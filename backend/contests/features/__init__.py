from fastapi import APIRouter

from contests.features.admin.router import router as admin_router
from contests.features.calendar.router import router as calendar_router
from contests.features.organizer.router import router as organizer_router

router = APIRouter()
router.include_router(calendar_router)
router.include_router(organizer_router)
router.include_router(admin_router)
