from fastapi import APIRouter, HTTPException, status, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.schemas import (
    SavedPlayerCreate, SavedPlayerUpdate, SavedPlayerResponse, UserResponse,
)
from app.models.db_models import SavedPlayer as SavedPlayerModel
from app.database import get_db
from app.dependencies import get_current_user
from datetime import datetime

router = APIRouter(prefix="/players", tags=["players"])


def model_to_dict(p: SavedPlayerModel) -> dict:
    return {
        "id": p.id,
        "user_id": p.user_id,
        "name": p.name,
        "handicap_index": p.handicap_index,
        "preferred_tee": p.preferred_tee,
        "created_at": p.created_at.isoformat() if p.created_at else None,
        "updated_at": p.updated_at.isoformat() if p.updated_at else None,
    }


@router.get("/", response_model=list[SavedPlayerResponse])
async def list_players(
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all saved players for the current user. Owner sees all players."""
    try:
        if current_user.role == "owner":
            result = await db.execute(select(SavedPlayerModel).order_by(SavedPlayerModel.name))
        else:
            result = await db.execute(
                select(SavedPlayerModel)
                .where(SavedPlayerModel.user_id == current_user.id)
                .order_by(SavedPlayerModel.name)
            )
        players = result.scalars().all()
        return [model_to_dict(p) for p in players]
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.get("/{player_id}", response_model=SavedPlayerResponse)
async def get_player(
    player_id: str,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get a saved player by ID."""
    query = select(SavedPlayerModel).where(SavedPlayerModel.id == player_id)
    if current_user.role != "owner":
        query = query.where(SavedPlayerModel.user_id == current_user.id)

    result = await db.execute(query)
    player = result.scalar_one_or_none()
    if not player:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Player not found")
    return model_to_dict(player)


@router.post("/", response_model=SavedPlayerResponse, status_code=status.HTTP_201_CREATED)
async def create_player(
    player: SavedPlayerCreate,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new saved player."""
    try:
        db_player = SavedPlayerModel(
            user_id=current_user.id,
            name=player.name,
            handicap_index=player.handicap_index,
            preferred_tee=player.preferred_tee,
        )
        db.add(db_player)
        await db.commit()
        await db.refresh(db_player)
        return model_to_dict(db_player)
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.put("/{player_id}", response_model=SavedPlayerResponse)
async def update_player(
    player_id: str,
    player: SavedPlayerUpdate,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update a saved player."""
    result = await db.execute(select(SavedPlayerModel).where(SavedPlayerModel.id == player_id))
    existing = result.scalar_one_or_none()
    if not existing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Player not found")

    if existing.user_id != current_user.id and current_user.role != "owner":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    update_data = {k: v for k, v in player.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No fields to update")

    for key, value in update_data.items():
        setattr(existing, key, value)

    existing.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(existing)
    return model_to_dict(existing)


@router.delete("/{player_id}")
async def delete_player(
    player_id: str,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a saved player."""
    result = await db.execute(select(SavedPlayerModel).where(SavedPlayerModel.id == player_id))
    existing = result.scalar_one_or_none()
    if not existing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Player not found")

    if existing.user_id != current_user.id and current_user.role != "owner":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    await db.delete(existing)
    await db.commit()
    return {"message": "Player deleted successfully"}
