from collections.abc import Sequence
from dataclasses import dataclass
from typing import Any
from datetime import date, datetime
from uuid import UUID
from zoneinfo import ZoneInfo

from audit.domain.actions import AuditAction
from audit.domain.audit import Audit
from auth.repositories.pg_users import UserRepository
from core.database import UnitOfWork
from core.errors import Forbidden, NotFound, ValidationFailed
from dictionaries.repositories.pg_dictionaries import DictionaryRepository
from files.domain.files import Files
from infrastructure.sport.antidoping_certificate import AntidopingCertificateModel
from infrastructure.sport.athlete_discipline import AthleteDisciplineModel
from infrastructure.sport.athlete_organization import AthleteOrganizationModel
from infrastructure.sport.athlete_profile import AthleteProfileModel
from infrastructure.sport.coach_link import CoachLinkModel
from infrastructure.dictionaries.dictionary_discipline import DictionaryDisciplineModel
from infrastructure.dictionaries.dictionary_municipality import DictionaryMunicipalityModel
from infrastructure.enums import CoachLinkStatus, Sex, TrainingStage
from infrastructure.account.user import UserModel
from profiles.repositories.pg_coach_links import CoachLinkRepository
from profiles.repositories.pg_organizations import OrganizationRepository
from profiles.repositories.pg_sport_profiles import SportProfileRepository

ANTIDOPING_MONTHS = 12


def today() -> date:
    """Возвращает текущую дату по Оренбургу."""
    return datetime.now(ZoneInfo("Asia/Yekaterinburg")).date()


def plus_year(start: date) -> date:
    """Возвращает ту же дату через год; 29 февраля переходит на 28-е."""
    try:
        return start.replace(year=start.year + 1)
    except ValueError:
        return start.replace(year=start.year + 1, day=28)


@dataclass(frozen=True, slots=True)
class ProfileChange:
    municipality_id: int | None
    sex: Sex | None
    organization_id: int | None
    no_organization: bool
    start_year: int | None
    training_stage: TrainingStage | None
    discipline_ids: list[int]


@dataclass(frozen=True, slots=True)
class SportProfile:
    user: UserModel
    profile: AthleteProfileModel | None
    disciplines: Sequence[AthleteDisciplineModel]
    organizations: Sequence[AthleteOrganizationModel]
    coaches: Sequence[CoachLinkModel]
    antidoping: Sequence[AntidopingCertificateModel]


