from typing import Annotated

from fastapi import APIRouter, Body, Path, status

from core.request import ClientIp
from infrastructure.enums import NEXT_STAGE, Role
from training.dependencies import StaffDep as Staff, AttestationsDep
from training.domain.attestations import Decision
from training.features.schemas import AttestationOut, BoardOut, BoardRowOut, DecisionIn, GroupOut, StageOut

router = APIRouter(prefix="/training", tags=["Промежуточная аттестация"])


@router.get("/groups/{group_id}/attestation", summary="Аттестационная ведомость группы")
async def board(group_id: Annotated[int, Path()], user: Staff, attestations: AttestationsDep) -> BoardOut:
    """Кто из группы выполнил нормативы следующего этапа и в какие группы его можно перевести."""
    report = await attestations.board(user.id, Role.FEDERATION in user.roles, group_id)
    target = NEXT_STAGE.get(report.group.stage)
    return BoardOut(
        group=GroupOut.of(report.group, len(report.rows)),
        target_stage=StageOut.of(target) if target else None,
        rows=sorted((BoardRowOut.of(enrollment, row) for enrollment, row in report.rows),
                    key=lambda row: (not row.ready, row.athlete.name)),
        targets=[GroupOut.of(item) for item in report.targets],
        history=[AttestationOut.of(item) for item in report.history],
    )


@router.post("/attestations", status_code=status.HTTP_201_CREATED, summary="Оформить итог аттестации")
async def decide(body: Annotated[DecisionIn, Body()], user: Staff, ip: ClientIp, attestations: AttestationsDep) -> AttestationOut:
    """Фиксирует итог аттестации; при переводе зачисляет в группу следующего этапа."""
    decision = Decision(body.athlete_id, body.group_id, body.result, body.target_group_id, body.on, body.order_number,
                        body.comment)
    return AttestationOut.of(await attestations.decide(user.id, Role.FEDERATION in user.roles, decision, ip))
