from typing import Annotated

from fastapi import Depends

from audit.dependencies import get_audit
from audit.domain.audit import Audit
from auth.repositories.pg_users import UserRepository
from core.database import DbSession, UnitOfWork
from dictionaries.repositories.pg_dictionaries import DictionaryRepository
from files.dependencies import get_files
from files.domain.files import Files
from notifications.dependencies import NotificationsDep
from profiles.domain.coach_links import CoachLinks
from profiles.domain.organizations import Organizations
from profiles.domain.sport_profiles import SportProfiles
from profiles.repositories.pg_coach_links import CoachLinkRepository
from profiles.repositories.pg_organizations import OrganizationRepository
from profiles.repositories.pg_sport_profiles import SportProfileRepository


def get_organizations(db: DbSession, audit: Annotated[Audit, Depends(get_audit)]) -> Organizations:
    """Собирает сервис организаций для запроса."""
    return Organizations(UnitOfWork(db), OrganizationRepository(db), DictionaryRepository(db), audit)


def get_sport_profiles(
    db: DbSession, audit: Annotated[Audit, Depends(get_audit)], files: Annotated[Files, Depends(get_files)]
) -> SportProfiles:
    """Собирает сервис спортивных профилей для запроса."""
    return SportProfiles(UnitOfWork(db), SportProfileRepository(db), OrganizationRepository(db), CoachLinkRepository(db),
                         UserRepository(db), DictionaryRepository(db), files, audit)


def get_coach_links(db: DbSession, audit: Annotated[Audit, Depends(get_audit)], notifications: NotificationsDep) -> CoachLinks:
    """Собирает сервис связей тренер ↔ спортсмен для запроса."""
    return CoachLinks(UnitOfWork(db), CoachLinkRepository(db), UserRepository(db), DictionaryRepository(db), audit,
                      notifications)


OrganizationsDep = Annotated[Organizations, Depends(get_organizations)]
SportProfilesDep = Annotated[SportProfiles, Depends(get_sport_profiles)]
CoachLinksDep = Annotated[CoachLinks, Depends(get_coach_links)]
