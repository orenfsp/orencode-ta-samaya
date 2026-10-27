from fastapi import APIRouter

from auth.features.login.router import router as login_router
from auth.features.logout.router import router as logout_router
from auth.features.me.router import router as me_router
from auth.features.password_reset.router import router as password_reset_router
from auth.features.register.router import router as register_router
from auth.features.role_verification.router import router as role_verification_router

router = APIRouter()
router.include_router(register_router)
router.include_router(login_router)
router.include_router(me_router)
router.include_router(logout_router)
router.include_router(password_reset_router)
router.include_router(role_verification_router)
