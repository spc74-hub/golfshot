from fastapi import APIRouter, HTTPException, status, Depends, UploadFile, File
from app.models.schemas import RoundCreate, RoundUpdate, RoundResponse, UserResponse, JoinRoundRequest, JoinRoundResponse
from app.services.supabase import get_supabase_client
from app.services.round_ocr import extract_round_data
from app.dependencies import get_current_user
import uuid
import time
import base64
import random
import string

router = APIRouter(prefix="/rounds", tags=["rounds"])


def calculate_playing_handicap(handicap_index: float, slope: int, percentage: int = 100) -> int:
    """Calculate playing handicap from handicap index and slope."""
    playing_hcp = (handicap_index * slope) / 113
    return round(playing_hcp * percentage / 100)


def generate_share_code() -> str:
    """Generate a 6-character alphanumeric share code (no confusing chars like 0/O, 1/I/L)."""
    chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    return "".join(random.choice(chars) for _ in range(6))


def calculate_virtual_handicap(
    players: list,
    course_length: str,
    holes_data: list,
    use_handicap: bool = True,
    handicap_percentage: int = 100,
    tees: list | None = None,
) -> float | None:
    """
    Calculate Virtual Handicap for the first player in the round.
    HV = Handicap Index - (Stableford Points - 36) for 18 holes.

    Args:
        players: List of player data
        course_length: "18", "front9", or "back9"
        holes_data: List of hole data with par and handicap
        use_handicap: If False, all players use the first player's handicap ("común" mode)
        handicap_percentage: Percentage of handicap to use (100 or 75)
        tees: List of tees with slope data (for recalculating HDJ if stored as 0)

    Returns None if calculation cannot be performed.
    """
    if not players or not holes_data:
        return None

    # Get first player (the main player whose stats we track)
    user_player = players[0]
    scores = user_player.get("scores", {})
    od_handicap_index = user_player.get("od_handicap_index", 0)
    playing_handicap = user_player.get("playing_handicap", 0)

    if not scores or od_handicap_index is None:
        return None

    # Handle legacy rounds where playing_handicap was stored as 0
    # Recalculate from od_handicap_index if we have tee data
    if playing_handicap == 0 and od_handicap_index > 0 and tees:
        tee_box = user_player.get("tee_box", "")
        matching_tee = next((t for t in tees if t.get("name") == tee_box), None)
        if matching_tee:
            slope = matching_tee.get("slope", 113)
            playing_handicap = calculate_playing_handicap(od_handicap_index, slope, handicap_percentage)

    # If use_handicap is False ("común" mode), we still use the first player's handicap
    # for Stableford calculation internally
    effective_handicap = playing_handicap

    # Determine which holes to count based on course_length
    if course_length == "front9":
        holes_to_count = range(1, 10)
    elif course_length == "back9":
        holes_to_count = range(10, 19)
    else:  # "18"
        holes_to_count = range(1, 19)

    # Create holes lookup
    holes_lookup = {h.get("number"): h for h in holes_data}

    # Calculate Stableford points
    total_stableford = 0
    holes_played = 0

    for hole_num in holes_to_count:
        hole_num_str = str(hole_num)
        if hole_num_str not in scores:
            continue

        score = scores[hole_num_str]
        strokes = score.get("strokes", 0)
        if strokes <= 0:
            continue

        hole_data = holes_lookup.get(hole_num)
        if not hole_data:
            continue

        par = hole_data.get("par", 4)
        handicap_index = hole_data.get("handicap", 1)

        # Calculate strokes received on this hole
        strokes_received = 0
        if effective_handicap > 0:
            base_strokes = effective_handicap // 18
            remainder = effective_handicap % 18
            strokes_received = base_strokes + (1 if handicap_index <= remainder else 0)

        # Calculate net score and Stableford points
        net_score = strokes - strokes_received
        diff = net_score - par

        if diff <= -3:
            points = 5
        elif diff == -2:
            points = 4
        elif diff == -1:
            points = 3
        elif diff == 0:
            points = 2
        elif diff == 1:
            points = 1
        else:
            points = 0

        total_stableford += points
        holes_played += 1

    # Need at least some holes played
    if holes_played == 0:
        return None

    # Normalize to 18-hole equivalent
    is_9_hole_round = course_length in ["front9", "back9"]
    if is_9_hole_round:
        normalized_stableford = total_stableford * 2
    else:
        normalized_stableford = total_stableford

    # HV = Handicap Index - (Stableford Points - 36)
    virtual_handicap = od_handicap_index - (normalized_stableford - 36)

    return round(virtual_handicap, 1)


