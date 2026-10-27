import struct
import uuid
import zlib
from datetime import UTC, date, datetime, time, timedelta
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.config import settings
from files.repositories.s3_files import ObjectRepository
from infrastructure.base import DictionaryColumns
from infrastructure.contest import ContestModel
from infrastructure.contest_photo import ContestPhotoModel
from infrastructure.contest_status_history import ContestStatusHistoryModel
from infrastructure.dictionary_age_group import DictionaryAgeGroupModel
from infrastructure.dictionary_contest_format import DictionaryContestFormatModel
from infrastructure.dictionary_contest_level import DictionaryContestLevelModel
from infrastructure.dictionary_contest_type import DictionaryContestTypeModel
from infrastructure.dictionary_discipline import DictionaryDisciplineModel
from infrastructure.dictionary_municipality import DictionaryMunicipalityModel
from infrastructure.enums import ContestStatus, ParticipationType, VerificationStatus
from infrastructure.file import FileModel
from infrastructure.user import UserModel

S, V = ContestStatus, VerificationStatus
INDIVIDUAL, TEAM = ParticipationType.INDIVIDUAL, ParticipationType.TEAM

LIFECYCLE: dict[ContestStatus, list[ContestStatus]] = {
    S.DRAFT: [],
    S.PUBLISHED: [S.PUBLISHED],
    S.REGISTRATION_OPEN: [S.PUBLISHED, S.REGISTRATION_OPEN],
    S.COMPLETED: [S.PUBLISHED, S.REGISTRATION_OPEN, S.REGISTRATION_CLOSED, S.IN_PROGRESS, S.COMPLETED],
    S.CANCELLED: [S.PUBLISHED, S.REGISTRATION_OPEN, S.CANCELLED],
}

