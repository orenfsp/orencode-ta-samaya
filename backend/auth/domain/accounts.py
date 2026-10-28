import hashlib
import secrets
from datetime import UTC, date, datetime, timedelta, timezone
from typing import Any
from uuid import UUID

from audit.domain.actions import AuditAction
from audit.domain.audit import Audit
from auth.domain.codes import Codes
from auth.domain.password import PasswordHasher
from auth.domain.roles import Roles
from auth.domain.sessions import Sessions
from auth.repositories.pg_login_devices import LoginDeviceRepository
from auth.repositories.pg_users import UserRepository
from auth.repositories.red_forgot_requests import ForgotRequestRepository
from auth.repositories.red_login_attempts import LoginAttemptRepository
from auth.repositories.red_reset_tokens import ResetTokenRepository
from auth.repositories.red_sessions import SessionData
from core.config import Settings
from core.database import UnitOfWork
from core.errors import (
    AccountDisabled,
    EmailTaken,
    InvalidCode,
    InvalidCredentials,
    InvalidStatus,
    InvalidToken,
    NotFound,
    TooManyAttempts,
    Unauthorized,
    ValidationFailed,
)
from infrastructure.enums import Role
from infrastructure.account.user import UserModel
from notifications.domain.notifications import Notifications
from notifications.domain.types import NotificationType

ORENBURG = timezone(timedelta(hours=5))
BROWSERS = (("YaBrowser", "Яндекс Браузер"), ("Edg", "Edge"), ("OPR", "Opera"), ("Firefox", "Firefox"),
            ("Chrome", "Chrome"), ("Safari", "Safari"))
SYSTEMS = (("Android", "Android"), ("iPhone", "iOS"), ("iPad", "iPadOS"), ("Windows", "Windows"),
           ("Mac OS", "macOS"), ("Linux", "Linux"))


def _token_hash(token: str) -> str:
    """Хэширует токен для хранения в Redis."""
    return hashlib.sha256(token.encode()).hexdigest()


def _device(user_agent: str) -> str:
    """Определяет по User-Agent браузер и систему устройства для текста уведомления."""
    browser = next((name for marker, name in BROWSERS if marker in user_agent), "Браузер")
    system = next((name for marker, name in SYSTEMS if marker in user_agent), "неизвестная система")
    return f"{browser}, {system}"


def _now_text() -> str:
    """Текущее время по Оренбургу в формате для уведомлений."""
    return datetime.now(ORENBURG).strftime("%d.%m.%Y %H:%M")


