from fastapi import APIRouter

from training.features.attestations.router import router as attestations_router
from training.features.groups.router import router as groups_router
from training.features.journal.router import router as journal_router
from training.features.norms.router import router as norms_router
from training.features.organizations.router import router as organizations_router

router = APIRouter()
router.include_router(organizations_router)
router.include_router(groups_router)
router.include_router(journal_router)
router.include_router(norms_router)
router.include_router(attestations_router)
