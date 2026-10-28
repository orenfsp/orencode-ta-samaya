from fastapi import APIRouter

from reports.features.person.router import router as person_router

router = APIRouter()
router.include_router(person_router)
