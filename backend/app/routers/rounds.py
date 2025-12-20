from fastapi import APIRouter, HTTPException, status, Depends, UploadFile, File
from app.models.schemas import RoundCreate, RoundUpdate, RoundResponse, UserResponse
from app.services.supabase import get_supabase_client
from app.services.round_ocr import extract_round_data
from app.dependencies import get_current_user
import uuid
import time
import base64

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


# Import round from image endpoints
@router.post("/import/extract")
async def extract_round_from_image(
    file: UploadFile = File(...),
    current_user: UserResponse = Depends(get_current_user),
):
    """Extract round data from a scorecard image using AI."""
    try:
        # Validate file type
        if not file.content_type or not file.content_type.startswith("image/"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="File must be an image",
            )

        # Read and encode image
        contents = await file.read()
        image_base64 = base64.b64encode(contents).decode("utf-8")

        # Extract data using Claude Vision
        extracted_data = await extract_round_data(image_base64, file.content_type)

        return {
            "success": True,
            "message": "Round data extracted successfully",
            "round_data": extracted_data,
        }
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to extract round data: {str(e)}",
        )


@router.post("/import/save", response_model=RoundResponse, status_code=status.HTTP_201_CREATED)
async def save_imported_round(
    import_data: dict,
    current_user: UserResponse = Depends(get_current_user),
):
    """Save an imported round from extracted scorecard data."""
    supabase = get_supabase_client()

    try:
        course_info = import_data.get("course", {})
        round_info = import_data.get("round", {})
        holes_data = import_data.get("holes_data", [])
        num_holes = import_data.get("holes", 18)
        totals = import_data.get("totals", {})
        existing_course_id = import_data.get("existing_course_id")

        course = None
        course_id = None
        course_name = course_info.get("name", "Campo Importado")

        # If existing course ID is provided, use that course
        if existing_course_id:
            course_response = (
                supabase.table("courses")
                .select("*")
                .eq("id", existing_course_id)
                .execute()
            )
            if course_response.data:
                course = course_response.data[0]
                course_id = course["id"]
                course_name = course["name"]

        # If no existing course selected, check by name or create new
        if not course_id:
            course_response = (
                supabase.table("courses")
                .select("*")
                .eq("name", course_name)
                .execute()
            )

            if course_response.data:
                # Use existing course
                course = course_response.data[0]
                course_id = course["id"]
            else:
                # Create new course from extracted data
                tee_played = course_info.get("tee_played", {})
                new_course = {
                    "name": course_name,
                    "holes": num_holes,
                    "par": totals.get("par", 72),
                    "tees": [{
                        "name": tee_played.get("name", "Standard"),
                        "slope": tee_played.get("slope", 113),
                        "rating": tee_played.get("rating", 72.0),
                    }],
                    "holes_data": [
                        {
                            "number": h.get("number", i + 1),
                            "par": h.get("par", 4),
                            "handicap": h.get("handicap", i + 1),
                            "distance": h.get("distance", 350),
                        }
                        for i, h in enumerate(holes_data)
                    ],
                }

                course_create_response = supabase.table("courses").insert(new_course).execute()
                if not course_create_response.data:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="Failed to create course",
                    )
                course = course_create_response.data[0]
                course_id = course["id"]

        # Get the tee for playing handicap calculation
        tee_played = course_info.get("tee_played", {})
        tee_slope = tee_played.get("slope", 113)
        player_handicap_index = round_info.get("handicap_index", 24.0)
        playing_handicap = calculate_playing_handicap(player_handicap_index, tee_slope)

        # Build scores from holes_data
        scores = {}
        completed_holes = []
        for hole in holes_data:
            hole_num = hole.get("number")
            strokes = hole.get("strokes")
            if hole_num and strokes:
                scores[str(hole_num)] = {
                    "strokes": strokes,
                    "putts": 0,  # Not available from import
                }
                completed_holes.append(hole_num)

        # Create the player
        player = {
            "id": str(uuid.uuid4()),
            "name": round_info.get("player_name", current_user.display_name or "Jugador"),
            "od_handicap_index": player_handicap_index,
            "tee_box": tee_played.get("name", "Standard"),
            "team": None,
            "playing_handicap": playing_handicap,
            "scores": scores,
        }

        # Use course_length from import data, or determine from num_holes
        course_length = import_data.get("course_length", "18" if num_holes == 18 else "front9")

        # Create the imported round
        new_round = {
            "user_id": current_user.id,
            "od_id": int(time.time() * 1000),
            "od_user_id": current_user.id,
            "course_id": course_id,
            "course_name": course_name,
            "round_date": round_info.get("date", time.strftime("%Y-%m-%d")),
            "course_length": course_length,
            "game_mode": "stableford",  # Default for imported rounds
            "use_handicap": True,
            "handicap_percentage": 100,
            "sindicato_points": None,
            "team_mode": None,
            "best_ball_points": None,
            "worst_ball_points": None,
            "current_hole": num_holes,
            "completed_holes": completed_holes,
            "players": [player],
            "is_finished": True,
            "is_imported": True,
        }

        response = supabase.table("rounds").insert(new_round).execute()

        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to save imported round",
            )

        return response.data[0]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )
