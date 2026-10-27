from datetime import date, datetime
from typing import Annotated
from uuid import UUID

from email_validator import EmailNotValidError, validate_email
from pydantic import BaseModel, ConfigDict, StringConstraints, ValidationInfo, field_validator

from auth.domain.password import PasswordPolicy
from auth.domain.roles import Roles
from infrastructure.enums import Role, RoleStatus

NamePart = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=100)]


class RegisterIn(BaseModel):
    email: str
    password: str
    password_repeat: str
    last_name: NamePart
    first_name: NamePart
    middle_name: NamePart | None = None
    birth_date: date
    roles: list[Role]
    pd_consent: bool

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        value = value.strip()
        if len(value) > 255:
            raise ValueError("Email слишком длинный")
        try:
            return validate_email(value, check_deliverability=False, test_environment=True).normalized.lower()
        except EmailNotValidError:
            raise ValueError("Некорректный email") from None

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

    @field_validator("middle_name", mode="before")
    @classmethod
    def empty_middle_name(cls, value: str | None) -> str | None:
        if isinstance(value, str) and not value.strip():
            return None
        return value

    @field_validator("birth_date")
    @classmethod
    def check_birth_date(cls, value: date) -> date:
        if value > date.today():
            raise ValueError("Дата рождения в будущем")
        if value < date(1900, 1, 1):
            raise ValueError("Слишком ранняя дата рождения")
        return value

    @field_validator("roles")
    @classmethod
    def check_roles(cls, value: list[Role]) -> list[Role]:
        if not value:
            raise ValueError("Выберите хотя бы одну роль")
        if len(set(value)) != len(value):
            raise ValueError("Роли не должны повторяться")
        if not set(value) <= Roles.SELF_REGISTER_ROLES:
            raise ValueError("Эту роль нельзя выбрать при регистрации")
        return value

    @field_validator("pd_consent")
    @classmethod
    def check_consent(cls, value: bool) -> bool:
        if not value:
            raise ValueError("Необходимо согласие на обработку персональных данных")
        return value


class RoleOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    role: Role
    status: RoleStatus
    reject_reason: str | None
    onboarding_done: bool
    created_at: datetime


class RegisterOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    email: str
    last_name: str
    first_name: str
    middle_name: str | None
    birth_date: date
    roles: list[RoleOut]
