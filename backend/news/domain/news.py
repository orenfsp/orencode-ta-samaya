import re
import uuid
from datetime import UTC, datetime
from typing import Any
from uuid import UUID

from audit.domain.actions import AuditAction
from audit.domain.audit import Audit
from core.database import UnitOfWork
from core.errors import InvalidStatus, NotFound, ValidationFailed
from files.domain.files import Files
from infrastructure.file import FileModel
from infrastructure.news_article import NewsArticleModel
from news.repositories.pg_news import NewsRepository
from news.repositories.red_news_views import NewsViewsRepository

CYRILLIC = "абвгдеёжзийклмнопрстуфхцчшщъыьэюя"
LATIN = (
    "a", "b", "v", "g", "d", "e", "e", "zh", "z", "i", "y", "k", "l", "m", "n", "o", "p",
    "r", "s", "t", "u", "f", "h", "ts", "ch", "sh", "shch", "", "y", "", "e", "yu", "ya",
)
TRANSLIT = str.maketrans(dict(zip(CYRILLIC, LATIN)))


def _slug(title: str) -> str:
    base = re.sub(r"[^a-z0-9]+", "-", title.lower().translate(TRANSLIT)).strip("-")[:200] or "news"
    return f"{base}-{uuid.uuid4().hex[:6]}"


def _block_files(blocks: list[dict[str, Any]], kind: str) -> list[UUID]:
    return list(dict.fromkeys(UUID(block["file_id"]) for block in blocks if block["type"] == kind))


def _file_ids(cover_file_id: UUID | None, blocks: list[dict[str, Any]]) -> list[UUID]:
    cover = [cover_file_id] if cover_file_id else []
    return list(dict.fromkeys(cover + _block_files(blocks, "image") + _block_files(blocks, "file")))


class News:
    def __init__(
        self,
        repository: NewsRepository,
        views: NewsViewsRepository,
        files: Files,
        uow: UnitOfWork,
        audit: Audit,
    ) -> None:
        self._repository = repository
        self._views = views
        self._files = files
        self._uow = uow
        self._audit = audit

    async def list_public(
        self, q: str, section: str | None, tag: str | None, limit: int, offset: int
    ) -> tuple[list[NewsArticleModel], int]:
        return await self._repository.find(q, section, tag, "published", limit, offset)

    async def admin_list(
        self, q: str, status: str | None, tag: str | None, limit: int, offset: int
    ) -> tuple[list[NewsArticleModel], int]:
        return await self._repository.find(q, None, tag, status, limit, offset)

    async def tags(self) -> list[tuple[str, int]]:
        return await self._repository.tags()

    async def read(self, slug: str, visitor: str) -> NewsArticleModel:
        article = await self._repository.by_slug(slug)
        if article is None or article.status != "published":
            raise NotFound()
        if await self._views.first(article.id, visitor):
            await self._repository.add_view(article.id)
            await self._uow.commit()
        return article

    async def admin_get(self, article_id: UUID) -> NewsArticleModel:
        article = await self._repository.get(article_id)
        if article is None:
            raise NotFound()
        return article

    async def create(self, values: dict[str, Any], actor: UUID, ip: str | None) -> NewsArticleModel:
        await self._usable(values["cover_file_id"], values["blocks"], [], actor)
        hashtags = await self._repository.hashtags(values.pop("hashtags"))
        article = await self._repository.create(
            {**values, "slug": _slug(values["title"]), "status": "draft", "author_id": actor, "hashtags": hashtags}
        )
        await self._record(AuditAction.NEWS_CREATE, article, actor, ip)
        return article

    async def update(self, article_id: UUID, values: dict[str, Any], actor: UUID, ip: str | None) -> NewsArticleModel:
        article = await self._editable(article_id)
        if article.status == "archived":
            raise InvalidStatus()
        blocks = values.get("blocks", article.blocks)
        if article.status == "published" and not blocks:
            raise ValidationFailed(fields={"blocks": ["У опубликованной статьи должен быть текст"]})
        attached = _file_ids(article.cover_file_id, article.blocks)
        files = await self._usable(values.get("cover_file_id", article.cover_file_id), blocks, attached, actor)
        if "hashtags" in values:
            article.hashtags = await self._repository.hashtags(values.pop("hashtags"))
        for key, value in values.items():
            setattr(article, key, value)
        article.updated_at = datetime.now(UTC)
        await self._files.set_public(files, article.status == "published")
        removed = set(attached) - {item.id for item in files}
        await self._files.set_public(await self._attached(list(removed), actor), False)
        await self._record(AuditAction.NEWS_UPDATE, article, actor, ip)
        return article

    async def transition(self, article_id: UUID, action: str, actor: UUID, ip: str | None) -> NewsArticleModel:
        article = await self._editable(article_id)
        transitions = {
            "publish": ("draft", "published", AuditAction.NEWS_PUBLISH),
            "unpublish": ("published", "draft", AuditAction.NEWS_UNPUBLISH),
            "restore": ("archived", "draft", AuditAction.NEWS_RESTORE),
        }
        if action == "archive":
            if article.status == "archived":
                raise InvalidStatus()
            target, audit_action = "archived", AuditAction.NEWS_ARCHIVE
        else:
            previous, target, audit_action = transitions[action]
            if article.status != previous:
                raise InvalidStatus()
        if target == "published" and not article.blocks:
            raise ValidationFailed(fields={"blocks": ["Добавьте текст статьи"]})
        article.status = target
        if target == "published" and article.published_at is None:
            article.published_at = datetime.now(UTC)
        article.updated_at = datetime.now(UTC)
        files = await self._attached(_file_ids(article.cover_file_id, article.blocks), actor)
        await self._files.set_public(files, target == "published")
        await self._record(audit_action, article, actor, ip)
        return article

    async def _usable(
        self, cover_file_id: UUID | None, blocks: list[dict[str, Any]], attached: list[UUID], actor: UUID
    ) -> list[FileModel]:
        found: list[FileModel] = []
        errors: dict[str, list[str]] = {}
        for field, file_ids, types in (
            ("cover_file_id", [cover_file_id] if cover_file_id else [], Files.IMAGE_TYPES),
            ("blocks", _block_files(blocks, "image"), Files.IMAGE_TYPES),
            ("blocks", _block_files(blocks, "file"), Files.ALLOWED_TYPES),
        ):
            items, problem = await self._files.usable(file_ids, actor, True, types, attached)
            if problem:
                errors[field] = ["Только изображения JPEG, PNG или WebP" if problem == "type" else problem]
            found += items
        if errors:
            raise ValidationFailed(fields=errors)
        return found

    async def _attached(self, file_ids: list[UUID], actor: UUID) -> list[FileModel]:
        items, _ = await self._files.usable(file_ids, actor, True, Files.ALLOWED_TYPES, file_ids)
        return items

    async def _editable(self, article_id: UUID) -> NewsArticleModel:
        article = await self._repository.get(article_id, lock=True)
        if article is None:
            raise NotFound()
        return article

    async def _record(self, action: AuditAction, article: NewsArticleModel, actor: UUID, ip: str | None) -> None:
        await self._repository.flush()
        await self._audit.write(
            action,
            user_id=actor,
            object_type="news_article",
            object_id=article.id,
            payload={"title": article.title, "status": article.status},
            ip=ip,
        )
        await self._uow.commit()
