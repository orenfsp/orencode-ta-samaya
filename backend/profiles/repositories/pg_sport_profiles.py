from collections.abc import Sequence
from datetime import date
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from infrastructure.sport.antidoping_certificate import AntidopingCertificateModel
from infrastructure.sport.athlete_discipline import AthleteDisciplineModel
from infrastructure.sport.athlete_organization import AthleteOrganizationModel
from infrastructure.sport.athlete_profile import AthleteProfileModel


class SportProfileRepository:
    def __init__(self, db: AsyncSession) -> None:
        """Сохраняет сессию БД."""
        self._db = db

    async def profile(self, user_id: UUID) -> AthleteProfileModel | None:
        """Возвращает спортивный профиль или None."""
        return await self._db.get(AthleteProfileModel, user_id)

    async def ensure(self, user_id: UUID) -> AthleteProfileModel:
        """Возвращает спортивный профиль, создавая пустой при первом обращении."""
        item = await self.profile(user_id)
        if item is None:
            item = AthleteProfileModel(user_id=user_id)
            self._db.add(item)
            await self._db.flush()
        return item

    async def disciplines(self, user_id: UUID) -> Sequence[AthleteDisciplineModel]:
        """Возвращает периоды дисциплин спортсмена, новые первыми."""
        query = select(AthleteDisciplineModel).where(
            AthleteDisciplineModel.user_id == user_id, AthleteDisciplineModel.valid_to.is_(None)
        )
        return (await self._db.scalars(query.order_by(AthleteDisciplineModel.valid_from))).all()

    async def open_organization(self, user_id: UUID) -> AthleteOrganizationModel | None:
        """Возвращает незакрытый период организации спортсмена или None."""
        query = select(AthleteOrganizationModel).where(
            AthleteOrganizationModel.user_id == user_id, AthleteOrganizationModel.valid_to.is_(None)
        )
        return await self._db.scalar(query)

    async def organizations(self, user_id: UUID) -> Sequence[AthleteOrganizationModel]:
        """Возвращает историю организаций спортсмена."""
        query = select(AthleteOrganizationModel).where(AthleteOrganizationModel.user_id == user_id)
        return (await self._db.scalars(query.order_by(AthleteOrganizationModel.valid_from.desc()))).all()

    async def certificates(self, user_id: UUID) -> Sequence[AntidopingCertificateModel]:
        """Возвращает сертификаты РУСАДА спортсмена, свежие первыми."""
        query = select(AntidopingCertificateModel).where(AntidopingCertificateModel.user_id == user_id)
        return (await self._db.scalars(query.order_by(AntidopingCertificateModel.passed_on.desc()))).all()

    async def certificate(self, certificate_id: UUID) -> AntidopingCertificateModel | None:
        """Возвращает сертификат по id или None."""
        return await self._db.get(AntidopingCertificateModel, certificate_id)

    async def expiring_certificates(self, until: date) -> Sequence[AntidopingCertificateModel]:
        """Возвращает последние сертификаты спортсменов, истекающие до даты."""
        latest = (
            select(AntidopingCertificateModel.user_id, AntidopingCertificateModel.passed_on)
            .distinct(AntidopingCertificateModel.user_id)
            .order_by(AntidopingCertificateModel.user_id, AntidopingCertificateModel.passed_on.desc())
            .subquery()
        )
        query = select(AntidopingCertificateModel).join(
            latest,
            (latest.c.user_id == AntidopingCertificateModel.user_id)
            & (latest.c.passed_on == AntidopingCertificateModel.passed_on),
        ).where(AntidopingCertificateModel.valid_until <= until)
        return (await self._db.scalars(query)).all()

    def add(self, item: AthleteDisciplineModel | AthleteOrganizationModel | AntidopingCertificateModel) -> None:
        """Добавляет период дисциплины, организации или сертификат."""
        self._db.add(item)

    async def remove(self, item: AntidopingCertificateModel) -> None:
        """Удаляет сертификат."""
        await self._db.delete(item)
        await self._db.flush()

    async def refresh(self, *items: object) -> None:
        """Перечитывает объекты из БД."""
        for item in items:
            await self._db.refresh(item)

    async def flush(self) -> None:
        """Отправляет накопленные изменения в БД."""
        await self._db.flush()