class SportProfiles:
    """Спортивный профиль: организация, дисциплины с периодами, этап подготовки, антидопинг."""

    def __init__(
        self,
        uow: UnitOfWork,
        profiles: SportProfileRepository,
        organizations: OrganizationRepository,
        links: CoachLinkRepository,
        users: UserRepository,
        dictionary: DictionaryRepository,
        files: Files,
        audit: Audit,
    ) -> None:
        """Сохраняет зависимости."""
        self._uow, self._profiles, self._organizations, self._links = uow, profiles, organizations, links
        self._users, self._dictionary, self._files, self._audit = users, dictionary, files, audit

    async def get(self, user_id: UUID) -> SportProfile:
        """Собирает спортивный профиль: организация, дисциплины, история, тренеры, антидопинг."""
        user = await self._users.get(user_id)
        if user is None:
            raise NotFound()
        links = [link for link in await self._links.of_athlete(user_id) if link.status == CoachLinkStatus.ACTIVE]
        return SportProfile(
            user=user,
            profile=await self._profiles.profile(user_id),
            disciplines=await self._profiles.disciplines(user_id),
            organizations=await self._profiles.organizations(user_id),
            coaches=links,
            antidoping=await self._profiles.certificates(user_id),
        )

    async def update(self, user_id: UUID, change: ProfileChange, ip: str | None) -> SportProfile:
        """Сохраняет профиль, закрывая и открывая периоды дисциплин и организации с сегодняшнего дня."""
        user = await self._users.get(user_id)
        if user is None:
            raise NotFound()
        await self._check(change)
        now = today()
        profile = await self._profiles.ensure(user_id)
        before = {
            "municipality_id": user.municipality_id, "organization_id": profile.organization_id,
            "start_year": profile.start_year, "training_stage": profile.training_stage, "sex": profile.sex,
        }
        organization_id = None if change.no_organization else change.organization_id
        if profile.organization_id != organization_id or profile.no_organization != change.no_organization:
            current = await self._profiles.open_organization(user_id)
            if current is not None:
                current.valid_to = now
            self._profiles.add(AthleteOrganizationModel(user_id=user_id, organization_id=organization_id, valid_from=now))
        user.municipality_id = change.municipality_id
        profile.sex, profile.organization_id, profile.no_organization = change.sex, organization_id, change.no_organization
        profile.start_year, profile.training_stage = change.start_year, change.training_stage
        wanted = set(change.discipline_ids)
        existing = {item.discipline_id: item for item in await self._profiles.disciplines(user_id)}
        for discipline_id, item in existing.items():
            if discipline_id not in wanted:
                item.valid_to = now
        for discipline_id in wanted - set(existing):
            self._profiles.add(AthleteDisciplineModel(user_id=user_id, discipline_id=discipline_id, valid_from=now))
        await self._profiles.flush()
        after = {
            "municipality_id": user.municipality_id, "organization_id": profile.organization_id,
            "start_year": profile.start_year, "training_stage": profile.training_stage, "sex": profile.sex,
        }
        changed: dict[str, dict[str, Any]] = {name: {"old": str(before[name]) if before[name] is not None else None,
                          "new": str(value) if value is not None else None}
                   for name, value in after.items() if before[name] != value}
        if set(existing) != wanted:
            changed["disciplines"] = {"old": sorted(existing), "new": sorted(wanted)}
        if changed:
            await self._audit.write(AuditAction.SPORT_PROFILE_UPDATE, user_id, "user", user_id, changed, ip)
        await self._uow.commit()
        await self._profiles.refresh(profile, user)
        return await self.get(user_id)

    async def add_antidoping(
        self, user_id: UUID, passed_on: date, certificate_url: str | None, file_id: UUID | None, ip: str | None
    ) -> SportProfile:
        """Добавляет сертификат РУСАДА со сроком на год от даты прохождения."""
        if passed_on > today():
            raise ValidationFailed(fields={"passed_on": ["Дата из будущего"]})
        if not certificate_url and file_id is None:
            raise ValidationFailed(fields={"certificate_url": ["Укажите ссылку на сертификат или приложите файл"]})
        if file_id is not None:
            _, error = await self._files.usable([file_id], user_id, False, Files.DOCUMENT_TYPES | Files.IMAGE_TYPES)
            if error:
                raise ValidationFailed(fields={"file_id": ["Загрузите PDF или изображение" if error == "type" else error]})
        self._profiles.add(AntidopingCertificateModel(
            user_id=user_id, passed_on=passed_on, valid_until=plus_year(passed_on),
            certificate_url=certificate_url, file_id=file_id,
        ))
        await self._profiles.flush()
        await self._audit.write(AuditAction.ANTIDOPING_SAVE, user_id, "user", user_id,
                                {"passed_on": passed_on.isoformat()}, ip)
        await self._uow.commit()
        return await self.get(user_id)

    async def remove_antidoping(self, user_id: UUID, certificate_id: UUID) -> SportProfile:
        """Удаляет свой сертификат РУСАДА."""
        item = await self._profiles.certificate(certificate_id)
        if item is None:
            raise NotFound()
        if item.user_id != user_id:
            raise Forbidden()
        await self._profiles.remove(item)
        await self._uow.commit()
        return await self.get(user_id)

    async def _check(self, change: ProfileChange) -> None:
        """Проверяет поля профиля и справочные ссылки; бросает ValidationFailed."""
        errors: dict[str, list[str]] = {}
        if change.municipality_id is not None and await self._dictionary.get(
            DictionaryMunicipalityModel, change.municipality_id
        ) is None:
            errors["municipality_id"] = ["Выберите муниципалитет из справочника"]
        if change.organization_id is not None and not change.no_organization:
            organization = await self._organizations.get(change.organization_id)
            if organization is None or not organization.is_active:
                errors["organization_id"] = ["Выберите организацию из списка"]
        if change.start_year is not None and not 1950 <= change.start_year <= today().year:
            errors["start_year"] = ["Год от 1950 до текущего"]
        for discipline_id in change.discipline_ids:
            item = await self._dictionary.get(DictionaryDisciplineModel, discipline_id)
            if item is None or item.is_archived:
                errors["discipline_ids"] = ["Выберите дисциплины из справочника"]
        if errors:
            raise ValidationFailed(fields=errors)
