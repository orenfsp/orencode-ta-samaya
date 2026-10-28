from fastapi import APIRouter

from qualifications.features.judge_documents.router import router as judge_documents_router
from qualifications.features.judges.router import router as judges_router
from qualifications.features.mine.router import router as mine_router
from qualifications.features.review.router import router as review_router

router = APIRouter()
router.include_router(mine_router)
router.include_router(review_router)
router.include_router(judges_router)
router.include_router(judge_documents_router)
