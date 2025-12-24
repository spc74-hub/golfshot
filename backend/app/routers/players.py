from fastapi import APIRouter, HTTPException, status, Depends
from app.models.schemas import (
    SavedPlayerCreate,
    SavedPlayerUpdate,
    SavedPlayerResponse,
    UserResponse,
)
from app.services.supabase import get_supabase_client
from app.dependencies import get_current_user

router = APIRouter(prefix="/players", tags=["players"])


@router.get("/", response_model=list[SavedPlayerResponse])
async def list_players(current_user: UserResponse = Depends(get_current_user)):
    """List all saved players for the current user. Owner sees all players."""
    supabase = get_supabase_client()

    try:
        # Owner sees all players from all users
        if current_user.role == "owner":
            response = (
                supabase.table("saved_players")
                .select("*")
                .order("name")
                .execute()
            )
        else:
            # Regular users only see their own players
            response = (
                supabase.table("saved_players")
                .select("*")
                .eq("user_id", current_user.id)
                .order("name")
                .execute()
            )
        return response.data or []
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )


@router.get("/{player_id}", response_model=SavedPlayerResponse)
async def get_player(
    player_id: str,
    current_user: UserResponse = Depends(get_current_user),
):
    """Get a saved player by ID."""
    supabase = get_supabase_client()

    try:
        # Owner can see any player
        if current_user.role == "owner":
            response = (
                supabase.table("saved_players")
                .select("*")
                .eq("id", player_id)
                .single()
                .execute()
            )
        else:
            response = (
                supabase.table("saved_players")
                .select("*")
                .eq("id", player_id)
                .eq("user_id", current_user.id)
                .single()
                .execute()
            )

        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Player not found",
            )

        return response.data
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )


@router.post("/", response_model=SavedPlayerResponse, status_code=status.HTTP_201_CREATED)
async def create_player(
    player: SavedPlayerCreate,
    current_user: UserResponse = Depends(get_current_user),
):
    """Create a new saved player."""
    supabase = get_supabase_client()

    try:
        player_data = {
            "user_id": current_user.id,
            "name": player.name,
            "handicap_index": player.handicap_index,
            "preferred_tee": player.preferred_tee,
        }

        response = supabase.table("saved_players").insert(player_data).execute()

        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to create player",
            )

        return response.data[0]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )


@router.put("/{player_id}", response_model=SavedPlayerResponse)
async def update_player(
    player_id: str,
    player: SavedPlayerUpdate,
    current_user: UserResponse = Depends(get_current_user),
):
    """Update a saved player."""
    supabase = get_supabase_client()

    try:
        # Check ownership
        existing = (
            supabase.table("saved_players")
            .select("user_id")
            .eq("id", player_id)
            .single()
            .execute()
        )

        if not existing.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Player not found",
            )

        # Owner can edit any player, others can only edit their own
        if existing.data["user_id"] != current_user.id and current_user.role != "owner":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied",
            )

        # Prepare update data
        update_data = {k: v for k, v in player.model_dump().items() if v is not None}

        if not update_data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No fields to update",
            )

        response = (
            supabase.table("saved_players")
            .update(update_data)
            .eq("id", player_id)
            .execute()
        )

        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Player not found",
            )

        return response.data[0]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )


@router.delete("/{player_id}")
async def delete_player(
    player_id: str,
    current_user: UserResponse = Depends(get_current_user),
):
    """Delete a saved player."""
    supabase = get_supabase_client()

    try:
        # Check ownership
        existing = (
            supabase.table("saved_players")
            .select("user_id")
            .eq("id", player_id)
            .single()
            .execute()
        )

        if not existing.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Player not found",
            )

        # Owner can delete any player, others can only delete their own
        if existing.data["user_id"] != current_user.id and current_user.role != "owner":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied",
            )

        supabase.table("saved_players").delete().eq("id", player_id).execute()

        return {"message": "Player deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )
