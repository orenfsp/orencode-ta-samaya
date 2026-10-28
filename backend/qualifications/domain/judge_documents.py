from collections.abc import Sequence
from uuid import UUID

from audit.domain.actions import AuditAction
from audit.domain.audit import Audit
from contests.repositories.pg_contests import ContestRepository
from core.database import UnitOfWork
from core.errors import Forbidden, InvalidStatus, NotFound, ValidationFailed
from files.domain.files import Files
from infrastructure.contests.contest import ContestModel
from infrastructure.enums import ContestStatus, JudgeDocumentKind
from infrastructure.services.file import FileModel
from infrastructure.qualifications.judge_assignment import JudgeAssignmentModel
from infrastructure.qualifications.judge_document import JudgeDocumentModel
from qualifications.repositories.pg_judge_assignments import JudgeAssignmentRepository
from qualifications.repositories.pg_judge_documents import JudgeDocumentRepository

OPEN = frozenset({ContestStatus.IN_PROGRESS, ContestStatus.COMPLETED})


class JudgeDocuments:
    """Загрузка, замена и удаление документов судей, прикладываемых к протоколу соревнования."""

    TYPES = Files.DOCUMENT_TYPES | Files.IMAGE_TYPES

    def __init__(
        self,
        uow: UnitOfWork,
        documents: JudgeDocumentRepository,
        assignments: JudgeAssignmentRepository,
        contests: ContestRepository,
        files: Files,
        audit: Audit,
    ) -> None:
        """Сохраняет зависимости."""
        self._uow, self._documents, self._assignments = uow, documents, assignments
        self._contests, self._files, self._audit = contests, files, audit

    async def of_contest(self, contest_id: int) -> Sequence[JudgeDocumentModel]:
        """Возвращает документы судей соревнования, убедившись, что оно существует."""
        await self._contest(contest_id)
        return await self._documents.of_contest(contest_id)

    async def url(self, item: JudgeDocumentModel) -> str:
        """Возвращает ссылку на файл документа."""
        return await self._files.url(item.file)

    async def upload(
        self, actor_id: UUID, contest_id: int, kind: JudgeDocumentKind, file_id: UUID, comment: str | None, ip: str | None
    ) -> JudgeDocumentModel:
        """Загружает документ судьи к протоколу соревнования и пишет это в журнал аудита."""
        contest = await self._open(contest_id)
        assignment = await self._member(contest, actor_id)
        file = await self._file(actor_id, file_id)
        item = await self._documents.add(
            JudgeDocumentModel(
                contest_id=contest.id, assignment_id=assignment.id, judge_id=actor_id, kind=kind, file_id=file.id,
                comment=(comment or "").strip() or None,
            )
        )
        await self._documents.refresh(item)
        await self._audit.write(
            AuditAction.JUDGE_DOCUMENT_UPLOAD, actor_id, "judge_document", item.id,
            {"contest_id": contest.id, "kind": kind.value, "file": file.original_name}, ip,
        )
        await self._uow.commit()
        return item

    async def replace(
        self, actor_id: UUID, document_id: UUID, kind: JudgeDocumentKind, file_id: UUID | None, comment: str | None,
        ip: str | None,
    ) -> JudgeDocumentModel:
        """Заменяет файл, вид или комментарий своего документа и пишет это в журнал аудита."""
        item = await self._own(actor_id, document_id)
        if file_id is not None and file_id != item.file_id:
            item.file_id = (await self._file(actor_id, file_id)).id
        item.kind, item.comment = kind, (comment or "").strip() or None
        await self._documents.flush()
        await self._audit.write(
            AuditAction.JUDGE_DOCUMENT_REPLACE, actor_id, "judge_document", item.id,
            {"contest_id": item.contest_id, "kind": kind.value}, ip,
        )
        await self._uow.commit()
        return await self._documents.refresh(item)

    async def remove(self, actor_id: UUID, document_id: UUID, ip: str | None) -> None:
        """Удаляет свой документ и пишет это в журнал аудита."""
        item = await self._own(actor_id, document_id)
        contest_id = item.contest_id
        await self._documents.remove(item)
        await self._audit.write(
            AuditAction.JUDGE_DOCUMENT_REMOVE, actor_id, "judge_document", document_id, {"contest_id": contest_id}, ip
        )
        await self._uow.commit()

    async def _contest(self, contest_id: int) -> ContestModel:
        """Возвращает соревнование по id или вызывает ошибку, если его нет."""
        contest = await self._contests.get(contest_id)
        if contest is None:
            raise NotFound("Соревнование не найдено")
        return contest

    async def _open(self, contest_id: int) -> ContestModel:
        """Возвращает соревнование, если оно идёт или завершено, иначе вызывает ошибку."""
        contest = await self._contest(contest_id)
        if contest.status not in OPEN:
            raise InvalidStatus("Документы загружают, пока соревнование идёт или после завершения")
        return contest

    async def _member(self, contest: ContestModel, actor_id: UUID) -> JudgeAssignmentModel:
        """Проверяет, что актёр — судья коллегии соревнования, и возвращает его назначение."""
        assignment = await self._assignments.find(contest.id, actor_id)
        if assignment is None:
            raise Forbidden("Загружать документы может только судья коллегии этого соревнования")
        return assignment

    async def _own(self, actor_id: UUID, document_id: UUID) -> JudgeDocumentModel:
        """Возвращает документ, если он существует, принадлежит актёру и соревнование ещё открыто."""
        item = await self._documents.get(document_id)
        if item is None:
            raise NotFound()
        if item.judge_id != actor_id:
            raise Forbidden("Менять можно только свои документы")
        await self._member(await self._open(item.contest_id), actor_id)
        return item

    async def _file(self, actor_id: UUID, file_id: UUID) -> FileModel:
        """Проверяет, что файл подходящего типа и доступен актёру, и делает его публичным."""
        files, error = await self._files.usable([file_id], actor_id, False, self.TYPES)
        if error:
            message = "Загрузите PDF, DOCX или изображение" if error == "type" else error
            raise ValidationFailed(fields={"file_id": [message]})
        await self._files.set_public(files, True)
        return files[0]
