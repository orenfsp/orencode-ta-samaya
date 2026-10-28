from collections.abc import Sequence
from typing import Any
from uuid import UUID

from audit.domain.actions import AuditAction
from audit.domain.audit import Audit
from core.database import UnitOfWork
from core.errors import NameTaken, NotFound, ValidationFailed
from dictionaries.repositories.pg_dictionaries import DictionaryRepository
from infrastructure.dictionaries.dictionary_municipality import DictionaryMunicipalityModel
from infrastructure.dictionaries.dictionary_organization_type import DictionaryOrganizationTypeModel
from infrastructure.sport.organization import OrganizationModel
from profiles.repositories.pg_organizations import OrganizationRepository

FIELDS = (
    "name", "short_name", "organization_type_id", "municipality_id", "inn", "address", "website",
    "license_number", "license_date", "is_active",
)


def mask_inn(value: str | None) -> str | None:
    """Скрывает середину ИНН для публичного списка."""
    return f"{value[:4]}{'•' * (len(value) - 6)}{value[-2:]}" if value and len(value) > 6 else value


class Organizations:
    """Справочник организаций: поиск, создание и правка федерацией."""

    def __init__(
        self, uow: UnitOfWork, organizations: OrganizationRepository, dictionary: DictionaryRepository, audit: Audit
    ) -> None:
        """Сохраняет зависимости."""
        self._uow, self._organizations, self._dictionary, self._audit = uow, organizations, dictionary, audit

    async def search(
        self, q: str | None, municipality_id: int | None, type_id: int | None, active_only: bool, limit: int, offset: int
    ) -> tuple[Sequence[OrganizationModel], int, dict[int, int]]:
        """Ищет организации с фильтрами и считает в них спортсменов."""
        items, total = await self._organizations.search(q, municipality_id, type_id, active_only, limit, offset)
        return items, total, await self._organizations.athletes_count([item.id for item in items])

    async def get(self, organization_id: int) -> OrganizationModel:
        """Возвращает организацию или бросает NotFound."""
        item = await self._organizations.get(organization_id)
        if item is None:
            raise NotFound("Организация не найдена")
        return item

    async def create(self, actor_id: UUID, data: dict[str, Any], ip: str | None) -> OrganizationModel:
        """Создаёт организацию после проверки и пишет действие в журнал."""
        await self._check(data, None)
        item = await self._organizations.add(OrganizationModel(**{name: data.get(name) for name in FIELDS if name in data}))
        await self._audit.write(AuditAction.ORGANIZATION_CREATE, actor_id, "organization", None,
                                {"id": item.id, "name": item.name}, ip)
        await self._uow.commit()
        return await self._organizations.refresh(item)

    async def update(self, actor_id: UUID, organization_id: int, data: dict[str, Any], ip: str | None) -> OrganizationModel:
        """Правит организацию после проверки и пишет действие в журнал."""
        item = await self.get(organization_id)
        await self._check(data, item)
        diff = {name: value for name, value in data.items() if name in FIELDS and getattr(item, name) != value}
        for name, value in diff.items():
            setattr(item, name, value)
        await self._organizations.flush()
        if diff:
            await self._audit.write(
                AuditAction.ORGANIZATION_UPDATE, actor_id, "organization", None,
                {"id": item.id, "fields": sorted(diff)}, ip,
            )
        await self._uow.commit()
        return await self._organizations.refresh(item)

    async def _check(self, data: dict[str, Any], current: OrganizationModel | None) -> None:
        """Проверяет название, ИНН и справочные ссылки; бросает ValidationFailed."""
        errors: dict[str, list[str]] = {}
        name = data.get("name")
        if name is not None:
            same = await self._organizations.by_name(name)
            if same is not None and (current is None or same.id != current.id):
                raise NameTaken("Организация с таким названием уже есть")
        elif current is None:
            errors["name"] = ["Укажите название"]
        type_id = data.get("organization_type_id")
        if type_id is not None:
            if await self._dictionary.get(DictionaryOrganizationTypeModel, type_id) is None:
                errors["organization_type_id"] = ["Выберите тип из справочника"]
        elif current is None:
            errors["organization_type_id"] = ["Выберите тип"]
        municipality_id = data.get("municipality_id")
        if municipality_id is not None and await self._dictionary.get(DictionaryMunicipalityModel, municipality_id) is None:
            errors["municipality_id"] = ["Выберите муниципалитет из справочника"]
        inn = data.get("inn")
        if inn and (not inn.isdigit() or len(inn) not in (10, 12)):
            errors["inn"] = ["ИНН — 10 или 12 цифр"]
        if errors:
            raise ValidationFailed(fields=errors)
