from datetime import datetime
from typing import Annotated
from uuid import UUID

from pydantic import BaseModel, StringConstraints

from infrastructure.enums import JudgeDocumentKind

Comment = Annotated[str, StringConstraints(strip_whitespace=True, max_length=500)]


class JudgeDocumentOut(BaseModel):
    id: UUID
    kind: JudgeDocumentKind
    kind_title: str
    judge_id: UUID
    judge_name: str
    position: str | None
    removed: bool
    file_name: str
    file_type: str
    file_size: int
    url: str
    comment: str | None
    created_at: datetime
    updated_at: datetime


class JudgeDocumentIn(BaseModel):
    kind: JudgeDocumentKind
    file_id: UUID
    comment: Comment | None = None


class JudgeDocumentUpdate(BaseModel):
    kind: JudgeDocumentKind
    file_id: UUID | None = None
    comment: Comment | None = None
