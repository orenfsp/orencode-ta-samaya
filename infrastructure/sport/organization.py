from datetime import date, datetime

from sqlalchemy import Date, DateTime, ForeignKey, Integer, String, func, true
from sqlalchemy.orm import Mapped, mapped_column, relationship

from infrastructure.base import Base
from infrastructure.dictionaries.dictionary_municipality import DictionaryMunicipalityModel
from infrastructure.dictionaries.dictionary_organization_type import DictionaryOrganizationTypeModel


class OrganizationModel(Base):
    __tablename__ = "organizations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(300), unique=True)
    short_name: Mapped[str | None] = mapped_column(String(120))
    organization_type_id: Mapped[int] = mapped_column(ForeignKey("dictionary_organization_types.id", ondelete="RESTRICT"), index=True)
    municipality_id: Mapped[int | None] = mapped_column(ForeignKey("dictionary_municipalities.id", ondelete="RESTRICT"), index=True)
    inn: Mapped[str | None] = mapped_column(String(12))
    address: Mapped[str | None] = mapped_column(String(300))
    website: Mapped[str | None] = mapped_column(String(300))
    license_number: Mapped[str | None] = mapped_column(String(100))
    license_date: Mapped[date | None] = mapped_column(Date)
    is_active: Mapped[bool] = mapped_column(default=True, server_default=true())
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    organization_type: Mapped[DictionaryOrganizationTypeModel] = relationship(
        lazy="selectin",
    )

    municipality: Mapped[DictionaryMunicipalityModel | None] = relationship(
        lazy="selectin",
    )
