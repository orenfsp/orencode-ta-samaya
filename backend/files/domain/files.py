import logging
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
from infrastructure.services.file import FileModel

JPEG, PNG, WEBP = "image/jpeg", "image/png", "image/webp"
PDF = "application/pdf"
DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
ZIP = "application/zip"

logger = logging.getLogger("fsp.files")


def _detect(data: bytes, declared: str | None) -> str | None:
    """Определяет MIME-тип по сигнатуре файла; для ZIP-контейнеров доверяет заявленному типу DOCX/XLSX."""
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
    """Очищает имя файла от небезопасных символов и обрезает его до 120 символов."""
    name = re.sub(r"[^\w.\-]+", "_", filename, flags=re.UNICODE).strip("._")
    return name[-120:] or "file"


class Files:
    """Загрузка, выдача ссылок и управление доступом к файлам в объектном хранилище."""

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
        """Сохраняет зависимости."""
        self._uow = uow
        self._files = files
        self._storage = storage
        self._audit = audit
        self._settings = settings

    async def upload(
        self, user_id: UUID, filename: str, declared_type: str | None, data: bytes, ip: str | None
    ) -> FileModel:
        """Проверяет размер и тип файла, сохраняет его в приватное хранилище и регистрирует в базе."""
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
        """Ссылка для скачивания файла; NotFound, если файла нет или доступ запрещён."""
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

    async def url(self, item: FileModel) -> str:
        """Ссылка на файл: публичная для публичных файлов, подписанная для остальных."""
        if item.is_public:
            return self._storage.public_url(item.object_key)
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
        """Проверяет, что файлы существуют, принадлежат пользователю (или уже прикреплены) и подходят по типу."""
        attached = set(already_attached)
        items = await self._files.get_many(list(dict.fromkeys(file_ids)))
        if len(items) != len(set(file_ids)) or any(
            item.id not in attached and not is_federation and item.uploaded_by != user_id for item in items
        ):
            return [], "Файл не найден или загружен не вами"
        if any(item.content_type not in allowed_types for item in items):
            return [], "type"
        return items, None

    async def forget(self, item: FileModel) -> tuple[bool, str]:
        """Удаляет запись о файле из базы и возвращает его расположение в хранилище для последующего удаления."""
        stored = (item.is_public, item.object_key)
        await self._files.remove(item)
        return stored

    async def erase(self, objects: Iterable[tuple[bool, str]]) -> None:
        """Удаляет объекты из хранилища; ошибки удаления только логирует, не прерывая остальные."""
        for is_public, key in objects:
            try:
                await self._storage.remove(is_public, key)
            except Exception:
                logger.warning("Object %s was not removed from storage", key, exc_info=True)

    async def set_public(self, items: Iterable[FileModel], is_public: bool) -> None:
        """Переносит файлы между публичным и приватным хранилищем и обновляет их флаг видимости."""
        for item in items:
            if item.is_public != is_public:
                await self._storage.move(item.object_key, is_public)
                await self._files.update(item, {"is_public": is_public})
