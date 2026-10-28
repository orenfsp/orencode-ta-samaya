import asyncio
import logging
import re
from collections.abc import Callable
from datetime import UTC, datetime
from typing import Any
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from audit.domain.actions import AuditAction
from audit.domain.audit import Audit
from people.clients.codeforces import CodeforcesClient, CodeforcesUnavailable
from people.repositories.pg_codeforces import CodeforcesRepository
from core.config import Settings
from core.database import UnitOfWork
from core.errors import NotFound
from infrastructure.enums import CodeforcesStatus
from infrastructure.account.user import UserModel

S = CodeforcesStatus
NOT_FOUND = re.compile(r"handle (\S+) not found", re.IGNORECASE)
CLEARED = {
    "codeforces_handle": None,
    "codeforces_rating": None,
    "codeforces_max_rating": None,
    "codeforces_rank": None,
    "codeforces_status": None,
    "codeforces_updated_at": None,
}

logger = logging.getLogger("fsp.codeforces")


class Fetcher:
    """Получает данные пользователей Codeforces, вычищая несуществующие хэндлы по сообщению об ошибке."""

    def __init__(self, client: CodeforcesClient, pause: float) -> None:
        """Сохраняет клиент Codeforces и паузу между повторными запросами."""
        self._client = client
        self._pause = pause

    async def fetch(self, handles: list[str]) -> tuple[dict[str, dict[str, Any]], set[str]]:
        """Запрашивает данные хэндлов; возвращает найденных и отдельно ненайденных, повторяя запрос без них."""
        missing: set[str] = set()
        left = list(handles)
        while left:
            body = await self._client.user_info(left)
            if body.get("status") == "OK":
                users = {str(item.get("handle", "")).lower(): item for item in body.get("result", [])}
                return {handle: users[handle.lower()] for handle in left if handle.lower() in users}, missing
            match = NOT_FOUND.search(str(body.get("comment", "")))
            if not match:
                raise CodeforcesUnavailable(str(body.get("comment") or "unknown error"))
            bad = match.group(1).lower()
            missing.update(handle for handle in left if handle.lower() == bad)
            remaining = [handle for handle in left if handle.lower() != bad]
            if len(remaining) == len(left):
                raise CodeforcesUnavailable(str(body.get("comment")))
            left = remaining
            if left:
                await asyncio.sleep(self._pause)
        return {}, missing


def _values(item: dict[str, Any]) -> dict[str, Any]:
    """Превращает данные пользователя Codeforces в поля для сохранения."""
    return {
        "codeforces_rating": item.get("rating"),
        "codeforces_max_rating": item.get("maxRating"),
        "codeforces_rank": item.get("rank"),
        "codeforces_status": S.OK,
        "codeforces_updated_at": datetime.now(UTC),
    }


async def apply(repository: CodeforcesRepository, found: dict[str, dict[str, Any]], missing: set[str]) -> None:
    """Сохраняет полученные рейтинги и помечает ненайденные хэндлы."""
    for handle, item in found.items():
        await repository.set_handle(handle, _values(item))
    for handle in missing:
        await repository.set_handle(
            handle,
            {
                "codeforces_status": S.NOT_FOUND,
                "codeforces_rating": None,
                "codeforces_max_rating": None,
                "codeforces_rank": None,
                "codeforces_updated_at": datetime.now(UTC),
            },
        )


class Codeforces:
    """Привязывает и отвязывает хэндл Codeforces пользователя, обновляя его рейтинг."""

    def __init__(
        self, uow: UnitOfWork, repository: CodeforcesRepository, fetcher: Fetcher, audit: Audit
    ) -> None:
        """Сохраняет зависимости."""
        self._uow = uow
        self._repository = repository
        self._fetcher = fetcher
        self._audit = audit

    async def set_handle(self, user_id: UUID, handle: str, ip: str | None) -> UserModel:
        """Привязывает новый хэндл пользователю, сбрасывает старые данные и пытается сразу подтянуть рейтинг."""
        user = await self._user(user_id)
        old = user.codeforces_handle
        if old != handle:
            await self._repository.set_user(user_id, {**CLEARED, "codeforces_handle": handle, "codeforces_status": S.PENDING})
            await self._audit.write(
                AuditAction.PROFILE_UPDATE,
                user_id=user_id,
                object_type="user",
                object_id=user_id,
                payload={"codeforces_handle": {"old": old, "new": handle}},
                ip=ip,
            )
            await self._uow.commit()
            try:
                found, missing = await self._fetcher.fetch([handle])
                await apply(self._repository, found, missing)
                await self._uow.commit()
            except CodeforcesUnavailable as error:
                logger.warning("Codeforces недоступен, %s останется pending: %s", handle, error)
        return await self._user(user_id)

    async def remove(self, user_id: UUID, ip: str | None) -> None:
        """Отвязывает хэндл Codeforces пользователя, если он был привязан."""
        user = await self._user(user_id)
        if user.codeforces_handle is None:
            return
        await self._repository.set_user(user_id, CLEARED)
        await self._audit.write(
            AuditAction.PROFILE_UPDATE,
            user_id=user_id,
            object_type="user",
            object_id=user_id,
            payload={"codeforces_handle": {"old": user.codeforces_handle, "new": None}},
            ip=ip,
        )
        await self._uow.commit()

    async def _user(self, user_id: UUID) -> UserModel:
        """Возвращает пользователя по id или поднимает NotFound."""
        user = await self._repository.user(user_id)
        if user is None:
            raise NotFound()
        return user


class CodeforcesWatcher:
    """Фоновый процесс, периодически обновляющий рейтинги Codeforces у всех привязанных хэндлов."""

    def __init__(
        self, sessions: async_sessionmaker[AsyncSession], fetcher: Callable[[], Fetcher], settings: Settings
    ) -> None:
        """Сохраняет фабрику сессий, фабрику Fetcher и параметры обновления из настроек."""
        self._sessions = sessions
        self._fetcher = fetcher
        self._interval = settings.codeforces_interval_seconds
        self._batch = settings.codeforces_batch
        self._pause = settings.codeforces_pause_seconds

    async def tick(self) -> int:
        """Обновляет рейтинги всех хэндлов пачками; возвращает число обработанных хэндлов."""
        async with self._sessions() as db:
            repository = CodeforcesRepository(db)
            handles = list(await repository.handles())
            fetcher = self._fetcher()
            updated = 0
            for start in range(0, len(handles), self._batch):
                if start:
                    await asyncio.sleep(self._pause)
                found, missing = await fetcher.fetch(handles[start : start + self._batch])
                await apply(repository, found, missing)
                await db.commit()
                updated += len(found) + len(missing)
            return updated

    async def run(self) -> None:
        """Бесконечно обновляет рейтинги с заданным интервалом, не падая из-за ошибок Codeforces."""
        while True:
            try:
                count = await self.tick()
                logger.info("Codeforces: обновлено хэндлов %s", count)
            except asyncio.CancelledError:
                raise
            except CodeforcesUnavailable as error:
                logger.warning("Codeforces недоступен, прошлые значения сохранены: %s", error)
            except Exception:
                logger.exception("Codeforces: ошибка обновления")
            await asyncio.sleep(self._interval)