@router.get("/", response_model=list[RoundResponse])
async def list_rounds(current_user: UserResponse = Depends(get_current_user)):
    """List all rounds for the current user (owned and shared)."""
    supabase = get_supabase_client()

    try:
        # Get rounds owned by user
        owned_response = (
            supabase.table("rounds")
            .select("*")
            .eq("user_id", current_user.id)
            .order("round_date", desc=True)
            .execute()
        )
        owned_rounds = owned_response.data or []

        # Get rounds where user is a collaborator
        shared_response = (
            supabase.table("rounds")
            .select("*")
            .contains("collaborators", [current_user.id])
            .order("round_date", desc=True)
            .execute()
        )
        shared_rounds = shared_response.data or []

        # Mark ownership and merge
        for r in owned_rounds:
            r["is_owner"] = True
        for r in shared_rounds:
            r["is_owner"] = False

        # Combine and sort by date
        all_rounds = owned_rounds + shared_rounds
        all_rounds.sort(key=lambda x: x.get("round_date", ""), reverse=True)

        return all_rounds
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
    """Get round by ID (owned or shared)."""
    supabase = get_supabase_client()

    try:
        response = (
            supabase.table("rounds")
            .select("*")
            .eq("id", round_id)
            .single()
            .execute()
        )

        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Round not found",
            )

        round_data = response.data
        user_id = round_data.get("user_id")
        collaborators = round_data.get("collaborators") or []

        # Check if user has access (owner or collaborator)
        if user_id != current_user.id and current_user.id not in collaborators:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied",
            )

        # Add is_owner flag
        round_data["is_owner"] = user_id == current_user.id

        return round_data
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
    """Update a round (owner or collaborator can update scores)."""
    supabase = get_supabase_client()

    try:
        # Check ownership or collaboration - also get course_id and course_length for HV calculation
        existing = (
            supabase.table("rounds")
            .select("user_id, collaborators, share_code, course_id, course_length")
            .eq("id", round_id)
            .single()
            .execute()
        )

        if not existing.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Round not found",
            )

        user_id = existing.data["user_id"]
        collaborators = existing.data.get("collaborators") or []
        is_owner = user_id == current_user.id
        is_collaborator = current_user.id in collaborators

        if not is_owner and not is_collaborator:
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
            players_data = [p.model_dump() for p in round_update.players]
            update_data["players"] = players_data

            # Calculate and store Virtual Handicap when players/scores are updated
            course_id = existing.data.get("course_id")
            course_length = existing.data.get("course_length", "18")
            use_handicap = existing.data.get("use_handicap", True)
            handicap_percentage = existing.data.get("handicap_percentage", 100)
            if course_id:
                # Get course holes_data and tees for HV calculation
                course_response = supabase.table("courses").select("holes_data, tees").eq("id", course_id).single().execute()
                if course_response.data and course_response.data.get("holes_data"):
                    holes_data = course_response.data["holes_data"]
                    tees = course_response.data.get("tees", [])
                    virtual_handicap = calculate_virtual_handicap(
                        players_data,
                        course_length,
                        holes_data,
                        use_handicap=use_handicap,
                        handicap_percentage=handicap_percentage,
                        tees=tees,
                    )
                    if virtual_handicap is not None:
                        update_data["virtual_handicap"] = virtual_handicap

        if round_update.is_finished is not None:
            update_data["is_finished"] = round_update.is_finished

        # Handle share_enabled (only owner can change)
        if round_update.share_enabled is not None and is_owner:
            if round_update.share_enabled:
                # Enable sharing - generate code if not exists
                if not existing.data.get("share_code"):
                    # Generate unique share code
                    for _ in range(10):  # Try up to 10 times
                        code = generate_share_code()
                        # Check if code already exists
                        check = supabase.table("rounds").select("id").eq("share_code", code).execute()
                        if not check.data:
                            update_data["share_code"] = code
                            break
                    else:
                        raise HTTPException(
                            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                            detail="Could not generate unique share code",
                        )
            else:
                # Disable sharing - remove code and collaborators
                update_data["share_code"] = None
                update_data["collaborators"] = []

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

        result = response.data[0]
        result["is_owner"] = is_owner
        return result
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

        # Use calculated_hdj from OCR if available (calculated from Stableford points)
        # Otherwise calculate from current handicap_index
        calculated_hdj = round_info.get("calculated_hdj", 0)
        if calculated_hdj > 0:
            playing_handicap = calculated_hdj
        else:
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
                    "putts": hole.get("putts", 0),  # Include putts from OCR extraction
                }
                completed_holes.append(hole_num)

        # Get player name and try to match with current user
        imported_player_name = round_info.get("player_name", "Jugador")
        user_display_name = current_user.display_name or ""

        # Check if imported player name matches the current user
        # Match if: names are similar (case-insensitive partial match)
        def names_match(imported: str, user: str) -> bool:
            if not imported or not user:
                return False
            imported_lower = imported.lower().strip()
            user_lower = user.lower().strip()
            # Check if one contains the other
            if imported_lower in user_lower or user_lower in imported_lower:
                return True
            # Check first name match
            imported_parts = imported_lower.split()
            user_parts = user_lower.split()
            if imported_parts and user_parts:
                # Match if first names are similar or one is abbreviation of other
                if imported_parts[0] == user_parts[0]:
                    return True
                # Check if imported is abbreviation (e.g., "sporcar" for "Sergio Porcar")
                user_initials = "".join([p[0] for p in user_parts])
                if imported_lower.startswith(user_initials) or imported_lower in user_initials:
                    return True
                # Check if imported starts with first letters of user name parts
                if any(user_p.startswith(imported_parts[0][:3]) for user_p in user_parts):
                    return True
            return False

        # Use user's display name if there's a match, otherwise use imported name
        final_player_name = user_display_name if names_match(imported_player_name, user_display_name) else imported_player_name

        # Create the player
        player = {
            "id": str(uuid.uuid4()),
            "name": final_player_name or "Jugador",
            "od_handicap_index": player_handicap_index,
            "tee_box": tee_played.get("name", "Standard"),
            "team": None,
            "playing_handicap": playing_handicap,
            "scores": scores,
        }

        # Use course_length from import data, or determine from num_holes
        course_length = import_data.get("course_length", "18" if num_holes == 18 else "front9")

        # Calculate Virtual Handicap for this imported round
        course_holes_data = course.get("holes_data", []) if course else holes_data
        course_tees = course.get("tees", []) if course else [tee_played]
        virtual_handicap = calculate_virtual_handicap(
            [player],
            course_length,
            course_holes_data,
            use_handicap=True,  # Imported rounds always use handicap
            handicap_percentage=100,
            tees=course_tees,
        )

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
            "virtual_handicap": virtual_handicap,
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


