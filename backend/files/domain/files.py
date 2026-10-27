import re
import uuid
from collections.abc import Iterable, Sequence
from uuid import UUID

from audit.domain.actions import AuditAction
from audit.domain.audit import Audit
from core.config import Settings
from core.database import UnitOfWork
from core.errors import FileTooLarge, NotFound, UnsupportedFileType
from files.repositories.pg_files import FileRepository
from files.repositories.s3_files import ObjectRepository
from infrastructure.file import FileModel

JPEG, PNG, WEBP = "image/jpeg", "image/png", "image/webp"
PDF = "application/pdf"
DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
ZIP = "application/zip"


def _detect(data: bytes, declared: str | None) -> str | None:
    if data.startswith(b"\xff\xd8\xff"):
        return JPEG
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return PNG
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return WEBP
    if data.startswith(b"%PDF-"):
        return PDF
    if data.startswith(b"PK\x03\x04"):
        return declared if declared in (DOCX, XLSX) else ZIP
    return None


def _safe_name(filename: str) -> str:
    name = re.sub(r"[^\w.\-]+", "_", filename, flags=re.UNICODE).strip("._")
    return name[-120:] or "file"


class Files:
    IMAGE_TYPES = frozenset({JPEG, PNG, WEBP})
    DOCUMENT_TYPES = frozenset({PDF, DOCX})
    ALLOWED_TYPES = frozenset({JPEG, PNG, WEBP, PDF, DOCX, XLSX, ZIP})

    def __init__(
        self,
        uow: UnitOfWork,
        files: FileRepository,
        storage: ObjectRepository,
        audit: Audit,
        settings: Settings,
    ) -> None:
        self._uow = uow
        self._files = files
        self._storage = storage
        self._audit = audit
        self._settings = settings

    async def upload(
        self, user_id: UUID, filename: str, declared_type: str | None, data: bytes, ip: str | None
    ) -> FileModel:
        if len(data) > self._settings.file_max_size_mb * 1024 * 1024:
            raise FileTooLarge(f"Файл больше {self._settings.file_max_size_mb} МБ")
        content_type = _detect(data, declared_type)
        if content_type is None or content_type not in self.ALLOWED_TYPES:
            raise UnsupportedFileType("Поддерживаются JPEG, PNG, WebP, PDF, DOCX, XLSX и ZIP")
        key = f"{uuid.uuid4()}/{_safe_name(filename)}"
        await self._storage.put(False, key, data, content_type)
        item = await self._files.add(
            FileModel(
                object_key=key,
                is_public=False,
                original_name=filename[:255] or "file",
                content_type=content_type,
                size=len(data),
                uploaded_by=user_id,
            )
        )
        await self._audit.write(
            AuditAction.FILE_UPLOAD,
            user_id=user_id,
            object_type="file",
            object_id=item.id,
            payload={"name": item.original_name, "type": content_type, "size": item.size},
            ip=ip,
        )
        await self._uow.commit()
        return item

    async def download_url(self, user_id: UUID | None, is_federation: bool, file_id: UUID) -> str:
        item = await self._files.get(file_id)
        if item is None:
            raise NotFound()
        if item.is_public:
            return self._storage.public_url(item.object_key)
        if user_id is None or not (is_federation or item.uploaded_by == user_id):
            raise NotFound()
        return await self._storage.signed_url(
            item.object_key, item.original_name, self._settings.file_signed_url_ttl_seconds
        )

    async def usable(
        self,
        file_ids: Sequence[UUID],
        user_id: UUID,
        is_federation: bool,
        allowed_types: frozenset[str],
        already_attached: Iterable[UUID] = (),
    ) -> tuple[list[FileModel], str | None]:
        attached = set(already_attached)
        items = await self._files.get_many(list(dict.fromkeys(file_ids)))
        if len(items) != len(set(file_ids)) or any(
            item.id not in attached and not is_federation and item.uploaded_by != user_id for item in items
        ):
            return [], "Файл не найден или загружен не вами"
        if any(item.content_type not in allowed_types for item in items):
            return [], "type"
        return items, None

    async def set_public(self, items: Iterable[FileModel], is_public: bool) -> None:
        for item in items:
            if item.is_public != is_public:
                await self._storage.move(item.object_key, is_public)
                await self._files.update(item, {"is_public": is_public})
