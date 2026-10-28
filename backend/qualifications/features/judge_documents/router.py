from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Body, Path, status

from auth.dependencies import CurrentUserDep
from core.request import ClientIp
from infrastructure.enums import JUDGE_DOCUMENT_KIND_TITLES
from infrastructure.qualifications.judge_document import JudgeDocumentModel
from qualifications.dependencies import JudgeDocumentsDep
from qualifications.domain.judge_documents import JudgeDocuments
from qualifications.features.judge_documents.schemas import JudgeDocumentIn, JudgeDocumentOut, JudgeDocumentUpdate

router = APIRouter(tags=["Документы судей к протоколу"])
ContestId = Annotated[int, Path()]
DocumentId = Annotated[UUID, Path()]


async def _out(documents: JudgeDocuments, item: JudgeDocumentModel) -> JudgeDocumentOut:
    """Собирает схему ответа по документу судьи, включая ссылку на файл."""
    judge, assignment = item.judge, item.assignment
    return JudgeDocumentOut(
        id=item.id,
        kind=item.kind,
        kind_title=JUDGE_DOCUMENT_KIND_TITLES[item.kind],
        judge_id=item.judge_id,
        judge_name=" ".join(part for part in (judge.last_name, judge.first_name, judge.middle_name) if part),
        position=assignment.position.name if assignment else None,
        removed=assignment is None or assignment.removed_at is not None,
        file_name=item.file.original_name,
        file_type=item.file.content_type,
        file_size=item.file.size,
        url=await documents.url(item),
        comment=item.comment,
        created_at=item.created_at,
        updated_at=item.updated_at,
    )


@router.get("/contests/{contest_id}/judge-documents", summary="Документы судейской коллегии")
async def of_contest(contest_id: ContestId, documents: JudgeDocumentsDep) -> list[JudgeDocumentOut]:
    """Возвращает документы судейской коллегии соревнования."""
    return [await _out(documents, item) for item in await documents.of_contest(contest_id)]


@router.post(
    "/contests/{contest_id}/judge-documents", status_code=status.HTTP_201_CREATED, summary="Загрузить документ судьи"
)
async def upload(
    contest_id: ContestId,
    body: Annotated[JudgeDocumentIn, Body()],
    user: CurrentUserDep,
    ip: ClientIp,
    documents: JudgeDocumentsDep,
) -> JudgeDocumentOut:
    """Загружает документ судьи к протоколу соревнования."""
    item = await documents.upload(user.id, contest_id, body.kind, body.file_id, body.comment, ip)
    return await _out(documents, item)


@router.patch("/judge-documents/{document_id}", summary="Заменить свой документ")
async def replace(
    document_id: DocumentId,
    body: Annotated[JudgeDocumentUpdate, Body()],
    user: CurrentUserDep,
    ip: ClientIp,
    documents: JudgeDocumentsDep,
) -> JudgeDocumentOut:
    """Заменяет свой документ судьи."""
    item = await documents.replace(user.id, document_id, body.kind, body.file_id, body.comment, ip)
    return await _out(documents, item)


@router.delete("/judge-documents/{document_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Удалить свой документ")
async def remove(document_id: DocumentId, user: CurrentUserDep, ip: ClientIp, documents: JudgeDocumentsDep) -> None:
    """Удаляет свой документ судьи."""
    await documents.remove(user.id, document_id, ip)
