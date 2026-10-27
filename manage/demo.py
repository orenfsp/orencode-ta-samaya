from dataclasses import dataclass
from datetime import UTC, date, datetime
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from auth.domain.password import password_hasher
from auth.domain.roles import Roles
from auth.repositories.pg_user_roles import UserRoleRepository
from auth.repositories.pg_users import UserRepository
from core.config import settings
from infrastructure.enums import Role, RoleStatus

V = RoleStatus.VERIFIED
P = RoleStatus.PENDING
R = RoleStatus.REJECTED


@dataclass(frozen=True, slots=True)
class DemoAccount:
    email: str
    last_name: str
    first_name: str
    middle_name: str | None
    birth_date: date
    roles: tuple[tuple[Role, RoleStatus], ...]


DEMO_ACCOUNTS = (
    DemoAccount("federation@example.test", "Федеральцев", "Олег", "Викторович", date(1980, 4, 12), ((Role.FEDERATION, V),)),
    DemoAccount("minister@example.test", "Министров", "Пётр", "Сергеевич", date(1975, 9, 3), ((Role.FEDERATION, V),)),
    DemoAccount("organizer@example.test", "Организаторова", "Елена", "Павловна", date(1988, 1, 20), ((Role.ORGANIZER, V),)),
    DemoAccount("organizer.pending@example.test", "Петрова", "Анна", "Сергеевна", date(1990, 7, 15), ((Role.ORGANIZER, P),)),
    DemoAccount("athlete@example.test", "Соколов", "Артём", "Игоревич", date(2006, 3, 1), ((Role.ATHLETE, V),)),
    DemoAccount("athlete.second@example.test", "Морозова", "Дарья", "Ильинична", date(2009, 9, 1), ((Role.ATHLETE, V),)),
    DemoAccount("athlete.third@example.test", "Гусев", "Тимур", "Ринатович", date(2005, 2, 11), ((Role.ATHLETE, V),)),
    DemoAccount("pupil1@example.test", "Ковалёв", "Никита", "Сергеевич", date(2010, 2, 14), ((Role.ATHLETE, V),)),
    DemoAccount("pupil2@example.test", "Фёдорова", "Алиса", "Романовна", date(2011, 7, 3), ((Role.ATHLETE, V),)),
    DemoAccount("pupil3@example.test", "Ахмедов", "Руслан", "Тимурович", date(2009, 12, 20), ((Role.ATHLETE, V),)),
    DemoAccount("athlete.minor@example.test", "Белова", "Мария", "Андреевна", date(2012, 5, 18), ((Role.ATHLETE, V),)),
    DemoAccount("coach@example.test", "Тренеров", "Игорь", "Николаевич", date(1985, 11, 2), ((Role.COACH, V),)),
    DemoAccount("coach.unverified@example.test", "Новиков", "Денис", None, date(1995, 2, 27), ((Role.COACH, P),)),
    DemoAccount("judge@example.test", "Орлов", "Павел", "Дмитриевич", date(1983, 6, 9), ((Role.JUDGE, V),)),
    DemoAccount("judge.pending@example.test", "Лебедев", "Максим", "Андреевич", date(1991, 4, 22), ((Role.JUDGE, P),)),
    DemoAccount("judge.rejected@example.test", "Зайцев", "Роман", "Олегович", date(1992, 12, 30), ((Role.JUDGE, R),)),
    DemoAccount("athlete.coach@example.test", "Кузнецов", "Илья", "Петрович", date(2001, 8, 14), ((Role.ATHLETE, V), (Role.COACH, V))),
    DemoAccount("coach.judge@example.test", "Зайцева", "Ольга", "Михайловна", date(1979, 10, 5), ((Role.COACH, V), (Role.JUDGE, V))),
)

REJECT_REASON = "Не приложен документ о судейской квалификации"


async def seed_demo(db: AsyncSession) -> None:
    users = UserRepository(db)
    user_roles = UserRoleRepository(db)
    password_hash = await password_hasher.hash(settings.demo_password)
    now = datetime.now(UTC)
    federation_id: UUID | None = None
    for account in DEMO_ACCOUNTS:
        if await users.email_exists(account.email):
            continue
        user = await users.create(
            email=account.email,
            password_hash=password_hash,
            last_name=account.last_name,
            first_name=account.first_name,
            middle_name=account.middle_name,
            birth_date=account.birth_date,
            pd_consent_version=settings.pd_consent_version,
            pd_consent_at=now,
            roles=list(account.roles),
        )
        if Role.FEDERATION in Roles.granted_roles(user) and federation_id is None:
            federation_id = user.id
        for item in user.roles:
            if federation_id is None or item.role in Roles.AUTO_VERIFIED_ROLES or item.status == P:
                continue
            reason = REJECT_REASON if item.status == R else None
            await user_roles.decide(item.id, item.status, reason, federation_id, now)
    await db.commit()
