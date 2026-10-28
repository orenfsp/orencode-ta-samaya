import re
from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, ConfigDict, StringConstraints, field_validator

from infrastructure.enums import CodeforcesStatus
from infrastructure.account.user import UserModel


class HandleIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    handle: Annotated[str, StringConstraints(strip_whitespace=True)]

    @field_validator("handle")
    @classmethod
    def check_handle(cls, value: str) -> str:
        """Проверяет, что хэндл состоит из допустимых символов Codeforces."""
        if not re.fullmatch(r"[A-Za-z0-9_.\-]{1,24}", value):
            raise ValueError("Латиница, цифры, «_», «-» и «.», до 24 символов")
        return value


class CodeforcesOut(BaseModel):
    handle: str
    url: str
    rating: int | None
    max_rating: int | None
    rank: str | None
    status: CodeforcesStatus
    updated_at: datetime | None

    @classmethod
    def of(cls, user: UserModel) -> "CodeforcesOut | None":
        """Строит профиль Codeforces из пользователя; None, если хэндл не привязан."""
        if not user.codeforces_handle:
            return None
        return cls(
            handle=user.codeforces_handle,
            url=f"https://codeforces.com/profile/{user.codeforces_handle}",
            rating=user.codeforces_rating,
            max_rating=user.codeforces_max_rating,
            rank=user.codeforces_rank,
            status=user.codeforces_status or CodeforcesStatus.PENDING,
            updated_at=user.codeforces_updated_at,
        )
