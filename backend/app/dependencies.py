from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Callable
from app.database import get_db
from app.auth import decode_access_token
from app.models.db_models import Profile
from app.models.schemas import UserResponse

security = HTTPBearer()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> UserResponse:
    """Verify JWT token and return current user."""
    token = credentials.credentials
    payload = decode_access_token(token)

    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token",
        )

    user_id = payload.get("sub")
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token",
        )

    result = await db.execute(select(Profile).where(Profile.id == user_id))
    profile = result.scalar_one_or_none()

    if profile is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )

    if profile.status == "disabled" or profile.status == "blocked":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is disabled",
        )

    permissions = profile.permissions or []

    return UserResponse(
        id=profile.id,
        email=profile.email,
        display_name=profile.display_name,
        role=profile.role or "user",
        status=profile.status or "active",
        permissions=permissions,
        linked_player_id=profile.linked_player_id,
        created_at=profile.created_at,
        updated_at=profile.updated_at or profile.created_at,
    )


async def get_admin_user(
    current_user: UserResponse = Depends(get_current_user),
) -> UserResponse:
    """Verify that the current user is an admin or owner."""
    if current_user.role not in ("admin", "owner"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )
    return current_user


async def get_owner_user(
    current_user: UserResponse = Depends(get_current_user),
) -> UserResponse:
    """Verify that the current user is the owner."""
    if current_user.role != "owner":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Owner access required",
        )
    return current_user


def require_permission(permission: str) -> Callable:
    """
    Dependency factory that checks if user has a specific permission.
    Owner and admin roles automatically have all permissions.
    """
    async def permission_checker(
        current_user: UserResponse = Depends(get_current_user),
    ) -> UserResponse:
        if current_user.role in ("owner", "admin"):
            return current_user
        if permission not in current_user.permissions:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Permission '{permission}' required",
            )
        return current_user

    return permission_checker


def has_permission(user: UserResponse, permission: str) -> bool:
    """Check if user has a specific permission."""
    if user.role in ("owner", "admin"):
        return True
    return permission in user.permissions
