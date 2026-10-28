import uuid
from datetime import date, datetime
from enum import StrEnum

from sqlalchemy import CheckConstraint, Date, DateTime, Enum, ForeignKey, Index, Text, Uuid, func, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from infrastructure.base import Base
from infrastructure.dictionaries.dictionary_judge_category import DictionaryJudgeCategoryModel
from infrastructure.dictionaries.dictionary_rank_type import DictionaryRankTypeModel
from infrastructure.enums import QualificationKind, QualificationStatus
from infrastructure.services.file import FileModel
from infrastructure.account.user import UserModel


def _values(enum_cls: type[StrEnum]) -> list[str]:
    """Значения перечисления для хранения в enum-типе Postgres."""
    return [item.value for item in enum_cls]


class QualificationModel(Base):
    __tablename__ = "qualifications"
    __table_args__ = (
        CheckConstraint("(kind = 'judge_category' AND judge_category_id IS NOT NULL AND rank_type_id IS NULL) " "OR (kind = 'rank' AND rank_type_id IS NOT NULL AND judge_category_id IS NULL)", name="ck_qualifications_item"),
        Index("uq_qualifications_pending", "user_id", "kind", unique=True, postgresql_where=text("status = 'pending'")),
        Index("uq_qualifications_approved", "user_id", "kind", unique=True, postgresql_where=text("status = 'approved'")),
        Index("ix_qualifications_queue", "kind", "status", "created_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    kind: Mapped[QualificationKind] = mapped_column(Enum(QualificationKind, name="qualification_kind", values_callable=_values))
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    submitted_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"), index=True)
    judge_category_id: Mapped[int | None] = mapped_column(ForeignKey("dictionary_judge_categories.id", ondelete="RESTRICT"))
    rank_type_id: Mapped[int | None] = mapped_column(ForeignKey("dictionary_rank_types.id", ondelete="RESTRICT"))
    document_file_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("files.id", ondelete="RESTRICT"))
    basis: Mapped[str | None] = mapped_column(Text)
    status: Mapped[QualificationStatus] = mapped_column(Enum(QualificationStatus, name="qualification_status", values_callable=_values), index=True)
    reject_reason: Mapped[str | None] = mapped_column(Text)
    decided_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    valid_from: Mapped[date | None] = mapped_column(Date)
    valid_until: Mapped[date | None] = mapped_column(Date, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    user: Mapped[UserModel] = relationship(
        foreign_keys=[user_id],
        lazy="selectin",
    )

    submitter: Mapped[UserModel] = relationship(
        foreign_keys=[submitted_by],
        lazy="selectin",
    )

    judge_category: Mapped[DictionaryJudgeCategoryModel | None] = relationship(
        lazy="selectin",
    )

    rank_type: Mapped[DictionaryRankTypeModel | None] = relationship(
        lazy="selectin",
    )

    document: Mapped[FileModel] = relationship(
        lazy="selectin",
    )

    @property
    def item_id(self) -> int:
        """Id судейской категории или разряда, в зависимости от вида квалификации."""
        return self.judge_category_id or self.rank_type_id or 0

    @property
    def item_name(self) -> str:
        """Название судейской категории или разряда."""
        item = self.judge_category or self.rank_type
        return item.name if item else ""