DEMO: list[dict[str, Any]] = [
    {
        "title": "Первенство Оренбургской области по алгоритмическому программированию",
        "description": "Личное первенство для школьников и студентов. Два тура по 5 часов, задачи в формате ICPC.",
        "discipline": "Алгоритмическое программирование",
        "type": "Первенство",
        "level": "Региональное",
        "format": "Очно",
        "municipality": "г. Оренбург",
        "venue": "ОГУ, пр. Победы, 13, корпус 2",
        "participation_type": INDIVIDUAL,
        "age_groups": ["14–17 лет"],
        "start": 21,
        "days": 2,
        "organizer": "federation@example.test",
        "status": S.REGISTRATION_OPEN,
        "verification": V.VERIFIED,
        "regulations": True,
        "photos": [(37, 99, 235), (220, 38, 38), (22, 163, 74)],
    },
    {
        "title": "Кубок Оренбуржья по продуктовому программированию",
        "description": "Командная разработка продукта по кейсу от индустриального партнёра: два дня онлайн, защита очно.",
        "discipline": "Продуктовое программирование",
        "type": "Кубок",
        "level": "Региональное",
        "format": "Смешанный",
        "municipality": "г. Оренбург",
        "venue": "Технопарк «Оренбург»",
        "participation_type": TEAM,
        "team": (3, 5),
        "start": 35,
        "days": 3,
        "prize_fund_text": "150 000 ₽ призовых и стажировки у партнёров",
        "prize_fund_amount": 150000,
        "organizer": "organizer@example.test",
        "status": S.PUBLISHED,
        "verification": V.PENDING,
        "regulations": True,
        "photos": [(124, 58, 237), (234, 179, 8)],
    },
    {
        "title": "Открытый турнир по информационной безопасности (CTF)",
        "description": "Командный CTF в формате Jeopardy.",
        "discipline": "Программирование систем информационной безопасности",
        "type": "Турнир",
        "level": "Межрегиональное",
        "format": "Онлайн",
        "participation_type": TEAM,
        "team": (2, 4),
        "start": 14,
        "days": 1,
        "organizer": "organizer@example.test",
        "status": S.REGISTRATION_OPEN,
        "verification": V.REJECTED,
        "verification_reason": "Нет положения о соревновании",
    },
    {
        "title": "Внутренний хакатон ОГУ по искусственному интеллекту",
        "description": "Хакатон для студентов университета.",
        "discipline": "Программирование систем искусственного интеллекта",
        "type": "Турнир",
        "level": "Региональное",
        "format": "Очно",
        "municipality": "г. Оренбург",
        "venue": "ОГУ, IT-холл",
        "participation_type": TEAM,
        "team": (2, 3),
        "start": 28,
        "days": 2,
        "prize_fund_text": "Мерч и сертификаты на обучение",
        "organizer": "organizer@example.test",
        "status": S.PUBLISHED,
        "verification": V.NOT_REQUESTED,
    },
    {
        "title": "Турнир по робототехнике",
        "discipline": "Программирование робототехники",
        "type": "Турнир",
        "level": "Региональное",
        "format": "Очно",
        "municipality": "г. Новотроицк",
        "participation_type": TEAM,
        "team": (2, 2),
        "start": 60,
        "days": 1,
        "organizer": "organizer@example.test",
        "status": S.DRAFT,
        "verification": V.NOT_REQUESTED,
    },
    {
        "title": "Чемпионат Оренбургской области по алгоритмическому программированию",
        "description": "Личный чемпионат области.",
        "discipline": "Алгоритмическое программирование",
        "type": "Чемпионат",
        "level": "Региональное",
        "format": "Очно",
        "municipality": "г. Оренбург",
        "venue": "ОГУ, корпус 2",
        "participation_type": INDIVIDUAL,
        "start": -120,
        "days": 1,
        "organizer": "federation@example.test",
        "status": S.COMPLETED,
        "verification": V.VERIFIED,
    },
    {
        "title": "Кубок ПФО по алгоритмическому программированию",
        "description": "Межрегиональный кубок Приволжского федерального округа.",
        "discipline": "Алгоритмическое программирование",
        "type": "Кубок",
        "level": "Межрегиональное",
        "format": "Очно",
        "municipality": "г. Оренбург",
        "participation_type": INDIVIDUAL,
        "start": -210,
        "days": 2,
        "organizer": "federation@example.test",
        "status": S.COMPLETED,
        "verification": V.VERIFIED,
        "rating_points": [60, 45, 30, 15, 5],
    },
    {
        "title": "Соревнования по программированию беспилотных авиационных систем",
        "discipline": "Программирование беспилотных авиационных систем",
        "type": "Турнир",
        "level": "Региональное",
        "format": "Очно",
        "municipality": "Бузулукский район",
        "participation_type": INDIVIDUAL,
        "start": 45,
        "days": 1,
        "organizer": "federation@example.test",
        "status": S.CANCELLED,
        "cancel_reason": "Площадка недоступна из-за ремонта",
        "verification": V.NOT_REQUESTED,
    },
]

def _png(color: tuple[int, int, int], width: int = 640, height: int = 360) -> bytes:
    row = b"\x00" + bytes(color) * width
    raw = zlib.compress(row * height)

    def chunk(kind: bytes, data: bytes) -> bytes:
        return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", zlib.crc32(kind + data))

    header = struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0)
    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", header) + chunk(b"IDAT", raw) + chunk(b"IEND", b"")


def _pdf(title: str) -> bytes:
    stream = b"BT /F1 18 Tf 72 720 Td (Polozhenie o sorevnovanii) Tj ET"
    objects = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R "
        b"/Resources << /Font << /F1 5 0 R >> >> >>",
        b"<< /Length " + str(len(stream)).encode() + b" >>\nstream\n" + stream + b"\nendstream",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    ]
    body, offsets = b"%PDF-1.4\n", []
    for number, content in enumerate(objects, start=1):
        offsets.append(len(body))
        body += f"{number} 0 obj\n".encode() + content + b"\nendobj\n"
    xref = len(body)
    body += f"xref\n0 {len(objects) + 1}\n0000000000 65535 f \n".encode()
    body += b"".join(f"{offset:010d} 00000 n \n".encode() for offset in offsets)
    body += f"trailer << /Size {len(objects) + 1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF".encode()
    return body


async def _store(
    db: AsyncSession, storage: ObjectRepository, data: bytes, name: str, content_type: str, owner: UserModel, public: bool
) -> FileModel:
    key = f"{uuid.uuid4()}/{name}"
    await storage.put(public, key, data, content_type)
    item = FileModel(
        object_key=key, is_public=public, original_name=name, content_type=content_type, size=len(data), uploaded_by=owner.id
    )
    db.add(item)
    await db.flush()
    return item


