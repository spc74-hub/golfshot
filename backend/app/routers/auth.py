from fastapi import APIRouter, HTTPException, status, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.schemas import LoginRequest, RegisterRequest, UserResponse
from app.models.db_models import Profile
from app.database import get_db
from app.auth import verify_password, get_password_hash, create_access_token
from app.dependencies import get_current_user

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register")
async def register(request: RegisterRequest, db: AsyncSession = Depends(get_db)):
    """Register a new user."""
    try:
        # Check if email already exists
        result = await db.execute(select(Profile).where(Profile.email == request.email))
        existing = result.scalar_one_or_none()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already registered",
            )

        # Create user
        profile = Profile(
            email=request.email,
            hashed_password=get_password_hash(request.password),
            display_name=request.display_name,
            role="user",
            status="active",
            permissions=[],
        )
        db.add(profile)
        await db.commit()
        await db.refresh(profile)

        # Create access token
        access_token = create_access_token(data={"sub": profile.id})

        return {
            "message": "User registered successfully",
            "user": {
                "id": profile.id,
                "email": profile.email,
            },
            "session": {
                "access_token": access_token,
                "refresh_token": None,
            },
        }
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.post("/login")
async def login(request: LoginRequest, db: AsyncSession = Depends(get_db)):
    """Login user."""
    try:
        result = await db.execute(select(Profile).where(Profile.email == request.email))
        profile = result.scalar_one_or_none()

        if not profile or not verify_password(request.password, profile.hashed_password):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid credentials",
            )

        if profile.status == "disabled" or profile.status == "blocked":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User account is disabled",
            )

        access_token = create_access_token(data={"sub": profile.id})

        return {
            "access_token": access_token,
            "refresh_token": None,
            "token_type": "bearer",
            "user": {
                "id": profile.id,
                "email": profile.email,
                "display_name": profile.display_name,
                "role": profile.role or "user",
                "status": profile.status or "active",
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
    """Logout user (client-side token removal)."""
    return {"message": "Logged out successfully"}


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: UserResponse = Depends(get_current_user)):
    """Get current user."""
    return current_user
