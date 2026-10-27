from fastapi import APIRouter

from dictionaries.features.manage.router import router as manage_router
from dictionaries.features.read.router import router as read_router

router = APIRouter()
router.include_router(read_router)
router.include_router(manage_router)
