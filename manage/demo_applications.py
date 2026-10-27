from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from applications.domain.eligibility import Eligibility
from infrastructure.contest import ContestModel
from infrastructure.contest_application import ContestApplicationModel
from infrastructure.contest_application_member import ContestApplicationMemberModel
from infrastructure.dictionary_academic_group import DictionaryAcademicGroupModel
from infrastructure.dictionary_age_group import DictionaryAgeGroupModel
from infrastructure.enums import ApplicationCreator, ApplicationStatus, MemberConfirmation
from infrastructure.user import UserModel

S = ApplicationStatus
C = MemberConfirmation

ACADEMIC_GROUPS = {
    "athlete@example.test": "Студенты",
    "athlete.minor@example.test": "5–9 классы",
    "athlete.coach@example.test": "Студенты",
    "athlete.second@example.test": "10–11 классы",
    "athlete.third@example.test": "Студенты",
    "pupil1@example.test": "10–11 классы",
    "pupil2@example.test": "5–9 классы",
    "pupil3@example.test": "10–11 классы",
}

ALGORITHMS = "Первенство Оренбургской области по алгоритмическому программированию"
CTF = "Открытый турнир по информационной безопасности (CTF)"

DEMO = [
    {
        "contest": ALGORITHMS,
        "creator": "athlete.minor@example.test",
        "as": ApplicationCreator.ATHLETE,
        "status": S.APPROVED,
        "members": [("athlete.minor@example.test", C.CONFIRMED, False)],
    },
    {
        "contest": ALGORITHMS,
        "creator": "athlete.second@example.test",
        "as": ApplicationCreator.ATHLETE,
        "status": S.SUBMITTED,
        "members": [("athlete.second@example.test", C.CONFIRMED, False)],
    },
    {
        "contest": CTF,
        "creator": "athlete@example.test",
        "as": ApplicationCreator.ATHLETE,
        "team_name": "Байтики",
        "status": S.FORMING,
        "members": [("athlete@example.test", C.CONFIRMED, True), ("athlete.minor@example.test", C.INVITED, False)],
    },
    {
        "contest": CTF,
        "creator": "coach@example.test",
        "as": ApplicationCreator.COACH,
        "team_name": "Степные хакеры",
        "status": S.SUBMITTED,
        "members": [
            ("athlete.second@example.test", C.CONFIRMED, True),
            ("athlete.third@example.test", C.CONFIRMED, False),
        ],
    },
]


async def _user(db: AsyncSession, email: str) -> UserModel:
    user = await db.scalar(select(UserModel).where(UserModel.email == email))
    if user is None:
        raise LookupError(email)
    return user


async def seed(db: AsyncSession) -> None:
    for email, group_name in ACADEMIC_GROUPS.items():
        user = await _user(db, email)
        group = await db.scalar(select(DictionaryAcademicGroupModel).where(DictionaryAcademicGroupModel.name == group_name))
        if group is None:
            raise LookupError(group_name)
        user.academic_group_id = group.id
    await db.flush()
    catalog = list((await db.scalars(select(DictionaryAgeGroupModel).where(DictionaryAgeGroupModel.is_archived.is_(False)))).all())
    federation = await _user(db, "federation@example.test")
    now = datetime.now(UTC)
    for row in DEMO:
        contest = await db.scalar(select(ContestModel).where(ContestModel.title == row["contest"]))
        if contest is None:
            raise LookupError(row["contest"])
        creator = await _user(db, row["creator"])
        status = row["status"]
        sent = status != S.FORMING
        item = ContestApplicationModel(
            contest_id=contest.id,
            team_name=row.get("team_name"),
            created_by=creator.id,
            created_as=row["as"],
            status=status,
            submitted_at=now if sent else None,
            decided_by=federation.id if status == S.APPROVED else None,
            decided_at=now if status == S.APPROVED else None,
        )
        db.add(item)
        await db.flush()
        for email, confirmation, captain in row["members"]:
            user = await _user(db, email)
            age_group = Eligibility.age_group(user, contest, catalog) if sent else None
            db.add(
                ContestApplicationMemberModel(
                    application_id=item.id,
                    contest_id=contest.id,
                    user_id=user.id,
                    is_captain=captain,
                    confirmation=confirmation,
                    is_active=True,
                    responded_at=now if confirmation == C.CONFIRMED else None,
                    age_group_id=age_group.id if age_group else None,
                    academic_group_id=user.academic_group_id if sent else None,
                )
            )
    await db.commit()
