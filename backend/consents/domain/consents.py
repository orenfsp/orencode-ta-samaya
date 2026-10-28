from collections.abc import Sequence
from datetime import UTC, date, datetime
from uuid import UUID
from zoneinfo import ZoneInfo

from audit.domain.actions import AuditAction
from audit.domain.audit import Audit
from consents.repositories.pg_consents import ConsentRepository
from core.database import UnitOfWork
from core.errors import InvalidStatus, NotFound, ValidationFailed
from files.domain.files import Files
from infrastructure.enums import ConsentStatus
from infrastructure.account.guardian_consent import GuardianConsentModel
from infrastructure.account.user import UserModel
from notifications.domain.notifications import Notifications
from notifications.domain.types import NotificationType

S = ConsentStatus
ADULT_AGE = 18


def is_minor(birth_date: date, on: date | None = None) -> bool:
    """True, если на указанную дату (по умолчанию сегодня по Оренбургу) человеку ещё нет 18 лет."""
    day = on or datetime.now(ZoneInfo("Asia/Yekaterinburg")).date()
    return day.year - birth_date.year - ((day.month, day.day) < (birth_date.month, birth_date.day)) < ADULT_AGE


class Consents:
    """Подача и модерация согласий законных представителей несовершеннолетних."""

    def __init__(
        self,
        uow: UnitOfWork,
        consents: ConsentRepository,
        files: Files,
        audit: Audit,
        notifications: Notifications,
    ) -> None:
        """Сохраняет зависимости."""
        self._uow = uow
        self._consents = consents
        self._files = files
        self._audit = audit
        self._notifications = notifications

    async def owner(self, user_id: UUID) -> UserModel | None:
        """Возвращает пользователя, которому принадлежит согласие."""
        return await self._consents.user(user_id)

    async def mine(self, user_id: UUID) -> GuardianConsentModel | None:
        """Возвращает согласие текущего пользователя, если оно подано."""
        return await self._consents.for_user(user_id)

    async def submit(
        self, user_id: UUID, guardian_name: str, guardian_phone: str, file_id: UUID, ip: str | None
    ) -> GuardianConsentModel:
        """Подаёт или обновляет согласие представителя для несовершеннолетнего пользователя."""
        user = await self._consents.user(user_id)
        if user is None:
            raise NotFound()
        if not is_minor(user.birth_date):
            raise ValidationFailed(fields={"file_id": ["Согласие нужно только до 18 лет"]})
        current = await self._consents.for_user(user.id)
        if current is not None and current.status == S.APPROVED:
            raise InvalidStatus("Согласие уже одобрено")
        attached = [current.file_id] if current else []
        items, problem = await self._files.usable(
            [file_id], user.id, False, Files.DOCUMENT_TYPES | Files.IMAGE_TYPES, attached
        )
        if problem:
            message = "Скан согласия — PDF, DOCX, JPEG, PNG или WebP" if problem == "type" else problem
            raise ValidationFailed(fields={"file_id": [message]})
        values = {
            "guardian_name": guardian_name,
            "guardian_phone": guardian_phone,
            "file_id": items[0].id,
            "status": S.PENDING,
            "reject_reason": None,
            "decided_by": None,
            "decided_at": None,
            "submitted_at": datetime.now(UTC),
        }
        if current is None:
            current = await self._consents.add(GuardianConsentModel(user_id=user.id, **values))
        else:
            await self._consents.update(current, values)
        await self._audit.write(
            AuditAction.CONSENT_SUBMIT,
            user_id=user.id,
            object_type="guardian_consent",
            object_id=current.id,
            payload={"guardian_name": guardian_name},
            ip=ip,
        )
        await self._notifications.consent_submitted(user.id)
        await self._uow.commit()
        return await self._reload(user.id)

    async def queue(
        self, status: ConsentStatus | None, search: str | None, limit: int, offset: int
    ) -> tuple[Sequence[tuple[GuardianConsentModel, UserModel]], int]:
        """Страница согласий на модерации по фильтрам статуса и поиска, с общим количеством."""
        return await self._consents.list(status, search.strip() if search else None, limit, offset)

    async def pending_count(self) -> int:
        """Количество согласий в ожидании."""
        return await self._consents.pending_count()

    async def approve(self, actor_id: UUID, consent_id: UUID, ip: str | None) -> GuardianConsentModel:
        """Одобряет согласие."""
        return await self._decide(actor_id, consent_id, S.APPROVED, None, ip)

    async def reject(self, actor_id: UUID, consent_id: UUID, reason: str, ip: str | None) -> GuardianConsentModel:
        """Отклоняет согласие с указанием причины."""
        return await self._decide(actor_id, consent_id, S.REJECTED, reason, ip)

    async def _decide(
        self, actor_id: UUID, consent_id: UUID, status: ConsentStatus, reason: str | None, ip: str | None
    ) -> GuardianConsentModel:
        """Переводит согласие в ожидании в указанный статус, пишет аудит и уведомляет пользователя."""
        item = await self._consents.lock(consent_id)
        if item is None:
            raise NotFound()
        if item.status != S.PENDING:
            raise InvalidStatus("Решение по согласию уже принято")
        await self._consents.update(
            item,
            {"status": status, "reject_reason": reason, "decided_by": actor_id, "decided_at": datetime.now(UTC)},
        )
        approved = status == S.APPROVED
        await self._audit.write(
            AuditAction.CONSENT_APPROVE if approved else AuditAction.CONSENT_REJECT,
            user_id=actor_id,
            object_type="guardian_consent",
            object_id=item.id,
            payload={"owner_id": str(item.user_id), "reason": reason} if reason else {"owner_id": str(item.user_id)},
            ip=ip,
        )
        await self._notifications.consent_decided(
            item.user_id,
            actor_id,
            NotificationType.CONSENT_APPROVED if approved else NotificationType.CONSENT_REJECTED,
            reason,
        )
        await self._uow.commit()
        return await self._reload(item.user_id)

    async def _reload(self, user_id: UUID) -> GuardianConsentModel:
        """Загружает актуальное согласие пользователя после изменения; NotFound, если его нет."""
        item = await self._consents.for_user(user_id)
        if item is None:
            raise NotFound()
        return item
