from collections.abc import Sequence
from datetime import UTC, date, datetime
from typing import Any
from uuid import UUID
from zoneinfo import ZoneInfo

from audit.domain.actions import AuditAction
from audit.domain.audit import Audit
from auth.domain.roles import Roles
from auth.repositories.pg_users import UserRepository
from contests.repositories.pg_contests import ContestQuery, ContestRepository
from core.database import UnitOfWork
from core.errors import HasApplications, InvalidStatus, NotFound, PointsLocked, ValidationFailed
from dictionaries.domain.dictionaries import Dictionary
from files.domain.files import Files
from infrastructure.base import DictionaryColumns
from infrastructure.contests.contest import ContestModel
from infrastructure.contests.contest_photo import ContestPhotoModel
from infrastructure.dictionaries.dictionary_academic_group import DictionaryAcademicGroupModel
from infrastructure.dictionaries.dictionary_age_group import DictionaryAgeGroupModel
from infrastructure.dictionaries.dictionary_contest_format import DictionaryContestFormatModel
from infrastructure.dictionaries.dictionary_contest_level import DictionaryContestLevelModel
from infrastructure.dictionaries.dictionary_contest_type import DictionaryContestTypeModel
from infrastructure.dictionaries.dictionary_discipline import DictionaryDisciplineModel
from infrastructure.dictionaries.dictionary_municipality import DictionaryMunicipalityModel
from infrastructure.enums import ContestStatus, ParticipationType, Role, VerificationStatus
from infrastructure.services.file import FileModel
from notifications.domain.notifications import Notifications
from notifications.domain.types import NotificationType

S = ContestStatus
V = VerificationStatus


def _now() -> datetime:
    """Возвращает текущее время в UTC."""
    return datetime.now(UTC)


def _plain(value: Any) -> Any:
    """Приводит дату, время, UUID или их список к простым JSON-сериализуемым значениям."""
    if isinstance(value, date | datetime):
        return value.isoformat()
    if isinstance(value, UUID):
        return str(value)
    if isinstance(value, list | tuple):
        return [_plain(item) for item in value]
    return value


