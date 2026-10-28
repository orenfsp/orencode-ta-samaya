from typing import Annotated

from fastapi import APIRouter, File, UploadFile, status

from auth.dependencies import CurrentUserDep
from core.config import settings
from core.request import ClientIp
from files.dependencies import FilesDep
from files.features.upload.schemas import FileOut

router = APIRouter(prefix="/files", tags=["Файлы"])


@router.post("", status_code=status.HTTP_201_CREATED, summary="Загрузить файл")
async def upload(
    file: Annotated[UploadFile, File()],
    user: CurrentUserDep,
    ip: ClientIp,
    files: FilesDep,
) -> FileOut:
    """Загружает файл текущего пользователя."""
    data = await file.read(settings.file_max_size_mb * 1024 * 1024 + 1)
    item = await files.upload(user.id, file.filename or "file", file.content_type, data, ip)
    return FileOut.model_validate(item)