DEFAULT_POINTS = {"Региональное": [40, 30, 20], "Межрегиональное": [60, 45, 30]}


async def _by_name[M: DictionaryColumns](db: AsyncSession, model: type[M], name: str) -> M:
    item = await db.scalar(select(model).where(model.name == name))
    if item is None:
        raise LookupError(f"{model.__name__}: {name}")
    return item


async def seed(db: AsyncSession) -> None:
    today = date.today()
    now = datetime.now(UTC)
    storage = ObjectRepository(settings)
    for row in DEMO:
        organizer = await db.scalar(select(UserModel).where(UserModel.email == row["organizer"]))
        if organizer is None:
            raise LookupError(row["organizer"])
        starts_on = today + timedelta(days=row["start"])
        opens = datetime.combine(starts_on - timedelta(days=40), time(0, 0), UTC)
        closes = datetime.combine(starts_on - timedelta(days=2), time(23, 59), UTC)
        team = row.get("team")
        verification = row["verification"]
        points = row.get("rating_points") or DEFAULT_POINTS.get(row["level"], [40, 30, 20])
        item = ContestModel(
            title=row["title"],
            description=row.get("description"),
            discipline=await _by_name(db, DictionaryDisciplineModel, row["discipline"]),
            contest_type=await _by_name(db, DictionaryContestTypeModel, row["type"]),
            contest_level=await _by_name(db, DictionaryContestLevelModel, row["level"]),
            contest_format=await _by_name(db, DictionaryContestFormatModel, row["format"]),
            municipality=await _by_name(db, DictionaryMunicipalityModel, row["municipality"]) if row.get("municipality") else None,
            venue=row.get("venue"),
            participation_type=row["participation_type"],
            team_size_min=team[0] if team else None,
            team_size_max=team[1] if team else None,
            age_groups=[await _by_name(db, DictionaryAgeGroupModel, name) for name in row.get("age_groups", [])],
            starts_on=starts_on,
            ends_on=starts_on + timedelta(days=row["days"] - 1),
            registration_opens_at=opens,
            registration_closes_at=closes,
            prize_fund_text=row.get("prize_fund_text"),
            prize_fund_amount=row.get("prize_fund_amount"),
            organizer_id=organizer.id,
            created_by=organizer.id,
            status=row["status"],
            cancel_reason=row.get("cancel_reason"),
            published_at=now if row["status"] != S.DRAFT else None,
            verification_status=verification,
            verification_reason=row.get("verification_reason"),
            verification_requested_at=now if verification in (V.PENDING, V.REJECTED) else None,
            verified_at=now if verification == V.VERIFIED else None,
            rating_points=[{"place": place, "points": value} for place, value in enumerate(points, start=1)]
            if verification == V.VERIFIED
            else None,
        )
        public = row["status"] not in (S.DRAFT, S.ARCHIVED)
        if row.get("regulations"):
            item.regulations = await _store(db, storage, _pdf(row["title"]), "polozhenie.pdf", "application/pdf", organizer, public)
        for position, color in enumerate(row.get("photos", [])):
            photo = await _store(db, storage, _png(color), f"photo-{position + 1}.png", "image/png", organizer, public)
            item.photos.append(ContestPhotoModel(file=photo, position=position))
        db.add(item)
        await db.flush()
        previous: ContestStatus | None = None
        for status in [S.DRAFT, *LIFECYCLE[row["status"]]]:
            db.add(
                ContestStatusHistoryModel(
                    contest_id=item.id,
                    kind="status",
                    from_value=previous,
                    to_value=status,
                    user_id=organizer.id,
                    comment=row.get("cancel_reason") if status == S.CANCELLED else None,
                )
            )
            previous = status
        if verification != V.NOT_REQUESTED:
            db.add(
                ContestStatusHistoryModel(
                    contest_id=item.id,
                    kind="verification",
                    from_value=V.NOT_REQUESTED,
                    to_value=verification,
                    user_id=organizer.id,
                    comment=row.get("verification_reason"),
                )
            )
    await db.commit()
