from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Path, status
from fastapi.responses import RedirectResponse

from auth.dependencies import OptionalUserDep
from files.dependencies import FilesDep
from infrastructure.enums import Role

router = APIRouter(prefix="/files", tags=["Файлы"])


@router.get("/{file_id}", summary="Скачать файл", response_class=RedirectResponse)
async def download(file_id: Annotated[UUID, Path()], user: OptionalUserDep, files: FilesDep) -> RedirectResponse:
    """Перенаправляет на ссылку для скачивания файла с учётом прав доступа."""
    is_federation = user is not None and Role.FEDERATION in user.roles
    url = await files.download_url(user.id if user else None, is_federation, file_id)
    return RedirectResponse(url, status_code=status.HTTP_307_TEMPORARY_REDIRECT)
