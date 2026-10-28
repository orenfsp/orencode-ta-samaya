from fastapi import APIRouter

from profiles.features.coach_links.router import router as coach_links_router
from profiles.features.me.router import router as me_router
from profiles.features.organizations.router import router as organizations_router

router = APIRouter()
router.include_router(organizations_router)
router.include_router(me_router)
router.include_router(coach_links_router)
