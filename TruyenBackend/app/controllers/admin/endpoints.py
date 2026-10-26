from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, UploadFile

from app.constants.database import session
from app.middlewares.identity import current_user
from app.schemas.responses.outputs import BookPreviewOut, BookUploadOut, GenericResponse
from app.services import catalog as catalog_service
from app.utils.errors import DomainError

router = APIRouter(prefix="/admin", tags=["admin"])

MAX_UPLOAD_SIZE = 250 * 1024 * 1024  # 250 MB


@router.post("/books/upload", response_model=GenericResponse[BookUploadOut], status_code=201)
async def upload_book(
    file: Annotated[UploadFile, File(description="File truyện định dạng .txt hoặc .json")],
    title: Annotated[str | None, Form(description="Tùy chọn: Đặt tên truyện thủ công")] = None,
    overwrite: Annotated[bool, Form(description="Ghi đè nếu truyện đã tồn tại")] = False,
    export_chunks: Annotated[
        bool, Form(description="Tự động xuất chunk tĩnh cho TruyenWeb")
    ] = True,
    db=Depends(session),
    user=Depends(current_user),
):
    if not file.filename:
        raise DomainError(400, "MISSING_FILENAME", "Tên file không hợp lệ.")

    content = await file.read()
    if len(content) > MAX_UPLOAD_SIZE:
        raise DomainError(413, "FILE_TOO_LARGE", "File vượt quá giới hạn tối đa 250MB.")

    result = await catalog_service.upload_book(
        db=db,
        filename=file.filename,
        content=content,
        custom_title=title,
        overwrite=overwrite,
        export_chunks=export_chunks,
    )
    return dict(data=result)


@router.post("/books/preview", response_model=GenericResponse[BookPreviewOut])
async def preview_book(
    file: Annotated[UploadFile, File(description="File truyện định dạng .txt hoặc .json")],
    title: Annotated[str | None, Form(description="Tùy chọn: Đặt tên truyện thủ công")] = None,
    user=Depends(current_user),
):
    if not file.filename:
        raise DomainError(400, "MISSING_FILENAME", "Tên file không hợp lệ.")

    content = await file.read()
    if len(content) > MAX_UPLOAD_SIZE:
        raise DomainError(413, "FILE_TOO_LARGE", "File vượt quá giới hạn tối đa 250MB.")

    result = await catalog_service.preview_book(
        filename=file.filename,
        content=content,
        custom_title=title,
    )
    return dict(data=result)
