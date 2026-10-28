from fastapi import APIRouter

from ratings.features.public.router import router as public_router

router = APIRouter()
router.include_router(public_router)
