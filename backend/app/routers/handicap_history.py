from fastapi import APIRouter, HTTPException, status, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.schemas import (
    HandicapHistoryCreate, HandicapHistoryUpdate, HandicapHistoryResponse, UserResponse,
)
from app.models.db_models import HandicapHistory as HandicapHistoryModel
from app.database import get_db
from app.dependencies import get_current_user
from typing import Optional

router = APIRouter(prefix="/handicap-history", tags=["handicap-history"])


def model_to_dict(h: HandicapHistoryModel) -> dict:
    return {
        "id": h.id,
        "user_id": h.user_id,
        "handicap_index": h.handicap_index,
        "effective_date": h.effective_date,
        "notes": h.notes,
        "created_at": h.created_at.isoformat() if h.created_at else None,
    }


@router.get("/", response_model=list[HandicapHistoryResponse])
async def list_handicap_history(
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all handicap history entries for the current user, ordered by date desc."""
    try:
        result = await db.execute(
            select(HandicapHistoryModel)
            .where(HandicapHistoryModel.user_id == current_user.id)
            .order_by(HandicapHistoryModel.effective_date.desc())
        )
        entries = result.scalars().all()
        return [model_to_dict(h) for h in entries]
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.get("/current", response_model=Optional[HandicapHistoryResponse])
async def get_current_handicap(
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get the most recent (current) handicap index for the user."""
    result = await db.execute(
        select(HandicapHistoryModel)
        .where(HandicapHistoryModel.user_id == current_user.id)
        .order_by(HandicapHistoryModel.effective_date.desc())
        .limit(1)
    )
    entry = result.scalar_one_or_none()
    if entry:
        return model_to_dict(entry)
    return None


@router.get("/at-date/{date}", response_model=Optional[HandicapHistoryResponse])
async def get_handicap_at_date(
    date: str,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get the handicap index that was effective on a specific date."""
    result = await db.execute(
        select(HandicapHistoryModel)
        .where(
            HandicapHistoryModel.user_id == current_user.id,
            HandicapHistoryModel.effective_date <= date,
        )
        .order_by(HandicapHistoryModel.effective_date.desc())
        .limit(1)
    )
    entry = result.scalar_one_or_none()
    if entry:
        return model_to_dict(entry)
    return None


@router.post("/", response_model=HandicapHistoryResponse, status_code=status.HTTP_201_CREATED)
async def create_handicap_entry(
    entry: HandicapHistoryCreate,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new handicap history entry."""
    try:
        db_entry = HandicapHistoryModel(
            user_id=current_user.id,
            handicap_index=entry.handicap_index,
            effective_date=entry.effective_date,
            notes=entry.notes,
        )
        db.add(db_entry)
        await db.commit()
        await db.refresh(db_entry)
        return model_to_dict(db_entry)
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.put("/{entry_id}", response_model=HandicapHistoryResponse)
async def update_handicap_entry(
    entry_id: str,
    entry: HandicapHistoryUpdate,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update a handicap history entry."""
    result = await db.execute(
        select(HandicapHistoryModel).where(HandicapHistoryModel.id == entry_id)
    )
    existing = result.scalar_one_or_none()
    if not existing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Handicap entry not found")
    if existing.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    update_data = {k: v for k, v in entry.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No fields to update")

    for key, value in update_data.items():
        setattr(existing, key, value)

    await db.commit()
    await db.refresh(existing)
    return model_to_dict(existing)


@router.delete("/{entry_id}")
async def delete_handicap_entry(
    entry_id: str,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a handicap history entry."""
    result = await db.execute(
        select(HandicapHistoryModel).where(HandicapHistoryModel.id == entry_id)
    )
    existing = result.scalar_one_or_none()
    if not existing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Handicap entry not found")
    if existing.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    await db.delete(existing)
    await db.commit()
    return {"message": "Handicap entry deleted successfully"}
