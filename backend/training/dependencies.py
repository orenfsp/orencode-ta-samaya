from typing import Annotated

from fastapi import Depends

from audit.dependencies import get_audit
from audit.domain.audit import Audit
from auth.dependencies import CurrentUser, CurrentUserDep
from auth.repositories.pg_users import UserRepository
from core.database import DbSession, UnitOfWork
from core.errors import Forbidden
from dictionaries.repositories.pg_dictionaries import DictionaryRepository
from files.dependencies import get_files
from files.domain.files import Files
from infrastructure.enums import Role
from notifications.dependencies import NotificationsDep
from profiles.repositories.pg_coach_links import CoachLinkRepository
from profiles.repositories.pg_organizations import OrganizationRepository
from profiles.repositories.pg_sport_profiles import SportProfileRepository
from training.domain.access import Access
from training.domain.attestations import Attestations
from training.domain.groups import Groups
from training.domain.journal import Journal
from training.domain.norms import Norms
from training.domain.programs import Programs
from training.repositories.pg_groups import GroupRepository
from training.repositories.pg_norms import NormRepository
from training.repositories.pg_programs import ProgramRepository

AuditDep = Annotated[Audit, Depends(get_audit)]


async def staff(user: CurrentUserDep) -> CurrentUser:
    """Пускает тренера и сотрудника федерации; иначе бросает Forbidden."""
    if not user.roles & {Role.COACH, Role.FEDERATION}:
        raise Forbidden("Раздел для тренеров и федерации")
    return user


StaffDep = Annotated[CurrentUser, Depends(staff)]


def get_access(db: DbSession) -> Access:
    """Собирает проверку прав на группы и спортсменов."""
    return Access(GroupRepository(db), CoachLinkRepository(db))


AccessDep = Annotated[Access, Depends(get_access)]


def get_programs(db: DbSession, audit: AuditDep) -> Programs:
    """Собирает карточку организации с программами и тренерами."""
    return Programs(UnitOfWork(db), ProgramRepository(db), OrganizationRepository(db), GroupRepository(db),
                    UserRepository(db), DictionaryRepository(db), audit)


def get_groups(db: DbSession, audit: AuditDep, access: AccessDep, notifications: NotificationsDep) -> Groups:
    """Собирает учебно-тренировочные группы."""
    return Groups(UnitOfWork(db), GroupRepository(db), ProgramRepository(db), OrganizationRepository(db),
                  SportProfileRepository(db), UserRepository(db), access, audit, notifications)


def get_journal(db: DbSession, audit: AuditDep, access: AccessDep, files: Annotated[Files, Depends(get_files)]) -> Journal:
    """Собирает журнал занятий."""
    return Journal(UnitOfWork(db), GroupRepository(db), files, access, audit)


def get_norms(db: DbSession, audit: AuditDep, access: AccessDep) -> Norms:
    """Собирает нормативы ФССП."""
    return Norms(UnitOfWork(db), NormRepository(db), UserRepository(db), access, audit)


def get_attestations(
    db: DbSession,
    audit: AuditDep,
    access: AccessDep,
    notifications: NotificationsDep,
    groups: Annotated[Groups, Depends(get_groups)],
    norms: Annotated[Norms, Depends(get_norms)],
) -> Attestations:
    """Собирает промежуточную аттестацию."""
    return Attestations(UnitOfWork(db), GroupRepository(db), NormRepository(db), groups, norms, access, audit,
                        notifications)


ProgramsDep = Annotated[Programs, Depends(get_programs)]
GroupsDep = Annotated[Groups, Depends(get_groups)]
JournalDep = Annotated[Journal, Depends(get_journal)]
NormsDep = Annotated[Norms, Depends(get_norms)]
AttestationsDep = Annotated[Attestations, Depends(get_attestations)]
