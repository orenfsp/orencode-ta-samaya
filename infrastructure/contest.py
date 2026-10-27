import uuid
from datetime import date, datetime
from enum import StrEnum
from typing import Any

from sqlalchemy import CheckConstraint, Date, DateTime, Enum, ForeignKey, Integer, String, Text, Uuid, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from infrastructure.base import Base
from infrastructure.contest_academic_group import contest_academic_groups
from infrastructure.contest_age_group import contest_age_groups
from infrastructure.contest_photo import ContestPhotoModel
from infrastructure.dictionary_academic_group import DictionaryAcademicGroupModel
from infrastructure.dictionary_age_group import DictionaryAgeGroupModel
from infrastructure.dictionary_contest_format import DictionaryContestFormatModel
from infrastructure.dictionary_contest_level import DictionaryContestLevelModel
from infrastructure.dictionary_contest_type import DictionaryContestTypeModel
from infrastructure.dictionary_discipline import DictionaryDisciplineModel
from infrastructure.dictionary_municipality import DictionaryMunicipalityModel
from infrastructure.enums import ContestStatus, ParticipationType, VerificationStatus
from infrastructure.file import FileModel
from infrastructure.user import UserModel


def _values(enum_cls: type[StrEnum]) -> list[str]:
    return [item.value for item in enum_cls]


class ContestModel(Base):
    __tablename__ = "contests"
    __table_args__ = (
        CheckConstraint("ends_on >= starts_on", name="ck_contests_dates"),
        CheckConstraint("registration_opens_at < registration_closes_at", name="ck_contests_registration"),
        CheckConstraint(
            "team_size_min IS NULL OR team_size_max IS NULL OR team_size_min <= team_size_max",
            name="ck_contests_team_size",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    title: Mapped[str] = mapped_column(String(300))
    description: Mapped[str | None] = mapped_column(Text)
    discipline_id: Mapped[int] = mapped_column(ForeignKey("dictionary_disciplines.id", ondelete="RESTRICT"))
    contest_type_id: Mapped[int] = mapped_column(
        ForeignKey("dictionary_contest_types.id", ondelete="RESTRICT")
    )
    contest_level_id: Mapped[int] = mapped_column(
        ForeignKey("dictionary_contest_levels.id", ondelete="RESTRICT")
    )
    contest_format_id: Mapped[int] = mapped_column(
        ForeignKey("dictionary_contest_formats.id", ondelete="RESTRICT")
    )
    participation_type: Mapped[ParticipationType] = mapped_column(
        Enum(ParticipationType, name="participation_type", values_callable=_values)
    )
    team_size_min: Mapped[int | None] = mapped_column()
    team_size_max: Mapped[int | None] = mapped_column()
    municipality_id: Mapped[int | None] = mapped_column(ForeignKey("dictionary_municipalities.id", ondelete="RESTRICT"))
    venue: Mapped[str | None] = mapped_column(String(300))
    starts_on: Mapped[date] = mapped_column(Date, index=True)
    ends_on: Mapped[date] = mapped_column(Date)
    registration_opens_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    registration_closes_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    prize_fund_text: Mapped[str | None] = mapped_column(String(500))
    prize_fund_amount: Mapped[int | None] = mapped_column()
    regulations_file_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("files.id", ondelete="SET NULL"))
    organizer_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"), index=True)

    status: Mapped[ContestStatus] = mapped_column(
        Enum(ContestStatus, name="contest_status", values_callable=_values),
        default=ContestStatus.DRAFT,
        index=True,
    )
    cancel_reason: Mapped[str | None] = mapped_column(Text)
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    verification_status: Mapped[VerificationStatus] = mapped_column(
        Enum(VerificationStatus, name="verification_status", values_callable=_values),
        default=VerificationStatus.NOT_REQUESTED,
        index=True,
    )
    verification_reason: Mapped[str | None] = mapped_column(Text)
    verification_requested_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    verified_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    rating_points: Mapped[list[dict[str, Any]] | None] = mapped_column(JSONB)

    created_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    discipline: Mapped[DictionaryDisciplineModel] = relationship(lazy="selectin")
    contest_type: Mapped[DictionaryContestTypeModel] = relationship(lazy="selectin")
    contest_level: Mapped[DictionaryContestLevelModel] = relationship(lazy="selectin")
    contest_format: Mapped[DictionaryContestFormatModel] = relationship(lazy="selectin")
    municipality: Mapped[DictionaryMunicipalityModel | None] = relationship(lazy="selectin")
    organizer: Mapped[UserModel] = relationship(foreign_keys=[organizer_id], lazy="selectin")
    regulations: Mapped[FileModel | None] = relationship(lazy="selectin")
    photos: Mapped[list[ContestPhotoModel]] = relationship(
        lazy="selectin", order_by=ContestPhotoModel.position, cascade="all, delete-orphan"
    )
    age_groups: Mapped[list[DictionaryAgeGroupModel]] = relationship(
        secondary=contest_age_groups, lazy="selectin", order_by=DictionaryAgeGroupModel.id
    )
    academic_groups: Mapped[list[DictionaryAcademicGroupModel]] = relationship(
        secondary=contest_academic_groups, lazy="selectin", order_by=DictionaryAcademicGroupModel.id
    )

    @property
    def photo_files(self) -> list[FileModel]:
        return [photo.file for photo in self.photos]

    @property
    def files(self) -> list[FileModel]:
        return ([self.regulations] if self.regulations else []) + self.photo_files
