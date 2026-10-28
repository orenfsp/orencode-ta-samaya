from fastapi import APIRouter

from results.features.manage.router import admin_router, organizer_router
from results.features.public.router import router as public_router

router = APIRouter()
router.include_router(public_router)
router.include_router(organizer_router)
router.include_router(admin_router)
