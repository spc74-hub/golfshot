from fastapi import APIRouter, HTTPException, status, Depends
from app.models.schemas import LoginRequest, RegisterRequest, UserResponse
from app.services.supabase import get_supabase_client
from app.dependencies import get_current_user

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register")
async def register(request: RegisterRequest):
    """Register a new user."""
    supabase = get_supabase_client()

    try:
        # Create user in Supabase Auth
        auth_response = supabase.auth.sign_up({
            "email": request.email,
            "password": request.password,
        })

        if not auth_response.user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to create user",
            )

        user = auth_response.user

        # Create profile
        supabase.table("profiles").insert({
            "id": user.id,
            "display_name": request.display_name,
            "role": "user",
            "status": "active",
        }).execute()

        return {
            "message": "User registered successfully",
            "user": {
                "id": user.id,
                "email": user.email,
            },
            "session": {
                "access_token": auth_response.session.access_token if auth_response.session else None,
                "refresh_token": auth_response.session.refresh_token if auth_response.session else None,
            },
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.post("/login")
async def login(request: LoginRequest):
    """Login user."""
    supabase = get_supabase_client()

    try:
        auth_response = supabase.auth.sign_in_with_password({
            "email": request.email,
            "password": request.password,
        })

        if not auth_response.user or not auth_response.session:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid credentials",
            )

        user = auth_response.user
        session = auth_response.session

        # Get profile
        profile_response = supabase.table("profiles").select("*").eq("id", user.id).single().execute()
        profile = profile_response.data if profile_response.data else {}

        # Check if user is disabled
        if profile.get("status") == "disabled":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User account is disabled",
            )

        return {
            "access_token": session.access_token,
            "refresh_token": session.refresh_token,
            "token_type": "bearer",
            "user": {
                "id": user.id,
                "email": user.email,
                "display_name": profile.get("display_name"),
                "role": profile.get("role", "user"),
                "status": profile.get("status", "active"),
            },
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(e),
        )


@router.post("/logout")
async def logout(current_user: UserResponse = Depends(get_current_user)):
    """Logout user."""
    supabase = get_supabase_client()

    try:
        supabase.auth.sign_out()
        return {"message": "Logged out successfully"}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: UserResponse = Depends(get_current_user)):
    """Get current user."""
    return current_user
