from typing import Annotated

from fastapi import APIRouter, Path, Query, Request

from auth.dependencies import OptionalUserDep
from core.request import ClientIp
from news.dependencies import NewsDep
from news.features.public.schemas import ArticleOut, ArticlePage, TagOut

router = APIRouter(prefix="/news", tags=["Новости"])


@router.get("", summary="Лента опубликованных статей")
async def list_articles(
    news: NewsDep,
    q: Annotated[str, Query(max_length=200)] = "",
    section: Annotated[str | None, Query(max_length=100)] = None,
    tag: Annotated[str | None, Query(max_length=50)] = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 12,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> ArticlePage:
    items, total = await news.list_public(q.strip(), section, tag, limit, offset)
    return ArticlePage(items=[ArticleOut.model_validate(item) for item in items], total=total)


@router.get("/tags", summary="Хэштеги опубликованных статей")
async def list_tags(news: NewsDep) -> list[TagOut]:
    return [TagOut(name=name, count=count) for name, count in await news.tags()]


@router.get("/{slug}", summary="Статья")
async def read_article(
    slug: Annotated[str, Path(max_length=220)],
    request: Request,
    user: OptionalUserDep,
    news: NewsDep,
    ip: ClientIp,
) -> ArticleOut:
    visitor = str(user.id) if user else f"{ip}|{request.headers.get('user-agent', '')}"
    return ArticleOut.model_validate(await news.read(slug, visitor))
