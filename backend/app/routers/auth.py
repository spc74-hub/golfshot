import httpx
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, HTTPException, status, Depends, Request
from jose import jwt as cf_jwt
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.schemas import LoginRequest, RegisterRequest, UserResponse
from app.models.db_models import Profile
from app.database import get_db
from app.auth import verify_password, get_password_hash, create_access_token
from app.config import get_settings
from app.dependencies import get_current_user

router = APIRouter(prefix="/auth", tags=["auth"])

# ⚠️ Cloudflare ROTA estas claves. Cachearlas para siempre significa que, el día
# que rota, la verificación falla y el auto-login deja de funcionar sin que nadie
# haya tocado nada: pasas el OTP y la app te pide usuario y contraseña. Ocurrió el
# 2026-08-12 en nueve apps a la vez. Por eso la caché caduca, y ante un fallo de
# verificación se recarga y se reintenta UNA vez (así una rotación se absorbe al
# instante). Ver spcapps-infra/docs/PATTERNS.md → "El JWKS tiene que caducar".
_CF_JWKS_TTL = timedelta(hours=1)
_cf_jwks: dict | None = None
_cf_jwks_at: datetime | None = None


async def _cloudflare_jwks(settings, force: bool = False) -> dict:
    global _cf_jwks, _cf_jwks_at
    fresco = (
        _cf_jwks is not None
        and _cf_jwks_at is not None
        and datetime.now(timezone.utc) - _cf_jwks_at < _CF_JWKS_TTL
    )
    if fresco and not force:
        return _cf_jwks
    async with httpx.AsyncClient(timeout=5) as client:
        res = await client.get(f"{settings.cf_access_team_domain}/cdn-cgi/access/certs")
        res.raise_for_status()
        _cf_jwks = res.json()
    _cf_jwks_at = datetime.now(timezone.utc)
    return _cf_jwks


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


@router.post("/cf-access")
async def cf_access_login(request: Request, db: AsyncSession = Depends(get_db)):
    """Auto-login from a Cloudflare Access identity (no password).

    Only works behind Cloudflare Access: validates the signed assertion that
    Cloudflare injects (Cf-Access-Jwt-Assertion) against the team's public keys
    and checks the `aud` matches this app — so it can't be forged by a client.
    """
    settings = get_settings()
    if not settings.cf_access_aud:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Cloudflare Access login not configured")

    assertion = request.headers.get("Cf-Access-Jwt-Assertion")
    if not assertion:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="No Cloudflare Access assertion present")

    def _decode(jwks):
        return cf_jwt.decode(
            assertion,
            jwks,
            algorithms=["RS256"],
            audience=settings.cf_access_aud,
            issuer=settings.cf_access_team_domain,
        )

    try:
        try:
            claims = _decode(await _cloudflare_jwks(settings))
        except Exception:
            # Puede ser un assertion inválido, o que Cloudflare acabe de rotar sus
            # claves. Se reintenta una vez con el JWKS recién descargado.
            claims = _decode(await _cloudflare_jwks(settings, force=True))
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid Cloudflare Access assertion")

    email = claims.get("email")
    if not email:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Cloudflare Access assertion has no email")

    result = await db.execute(select(Profile).where(Profile.email == email))
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No account for this identity")
    if profile.status in ("disabled", "blocked"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User account is disabled")

    access_token = create_access_token(data={"sub": profile.id})
    return {"access_token": access_token, "token_type": "bearer"}


@router.post("/logout")
async def logout(current_user: UserResponse = Depends(get_current_user)):
    """Logout user (client-side token removal)."""
    return {"message": "Logged out successfully"}


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: UserResponse = Depends(get_current_user)):
    """Get current user."""
    return current_user
