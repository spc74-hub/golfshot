from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from supabase import Client
from typing import Callable
from app.services.supabase import get_supabase_client, get_supabase_admin_client
from app.models.schemas import UserResponse

security = HTTPBearer()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> UserResponse:
    """Verify JWT token and return current user."""
    token = credentials.credentials
    supabase = get_supabase_client()

    try:
        user_response = supabase.auth.get_user(token)
        if not user_response or not user_response.user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication token",
            )

        user = user_response.user

        # Get profile data
        profile_response = supabase.table("profiles").select("*").eq("id", user.id).single().execute()
        profile = profile_response.data if profile_response.data else {}

        # Get permissions as list (handle both array and None)
        permissions = profile.get("permissions", [])
        if permissions is None:
            permissions = []

        return UserResponse(
            id=user.id,
            email=user.email,
            display_name=profile.get("display_name"),
            role=profile.get("role", "user"),
            status=profile.get("status", "active"),
            permissions=permissions,
            linked_player_id=profile.get("linked_player_id"),
            created_at=user.created_at,
            updated_at=profile.get("updated_at", user.created_at),
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Could not validate credentials: {str(e)}",
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
        # Owner and admin have all permissions
        if current_user.role in ("owner", "admin"):
            return current_user

        # Check specific permission
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


def get_db() -> Client:
    """Get Supabase client dependency."""
    return get_supabase_client()


def get_admin_db() -> Client:
    """Get Supabase admin client dependency."""
    return get_supabase_admin_client()
