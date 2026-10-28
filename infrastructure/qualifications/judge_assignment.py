import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, Uuid, func, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from infrastructure.base import Base
from infrastructure.contests.contest import ContestModel
from infrastructure.dictionaries.dictionary_judge_position import DictionaryJudgePositionModel
from infrastructure.account.user import UserModel


class JudgeAssignmentModel(Base):
    __tablename__ = "judge_assignments"
    __table_args__ = (
        Index("uq_judge_assignments_contest_judge", "contest_id", "judge_id", unique=True, postgresql_where=text("removed_at IS NULL")),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    contest_id: Mapped[int] = mapped_column(ForeignKey("contests.id", ondelete="CASCADE"), index=True)
    judge_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    position_id: Mapped[int] = mapped_column(ForeignKey("dictionary_judge_positions.id", ondelete="RESTRICT"))
    assigned_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    removed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    removed_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))

    contest: Mapped[ContestModel] = relationship(
        lazy="selectin",
    )

    judge: Mapped[UserModel] = relationship(
        foreign_keys=[judge_id],
        lazy="selectin",
    )

    position: Mapped[DictionaryJudgePositionModel] = relationship(
        lazy="selectin",
    )
