from datetime import datetime
from typing import Any

from sqlalchemy import DateTime, Index, Integer, String, Text, false, func, text
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class DictionaryColumns:
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(200))
    description: Mapped[str | None] = mapped_column(Text)
    is_archived: Mapped[bool] = mapped_column(default=False, server_default=false())
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


def dictionary_table_args(table: str, *extra: Any) -> tuple[Any, ...]:
    return (
        Index(
            f"uq_{table}_name_active",
            text("lower(name)"),
            unique=True,
            postgresql_where=text("NOT is_archived"),
        ),
        *extra,
    )
