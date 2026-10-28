from typing import Annotated, Literal

from fastapi import APIRouter, Body, Query

from auth.dependencies import CurrentUserDep
from documents.dependencies import DocumentsDep
from documents.features.mine.schemas import AvailableOut, ContestRefOut, MyDocumentOut, MyDocuments, ReferenceIn
from infrastructure.contests.contest import ContestModel
from infrastructure.participation.document import DocumentModel
from infrastructure.enums import DOCUMENT_KIND_TITLES, DocumentKind

router = APIRouter(prefix="/me/documents", tags=["Документы: мои"])


def _dates(contest: ContestModel) -> str:
    """Форматирует период соревнования: одна дата или диапазон."""
    starts, ends = contest.starts_on, contest.ends_on
    return f"{starts:%d.%m.%Y}" if starts == ends else f"{starts:%d.%m.%Y} — {ends:%d.%m.%Y}"


def _out(item: DocumentModel) -> MyDocumentOut:
    """Собирает схему документа из снимка его данных."""
    contest, form, who = item.data["contest"], item.data["form"], item.data["recipient"]
    return MyDocumentOut(
        token=item.token,
        number=item.number,
        kind=item.kind,
        kind_title=DOCUMENT_KIND_TITLES[item.kind],
        title=form["title"],
        role=who["role"],
        place=who["place"],
        issued_on=form["issued_on"],
        contest=ContestRefOut(id=contest["id"], title=contest["title"], dates=contest["dates"]),
    )


@router.get("", summary="Мои документы (sort=new|old по дате выдачи, kind) и соревнования, по которым можно получить справку")
async def mine(
    user: CurrentUserDep,
    documents: DocumentsDep,
    sort: Annotated[Literal["new", "old"], Query()] = "new",
    kind: Annotated[DocumentKind | None, Query()] = None,
) -> MyDocuments:
    """Отдаёт документы текущего пользователя и соревнования, по которым можно получить справку."""
    return MyDocuments(
        items=[_out(item) for item in await documents.mine(user.id, kind, sort == "old")],
        available=[
            AvailableOut(contest=ContestRefOut(id=contest.id, title=contest.title, dates=_dates(contest)))
            for contest in await documents.available(user.id)
        ],
    )


@router.post("/reference", summary="Получить справку об участии")
async def reference(body: Annotated[ReferenceIn, Body()], user: CurrentUserDep, documents: DocumentsDep) -> list[MyDocumentOut]:
    """Выдаёт текущему пользователю справку об участии в соревновании."""
    return [_out(item) for item in await documents.request_reference(user.id, body.contest_id)]