class Contest:
    """Домен соревнований: создание, редактирование, переходы статусов и верификация с начислением рейтинга."""

    REFERENCES: dict[str, type[DictionaryColumns]] = {
        "discipline_id": DictionaryDisciplineModel,
        "contest_type_id": DictionaryContestTypeModel,
        "contest_level_id": DictionaryContestLevelModel,
        "contest_format_id": DictionaryContestFormatModel,
        "municipality_id": DictionaryMunicipalityModel,
    }
    GROUPS: dict[str, tuple[str, type[DictionaryColumns]]] = {
        "age_group_ids": ("age_groups", DictionaryAgeGroupModel),
        "academic_group_ids": ("academic_groups", DictionaryAcademicGroupModel),
    }
    RATING_FIELDS = frozenset(
        {
            "discipline_id",
            "contest_level_id",
            "participation_type",
            "team_size_min",
            "team_size_max",
            "age_group_ids",
            "academic_group_ids",
            "starts_on",
            "ends_on",
        }
    )
    PUBLIC_STATUSES = frozenset(set(S) - {S.DRAFT, S.ARCHIVED})
    NOT_DELETABLE = frozenset({S.IN_PROGRESS, S.COMPLETED, S.ARCHIVED})
    TRANSITIONS: dict[str, tuple[frozenset[ContestStatus], ContestStatus]] = {
        "publish": (frozenset({S.DRAFT}), S.PUBLISHED),
        "unpublish": (frozenset({S.PUBLISHED}), S.DRAFT),
        "open_registration": (frozenset({S.PUBLISHED, S.REGISTRATION_CLOSED}), S.REGISTRATION_OPEN),
        "close_registration": (frozenset({S.REGISTRATION_OPEN}), S.REGISTRATION_CLOSED),
        "start": (frozenset({S.PUBLISHED, S.REGISTRATION_OPEN, S.REGISTRATION_CLOSED}), S.IN_PROGRESS),
        "complete": (frozenset({S.IN_PROGRESS}), S.COMPLETED),
        "cancel": (frozenset({S.DRAFT, S.PUBLISHED, S.REGISTRATION_OPEN, S.REGISTRATION_CLOSED}), S.CANCELLED),
        "archive": (frozenset({S.COMPLETED, S.CANCELLED}), S.ARCHIVED),
    }
    DEFAULT_RATING_POINTS: dict[str, list[int]] = {
        "Международное": [100, 80, 60],
        "Всероссийское": [100, 80, 60],
        "Межрегиональное": [60, 45, 30],
        "Региональное": [40, 30, 20],
    }
    FALLBACK_RATING_POINTS = [40, 30, 20]
    MAX_PHOTOS = 10
    FILE_FIELDS = frozenset({"regulations_file_id", "photo_file_ids"})

    def __init__(
        self,
        uow: UnitOfWork,
        contests: ContestRepository,
        users: UserRepository,
        dictionary: Dictionary,
        files: Files,
        audit: Audit,
        notifications: Notifications,
    ) -> None:
        """Сохраняет зависимости."""
        self._uow = uow
        self._contests = contests
        self._users = users
        self._dictionary = dictionary
        self._files = files
        self._audit = audit
        self._notifications = notifications

    @classmethod
    def points_for_level(cls, level_name: str) -> list[dict[str, int]]:
        """Возвращает баллы рейтинга по умолчанию за места для уровня соревнования."""
        values = cls.DEFAULT_RATING_POINTS.get(level_name, cls.FALLBACK_RATING_POINTS)
        return [{"place": place, "points": points} for place, points in enumerate(values, start=1)]

    async def default_rating_points(self) -> list[tuple[DictionaryColumns, list[dict[str, int]]]]:
        """Возвращает все уровни соревнований с баллами рейтинга по умолчанию для каждого."""
        levels = await self._dictionary.list("contest_levels", include_archived=False)
        return [(level, self.points_for_level(level.name)) for level in levels]

    async def list_public(self, query: ContestQuery, limit: int, offset: int) -> tuple[Sequence[ContestModel], int]:
        """Возвращает страницу опубликованных соревнований по фильтру."""
        query.statuses = query.statuses & self.PUBLIC_STATUSES if query.statuses else self.PUBLIC_STATUSES
        query.today = datetime.now(ZoneInfo("Asia/Yekaterinburg")).date()
        return await self._contests.list(query, limit, offset)

    async def get_public(self, contest_id: int) -> ContestModel:
        """Возвращает опубликованное соревнование по id, иначе NotFound."""
        item = await self._contests.get(contest_id)
        if item is None or item.status not in self.PUBLIC_STATUSES:
            raise NotFound()
        return item

    async def list_for_organizer(
        self, user_id: UUID, query: ContestQuery, limit: int, offset: int
    ) -> tuple[Sequence[ContestModel], int]:
        """Возвращает страницу соревнований организатора по фильтру."""
        query.organizer_id = user_id
        query.today = datetime.now(ZoneInfo("Asia/Yekaterinburg")).date()
        return await self._contests.list(query, limit, offset)

    async def list_all(self, query: ContestQuery, limit: int, offset: int) -> tuple[Sequence[ContestModel], int]:
        """Возвращает страницу всех соревнований для федерации; ожидающие верификации — по умолчанию первыми."""
        if query.verification_status == V.PENDING and not query.order:
            query.order = [ContestModel.verification_requested_at.asc(), ContestModel.id.asc()]
        query.today = datetime.now(ZoneInfo("Asia/Yekaterinburg")).date()
        return await self._contests.list(query, limit, offset)

    async def get_for(self, user_id: UUID, is_federation: bool, contest_id: int) -> ContestModel:
        """Возвращает соревнование, если пользователь — его организатор или федерация."""
        return await self._own(user_id, is_federation, contest_id)

    async def create(
        self, user_id: UUID, is_federation: bool, fields: dict[str, Any], ip: str | None
    ) -> ContestModel:
        """Создаёт соревнование в статусе черновика; федерация может сразу верифицировать его с баллами рейтинга."""
        data = dict(fields)
        rating_points = data.pop("rating_points", None)
        organizer_id = data.pop("organizer_id", None) or user_id
        errors: dict[str, list[str]] = {}
        await self._check_organizer(organizer_id, errors)
        resolved = await self._resolve(data, errors)
        groups = await self._resolve_groups(data, errors)
        attachments = await self._resolve_files(None, data, user_id, is_federation, errors)
        self._validate(data, resolved.get("contest_format_id"), errors)
        if rating_points is not None:
            self._validate_points(rating_points, errors)
        if errors:
            raise ValidationFailed(fields=errors)
        scalars = {key: value for key, value in data.items() if key not in self.GROUPS and key not in self.FILE_FIELDS}
        item = await self._contests.add(
            ContestModel(
                **scalars,
                **groups,
                **attachments,
                organizer_id=organizer_id,
                created_by=user_id,
                status=S.DRAFT,
                verification_status=V.NOT_REQUESTED,
            )
        )
        if is_federation and rating_points is not None:
            await self._set_verified(item, user_id, rating_points)
        await self._write_audit(AuditAction.CONTEST_CREATE, item, user_id, ip, {"title": item.title})
        await self._uow.commit()
        return await self._reload(item.id)

    async def update(
        self, user_id: UUID, is_federation: bool, contest_id: int, fields: dict[str, Any], ip: str | None
    ) -> ContestModel:
        """Обновляет поля соревнования; изменение рейтинговых полей верифицированного соревнования снимает верификацию."""
        item = await self._own(user_id, is_federation, contest_id, lock=True)
        if item.status == S.ARCHIVED:
            raise InvalidStatus()
        data = dict(fields)
        current = self._snapshot(item)
        merged = {**current, **data}
        errors: dict[str, list[str]] = {}
        if "organizer_id" in data:
            await self._check_organizer(data["organizer_id"], errors)
        resolved = await self._resolve(data, errors)
        groups = await self._resolve_groups(data, errors)
        attachments = await self._resolve_files(item, data, user_id, is_federation, errors)
        format_item = resolved.get("contest_format_id", item.contest_format)
        self._validate(merged, format_item, errors)
        if errors:
            raise ValidationFailed(fields=errors)
        changed = {key: {"old": _plain(current.get(key)), "new": _plain(value)} for key, value in data.items() if current.get(key) != value}
        scalars = {key: value for key, value in data.items() if key not in self.GROUPS and key not in self.FILE_FIELDS}
        old_files = list(item.files)
        await self._contests.update(item, {**scalars, **groups, **attachments})
        await self._sync_files(item, removed=[file for file in old_files if file not in item.files])
        if not is_federation and item.verification_status == V.VERIFIED and self.RATING_FIELDS & changed.keys():
            await self._contests.update(
                item, {"verification_status": V.PENDING, "verification_requested_at": _now()}
            )
            await self._write_audit(
                AuditAction.CONTEST_VERIFICATION, item, user_id, ip,
                {"from": V.VERIFIED.value, "to": V.PENDING.value, "reason": "Изменены поля, влияющие на рейтинг"},
            )
            await self._notifications.contest_verification_requested(user_id, item.title, edited=True)
        await self._write_audit(AuditAction.CONTEST_UPDATE, item, user_id, ip, {"changes": changed})
        await self._uow.commit()
        return await self._reload(item.id)

    async def delete(self, user_id: UUID, is_federation: bool, contest_id: int, ip: str | None) -> None:
        """Удаляет соревнование без заявок, если его статус допускает удаление."""
        item = await self._own(user_id, is_federation, contest_id, lock=True)
        if item.status in self.NOT_DELETABLE:
            raise InvalidStatus()
        if await self._contests.has_applications(item.id):
            raise HasApplications()
        payload = {"id": item.id, "title": item.title, "status": item.status.value}
        await self._files.set_public(item.files, False)
        await self._contests.delete(item)
        await self._audit.write(
            AuditAction.CONTEST_DELETE, user_id=user_id, object_type="contest", payload=payload, ip=ip
        )
        await self._uow.commit()

    async def transition(
        self,
        user_id: UUID,
        is_federation: bool,
        contest_id: int,
        action: str,
        ip: str | None,
        reason: str | None = None,
    ) -> ContestModel:
        """Переводит соревнование в новый статус по имени действия, если переход разрешён из текущего статуса."""
        allowed_from, target = self.TRANSITIONS[action]
        item = await self._own(user_id, is_federation, contest_id, lock=True)
        if item.status not in allowed_from:
            raise InvalidStatus()
        previous = item.status
        values: dict[str, Any] = {"status": target}
        if target == S.PUBLISHED and item.published_at is None:
            values["published_at"] = _now()
        if target == S.CANCELLED:
            values["cancel_reason"] = reason
        await self._contests.update(item, values)
        await self._sync_files(item)
        await self._write_audit(
            AuditAction.CONTEST_STATUS, item, user_id, ip, {"from": previous.value, "to": target.value, "reason": reason}
        )
        if target == S.CANCELLED:
            participants = await self._contests.participant_ids(item.id)
            await self._notifications.contest_cancelled(participants, user_id, item.id, item.title, reason)
        await self._uow.commit()
        return await self._reload(item.id)

    async def request_verification(self, user_id: UUID, contest_id: int, ip: str | None) -> ContestModel:
        """Организатор отправляет соревнование на верификацию в федерацию."""
        item = await self._own(user_id, False, contest_id, lock=True)
        if item.verification_status not in (V.NOT_REQUESTED, V.REJECTED) or item.status == S.ARCHIVED:
            raise InvalidStatus()
        await self._change_verification(
            item, user_id, ip, V.PENDING, verification_requested_at=_now(), verification_reason=None
        )
        await self._notifications.contest_verification_requested(user_id, item.title, edited=False)
        await self._uow.commit()
        return await self._reload(item.id)

    async def verify(
        self, user_id: UUID, contest_id: int, rating_points: list[dict[str, int]] | None, ip: str | None
    ) -> ContestModel:
        """Федерация верифицирует соревнование и фиксирует баллы рейтинга за места."""
        item = await self._own(user_id, True, contest_id, lock=True)
        points = rating_points if rating_points is not None else self.points_for_level(item.contest_level.name)
        errors: dict[str, list[str]] = {}
        self._validate_points(points, errors)
        if errors:
            raise ValidationFailed(fields=errors)
        previous = item.verification_status
        await self._set_verified(item, user_id, points)
        await self._write_audit(
            AuditAction.CONTEST_VERIFICATION, item, user_id, ip, {"from": previous.value, "to": V.VERIFIED.value, "rating_points": points}
        )
        await self._notifications.contest_verification(
            item.organizer_id, user_id, NotificationType.CONTEST_VERIFIED, item.title
        )
        await self._uow.commit()
        return await self._reload(item.id)

    async def reject_verification(self, user_id: UUID, contest_id: int, reason: str, ip: str | None) -> ContestModel:
        """Федерация отклоняет заявку на верификацию с указанием причины."""
        item = await self._own(user_id, True, contest_id, lock=True)
        if item.verification_status != V.PENDING:
            raise InvalidStatus()
        await self._change_verification(item, user_id, ip, V.REJECTED, reason, verification_reason=reason)
        await self._notifications.contest_verification(
            item.organizer_id, user_id, NotificationType.CONTEST_VERIFICATION_REJECTED, item.title, reason
        )
        await self._uow.commit()
        return await self._reload(item.id)

    async def revoke_verification(self, user_id: UUID, contest_id: int, ip: str | None) -> ContestModel:
        """Снимает верификацию с соревнования и обнуляет начисленные по нему баллы рейтинга."""
        item = await self._own(user_id, True, contest_id, lock=True)
        if item.verification_status != V.VERIFIED:
            raise InvalidStatus()
        await self._change_verification(
            item, user_id, ip, V.NOT_REQUESTED, rating_points=None, verified_by=None, verified_at=None
        )
        await self._contests.reprice_results(item.id, None)
        await self._notifications.contest_verification(
            item.organizer_id, user_id, NotificationType.CONTEST_VERIFICATION_REVOKED, item.title
        )
        await self._uow.commit()
        return await self._reload(item.id)

    async def set_rating_points(
        self, user_id: UUID, contest_id: int, rating_points: list[dict[str, int]], ip: str | None
    ) -> ContestModel:
        """Баллы задаются при верификации и после неё зафиксированы: по ним уже считается рейтинг.
        Изменить их можно только через «снять верификацию → верифицировать заново»."""
        item = await self._own(user_id, True, contest_id, lock=True)
        if item.verification_status == V.VERIFIED:
            raise PointsLocked()
        raise InvalidStatus()

    async def _set_verified(self, item: ContestModel, user_id: UUID, points: list[dict[str, int]]) -> None:
        """Отмечает соревнование верифицированным и пересчитывает результаты по новым баллам."""
        await self._contests.update(
            item,
            {
                "verification_status": V.VERIFIED,
                "verification_reason": None,
                "verified_by": user_id,
                "verified_at": _now(),
                "rating_points": points,
            },
        )
        await self._contests.reprice_results(item.id, points)

    async def _change_verification(
        self,
        item: ContestModel,
        user_id: UUID,
        ip: str | None,
        target: VerificationStatus,
        comment: str | None = None,
        **values: Any,
    ) -> None:
        """Меняет статус верификации соревнования и пишет это в журнал аудита."""
        previous = item.verification_status
        await self._contests.update(item, {"verification_status": target, **values})
        await self._write_audit(
            AuditAction.CONTEST_VERIFICATION, item, user_id, ip, {"from": previous.value, "to": target.value, "reason": comment}
        )

    async def _own(
        self, user_id: UUID, is_federation: bool, contest_id: int, lock: bool = False
    ) -> ContestModel:
        """Возвращает соревнование, если пользователь — его организатор или федерация; при lock блокирует строку."""
        item = await (self._contests.lock(contest_id) if lock else self._contests.get(contest_id))
        if item is None or (not is_federation and item.organizer_id != user_id):
            raise NotFound()
        return item

    async def _reload(self, contest_id: int) -> ContestModel:
        """Перечитывает соревнование из репозитория со связанными данными."""
        item = await self._contests.get(contest_id)
        if item is None:
            raise NotFound()
        return item

    async def _check_organizer(self, organizer_id: UUID, errors: dict[str, list[str]]) -> None:
        """Проверяет, что указанный пользователь имеет роль организатора или федерации."""
        user = await self._users.get(organizer_id)
        roles = Roles.granted_roles(user) if user else frozenset()
        if Role.ORGANIZER not in roles and Role.FEDERATION not in roles:
            errors["organizer_id"] = ["Организатор не найден или не подтверждён"]

    async def _resolve_files(
        self,
        item: ContestModel | None,
        data: dict[str, Any],
        user_id: UUID,
        is_federation: bool,
        errors: dict[str, list[str]],
    ) -> dict[str, Any]:
        """Проверяет и привязывает файл положения и фото соревнования, возвращая готовые для записи значения."""
        attached = [file.id for file in item.files] if item else []
        result: dict[str, Any] = {}
        if "regulations_file_id" in data:
            file_id = data["regulations_file_id"]
            found, problem = (
                await self._files.usable([file_id], user_id, is_federation, Files.DOCUMENT_TYPES, attached)
                if file_id
                else ([], None)
            )
            if problem:
                errors["regulations_file_id"] = [
                    "Загрузите положение в формате PDF или DOCX" if problem == "type" else problem
                ]
            else:
                result["regulations"] = found[0] if found else None
        if "photo_file_ids" in data:
            file_ids = list(dict.fromkeys(data["photo_file_ids"] or []))
            found, problem = await self._files.usable(file_ids, user_id, is_federation, Files.IMAGE_TYPES, attached)
            if len(file_ids) > self.MAX_PHOTOS:
                errors["photo_file_ids"] = [f"Не больше {self.MAX_PHOTOS} фото"]
            elif problem:
                errors["photo_file_ids"] = ["Только изображения JPEG, PNG или WebP" if problem == "type" else problem]
            else:
                existing = {photo.file_id: photo for photo in item.photos} if item else {}
                photos = []
                for position, file in enumerate(found):
                    photo = existing.get(file.id) or ContestPhotoModel(file=file)
                    photo.position = position
                    photos.append(photo)
                result["photos"] = photos
        return result

    async def _sync_files(self, item: ContestModel, removed: list[FileModel] | None = None) -> None:
        """Делает файлы соревнования публичными или приватными в зависимости от статуса; отвязанные скрывает."""
        await self._files.set_public(item.files, item.status in self.PUBLIC_STATUSES)
        if removed:
            await self._files.set_public(removed, False)

    async def _resolve(self, data: dict[str, Any], errors: dict[str, list[str]]) -> dict[str, DictionaryColumns]:
        """Подбирает активные записи справочников по id для полей вида discipline_id, contest_type_id и т. п."""
        resolved: dict[str, DictionaryColumns] = {}
        for field, model in self.REFERENCES.items():
            if field not in data or data[field] is None:
                continue
            item = await self._dictionary.active(model, data[field])
            if item is None:
                errors[field] = ["Выберите значение из справочника"]
            else:
                resolved[field] = item
        return resolved

    async def _resolve_groups(self, data: dict[str, Any], errors: dict[str, list[str]]) -> dict[str, list[Any]]:
        """Подбирает активные возрастные и академические группы по спискам id из справочников."""
        groups: dict[str, list[Any]] = {}
        for field, (relation, model) in self.GROUPS.items():
            if field not in data:
                continue
            items = []
            for item_id in dict.fromkeys(data[field] or []):
                item = await self._dictionary.active(model, item_id)
                if item is None:
                    errors[field] = ["Выберите значение из справочника"]
                    break
                items.append(item)
            groups[relation] = items
        return groups

    @staticmethod
    def _validate(data: dict[str, Any], format_item: DictionaryColumns | None, errors: dict[str, list[str]]) -> None:
        """Проверяет даты, место проведения, возрастные/академические группы и размер команды соревнования."""
        starts, ends = data.get("starts_on"), data.get("ends_on")
        opens, closes = data.get("registration_opens_at"), data.get("registration_closes_at")
        if starts and ends and ends < starts:
            errors.setdefault("ends_on", ["Не может быть раньше начала"])
        if opens and closes and closes <= opens:
            errors.setdefault("registration_closes_at", ["Должно быть позже открытия"])
        elif closes and starts and closes.date() > starts:
            errors.setdefault("registration_closes_at", ["Регистрация должна закрыться до начала соревнования"])
        online = format_item is not None and "онлайн" in format_item.name.lower()
        if format_item is not None and not online and data.get("municipality_id") is None:
            errors.setdefault("municipality_id", ["Укажите, где проводится"])
        if data.get("age_group_ids") and data.get("academic_group_ids"):
            errors.setdefault("academic_group_ids", ["Выберите либо возрастные, либо академические группы"])
        size_min, size_max = data.get("team_size_min"), data.get("team_size_max")
        if data.get("participation_type") == ParticipationType.TEAM:
            if size_min is None or size_max is None:
                errors.setdefault("team_size_max", ["Укажите размер команды"])
            elif size_max < size_min:
                errors.setdefault("team_size_max", ["Не может быть меньше минимума"])
        elif size_min is not None or size_max is not None:
            errors.setdefault("team_size_min", ["Только для командных соревнований"])

    @staticmethod
    def _validate_points(points: list[dict[str, int]], errors: dict[str, list[str]]) -> None:
        """Проверяет, что баллы рейтинга заданы за места подряд с 1, без повторов и без отрицательных значений."""
        places = [item["place"] for item in points]
        if not points:
            errors["rating_points"] = ["Укажите баллы хотя бы за одно место"]
        elif sorted(places) != list(range(1, len(places) + 1)):
            errors["rating_points"] = ["Места должны идти подряд с 1 без повторов"]
        elif any(item["points"] < 0 for item in points):
            errors["rating_points"] = ["Баллы не могут быть отрицательными"]

    @staticmethod
    def _snapshot(item: ContestModel) -> dict[str, Any]:
        """Снимает текущие значения изменяемых полей соревнования для сравнения при обновлении."""
        columns = [
            "title",
            "description",
            "discipline_id",
            "contest_type_id",
            "contest_level_id",
            "contest_format_id",
            "participation_type",
            "team_size_min",
            "team_size_max",
            "municipality_id",
            "venue",
            "starts_on",
            "ends_on",
            "registration_opens_at",
            "registration_closes_at",
            "prize_fund_text",
            "prize_fund_amount",
            "organizer_id",
        ]
        snapshot = {column: getattr(item, column) for column in columns}
        snapshot["age_group_ids"] = [group.id for group in item.age_groups]
        snapshot["academic_group_ids"] = [group.id for group in item.academic_groups]
        snapshot["regulations_file_id"] = item.regulations_file_id
        snapshot["photo_file_ids"] = [photo.file_id for photo in item.photos]
        return snapshot

    async def _write_audit(
        self, action: AuditAction, item: ContestModel, user_id: UUID, ip: str | None, values: dict[str, Any]
    ) -> None:
        """Пишет действие по соревнованию в журнал аудита."""
        await self._audit.write(
            action, user_id=user_id, object_type="contest", payload={"id": item.id, **values}, ip=ip
        )
