from typing import Annotated

from pydantic import BaseModel, StringConstraints, ValidationInfo, field_validator

from auth.domain.password import PasswordPolicy

Email = Annotated[str, StringConstraints(strip_whitespace=True, to_lower=True, min_length=1, max_length=255)]


class ForgotIn(BaseModel):
    email: Email


class VerifyIn(BaseModel):
    email: Email
    code: Annotated[str, StringConstraints(pattern=r"^\d{6}$")]

    @field_validator("code", mode="before")
    @classmethod
    def digits(cls, value: object) -> object:
        """Убирает пробелы в коде перед проверкой формата."""
        return "".join(str(value).split()) if isinstance(value, str) else value


class VerifyOut(BaseModel):
    reset_token: str


class ResetIn(BaseModel):
    token: Annotated[str, StringConstraints(min_length=1, max_length=128)]
    password: str
    password_repeat: str

    @field_validator("password")
    @classmethod
    def check_password(cls, value: str) -> str:
        """Проверяет новый пароль на соответствие требованиям политики."""
        problems = PasswordPolicy.violations(value)
        if problems:
            raise ValueError("\n".join(problems))
        return value

    @field_validator("password_repeat")
    @classmethod
    def check_repeat(cls, value: str, info: ValidationInfo) -> str:
        """Проверяет, что повтор пароля совпадает с паролем."""
        if "password" in info.data and value != info.data["password"]:
            raise ValueError("Пароли не совпадают")
        return value
