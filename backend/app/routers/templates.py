from fastapi import APIRouter, HTTPException, status, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.schemas import (
    RoundTemplateCreate, RoundTemplateUpdate, RoundTemplateResponse, UserResponse,
)
from app.models.db_models import RoundTemplate as RoundTemplateModel
from app.database import get_db
from app.dependencies import get_current_user
from datetime import datetime

router = APIRouter(prefix="/templates", tags=["templates"])


def model_to_dict(t: RoundTemplateModel) -> dict:
    return {
        "id": t.id,
        "user_id": t.user_id,
        "name": t.name,
        "course_id": t.course_id,
        "course_name": t.course_name,
        "course_length": t.course_length,
        "game_mode": t.game_mode,
        "use_handicap": t.use_handicap,
        "handicap_percentage": t.handicap_percentage,
        "sindicato_points": t.sindicato_points,
        "team_mode": t.team_mode,
        "best_ball_points": t.best_ball_points,
        "worst_ball_points": t.worst_ball_points,
        "player_ids": t.player_ids or [],
        "default_tee": t.default_tee,
        "is_favorite": t.is_favorite or False,
        "created_at": t.created_at.isoformat() if t.created_at else None,
        "updated_at": t.updated_at.isoformat() if t.updated_at else None,
    }


@router.get("/", response_model=list[RoundTemplateResponse])
async def list_templates(
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all round templates for the current user."""
    try:
        result = await db.execute(
            select(RoundTemplateModel)
            .where(RoundTemplateModel.user_id == current_user.id)
            .order_by(RoundTemplateModel.is_favorite.desc(), RoundTemplateModel.name)
        )
        templates = result.scalars().all()
        return [model_to_dict(t) for t in templates]
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.get("/{template_id}", response_model=RoundTemplateResponse)
async def get_template(
    template_id: str,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get a round template by ID."""
    result = await db.execute(
        select(RoundTemplateModel)
        .where(RoundTemplateModel.id == template_id, RoundTemplateModel.user_id == current_user.id)
    )
    template = result.scalar_one_or_none()
    if not template:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Template not found")
    return model_to_dict(template)


@router.post("/", response_model=RoundTemplateResponse, status_code=status.HTTP_201_CREATED)
async def create_template(
    template: RoundTemplateCreate,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new round template."""
    try:
        db_template = RoundTemplateModel(
            user_id=current_user.id,
            name=template.name,
            course_id=template.course_id,
            course_name=template.course_name,
            course_length=template.course_length,
            game_mode=template.game_mode,
            use_handicap=template.use_handicap,
            handicap_percentage=template.handicap_percentage,
            sindicato_points=template.sindicato_points,
            team_mode=template.team_mode,
            best_ball_points=template.best_ball_points,
            worst_ball_points=template.worst_ball_points,
            player_ids=template.player_ids,
            default_tee=template.default_tee,
            is_favorite=template.is_favorite,
        )
        db.add(db_template)
        await db.commit()
        await db.refresh(db_template)
        return model_to_dict(db_template)
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.put("/{template_id}", response_model=RoundTemplateResponse)
async def update_template(
    template_id: str,
    template: RoundTemplateUpdate,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update a round template."""
    result = await db.execute(
        select(RoundTemplateModel).where(RoundTemplateModel.id == template_id)
    )
    existing = result.scalar_one_or_none()
    if not existing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Template not found")
    if existing.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    update_data = {k: v for k, v in template.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No fields to update")

    for key, value in update_data.items():
        setattr(existing, key, value)

    existing.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(existing)
    return model_to_dict(existing)


@router.delete("/{template_id}")
async def delete_template(
    template_id: str,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a round template."""
    result = await db.execute(
        select(RoundTemplateModel).where(RoundTemplateModel.id == template_id)
    )
    existing = result.scalar_one_or_none()
    if not existing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Template not found")
    if existing.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    await db.delete(existing)
    await db.commit()
    return {"message": "Template deleted successfully"}


@router.patch("/{template_id}/favorite")
async def toggle_favorite(
    template_id: str,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Toggle the favorite status of a template."""
    result = await db.execute(
        select(RoundTemplateModel).where(RoundTemplateModel.id == template_id)
    )
    existing = result.scalar_one_or_none()
    if not existing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Template not found")
    if existing.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    existing.is_favorite = not (existing.is_favorite or False)
    existing.updated_at = datetime.utcnow()
    await db.commit()
    return {"is_favorite": existing.is_favorite}
