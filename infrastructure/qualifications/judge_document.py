import uuid
from datetime import datetime
from enum import StrEnum

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, Text, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from infrastructure.base import Base
from infrastructure.enums import JudgeDocumentKind
from infrastructure.services.file import FileModel
from infrastructure.qualifications.judge_assignment import JudgeAssignmentModel
from infrastructure.account.user import UserModel


def _values(enum_cls: type[StrEnum]) -> list[str]:
    """Возвращает строковые значения элементов перечисления для колонки Enum."""
    return [item.value for item in enum_cls]


class JudgeDocumentModel(Base):
    __tablename__ = "judge_documents"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    contest_id: Mapped[int] = mapped_column(Integer, ForeignKey("contests.id", ondelete="CASCADE"), index=True)
    assignment_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("judge_assignments.id", ondelete="SET NULL"), index=True)
    judge_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    kind: Mapped[JudgeDocumentKind] = mapped_column(Enum(JudgeDocumentKind, name="judge_document_kind", values_callable=_values))
    file_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("files.id", ondelete="RESTRICT"))
    comment: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    judge: Mapped[UserModel] = relationship(
        lazy="selectin",
    )

    assignment: Mapped[JudgeAssignmentModel | None] = relationship(
        lazy="selectin",
    )

    file: Mapped[FileModel] = relationship(
        lazy="selectin",
    )
