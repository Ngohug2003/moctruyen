from fastapi import APIRouter, Depends, Query

from app.constants.database import session
from app.schemas.responses.cultivation import CultivationOut
from app.schemas.responses.outputs import BookOut, ChapterMeta, ChapterOut, GenericResponse, Page
from app.services import catalog
from app.services import cultivation as cultivation_service

router = APIRouter(prefix="/public", tags=["catalog"])


@router.get("/books", response_model=GenericResponse[Page[BookOut]])
async def books(
    page: int = Query(1, ge=1), page_size: int = Query(50, ge=1, le=100), db=Depends(session)
):
    return dict(data=await catalog.books(db, page, page_size))


@router.get("/books/{book_id}/chapters", response_model=GenericResponse[Page[ChapterMeta]])
async def chapters(
    book_id: str,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    db=Depends(session),
):
    return dict(data=await catalog.chapters(db, book_id, page, page_size))


@router.get("/books/{book_id}/chapters/{position}", response_model=GenericResponse[ChapterOut])
async def chapter(book_id: str, position: int, db=Depends(session)):
    return dict(data=await catalog.chapter(db, book_id, position))


@router.get("/books/{book_id}/cultivation", response_model=GenericResponse[CultivationOut])
async def cultivation(book_id: str, db=Depends(session)):
    return {"data": await cultivation_service.get_guide(db, book_id)}
