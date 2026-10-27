from fastapi import APIRouter

from applications.features.moderation.router import admin_router, organizer_router
from applications.features.participant.router import router as participant_router
from applications.features.public.router import router as public_router

router = APIRouter()
router.include_router(public_router)
router.include_router(participant_router)
router.include_router(organizer_router)
router.include_router(admin_router)
