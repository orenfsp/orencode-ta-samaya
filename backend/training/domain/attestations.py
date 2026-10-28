from collections.abc import Sequence
from dataclasses import dataclass
from datetime import date
from uuid import UUID

from audit.domain.actions import AuditAction
from audit.domain.audit import Audit
from core.database import UnitOfWork
from core.errors import AppError, InvalidStatus, NotFound, ValidationFailed
from infrastructure.enums import ATTESTATION_RESULT_TITLES, NEXT_STAGE, TRAINING_STAGE_TITLES, AttestationResult
from infrastructure.training.attestation import AttestationModel
from infrastructure.training.group_enrollment import GroupEnrollmentModel
from infrastructure.training.training_group import TrainingGroupModel
from notifications.domain.notifications import Notifications
from notifications.domain.types import NotificationType as T
from training.domain.access import Access, full_name, today
from training.domain.groups import Groups, Move
from training.domain.norms import Norms, Readiness
from training.repositories.pg_groups import GroupRepository
from training.repositories.pg_norms import NormRepository


class NotReady(AppError):
    status_code = 409
    code = "not_ready"
    message = "Спортсмен не выполнил нормативы следующего этапа. Перевести без них может только федерация с обоснованием"


@dataclass(frozen=True, slots=True)
class Board:
    group: TrainingGroupModel
    rows: Sequence[tuple[GroupEnrollmentModel, Readiness]]
    targets: Sequence[TrainingGroupModel]
    history: Sequence[AttestationModel]


@dataclass(frozen=True, slots=True)
class Decision:
    athlete_id: UUID
    group_id: int
    result: AttestationResult
    target_group_id: int | None
    on: date
    order_number: str | None
    comment: str | None


class Attestations:
    """Промежуточная аттестация: кто выполнил требования следующего этапа и оформление перевода."""

    def __init__(
        self,
        uow: UnitOfWork,
        groups: GroupRepository,
        norms_repository: NormRepository,
        group_service: Groups,
        norms: Norms,
        access: Access,
        audit: Audit,
        notifications: Notifications,
    ) -> None:
        """Сохраняет зависимости."""
        self._uow, self._groups, self._repository = uow, groups, norms_repository
        self._group_service, self._norms, self._access = group_service, norms, access
        self._audit, self._notifications = audit, notifications

    async def board(self, actor_id: UUID, is_federation: bool, group_id: int) -> Board:
        """Собирает аттестационную ведомость группы: нормативы следующего этапа по каждому спортсмену."""
        group = await self._group(group_id)
        self._access.group(actor_id, is_federation, group)
        target = NEXT_STAGE.get(group.stage)
        enrollments = [item for item in await self._groups.enrollments(group.id) if item.valid_to is None]
        report = await self._norms.readiness(group.stage, target, group.discipline_id, [item.athlete_id for item in enrollments])
        targets = await self._groups.search(None, None, group.discipline_id, target, True) if target else []
        targets = sorted(targets, key=lambda item: (item.organization_id != group.organization_id, item.name))
        return Board(
            group=group,
            rows=[(item, report[item.athlete_id]) for item in enrollments],
            targets=targets,
            history=await self._repository.attestations(group_id=group.id),
        )

    async def decide(self, actor_id: UUID, is_federation: bool, decision: Decision, ip: str | None) -> AttestationModel:
        """Фиксирует итог аттестации; при переводе зачисляет спортсмена в группу следующего этапа."""
        group = await self._group(decision.group_id)
        self._access.group(actor_id, is_federation, group)
        current = await self._groups.open_enrollment(group.id, decision.athlete_id)
        if current is None:
            raise ValidationFailed(fields={"athlete_id": ["Спортсмен сейчас не занимается в этой группе"]})
        if decision.on > today():
            raise ValidationFailed(fields={"on": ["Дата не может быть в будущем"]})
        comment = (decision.comment or "").strip() or None
        item = AttestationModel(
            athlete_id=decision.athlete_id, group_id=group.id, stage_from=group.stage, result=decision.result,
            decided_on=decision.on, order_number=decision.order_number, comment=comment, actor_id=actor_id,
        )
        if decision.result == AttestationResult.TRANSFERRED:
            target_stage = NEXT_STAGE.get(group.stage)
            if target_stage is None:
                raise InvalidStatus("Этап высшего спортивного мастерства — последний")
            target = await self._groups.get(decision.target_group_id, lock=True) if decision.target_group_id else None
            if target is None or target.stage != target_stage:
                raise ValidationFailed(fields={"target_group_id": [
                    f"Выберите группу этапа «{TRAINING_STAGE_TITLES[target_stage]}»"]})
            readiness = (await self._norms.readiness(group.stage, target_stage, group.discipline_id, [decision.athlete_id]))[decision.athlete_id]
            if not readiness.ready:
                if not is_federation:
                    raise NotReady()
                if comment is None:
                    raise ValidationFailed(fields={"comment": ["Укажите обоснование перевода без выполненных нормативов"]})
                item.is_override = True
            await self._group_service.move(actor_id, current, target, Move(decision.on, decision.order_number, comment))
            item.stage_to, item.target_group_id = target_stage, target.id
        self._repository.add(item)
        await self._repository.flush()
        await self._audit.write(AuditAction.ATTESTATION_DECIDE, actor_id, "attestation", item.id, {
            "athlete_id": str(decision.athlete_id), "athlete": full_name(current.athlete), "group_id": group.id,
            "result": decision.result.value, "stage_to": item.stage_to.value if item.stage_to else None,
            "override": item.is_override, "order_number": decision.order_number,
        }, ip)
        text = (f"{full_name(current.athlete)}: {ATTESTATION_RESULT_TITLES[decision.result].lower()}"
                + (f" «{TRAINING_STAGE_TITLES[item.stage_to]}»" if item.stage_to else "") + ".")
        await self._notifications.training(
            [decision.athlete_id, group.coach_id], actor_id, T.TRAINING_ATTESTATION, "Итоги промежуточной аттестации",
            text, "/cabinet/athlete/training",
        )
        await self._uow.commit()
        await self._repository.refresh(item)
        return item

    async def _group(self, group_id: int) -> TrainingGroupModel:
        """Возвращает группу или бросает NotFound."""
        group = await self._groups.get(group_id)
        if group is None:
            raise NotFound("Группа не найдена")
        return group