# ============================================
# SHARED ROUNDS ENDPOINTS
# ============================================


@router.post("/join", response_model=JoinRoundResponse)
async def join_round_by_code(
    request: JoinRoundRequest,
    current_user: UserResponse = Depends(get_current_user),
):
    """Join a shared round by its share code."""
    supabase = get_supabase_client()

    try:
        # Find round by share code (case-insensitive)
        share_code = request.share_code.upper()
        response = (
            supabase.table("rounds")
            .select("id, user_id, collaborators, is_finished")
            .eq("share_code", share_code)
            .single()
            .execute()
        )

        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Partida no encontrada con ese codigo",
            )

        round_data = response.data
        round_id = round_data["id"]
        owner_id = round_data["user_id"]
        collaborators = round_data.get("collaborators") or []

        # Check if user is already owner
        if owner_id == current_user.id:
            return JoinRoundResponse(
                round_id=round_id,
                message="Ya eres el propietario de esta partida",
            )

        # Check if user is already a collaborator
        if current_user.id in collaborators:
            return JoinRoundResponse(
                round_id=round_id,
                message="Ya estas unido a esta partida",
            )

        # Check if round is finished
        if round_data.get("is_finished"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Esta partida ya ha finalizado",
            )

        # Add user to collaborators
        collaborators.append(current_user.id)
        supabase.table("rounds").update({"collaborators": collaborators}).eq("id", round_id).execute()

        return JoinRoundResponse(
            round_id=round_id,
            message="Te has unido a la partida correctamente",
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )


