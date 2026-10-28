from fastapi import APIRouter

from consents.features.mine.router import router as mine_router
from consents.features.review.router import router as review_router

router = APIRouter()
router.include_router(mine_router)
router.include_router(review_router)
