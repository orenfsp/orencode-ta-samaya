from collections.abc import Sequence
from typing import Any
from uuid import UUID

from sqlalchemy.orm import class_mapper

from audit.domain.actions import AuditAction
from audit.domain.audit import Audit
from core.database import UnitOfWork
from core.errors import InUse, NameTaken, NotFound, ValidationFailed
from dictionaries.repositories.pg_dictionaries import DictionaryRepository
from infrastructure.base import DictionaryColumns
from infrastructure.dictionaries.dictionary_academic_group import DictionaryAcademicGroupModel
from infrastructure.dictionaries.dictionary_age_group import DictionaryAgeGroupModel
from infrastructure.dictionaries.dictionary_contest_format import DictionaryContestFormatModel
from infrastructure.dictionaries.dictionary_contest_level import DictionaryContestLevelModel
from infrastructure.dictionaries.dictionary_contest_type import DictionaryContestTypeModel
from infrastructure.dictionaries.dictionary_discipline import DictionaryDisciplineModel
from infrastructure.dictionaries.dictionary_judge_category import DictionaryJudgeCategoryModel
from infrastructure.dictionaries.dictionary_judge_position import DictionaryJudgePositionModel
from infrastructure.dictionaries.dictionary_municipality import DictionaryMunicipalityModel
from infrastructure.dictionaries.dictionary_organization_type import DictionaryOrganizationTypeModel
from infrastructure.dictionaries.dictionary_rank_type import DictionaryRankTypeModel
from infrastructure.enums import RankKind

SERVICE_COLUMNS = frozenset({"id", "is_archived", "created_at", "updated_at"})


