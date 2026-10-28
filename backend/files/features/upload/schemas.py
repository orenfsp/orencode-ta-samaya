from urllib.parse import quote
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, computed_field

from core.config import settings


class FileOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    original_name: str
    content_type: str
    size: int
    is_public: bool
    object_key: str = Field(exclude=True)

    @computed_field
    @property
    def url(self) -> str:
        """Публичная ссылка на файл или путь для скачивания через API."""
        if self.is_public:
            return f"{settings.s3_public_url}/{settings.s3_public_bucket}/{quote(self.object_key)}"
        return f"/api/v1/files/{self.id}"
