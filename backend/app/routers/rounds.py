from fastapi import APIRouter, HTTPException, status, Depends
from app.models.schemas import RoundCreate, RoundUpdate, RoundResponse, UserResponse
from app.services.supabase import get_supabase_client
from app.dependencies import get_current_user
import uuid
import time

router = APIRouter(prefix="/rounds", tags=["rounds"])


def calculate_playing_handicap(handicap_index: float, slope: int, percentage: int = 100) -> int:
    """Calculate playing handicap from handicap index and slope."""
    playing_hcp = (handicap_index * slope) / 113
    return round(playing_hcp * percentage / 100)


@router.get("/", response_model=list[RoundResponse])
async def list_rounds(current_user: UserResponse = Depends(get_current_user)):
    """List all rounds for the current user."""
    supabase = get_supabase_client()

    try:
        response = (
            supabase.table("rounds")
            .select("*")
            .eq("user_id", current_user.id)
            .order("round_date", desc=True)
            .execute()
        )
        return response.data or []
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )


@router.get("/{round_id}", response_model=RoundResponse)
async def get_round(
    round_id: str,
    current_user: UserResponse = Depends(get_current_user),
):
    """Get round by ID."""
    supabase = get_supabase_client()

    try:
        response = (
            supabase.table("rounds")
            .select("*")
            .eq("id", round_id)
            .eq("user_id", current_user.id)
            .single()
            .execute()
        )

        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Round not found",
            )

        return response.data
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )


@router.post("/", response_model=RoundResponse, status_code=status.HTTP_201_CREATED)
async def create_round(
    round_data: RoundCreate,
    current_user: UserResponse = Depends(get_current_user),
):
    """Create a new round."""
    supabase = get_supabase_client()

    try:
        # Get course to calculate playing handicaps
        course_response = (
            supabase.table("courses")
            .select("*")
            .eq("id", round_data.course_id)
            .single()
            .execute()
        )

        if not course_response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Course not found",
            )

        course = course_response.data
        tees_dict = {t["name"]: t for t in course["tees"]}

        # Prepare players with calculated handicaps
        players = []
        for player in round_data.players:
            tee = tees_dict.get(player.tee_box)
            if not tee:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Tee '{player.tee_box}' not found for course",
                )

            playing_handicap = calculate_playing_handicap(
                player.od_handicap_index,
                tee["slope"],
                round_data.handicap_percentage if round_data.use_handicap else 0,
            )

            players.append({
                "id": str(uuid.uuid4()),
                "name": player.name,
                "od_handicap_index": player.od_handicap_index,
                "tee_box": player.tee_box,
                "team": player.team,
                "playing_handicap": playing_handicap if round_data.use_handicap else 0,
                "scores": {},
            })

        # Determine starting hole based on course length
        current_hole = 1 if round_data.course_length in ["18", "front9"] else 10

        # Create round data
        new_round = {
            "user_id": current_user.id,
            "od_id": int(time.time() * 1000),
            "od_user_id": current_user.id,
            "course_id": round_data.course_id,
            "course_name": round_data.course_name,
            "round_date": round_data.round_date,
            "course_length": round_data.course_length,
            "game_mode": round_data.game_mode,
            "use_handicap": round_data.use_handicap,
            "handicap_percentage": round_data.handicap_percentage,
            "sindicato_points": round_data.sindicato_points,
            "team_mode": round_data.team_mode,
            "best_ball_points": round_data.best_ball_points,
            "worst_ball_points": round_data.worst_ball_points,
            "current_hole": current_hole,
            "completed_holes": [],
            "players": players,
            "is_finished": False,
        }

        response = supabase.table("rounds").insert(new_round).execute()

        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to create round",
            )

        return response.data[0]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )


@router.put("/{round_id}", response_model=RoundResponse)
async def update_round(
    round_id: str,
    round_update: RoundUpdate,
    current_user: UserResponse = Depends(get_current_user),
):
    """Update a round."""
    supabase = get_supabase_client()

    try:
        # Check ownership
        existing = (
            supabase.table("rounds")
            .select("user_id")
            .eq("id", round_id)
            .single()
            .execute()
        )

        if not existing.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Round not found",
            )

        if existing.data["user_id"] != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied",
            )

        # Prepare update data
        update_data = {}

        if round_update.current_hole is not None:
            update_data["current_hole"] = round_update.current_hole

        if round_update.completed_holes is not None:
            update_data["completed_holes"] = round_update.completed_holes

        if round_update.players is not None:
            update_data["players"] = [p.model_dump() for p in round_update.players]

        if round_update.is_finished is not None:
            update_data["is_finished"] = round_update.is_finished

        if not update_data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No fields to update",
            )

        response = supabase.table("rounds").update(update_data).eq("id", round_id).execute()

        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Round not found",
            )

        return response.data[0]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )


@router.delete("/{round_id}")
async def delete_round(
    round_id: str,
    current_user: UserResponse = Depends(get_current_user),
):
    """Delete a round."""
    supabase = get_supabase_client()

    try:
        # Check ownership
        existing = (
            supabase.table("rounds")
            .select("user_id")
            .eq("id", round_id)
            .single()
            .execute()
        )

        if not existing.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Round not found",
            )

        if existing.data["user_id"] != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied",
            )

        supabase.table("rounds").delete().eq("id", round_id).execute()

        return {"message": "Round deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )


@router.patch("/{round_id}/finish", response_model=RoundResponse)
async def finish_round(
    round_id: str,
    current_user: UserResponse = Depends(get_current_user),
):
    """Mark a round as finished."""
    supabase = get_supabase_client()

    try:
        # Check ownership
        existing = (
            supabase.table("rounds")
            .select("user_id")
            .eq("id", round_id)
            .single()
            .execute()
        )

        if not existing.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Round not found",
            )

        if existing.data["user_id"] != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied",
            )

        response = (
            supabase.table("rounds")
            .update({"is_finished": True})
            .eq("id", round_id)
            .execute()
        )

        return response.data[0]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )
