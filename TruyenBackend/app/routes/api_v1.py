from fastapi import APIRouter

from app.controllers.admin.endpoints import router as admin
from app.controllers.auth.endpoints import router as auth
from app.controllers.public.endpoints import router as public
from app.controllers.reader.endpoints import router as reader

router = APIRouter(prefix="/v1")
router.include_router(auth)
router.include_router(public)
router.include_router(reader)
router.include_router(admin)
