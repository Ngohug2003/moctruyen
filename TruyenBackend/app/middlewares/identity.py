from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.constants.database import session
from app.services.auth import authenticate
from app.utils.errors import DomainError

bearer = HTTPBearer(auto_error=False)


def token(credentials: HTTPAuthorizationCredentials | None = Depends(bearer)):
    if not credentials:
        raise DomainError(401, "UNAUTHORIZED", "Vui lòng đăng nhập.")
    return credentials.credentials


async def current_user(db=Depends(session), value=Depends(token)):
    return await authenticate(db, value)
