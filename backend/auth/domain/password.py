import asyncio

from argon2 import PasswordHasher as Argon2Hasher
from argon2.exceptions import InvalidHashError, VerificationError, VerifyMismatchError


class PasswordPolicy:
    min_length = 8
    max_length = 128

    @classmethod
    def violations(cls, password: str) -> list[str]:
        problems: list[str] = []
        if len(password) < cls.min_length:
            problems.append(f"Пароль должен быть не короче {cls.min_length} символов")
        if len(password) > cls.max_length:
            problems.append(f"Пароль должен быть не длиннее {cls.max_length} символов")
        if not any(char.islower() for char in password):
            problems.append("Пароль должен содержать строчную букву")
        if not any(char.isupper() for char in password):
            problems.append("Пароль должен содержать заглавную букву")
        if not any(char.isdigit() for char in password):
            problems.append("Пароль должен содержать цифру")
        return problems


class PasswordHasher:
    def __init__(self) -> None:
        self._hasher = Argon2Hasher()
        self._dummy_hash = self._hasher.hash("dummy-password-for-timing")

    async def hash(self, password: str) -> str:
        return await asyncio.to_thread(self._hasher.hash, password)

    async def verify(self, password_hash: str | None, password: str) -> bool:
        try:
            return await asyncio.to_thread(self._hasher.verify, password_hash or self._dummy_hash, password)
        except (VerifyMismatchError, VerificationError, InvalidHashError):
            return False

    def needs_rehash(self, password_hash: str) -> bool:
        return self._hasher.check_needs_rehash(password_hash)


password_hasher = PasswordHasher()
