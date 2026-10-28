from fastapi import APIRouter

from notifications.features.bot_admins.router import router as bot_admins_router
from notifications.features.inbox.router import router as inbox_router
from notifications.features.settings.router import router as settings_router

router = APIRouter()
router.include_router(inbox_router)
router.include_router(settings_router)
router.include_router(bot_admins_router)

__all__ = ["router"]
