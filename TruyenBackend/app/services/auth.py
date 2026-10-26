import hashlib
import secrets
from datetime import UTC, datetime, timedelta
from uuid import uuid4

from pwdlib import PasswordHash
from sqlalchemy.exc import IntegrityError
from starlette.concurrency import run_in_threadpool

from app.models.entities import LoginSession, User
from app.repositories import accounts as repo
from app.utils.errors import DomainError

hasher = PasswordHash.recommended()
DUMMY_HASH = hasher.hash(secrets.token_urlsafe(32))


def digest(token):
    return hashlib.sha256(token.encode()).hexdigest()


async def authenticate(db, token):
    session = await repo.token_session(db, digest(token))
    if not session or session.expires_at <= datetime.now(UTC):
        raise DomainError(401, "UNAUTHORIZED", "Phiên đăng nhập đã hết hạn.")
    user = await repo.user(db, session.user_id)
    if not user or not user.active:
        raise DomainError(401, "UNAUTHORIZED", "Tài khoản không khả dụng.")
    return user


async def credentials(db, body, register=False):
    email = str(body.email).lower()
    user = await repo.by_email(db, email)
    if register:
        if user:
            raise DomainError(409, "EMAIL_EXISTS", "Email đã được đăng ký.")
        user = User(
            id=str(uuid4()),
            email=email,
            name=body.name.strip(),
            password_hash=await run_in_threadpool(hasher.hash, body.password),
        )
        try:
            await repo.add(db, user)
        except IntegrityError:
            raise DomainError(409, "EMAIL_EXISTS", "Email đã được đăng ký.") from None
    else:
        valid = await run_in_threadpool(
            hasher.verify, body.password, user.password_hash if user else DUMMY_HASH
        )
        if not user or not valid or not user.active:
            raise DomainError(401, "BAD_CREDENTIALS", "Email hoặc mật khẩu không đúng.")
    token = secrets.token_urlsafe(32)
    await repo.add(
        db,
        LoginSession(
            token_hash=digest(token),
            user_id=user.id,
            expires_at=datetime.now(UTC) + timedelta(days=7),
        ),
    )
    return dict(token=token, user=user)


async def logout(db, token):
    row = await repo.token_session(db, digest(token))
    if row:
        await repo.remove(db, row)