class Account:
    """Регистрация, вход, восстановление доступа и управление профилем пользователя."""

    def __init__(
        self,
        uow: UnitOfWork,
        users: UserRepository,
        login_attempts: LoginAttemptRepository,
        forgot_requests: ForgotRequestRepository,
        reset_tokens: ResetTokenRepository,
        sessions: Sessions,
        audit: Audit,
        hasher: PasswordHasher,
        settings: Settings,
        notifications: Notifications,
        codes: Codes,
        devices: LoginDeviceRepository,
    ) -> None:
        """Сохраняет зависимости."""
        self._codes = codes
        self._devices = devices
        self._uow = uow
        self._users = users
        self._login_attempts = login_attempts
        self._forgot_requests = forgot_requests
        self._reset_tokens = reset_tokens
        self._sessions = sessions
        self._audit = audit
        self._hasher = hasher
        self._settings = settings
        self._notifications = notifications

    async def register(
        self,
        email: str,
        password: str,
        last_name: str,
        first_name: str,
        middle_name: str | None,
        birth_date: date,
        roles: list[Role],
        ip: str | None,
        user_agent: str = "",
    ) -> UserModel:
        """Регистрирует нового пользователя, запускает подтверждение почты и запросы модерируемых ролей."""
        if await self._users.email_exists(email):
            raise EmailTaken(fields={"email": [EmailTaken.message]})
        now = datetime.now(UTC)
        user = await self._users.create(
            email=email,
            password_hash=await self._hasher.hash(password),
            last_name=last_name,
            first_name=first_name,
            middle_name=middle_name,
            birth_date=birth_date,
            pd_consent_version=self._settings.pd_consent_version,
            pd_consent_at=now,
            roles=[(role, Roles.initial_status(role)) for role in roles],
        )
        await self._audit.write(
            AuditAction.AUTH_REGISTER,
            user_id=user.id,
            object_type="user",
            object_id=user.id,
            payload={"roles": [role.value for role in roles]},
            ip=ip,
        )
        for role in roles:
            if role in Roles.MODERATED_ROLES:
                await self._notifications.role_requested(user.id, role)
        code = await self._codes.issue(Codes.VERIFY_EMAIL, user.id, strict=False)
        if code:
            await self._notifications.code(user.id, user.email, NotificationType.AUTH_EMAIL_VERIFY, code)
        await self._devices.remember(user.id, _token_hash(user_agent), user_agent)
        await self._uow.commit()
        return user

    async def authenticate(self, email: str, password: str, ip: str | None, user_agent: str = "") -> UserModel:
        """Проверяет логин и пароль с учётом лимита попыток, уведомляет о входе с нового устройства."""
        if await self._login_attempts.failures(ip, email) >= self._settings.login_max_attempts:
            retry_after = await self._login_attempts.retry_after(ip, email)
            raise TooManyAttempts(headers={"Retry-After": str(retry_after)})

        user = await self._users.get_by_email(email)
        password_ok = await self._hasher.verify(user.password_hash if user else None, password)
        if user is None or not password_ok:
            await self._login_attempts.register_failure(ip, email, self._settings.login_window_seconds)
            await self._audit.write(
                AuditAction.AUTH_LOGIN_FAILED,
                user_id=user.id if user else None,
                payload={"email": email},
                ip=ip,
            )
            await self._uow.commit()
            raise InvalidCredentials()

        if not user.is_active:
            raise AccountDisabled()

        await self._login_attempts.reset(ip, email)
        if self._hasher.needs_rehash(user.password_hash):
            await self._users.set_password_hash(user.id, await self._hasher.hash(password))
        await self._users.set_last_login(user.id, datetime.now(UTC))
        await self._audit.write(AuditAction.AUTH_LOGIN, user_id=user.id, ip=ip)
        known, first = await self._devices.remember(user.id, _token_hash(user_agent), user_agent)
        if not known and not first:
            await self._notifications.security(
                user.id, NotificationType.AUTH_NEW_DEVICE, "Вход с нового устройства",
                f"В аккаунт ФСП вошли с устройства, которого раньше не было: {_device(user_agent)}, "
                f"IP {ip or 'неизвестен'}, {_now_text()} по Оренбургу.\n"
                "Если это были не вы, восстановите доступ и смените пароль.")
        await self._uow.commit()
        return user

    async def start_session(self, old_sid: str | None, user: UserModel) -> SessionData:
        """Закрывает старую сессию, если была, и открывает новую для пользователя."""
        await self._sessions.close_if_exists(old_sid)
        return await self._sessions.open(user.id, user.email, Roles.granted_roles(user))

    async def get_me(self, user_id: UUID, session_roles: frozenset[Role]) -> UserModel:
        """Возвращает активного пользователя, обновляя роли в сессии при их изменении."""
        user = await self._users.get(user_id)
        if user is None or not user.is_active:
            await self._sessions.close_all(user_id)
            raise Unauthorized()
        roles = Roles.granted_roles(user)
        if roles != session_roles:
            await self._sessions.refresh_roles(user.id, roles)
        return user

    async def update_profile(self, user_id: UUID, changes: dict[str, Any], ip: str | None) -> UserModel:
        """Валидирует и сохраняет изменения профиля, пишет в аудит только реально изменённые поля."""
        user = await self.get_user(user_id)
        errors: dict[str, list[str]] = {}
        for name in ("last_name", "first_name", "birth_date"):
            if name in changes and changes[name] is None:
                errors[name] = ["Не может быть пустым"]
        group_id = changes.get("academic_group_id")
        if group_id is not None and not await self._users.academic_group_exists(group_id):
            errors["academic_group_id"] = ["Выберите значение из справочника"]
        if errors:
            raise ValidationFailed(fields=errors)
        if "middle_name" in changes:
            changes["middle_name"] = changes["middle_name"] or None
        diff = {name: value for name, value in changes.items() if getattr(user, name) != value}
        if diff:
            await self._users.update_profile(user_id, diff)
            await self._audit.write(
                AuditAction.PROFILE_UPDATE,
                user_id=user_id,
                object_type="user",
                object_id=user_id,
                payload={
                    name: {"old": str(getattr(user, name)) if getattr(user, name) is not None else None,
                           "new": str(value) if value is not None else None}
                    for name, value in diff.items()
                },
                ip=ip,
            )
            await self._uow.commit()
        return await self.get_user(user_id)

    async def get_user(self, user_id: UUID) -> UserModel:
        """Возвращает пользователя по id; NotFound, если его нет."""
        user = await self._users.get(user_id)
        if user is None:
            raise NotFound()
        return user

    async def logout(self, sid: str, user_id: UUID, ip: str | None) -> None:
        """Закрывает сессию и пишет выход в аудит."""
        await self._sessions.close(sid, user_id)
        await self._audit.write(AuditAction.AUTH_LOGOUT, user_id=user_id, ip=ip)
        await self._uow.commit()

    async def forgot_password(self, email: str, ip: str | None) -> None:
        """Отправляет код восстановления пароля с учётом лимита запросов; молчит, если email неизвестен."""
        requests = await self._forgot_requests.hit(email, self._settings.forgot_window_seconds)
        if requests > self._settings.forgot_max_requests:
            return
        user = await self._users.get_by_email(email)
        if user is None or not user.is_active:
            return
        code = await self._codes.issue(Codes.RESET, user.id, strict=False)
        if code is None:
            return
        await self._notifications.code(user.id, user.email, NotificationType.AUTH_PASSWORD_RESET, code)
        await self._audit.write(AuditAction.AUTH_PASSWORD_RESET_REQUESTED, user_id=user.id, ip=ip)
        await self._uow.commit()

    async def verify_reset_code(self, email: str, code: str) -> str:
        """Проверяет код восстановления и выдаёт одноразовый токен для смены пароля."""
        user = await self._users.get_by_email(email)
        if user is None or not user.is_active:
            raise InvalidCode(fields={"code": ["Неверный или устаревший код"]})
        await self._codes.check(Codes.RESET, user.id, code)
        token = secrets.token_urlsafe(32)
        await self._reset_tokens.save(_token_hash(token), user.id, self._settings.reset_session_ttl_seconds)
        return token

    async def reset_password(self, token: str, password: str, ip: str | None) -> None:
        """Меняет пароль по токену восстановления, завершает все сессии и уведомляет пользователя."""
        user_id = await self._reset_tokens.pop(_token_hash(token))
        if user_id is None:
            raise InvalidToken()
        user = await self._users.get(user_id)
        if user is None or not user.is_active:
            raise InvalidToken()
        await self._users.set_password_hash(user.id, await self._hasher.hash(password))
        await self._users.set_email_verified(user.id, datetime.now(UTC))
        await self._audit.write(AuditAction.AUTH_PASSWORD_RESET, user_id=user.id, ip=ip)
        await self._notifications.security(
            user.id, NotificationType.AUTH_PASSWORD_CHANGED, "Пароль изменён",
            f"Пароль от аккаунта ФСП изменён {_now_text()} по Оренбургу. Все входы на других устройствах завершены.\n"
            "Если это были не вы, восстановите доступ по почте.")
        await self._uow.commit()
        await self._sessions.close_all(user.id)
        await self._login_attempts.reset_email(user.email)

    async def send_email_code(self, user_id: UUID) -> None:
        """Отправляет код подтверждения почты; InvalidStatus, если почта уже подтверждена."""
        user = await self.get_user(user_id)
        if user.email_verified_at is not None:
            raise InvalidStatus("Почта уже подтверждена")
        code = await self._codes.issue(Codes.VERIFY_EMAIL, user.id)
        if code:
            await self._notifications.code(user.id, user.email, NotificationType.AUTH_EMAIL_VERIFY, code)
        await self._uow.commit()

    async def confirm_email(self, user_id: UUID, code: str, ip: str | None) -> None:
        """Подтверждает почту по коду; ничего не делает, если она уже подтверждена."""
        user = await self.get_user(user_id)
        if user.email_verified_at is not None:
            return
        await self._codes.check(Codes.VERIFY_EMAIL, user.id, code)
        await self._users.set_email_verified(user.id, datetime.now(UTC))
        await self._audit.write(AuditAction.AUTH_EMAIL_VERIFIED, user_id=user.id, object_type="user",
                                object_id=user.id, ip=ip)
        await self._uow.commit()

    async def request_email_change(self, user_id: UUID, new_email: str, password: str) -> None:
        """Проверяет пароль и новую почту, отправляет код подтверждения смены почты."""
        user = await self.get_user(user_id)
        if not await self._hasher.verify(user.password_hash, password):
            raise ValidationFailed(fields={"password": ["Неверный пароль"]})
        if new_email == user.email:
            raise ValidationFailed(fields={"new_email": ["Это ваша текущая почта"]})
        if await self._users.email_exists(new_email):
            raise EmailTaken(fields={"new_email": [EmailTaken.message]})
        code = await self._codes.issue(Codes.CHANGE_EMAIL, user.id, payload=new_email)
        if code:
            await self._notifications.code(user.id, new_email, NotificationType.AUTH_EMAIL_CHANGE, code)
        await self._uow.commit()

    async def confirm_email_change(self, user_id: UUID, code: str, ip: str | None) -> UserModel:
        """Подтверждает смену почты по коду, завершает все сессии и уведомляет пользователя."""
        user = await self.get_user(user_id)
        new_email = await self._codes.check(Codes.CHANGE_EMAIL, user.id, code)
        if await self._users.email_exists(new_email):
            raise EmailTaken(fields={"code": [EmailTaken.message]})
        old_email = user.email
        await self._users.set_email(user.id, new_email, datetime.now(UTC))
        await self._audit.write(AuditAction.PROFILE_EMAIL_CHANGE, user_id=user.id, object_type="user",
                                object_id=user.id, payload={"email": {"old": old_email, "new": new_email}}, ip=ip)
        await self._notifications.security(
            user.id, NotificationType.AUTH_EMAIL_CHANGED, "Почта изменена",
            f"Почта аккаунта ФСП изменена с {old_email} на {new_email} {_now_text()} по Оренбургу.\n"
            "Если это были не вы, срочно восстановите доступ.", old_address=old_email)
        await self._uow.commit()
        await self._sessions.close_all(user.id)
        return await self.get_user(user.id)
