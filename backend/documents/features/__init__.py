from fastapi import APIRouter

from documents.features.manage.router import admin_router, organizer_router
from documents.features.mine.router import router as mine_router
from documents.features.public.router import router as public_router

router = APIRouter()
router.include_router(public_router)
router.include_router(mine_router)
router.include_router(organizer_router)
router.include_router(admin_router)
