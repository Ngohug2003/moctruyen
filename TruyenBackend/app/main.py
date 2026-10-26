import logging
import uuid
from collections import defaultdict, deque
from contextlib import asynccontextmanager
from time import monotonic

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text
from starlette.exceptions import HTTPException

from app.constants.config import settings
from app.constants.database import engine
from app.routes.api_v1 import router
from app.utils.errors import DomainError


@asynccontextmanager
async def lifespan(app):
    yield
    await engine.dispose()


app = FastAPI(title="Mộc API", version="1.0.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_methods=["GET", "POST", "PUT"],
    allow_headers=["Authorization", "Content-Type"],
)
app.include_router(router, prefix="/api")


def failure(status, code, message):
    return JSONResponse(
        status_code=status, content=dict(success=False, message=message, error_code=code, data=None)
    )


@app.exception_handler(DomainError)
async def domain(request, exc):
    return failure(exc.status, exc.code, exc.message)


@app.exception_handler(RequestValidationError)
async def invalid(request, exc):
    return failure(
        422,
        "VALIDATION_ERROR",
        "Dữ liệu không hợp lệ. Kiểm tra email, mật khẩu (ít nhất 8 ký tự) và các trường nhập.",
    )


@app.exception_handler(HTTPException)
async def http_error(request, exc):
    return failure(exc.status_code, "HTTP_ERROR", "Yêu cầu không hợp lệ.")


@app.exception_handler(Exception)
async def unexpected(request: Request, exc: Exception):
    reference = uuid.uuid4().hex
    logging.getLogger("moc").error("Unhandled request %s [%s]", request.url.path, reference)
    return failure(500, "INTERNAL_ERROR", f"Lỗi máy chủ. Mã tham chiếu: {reference}")


@app.get("/health")
async def health():
    return dict(success=True, data={"status": "ok"})


@app.get("/ready")
async def ready():
    async with engine.connect() as connection:
        await connection.execute(text("SELECT 1"))
    return dict(success=True, data={"database": "ok"})


# Single-process local throttle; use a shared gateway limiter for multiple replicas.

attempts = defaultdict(deque)


@app.middleware("http")
async def limit_auth(request, call_next):
    if request.method == "POST" and request.url.path in {
        "/api/v1/auth/login",
        "/api/v1/auth/register",
    }:
        now = monotonic()
        for address in list(attempts):
            while attempts[address] and attempts[address][0] < now - 60:
                attempts[address].popleft()
            if not attempts[address]:
                del attempts[address]
        key = request.client.host if request.client else "unknown"
        if len(attempts[key]) >= 20:
            return failure(429, "RATE_LIMITED", "Thử lại sau một phút.")
        attempts[key].append(now)
    return await call_next(request)
