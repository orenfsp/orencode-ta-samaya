from typing import Annotated

from pydantic import BaseModel, StringConstraints, ValidationInfo, field_validator

from auth.domain.password import PasswordPolicy


class ForgotIn(BaseModel):
    email: Annotated[str, StringConstraints(strip_whitespace=True, to_lower=True, min_length=1, max_length=255)]


class ResetIn(BaseModel):
    token: Annotated[str, StringConstraints(min_length=1, max_length=128)]
    password: str
    password_repeat: str

    @field_validator("password")
    @classmethod
    def check_password(cls, value: str) -> str:
        problems = PasswordPolicy.violations(value)
        if problems:
            raise ValueError("\n".join(problems))
        return value

    @field_validator("password_repeat")
    @classmethod
    def check_repeat(cls, value: str, info: ValidationInfo) -> str:
        if "password" in info.data and value != info.data["password"]:
            raise ValueError("Пароли не совпадают")
        return value
