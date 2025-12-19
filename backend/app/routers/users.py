from fastapi import APIRouter, HTTPException, status, Depends
from app.models.schemas import UserResponse, UserUpdate
from app.services.supabase import get_supabase_client, get_supabase_admin_client
from app.dependencies import get_current_user, get_admin_user

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/", response_model=list[UserResponse])
async def list_users(admin_user: UserResponse = Depends(get_admin_user)):
    """List all users (admin only)."""
    supabase = get_supabase_admin_client()

    try:
        # Get all users from auth
        users_response = supabase.auth.admin.list_users()
        users = users_response if isinstance(users_response, list) else []

        # Get all profiles
        profiles_response = supabase.table("profiles").select("*").execute()
        profiles = {p["id"]: p for p in profiles_response.data} if profiles_response.data else {}

        result = []
        for user in users:
            profile = profiles.get(user.id, {})
            result.append(UserResponse(
                id=user.id,
                email=user.email,
                display_name=profile.get("display_name"),
                role=profile.get("role", "user"),
                status=profile.get("status", "active"),
                created_at=user.created_at,
                updated_at=profile.get("updated_at", user.created_at),
            ))

        return result
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )


@router.get("/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: str,
    current_user: UserResponse = Depends(get_current_user),
):
    """Get user by ID."""
    # Users can only view their own profile unless admin
    if current_user.id != user_id and current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied",
        )

    supabase = get_supabase_client()

    try:
        # Get profile
        profile_response = supabase.table("profiles").select("*").eq("id", user_id).single().execute()

        if not profile_response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found",
            )

        profile = profile_response.data

        return UserResponse(
            id=profile["id"],
            email=current_user.email if current_user.id == user_id else "",
            display_name=profile.get("display_name"),
            role=profile.get("role", "user"),
            status=profile.get("status", "active"),
            created_at=profile.get("created_at"),
            updated_at=profile.get("updated_at"),
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )


@router.patch("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: str,
    update: UserUpdate,
    current_user: UserResponse = Depends(get_current_user),
):
    """Update user profile."""
    # Users can update their own profile (name only)
    # Admins can update any user (including role and status)
    if current_user.id != user_id and current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied",
        )

    # Non-admins cannot change role or status
    if current_user.role != "admin" and (update.role or update.status):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can change role or status",
        )

    supabase = get_supabase_client()

    try:
        update_data = {k: v for k, v in update.model_dump().items() if v is not None}

        if not update_data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No fields to update",
            )

        response = supabase.table("profiles").update(update_data).eq("id", user_id).execute()

        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found",
            )

        profile = response.data[0]

        return UserResponse(
            id=profile["id"],
            email=current_user.email if current_user.id == user_id else "",
            display_name=profile.get("display_name"),
            role=profile.get("role", "user"),
            status=profile.get("status", "active"),
            created_at=profile.get("created_at"),
            updated_at=profile.get("updated_at"),
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )


@router.delete("/{user_id}")
async def delete_user(
    user_id: str,
    admin_user: UserResponse = Depends(get_admin_user),
):
    """Delete user (admin only)."""
    if admin_user.id == user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete your own account",
        )

    supabase = get_supabase_admin_client()

    try:
        # Delete user from auth (cascade will delete profile and rounds)
        supabase.auth.admin.delete_user(user_id)

        return {"message": "User deleted successfully"}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )
