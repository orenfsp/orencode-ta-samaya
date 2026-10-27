from typing import Literal

from fastapi import APIRouter
from pydantic import BaseModel
from sqlalchemy import text

from core.database import DbSession
from core.redis import RedisClient

router = APIRouter(tags=["system"])


class HealthOut(BaseModel):
    status: Literal["ok", "degraded"]
    db: Literal["ok", "fail"]
    redis: Literal["ok", "fail"]


@router.get("/health")
async def health(db: DbSession, redis: RedisClient) -> HealthOut:
    try:
        await db.execute(text("SELECT 1"))
        db_ok = True
    except Exception:
        db_ok = False
    try:
        redis_ok = bool(await redis.ping())
    except Exception:
        redis_ok = False
    return HealthOut(
        status="ok" if db_ok and redis_ok else "degraded",
        db="ok" if db_ok else "fail",
        redis="ok" if redis_ok else "fail",
    )
