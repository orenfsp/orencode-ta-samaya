from collections.abc import Sequence
from typing import Annotated
from urllib.parse import quote

from fastapi import APIRouter, Path, Response

from documents.dependencies import DocumentsDep
from documents.features.public.schemas import ContestRefOut, DocumentOut, FormOut, GroupList, GroupOut, ItemOut
from infrastructure.participation.document import DocumentModel
from infrastructure.enums import DOCUMENT_KIND_TITLES, DocumentKind

router = APIRouter(tags=["Документы: публично"])
Token = Annotated[str, Path(min_length=8, max_length=32)]


def pdf_response(filename: str, content: bytes) -> Response:
    """Оборачивает байты PDF в ответ для показа в браузере."""
    disposition = f"inline; filename*=UTF-8''{quote(filename)}"
    return Response(content, media_type="application/pdf", headers={"Content-Disposition": disposition})


def groups(items: Sequence[DocumentModel]) -> GroupList:
    """Группирует документы по виду для показа списком."""
    result: dict[DocumentKind, GroupOut] = {}
    for item in items:
        group = result.setdefault(
            item.kind,
            GroupOut(
                kind=item.kind,
                kind_title=DOCUMENT_KIND_TITLES[item.kind],
                form=FormOut(**item.data["form"]),
                items=[],
            ),
        )
        who = item.data["recipient"]
        group.items.append(
            ItemOut(
                token=item.token,
                number=item.number,
                name=who["short"],
                role=who["role"],
                team=who["team"],
                place=who["place"],
            )
        )
    return GroupList(items=[result[kind] for kind in DocumentKind if kind in result])


@router.get("/contests/{contest_id}/documents", summary="Документы соревнования")
async def contest_documents(contest_id: Annotated[int, Path()], documents: DocumentsDep) -> GroupList:
    """Отдаёт документы соревнования, сгруппированные по виду."""
    _, items = await documents.public(contest_id)
    return groups(items)


@router.get("/contests/{contest_id}/documents/{kind}/pdf", summary="Все документы вида одним PDF", response_class=Response)
async def contest_kind_pdf(
    contest_id: Annotated[int, Path()], kind: Annotated[DocumentKind, Path()], documents: DocumentsDep
) -> Response:
    """Отдаёт все документы соревнования данного вида одним PDF-файлом."""
    return pdf_response(*await documents.contest_pdf(contest_id, kind))


@router.get("/documents/{token}", summary="Проверка документа")
async def verify(token: Token, documents: DocumentsDep) -> DocumentOut:
    """Проверяет подлинность документа по токену и отдаёт его данные."""
    item = await documents.get(token)
    form, who = item.data["form"], item.data["recipient"]
    return DocumentOut(
        valid=documents.is_valid(item),
        token=item.token,
        number=item.number,
        kind=item.kind,
        kind_title=DOCUMENT_KIND_TITLES[item.kind],
        title=form["title"],
        lead=form["lead"],
        text=form["text"],
        issued_on=form["issued_on"],
        signer_position=form["signer_position"],
        signer_name=form["signer_name"],
        recipient=who["short"],
        role=who["role"],
        team=who["team"],
        place=who["place"],
        athletes=who["athletes"],
        position=who.get("position"),
        panel=who.get("panel", []),
        contest=ContestRefOut(**item.data["contest"]),
    )


@router.get("/documents/{token}/pdf", summary="PDF документа", response_class=Response)
async def document_pdf(token: Token, documents: DocumentsDep) -> Response:
    """Отдаёт PDF одного документа по токену."""
    return pdf_response(*await documents.pdf(token))
