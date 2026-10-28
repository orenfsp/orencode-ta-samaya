from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import exists, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from infrastructure.account.login_device import LoginDeviceModel


class LoginDeviceRepository:
    def __init__(self, db: AsyncSession) -> None:
        """Сохраняет зависимость."""
        self._db = db

    async def remember(self, user_id: UUID, fingerprint: str, user_agent: str) -> tuple[bool, bool]:
        """Обновляет время последнего входа с устройства или добавляет новое; (known, first)."""
        now = datetime.now(UTC)
        known = await self._db.execute(update(LoginDeviceModel).where(
            LoginDeviceModel.user_id == user_id, LoginDeviceModel.fingerprint == fingerprint)
            .values(last_seen=now).returning(LoginDeviceModel.id))
        if known.first() is not None:
            return True, False
        first = not await self._db.scalar(select(exists().where(LoginDeviceModel.user_id == user_id)))
        self._db.add(LoginDeviceModel(user_id=user_id, fingerprint=fingerprint, user_agent=user_agent[:500],
                                      first_seen=now, last_seen=now))
        await self._db.flush()
        return False, first
