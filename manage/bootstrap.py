import asyncio
import importlib
import json
import logging
from pathlib import Path

import asyncpg
from sqlalchemy import select

import infrastructure
from audit.dependencies import get_audit
from core.config import settings
from core.database import engine, session_factory
from documents.dependencies import get_documents
from documents.domain.documents import DocumentForm
from files.repositories.s3_files import ObjectRepository
from infrastructure.account.user import UserModel
from infrastructure.base import Base
from infrastructure.contests.contest import ContestModel
from infrastructure.enums import DocumentKind
from infrastructure.qualifications.qualification import QualificationModel
from qualifications.domain.qualifications import signature

# Демо-база: схема из моделей, данные из seed/seed.sql, файлы из seed/<тип>/…
# Запускается при каждом старте контейнера и возвращает базу в чистое тестовое состояние.

SEED = Path(__file__).resolve().parent / "seed"
logger = logging.getLogger("fsp.bootstrap")


async def bootstrap() -> None:
    """Пересоздаёт схему БД, заливает демо-данные из seed.sql и выпускает документы соревнований."""
    storage = ObjectRepository(settings)
    await storage.ensure_buckets()

    # Все модели должны быть импортированы до create_all, иначе их таблиц не будет. Модели лежат по папкам групп
    root = Path(next(iter(infrastructure.__path__)))
    for path in sorted(root.rglob("*.py")):
        importlib.import_module(".".join(("infrastructure", *path.relative_to(root).with_suffix("").parts)))
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.drop_all)
        await connection.run_sync(Base.metadata.create_all)

    # seed.sql целиком в одной транзакции. Временные таблицы живут до конца соединения,
    # поэтому список документов к выпуску читаем здесь же
    connection = await asyncpg.connect(settings.database_url.replace("+asyncpg", ""))
    try:
        async with connection.transaction():
            await connection.execute((SEED / "seed.sql").read_text(encoding="utf-8"))
        files = await connection.fetch("select id, object_key, is_public, content_type from files")
        documents = await connection.fetch("select contest_id, kind, form from seed_documents")
        # object_key — путь файла внутри seed/: кладём его в хранилище под тем же ключом и пишем настоящий размер
        sizes = []
        for row in files:
            data = (SEED / row["object_key"]).read_bytes()
            await storage.put(row["is_public"], row["object_key"], data, row["content_type"])
            sizes.append((row["id"], len(data)))
        await connection.executemany("update files set size = $2 where id = $1", sizes)
    finally:
        await connection.close()

    # Дипломы, сертификаты, благодарности и справки выпускает код приложения: так у них настоящие номера и подписи
    async with session_factory() as session:
        issuer = get_documents(session, get_audit(session))
        federation = await session.scalar(select(UserModel.id).where(UserModel.email == "federation@example.test"))
        for row in documents:
            contest = await session.get(ContestModel, row["contest_id"])
            if contest is None:
                raise LookupError(row["contest_id"])
            form = DocumentForm.from_plain(json.loads(row["form"]))
            await issuer.store_for(contest, DocumentKind(row["kind"]), form, federation)
        # Подпись QR-проверки разряда считается секретом приложения, поэтому seed.sql оставляет её пустой
        secret = settings.document_signing_secret.get_secret_value().encode()
        for item in await session.scalars(select(QualificationModel).where(QualificationModel.token.is_not(None))):
            item.signature = signature(item, secret)
        await session.commit()

    await engine.dispose()
    logger.info("Schema created, demo data seeded: %s files, %s document kinds", len(files), len(documents))


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    asyncio.run(bootstrap())
