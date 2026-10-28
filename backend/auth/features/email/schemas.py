from typing import Annotated

from pydantic import BaseModel, StringConstraints, field_validator

Email = Annotated[str, StringConstraints(strip_whitespace=True, to_lower=True, max_length=255,
                                         pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")]


class CodeIn(BaseModel):
    code: Annotated[str, StringConstraints(pattern=r"^\d{6}$")]

    @field_validator("code", mode="before")
    @classmethod
    def digits(cls, value: object) -> object:
        """Убирает пробелы в коде перед проверкой формата."""
        return "".join(str(value).split()) if isinstance(value, str) else value


class ChangeIn(BaseModel):
    new_email: Email
    password: Annotated[str, StringConstraints(min_length=1, max_length=200)]
