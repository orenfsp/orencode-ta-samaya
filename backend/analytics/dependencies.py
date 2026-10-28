from datetime import date
from typing import Annotated, Literal

from fastapi import Depends, Query as Param

from analytics.domain.analytics import Analytics, Query
from analytics.repositories.pg_analytics import AnalyticsRepository
from core.database import DbSession


def get_analytics(db: DbSession) -> Analytics:
    """Собирает сервис аналитики с репозиторием на переданной сессии БД."""
    return Analytics(AnalyticsRepository(db))


def analytics_query(
    date_from: Annotated[date | None, Param()] = None,
    date_to: Annotated[date | None, Param()] = None,
    discipline_id: Annotated[int | None, Param(ge=1)] = None,
    municipality_id: Annotated[int | None, Param(ge=1)] = None,
    group_kind: Annotated[Literal["age", "academic"] | None, Param()] = None,
    group_id: Annotated[int | None, Param(ge=1)] = None,
) -> Query:
    """Строит и валидирует запрос аналитики из параметров запроса."""
    return Query.build(date_from, date_to, discipline_id, municipality_id, group_kind, group_id)


AnalyticsService = Annotated[Analytics, Depends(get_analytics)]
AnalyticsQuery = Annotated[Query, Depends(analytics_query)]
