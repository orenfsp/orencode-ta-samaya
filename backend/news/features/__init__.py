from fastapi import APIRouter

from news.features.admin.router import router as admin_router
from news.features.public.router import router as public_router

router = APIRouter()
router.include_router(public_router)
router.include_router(admin_router)
