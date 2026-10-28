from fastapi import APIRouter

from people.features.admin.router import router as admin_router
from people.features.codeforces.router import router as codeforces_router
from people.features.page.router import router as page_router
from people.features.wall.router import router as wall_router

router = APIRouter()
router.include_router(page_router)
router.include_router(wall_router)
router.include_router(admin_router)
router.include_router(codeforces_router)
