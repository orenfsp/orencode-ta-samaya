import uuid
from datetime import date, datetime
from typing import TYPE_CHECKING

from sqlalchemy import Date, DateTime, Enum, ForeignKey, String, Uuid, func, true
from sqlalchemy.orm import Mapped, mapped_column, relationship

from infrastructure.base import Base
from infrastructure.dictionaries.dictionary_academic_group import DictionaryAcademicGroupModel
from infrastructure.dictionaries.dictionary_municipality import DictionaryMunicipalityModel
from infrastructure.enums import CodeforcesStatus, PageVisibility
from infrastructure.services.file import FileModel

if TYPE_CHECKING:
    from infrastructure.account.guardian_consent import GuardianConsentModel
    from infrastructure.account.user_role import UserRoleModel


class UserModel(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(255), unique=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    last_name: Mapped[str] = mapped_column(String(100))
    first_name: Mapped[str] = mapped_column(String(100))
    middle_name: Mapped[str | None] = mapped_column(String(100))
    birth_date: Mapped[date] = mapped_column(Date)
    is_active: Mapped[bool] = mapped_column(default=True, server_default=true())
    pd_consent_version: Mapped[str] = mapped_column(String(20))
    pd_consent_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    email_verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    academic_group_id: Mapped[int | None] = mapped_column(ForeignKey("dictionary_academic_groups.id", ondelete="RESTRICT"))
    municipality_id: Mapped[int | None] = mapped_column(ForeignKey("dictionary_municipalities.id", ondelete="RESTRICT"))
    codeforces_handle: Mapped[str | None] = mapped_column(String(24))
    codeforces_rating: Mapped[int | None] = mapped_column()
    codeforces_max_rating: Mapped[int | None] = mapped_column()
    codeforces_rank: Mapped[str | None] = mapped_column(String(40))
    codeforces_status: Mapped[CodeforcesStatus | None] = mapped_column(Enum(CodeforcesStatus, name="codeforces_status", values_callable=lambda kind: [item.value for item in kind]))
    codeforces_updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    page_visibility: Mapped[PageVisibility] = mapped_column(Enum(PageVisibility, name="page_visibility", values_callable=lambda kind: [item.value for item in kind]), default=PageVisibility.PUBLIC, server_default=PageVisibility.PUBLIC.value)
    avatar_file_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("files.id", ondelete="SET NULL", use_alter=True, name="fk_users_avatar_file_id"))

    academic_group: Mapped[DictionaryAcademicGroupModel | None] = relationship(
        lazy="selectin",
    )

    municipality: Mapped[DictionaryMunicipalityModel | None] = relationship(
        lazy="selectin",
    )

    avatar: Mapped[FileModel | None] = relationship(
        foreign_keys=[avatar_file_id],
        lazy="selectin",
    )

    guardian_consent: Mapped["GuardianConsentModel | None"] = relationship(
        foreign_keys="GuardianConsentModel.user_id",
        lazy="selectin",
        uselist=False,
        viewonly=True,
    )

    roles: Mapped[list["UserRoleModel"]] = relationship(
        back_populates="user",
        foreign_keys="UserRoleModel.user_id",
        order_by="UserRoleModel.created_at",
        lazy="selectin",
        cascade="all, delete-orphan",
    )
