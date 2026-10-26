from fastapi import APIRouter, Depends, Query

from app.constants.database import session
from app.middlewares.identity import current_user
from app.schemas.requests.inputs import ProgressInput
from app.schemas.responses.outputs import GenericResponse, Page, ProgressOut
from app.services import reader

router = APIRouter(prefix="/reader", tags=["reader"])


@router.get("/progress", response_model=GenericResponse[Page[ProgressOut]])
async def progress(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    db=Depends(session),
    user=Depends(current_user),
):
    return dict(data=await reader.list_progress(db, user, page, page_size))


@router.put("/progress/{book_id}", response_model=GenericResponse[ProgressOut])
async def save(book_id: str, body: ProgressInput, db=Depends(session), user=Depends(current_user)):
    return dict(data=await reader.save(db, user, book_id, body))