class Dictionary:
    """Создание, изменение, архивация и удаление записей во всех справочниках системы."""

    REGISTRY: dict[str, tuple[str, type[DictionaryColumns]]] = {
        "disciplines": ("Дисциплины", DictionaryDisciplineModel),
        "municipalities": ("Муниципалитеты", DictionaryMunicipalityModel),
        "organization_types": ("Типы организаций", DictionaryOrganizationTypeModel),
        "academic_groups": ("Академические группы", DictionaryAcademicGroupModel),
        "age_groups": ("Возрастные группы", DictionaryAgeGroupModel),
        "contest_types": ("Типы соревнований", DictionaryContestTypeModel),
        "contest_levels": ("Уровни соревнований", DictionaryContestLevelModel),
        "contest_formats": ("Форматы проведения", DictionaryContestFormatModel),
        "rank_types": ("Разряды и звания", DictionaryRankTypeModel),
        "judge_categories": ("Судейские категории", DictionaryJudgeCategoryModel),
        "judge_positions": ("Судейские должности", DictionaryJudgePositionModel),
    }

    def __init__(self, uow: UnitOfWork, repository: DictionaryRepository, audit: Audit) -> None:
        """Сохраняет зависимости."""
        self._uow = uow
        self._repository = repository
        self._audit = audit

    @classmethod
    def catalog(cls) -> list[tuple[str, str]]:
        """Список всех справочников: ключ и название."""
        return [(key, title) for key, (title, _) in cls.REGISTRY.items()]

    @classmethod
    def model(cls, key: str) -> type[DictionaryColumns]:
        """Модель справочника по ключу; NotFound, если такого справочника нет."""
        if key not in cls.REGISTRY:
            raise NotFound()
        return cls.REGISTRY[key][1]

    async def list(self, key: str, include_archived: bool) -> Sequence[DictionaryColumns]:
        """Список записей справочника, с архивными или без."""
        return await self._repository.list(self.model(key), include_archived)

    async def create(self, key: str, fields: dict[str, Any], user_id: UUID, ip: str | None) -> DictionaryColumns:
        """Создаёт запись справочника, проверив правила и уникальность имени."""
        model = self.model(key)
        self._check_rules(model, fields)
        await self._ensure_name_free(model, fields["name"])
        item = await self._repository.add(model(**fields))
        await self._write_audit(AuditAction.DICTIONARY_CREATE, key, item, user_id, ip, values=fields)
        await self._uow.commit()
        return item

    async def update(
        self, key: str, item_id: int, fields: dict[str, Any], user_id: UUID, ip: str | None
    ) -> DictionaryColumns:
        """Обновляет запись справочника, проверив правила и уникальность имени, пишет изменённые поля в аудит."""
        model = self.model(key)
        item = await self._get(model, item_id)
        before = self._values(item)
        self._check_rules(model, {**before, **fields})
        if "name" in fields and not item.is_archived:
            await self._ensure_name_free(model, fields["name"], exclude_id=item.id)
        item = await self._repository.update(item, fields)
        changes = {field: {"old": before[field], "new": value} for field, value in fields.items() if before[field] != value}
        await self._write_audit(AuditAction.DICTIONARY_UPDATE, key, item, user_id, ip, values=changes)
        await self._uow.commit()
        return item

    async def archive(self, key: str, item_id: int, user_id: UUID, ip: str | None) -> DictionaryColumns:
        """Архивирует запись справочника, если она ещё не архивирована."""
        item = await self._get(self.model(key), item_id)
        if not item.is_archived:
            item = await self._repository.update(item, {"is_archived": True})
            await self._write_audit(AuditAction.DICTIONARY_ARCHIVE, key, item, user_id, ip)
            await self._uow.commit()
        return item

    async def restore(self, key: str, item_id: int, user_id: UUID, ip: str | None) -> DictionaryColumns:
        """Восстанавливает запись из архива, проверив, что имя снова свободно."""
        model = self.model(key)
        item = await self._get(model, item_id)
        if item.is_archived:
            await self._ensure_name_free(model, item.name, exclude_id=item.id)
            item = await self._repository.update(item, {"is_archived": False})
            await self._write_audit(AuditAction.DICTIONARY_RESTORE, key, item, user_id, ip)
            await self._uow.commit()
        return item

    async def delete(self, key: str, item_id: int, user_id: UUID, ip: str | None) -> None:
        """Удаляет запись справочника; InUse, если она используется."""
        item = await self._get(self.model(key), item_id)
        values = self._values(item)
        item_id, name = item.id, item.name
        if not await self._repository.delete(item):
            await self._uow.rollback()
            raise InUse()
        await self._audit.write(
            AuditAction.DICTIONARY_DELETE,
            user_id=user_id,
            object_type=key,
            payload={"id": item_id, "name": name, "values": values},
            ip=ip,
        )
        await self._uow.commit()

    async def active[M: DictionaryColumns](self, model: type[M], item_id: int | None) -> M | None:
        """Возвращает запись, если она есть и не архивирована; None, если id пуст, записи нет или она в архиве."""
        if item_id is None:
            return None
        item = await self._repository.get(model, item_id)
        return item if item is not None and not item.is_archived else None

    async def _get[M: DictionaryColumns](self, model: type[M], item_id: int) -> M:
        """Возвращает запись по id; NotFound, если её нет."""
        item = await self._repository.get(model, item_id)
        if item is None:
            raise NotFound()
        return item

    async def _ensure_name_free(
        self, model: type[DictionaryColumns], name: str, exclude_id: int | None = None
    ) -> None:
        """Проверяет, что имя не занято активной записью; NameTaken, если занято."""
        if await self._repository.find_active(model, name, exclude_id) is not None:
            raise NameTaken()

    @staticmethod
    def _values(item: DictionaryColumns) -> dict[str, Any]:
        """Значения всех пользовательских колонок записи без служебных полей."""
        columns = class_mapper(type(item)).column_attrs.keys()
        return {column: getattr(item, column) for column in columns if column not in SERVICE_COLUMNS}

    @staticmethod
    def _check_rules(model: type[DictionaryColumns], data: dict[str, Any]) -> None:
        """Проверяет специфичные для типа справочника правила (сроки разрядов, границы возрастных групп)."""
        errors: dict[str, list[str]] = {}
        if model is DictionaryRankTypeModel:
            lifetime = bool(data.get("is_lifetime"))
            if not lifetime and data.get("validity_months") is None:
                errors["validity_months"] = ["Укажите срок действия"]
            if lifetime and data.get("validity_months") is not None:
                errors["validity_months"] = ["У пожизненного звания срока нет"]
            if data.get("rank_kind") != RankKind.TITLE and data.get("min_age") is None:
                errors["min_age"] = ["Укажите минимальный возраст"]
            if data.get("rank_kind") != RankKind.YOUTH and data.get("valid_until_age") is not None:
                errors["valid_until_age"] = ["Только для юношеских разрядов"]
        if model is DictionaryAgeGroupModel:
            min_age, max_age = data.get("min_age"), data.get("max_age")
            if min_age is None and max_age is None:
                errors["min_age"] = ["Укажите хотя бы одну границу"]
            if min_age is not None and max_age is not None and max_age < min_age:
                errors["max_age"] = ["Не может быть меньше «от»"]
        if errors:
            raise ValidationFailed(fields=errors)

    async def _write_audit(
        self,
        action: AuditAction,
        key: str,
        item: DictionaryColumns,
        user_id: UUID,
        ip: str | None,
        values: dict[str, Any] | None = None,
    ) -> None:
        """Пишет действие над записью справочника в аудит."""
        payload: dict[str, Any] = {"id": item.id, "name": item.name}
        if values:
            payload["values"] = values
        await self._audit.write(action, user_id=user_id, object_type=key, payload=payload, ip=ip)
