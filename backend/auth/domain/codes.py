import hashlib
import json
import secrets
from uuid import UUID

from auth.repositories.red_codes import CodeRepository
from core.config import Settings
from core.errors import InvalidCode, TooManyAttempts


def _digest(user_id: UUID, purpose: str, code: str) -> str:
    """Хэширует код с привязкой к пользователю и назначению для хранения в Redis."""
    return hashlib.sha256(f"{user_id}:{purpose}:{code}".encode()).hexdigest()


class Codes:
    """Выдача и проверка одноразовых шестизначных кодов (сброс пароля, подтверждение почты)."""

    RESET = "reset"
    VERIFY_EMAIL = "verify_email"
    CHANGE_EMAIL = "change_email"

    def __init__(self, repository: CodeRepository, settings: Settings) -> None:
        """Сохраняет зависимости."""
        self._repository, self._settings = repository, settings

    async def issue(self, purpose: str, user_id: UUID, payload: str = "", strict: bool = True) -> str | None:
        """Генерирует и сохраняет новый код с учётом задержки повторной отправки; None, если не strict и рано."""
        if not await self._repository.hold(purpose, user_id, self._settings.code_resend_seconds):
            if not strict:
                return None
            left = await self._repository.hold_left(purpose, user_id)
            raise TooManyAttempts(f"Новый код можно запросить через {left} с", headers={"Retry-After": str(left)})
        code = f"{secrets.randbelow(1_000_000):06d}"
        value = json.dumps({"hash": _digest(user_id, purpose, code), "payload": payload})
        await self._repository.save(purpose, user_id, value, self._settings.code_ttl_seconds)
        return code

    async def check(self, purpose: str, user_id: UUID, code: str) -> str:
        """Проверяет код и возвращает сохранённый payload; считает неудачные попытки и ограничивает их число."""
        raw = await self._repository.get(purpose, user_id)
        if raw is None:
            raise InvalidCode(fields={"code": ["Код устарел. Запросите новый"]})
        stored = json.loads(raw)
        if secrets.compare_digest(stored["hash"], _digest(user_id, purpose, code)):
            await self._repository.drop(purpose, user_id)
            return stored["payload"]
        left = self._settings.code_max_attempts - await self._repository.fail(
            purpose, user_id, self._settings.code_ttl_seconds)
        if left <= 0:
            await self._repository.drop(purpose, user_id)
            raise InvalidCode(fields={"code": ["Код больше не действует. Запросите новый"]})
        raise InvalidCode(fields={"code": [f"Неверный код. Осталось попыток: {left}"]})
