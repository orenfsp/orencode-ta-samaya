import uuid
from datetime import date, datetime

from sqlalchemy import CheckConstraint, Date, DateTime, ForeignKey, Index, Integer, String, func, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from infrastructure.base import Base
from infrastructure.dictionaries.dictionary_academic_group import DictionaryAcademicGroupModel
from infrastructure.dictionaries.dictionary_age_group import DictionaryAgeGroupModel
from infrastructure.dictionaries.dictionary_discipline import DictionaryDisciplineModel
from infrastructure.services.file import FileModel
from infrastructure.squads.squad_member import SquadMemberModel


class SquadModel(Base):
    __tablename__ = "squads"
    __table_args__ = (
        CheckConstraint("(age_group_id IS NULL) <> (academic_group_id IS NULL)", name="ck_squads_group"),
        CheckConstraint("main_size >= 1 AND reserve_size >= 0", name="ck_squads_sizes"),
        Index("uq_squads_age", "discipline_id", "age_group_id", unique=True, postgresql_where=text("age_group_id IS NOT NULL")),
        Index("uq_squads_academic", "discipline_id", "academic_group_id", unique=True, postgresql_where=text("academic_group_id IS NOT NULL")),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    discipline_id: Mapped[int] = mapped_column(ForeignKey("dictionary_disciplines.id", ondelete="RESTRICT"), index=True)
    age_group_id: Mapped[int | None] = mapped_column(ForeignKey("dictionary_age_groups.id", ondelete="RESTRICT"))
    academic_group_id: Mapped[int | None] = mapped_column(ForeignKey("dictionary_academic_groups.id", ondelete="RESTRICT"))
    main_size: Mapped[int] = mapped_column(Integer)
    reserve_size: Mapped[int] = mapped_column(Integer)
    order_number: Mapped[str] = mapped_column(String(100))
    order_date: Mapped[date] = mapped_column(Date)
    order_file_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("files.id", ondelete="RESTRICT"), unique=True)
    approved_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    approved_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    discipline: Mapped[DictionaryDisciplineModel] = relationship(
        lazy="selectin",
    )

    age_group: Mapped[DictionaryAgeGroupModel | None] = relationship(
        lazy="selectin",
    )

    academic_group: Mapped[DictionaryAcademicGroupModel | None] = relationship(
        lazy="selectin",
    )

    order_file: Mapped[FileModel] = relationship(
        lazy="selectin",
    )

    members: Mapped[list[SquadMemberModel]] = relationship(
        lazy="selectin",
        cascade="all, delete-orphan",
        passive_deletes=True,
        order_by=SquadMemberModel.position,
    )

    @property
    def group_kind(self) -> str:
        """Вид группы состава: по возрасту или по учебной группе."""
        return "age" if self.age_group_id is not None else "academic"

    @property
    def group(self) -> DictionaryAgeGroupModel | DictionaryAcademicGroupModel:
        """Возрастная или учебная группа состава, в зависимости от того, какая указана."""
        group = self.age_group or self.academic_group
        if group is None:
            raise ValueError("Squad without group")
        return group
