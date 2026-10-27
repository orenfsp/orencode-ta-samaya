from fastapi import APIRouter

from files.features.download.router import router as download_router
from files.features.upload.router import router as upload_router

router = APIRouter()
router.include_router(upload_router)
router.include_router(download_router)
