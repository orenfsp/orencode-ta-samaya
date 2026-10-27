from typing import cast

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException


class AppError(Exception):
    status_code: int = 400
    code: str = "error"
    message: str = "Ошибка запроса"

    def __init__(
        self,
        message: str | None = None,
        fields: dict[str, list[str]] | None = None,
        headers: dict[str, str] | None = None,
    ) -> None:
        self.message = message or self.message
        self.fields = fields
        self.headers = headers
        super().__init__(self.message)


class ValidationFailed(AppError):
    status_code = 422
    code = "validation_error"
    message = "Проверьте поля формы"


class Unauthorized(AppError):
    status_code = 401
    code = "unauthorized"
    message = "Требуется вход"


class InvalidCredentials(AppError):
    status_code = 401
    code = "invalid_credentials"
    message = "Неверный email или пароль"


class Forbidden(AppError):
    status_code = 403
    code = "forbidden"
    message = "Недостаточно прав"


class CsrfFailed(AppError):
    status_code = 403
    code = "csrf_failed"
    message = "Неверный CSRF-токен"


class AccountDisabled(AppError):
    status_code = 403
    code = "account_disabled"
    message = "Аккаунт отключён"


class NotFound(AppError):
    status_code = 404
    code = "not_found"
    message = "Не найдено"


class EmailTaken(AppError):
    status_code = 409
    code = "email_taken"
    message = "Этот email уже зарегистрирован"


class RoleAlreadyRequested(AppError):
    status_code = 409
    code = "role_already_requested"
    message = "Эта роль уже запрошена или подтверждена"


class InvalidStatus(AppError):
    status_code = 409
    code = "invalid_status"
    message = "Действие недоступно в текущем статусе"


class PointsLocked(AppError):
    status_code = 409
    code = "points_locked"
    message = "Баллы верифицированного соревнования зафиксированы. Чтобы изменить, снимите верификацию и верифицируйте заново"


class InvalidToken(AppError):
    status_code = 400
    code = "invalid_token"
    message = "Ссылка недействительна или устарела"


class TooManyAttempts(AppError):
    status_code = 429
    code = "too_many_attempts"
    message = "Слишком много попыток, попробуйте позже"


class NameTaken(AppError):
    status_code = 409
    code = "name_taken"
    message = "Такое значение уже есть"


class InUse(AppError):
    status_code = 409
    code = "in_use"
    message = "Значение используется — его можно только архивировать"


class FileTooLarge(AppError):
    status_code = 413
    code = "file_too_large"
    message = "Файл слишком большой"


class UnsupportedFileType(AppError):
    status_code = 415
    code = "unsupported_file_type"
    message = "Такой тип файла не поддерживается"


class SelfModeration(AppError):
    status_code = 409
    code = "self_moderation"
    message = "Решение по своему аккаунту принимает другой сотрудник ФСП"


class RegistrationClosed(AppError):
    status_code = 409
    code = "registration_closed"
    message = "Регистрация на соревнование сейчас закрыта"


class HasApplications(AppError):
    status_code = 409
    code = "has_applications"
    message = "На соревнование уже подали заявки. Его можно только отменить"


def error_body(code: str, message: str, fields: dict[str, list[str]] | None = None) -> dict:
    return {"error": {"code": code, "message": message, "fields": fields}}


def _field_name(loc: tuple) -> str:
    parts = [str(part) for part in loc if part not in ("body", "query", "path", "header", "cookie")]
    return ".".join(parts) or "__root__"


PYDANTIC_MESSAGES: dict[str, str] = {
    "missing": "Обязательное поле",
    "extra_forbidden": "Лишнее поле",
    "string_type": "Должно быть строкой",
    "string_too_short": "Не короче {min_length} символов",
    "string_too_long": "Не длиннее {max_length} символов",
    "int_type": "Должно быть целым числом",
    "int_parsing": "Должно быть целым числом",
    "int_from_float": "Должно быть целым числом",
    "bool_type": "Должно быть «да» или «нет»",
    "bool_parsing": "Должно быть «да» или «нет»",
    "greater_than": "Должно быть больше {gt}",
    "greater_than_equal": "Не меньше {ge}",
    "less_than": "Должно быть меньше {lt}",
    "less_than_equal": "Не больше {le}",
    "enum": "Допустимые значения: {expected}",
    "literal_error": "Допустимые значения: {expected}",
    "date_type": "Некорректная дата",
    "date_parsing": "Некорректная дата, формат ГГГГ-ММ-ДД",
    "date_from_datetime_parsing": "Некорректная дата, формат ГГГГ-ММ-ДД",
    "uuid_parsing": "Некорректный идентификатор",
    "uuid_type": "Некорректный идентификатор",
    "list_type": "Должно быть списком",
    "too_short": "Минимум элементов: {min_length}",
    "too_long": "Максимум элементов: {max_length}",
    "json_invalid": "Некорректный JSON",
    "model_attributes_type": "Ожидается объект",
    "dict_type": "Ожидается объект",
}


def _messages(item: dict) -> list[str]:
    if item["type"] == "string_too_short" and item.get("ctx", {}).get("min_length") == 1:
        return ["Не может быть пустым"]
    template = PYDANTIC_MESSAGES.get(item["type"])
    if template is None:
        message = str(item["msg"]).removeprefix("Value error, ")
        return [line for line in message.split("\n") if line]
    context = {key: str(value).replace(" or ", " или ") for key, value in item.get("ctx", {}).items()}
    try:
        return [template.format(**context)]
    except (KeyError, IndexError):
        return [template]


async def _app_error_handler(request: Request, error: Exception) -> JSONResponse:
    exc = cast(AppError, error)
    return JSONResponse(
        status_code=exc.status_code,
        content=error_body(exc.code, exc.message, exc.fields),
        headers=exc.headers,
    )


async def _validation_error_handler(request: Request, error: Exception) -> JSONResponse:
    exc = cast(RequestValidationError, error)
    fields: dict[str, list[str]] = {}
    for item in exc.errors():
        fields.setdefault(_field_name(tuple(item["loc"])), []).extend(_messages(item))
    return JSONResponse(
        status_code=ValidationFailed.status_code,
        content=error_body(ValidationFailed.code, ValidationFailed.message, fields),
    )


async def _http_error_handler(request: Request, error: Exception) -> JSONResponse:
    exc = cast(StarletteHTTPException, error)
    code = {400: "bad_request", 401: "unauthorized", 403: "forbidden", 404: "not_found", 405: "method_not_allowed"}.get(
        exc.status_code, "http_error"
    )
    return JSONResponse(
        status_code=exc.status_code,
        content=error_body(code, str(exc.detail)),
        headers=getattr(exc, "headers", None),
    )


def register_error_handlers(app: FastAPI) -> None:
    app.add_exception_handler(AppError, _app_error_handler)
    app.add_exception_handler(RequestValidationError, _validation_error_handler)
    app.add_exception_handler(StarletteHTTPException, _http_error_handler)
