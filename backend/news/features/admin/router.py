from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Body, Depends, Path, Query

from auth.dependencies import CurrentUser, require_role
from core.request import ClientIp
from infrastructure.enums import Role
from news.dependencies import NewsDep
from news.features.admin.schemas import ArticleIn, ArticleOut, ArticlePage, ArticlePatch

router = APIRouter(prefix="/admin/news", tags=["Новости: федерация"])

Federation = Annotated[CurrentUser, Depends(require_role(Role.FEDERATION))]
ArticleId = Annotated[UUID, Path()]


@router.get("", summary="Все статьи, включая черновики и архив")
async def list_articles(
    user: Federation,
    news: NewsDep,
    q: Annotated[str, Query(max_length=200)] = "",
    status: Annotated[Literal["draft", "published", "archived"] | None, Query()] = None,
    tag: Annotated[str | None, Query(max_length=50)] = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> ArticlePage:
    """Возвращает страницу статей для админки по фильтрам, включая черновики и архив."""
    items, total = await news.admin_list(q.strip(), status, tag, limit, offset)
    return ArticlePage(items=[ArticleOut.model_validate(item) for item in items], total=total)


@router.get("/{article_id}", summary="Статья")
async def get_article(article_id: ArticleId, user: Federation, news: NewsDep) -> ArticleOut:
    """Возвращает статью по id в любом статусе."""
    return ArticleOut.model_validate(await news.admin_get(article_id))


@router.post("", status_code=201, summary="Создать черновик")
async def create_article(
    body: Annotated[ArticleIn, Body()], user: Federation, news: NewsDep, ip: ClientIp
) -> ArticleOut:
    """Создаёт новую статью-черновик."""
    return ArticleOut.model_validate(await news.create(body.values(), user.id, ip))


@router.patch("/{article_id}", summary="Изменить статью")
async def update_article(
    article_id: ArticleId, body: Annotated[ArticlePatch, Body()], user: Federation, news: NewsDep, ip: ClientIp
) -> ArticleOut:
    """Обновляет переданные поля статьи."""
    return ArticleOut.model_validate(await news.update(article_id, body.values(), user.id, ip))


@router.post("/{article_id}/{action}", summary="Опубликовать, снять, архивировать или восстановить")
async def change_status(
    article_id: ArticleId,
    action: Annotated[Literal["publish", "unpublish", "archive", "restore"], Path()],
    user: Federation,
    news: NewsDep,
    ip: ClientIp,
) -> ArticleOut:
    """Меняет статус статьи: публикация, снятие с публикации, архивация или восстановление."""
    return ArticleOut.model_validate(await news.transition(article_id, action, user.id, ip))
