from datetime import datetime
from typing import Annotated
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Body, Depends, Path, Query, Response, status

from auth.dependencies import CurrentUser, require_role
from core.request import ClientIp
from documents.dependencies import DocumentsDep
from documents.domain.documents import DocumentForm
from documents.features.manage.schemas import FormIn
from documents.features.public.router import groups
from documents.features.public.schemas import GroupList
from infrastructure.enums import DocumentKind, Role

ContestId = Annotated[int, Path()]
Kind = Annotated[DocumentKind, Path()]


def _clean(value: str | None) -> str | None:
    """Обрезает пробелы и превращает пустую строку в None."""
    return (value or "").strip() or None


def _form(body: FormIn) -> DocumentForm:
    """Строит доменную форму документа из схемы запроса."""
    return DocumentForm(
        title=body.title.strip(),
        lead=_clean(body.lead),
        text=_clean(body.text),
        recipients=body.recipients,
        places_to=body.places_to,
        signer_position=_clean(body.signer_position),
        signer_name=_clean(body.signer_name),
        issued_on=body.issued_on or datetime.now(ZoneInfo("Asia/Yekaterinburg")).date(),
        judge_ids=[str(item) for item in body.judge_ids] if body.judge_ids is not None else None,
    )


def build(prefix: str, role: Role, tag: str) -> APIRouter:
    """Собирает роутер управления документами для указанной роли (организатор или федерация)."""
    router = APIRouter(prefix=prefix, tags=[tag])
    manager = require_role(role)
    federation = role == Role.FEDERATION

    @router.put("/contests/{contest_id}/documents/{kind}", summary="Выпустить документы вида (заменяет прежние)")
    async def issue(
        contest_id: ContestId,
        kind: Kind,
        body: Annotated[FormIn, Body()],
        user: Annotated[CurrentUser, Depends(manager)],
        ip: ClientIp,
        documents: DocumentsDep,
    ) -> GroupList:
        """Выпускает документы вида kind для соревнования, заменяя прежние."""
        return groups(await documents.issue(user.id, federation, contest_id, kind, _form(body), ip))

    @router.delete(
        "/contests/{contest_id}/documents/{kind}", summary="Убрать документы вида", status_code=status.HTTP_204_NO_CONTENT
    )
    async def remove(
        contest_id: ContestId,
        kind: Kind,
        user: Annotated[CurrentUser, Depends(manager)],
        ip: ClientIp,
        documents: DocumentsDep,
    ) -> None:
        """Убирает документы вида kind у соревнования."""
        await documents.remove(user.id, federation, contest_id, kind, ip)

    @router.get(
        "/contests/{contest_id}/documents/{kind}/preview", summary="Предпросмотр первой страницы", response_class=Response
    )
    async def preview(
        contest_id: ContestId,
        kind: Kind,
        query: Annotated[FormIn, Query()],
        user: Annotated[CurrentUser, Depends(manager)],
        documents: DocumentsDep,
    ) -> Response:
        """Строит предпросмотр первой страницы документа без сохранения."""
        content = await documents.preview(user.id, federation, contest_id, kind, _form(query))
        return Response(content, media_type="application/pdf")

    return router


organizer_router = build("/organizer", Role.ORGANIZER, "Документы: организатор")
admin_router = build("/admin", Role.FEDERATION, "Документы: федерация")
