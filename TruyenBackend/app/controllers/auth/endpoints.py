from fastapi import APIRouter, Depends

from app.constants.database import session
from app.middlewares.identity import current_user, token
from app.schemas.requests.inputs import Credentials, Registration
from app.schemas.responses.outputs import AuthOut, GenericResponse, UserOut
from app.services import auth

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=GenericResponse[AuthOut], status_code=201)
async def register(body: Registration, db=Depends(session)):
    return dict(data=await auth.credentials(db, body, True))


@router.post("/login", response_model=GenericResponse[AuthOut])
async def login(body: Credentials, db=Depends(session)):
    return dict(data=await auth.credentials(db, body))


@router.get("/me", response_model=GenericResponse[UserOut])
async def me(user=Depends(current_user)):
    return dict(data=user)


@router.post("/logout", response_model=GenericResponse[bool])
async def logout(db=Depends(session), value=Depends(token)):
    await auth.logout(db, value)
    return dict(data=True)