@router.post("/{round_id}/share", response_model=RoundResponse)
async def enable_round_sharing(
    round_id: str,
    current_user: UserResponse = Depends(get_current_user),
):
    """Enable sharing for a round (generates share code)."""
    supabase = get_supabase_client()

    try:
        # Check ownership
        existing = (
            supabase.table("rounds")
            .select("user_id, share_code")
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
                detail="Solo el propietario puede compartir la partida",
            )

        # If already has share code, return it
        if existing.data.get("share_code"):
            response = supabase.table("rounds").select("*").eq("id", round_id).single().execute()
            result = response.data
            result["is_owner"] = True
            return result

        # Generate unique share code
        for _ in range(10):
            code = generate_share_code()
            check = supabase.table("rounds").select("id").eq("share_code", code).execute()
            if not check.data:
                break
        else:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Could not generate unique share code",
            )

        # Update round with share code
        response = (
            supabase.table("rounds")
            .update({"share_code": code})
            .eq("id", round_id)
            .execute()
        )

        result = response.data[0]
        result["is_owner"] = True
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )


@router.delete("/{round_id}/share", response_model=RoundResponse)
async def disable_round_sharing(
    round_id: str,
    current_user: UserResponse = Depends(get_current_user),
):
    """Disable sharing for a round (removes share code and collaborators)."""
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
                detail="Solo el propietario puede desactivar el compartir",
            )

        # Remove share code and collaborators
        response = (
            supabase.table("rounds")
            .update({"share_code": None, "collaborators": []})
            .eq("id", round_id)
            .execute()
        )

        result = response.data[0]
        result["is_owner"] = True
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )


@router.delete("/{round_id}/leave")
async def leave_shared_round(
    round_id: str,
    current_user: UserResponse = Depends(get_current_user),
):
    """Leave a shared round (remove self from collaborators)."""
    supabase = get_supabase_client()

    try:
        # Get round
        existing = (
            supabase.table("rounds")
            .select("user_id, collaborators")
            .eq("id", round_id)
            .single()
            .execute()
        )

        if not existing.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Round not found",
            )

        # Can't leave if you're the owner
        if existing.data["user_id"] == current_user.id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El propietario no puede abandonar su propia partida",
            )

        collaborators = existing.data.get("collaborators") or []

        if current_user.id not in collaborators:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No estas unido a esta partida",
            )

        # Remove user from collaborators
        collaborators.remove(current_user.id)
        supabase.table("rounds").update({"collaborators": collaborators}).eq("id", round_id).execute()

        return {"message": "Has abandonado la partida"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )
