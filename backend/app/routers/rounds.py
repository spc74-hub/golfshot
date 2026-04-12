from fastapi import APIRouter, HTTPException, status, Depends, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
from app.models.schemas import RoundCreate, RoundUpdate, RoundResponse, UserResponse, JoinRoundRequest, JoinRoundResponse
from app.models.db_models import Round as RoundModel, Course as CourseModel, Profile
from app.database import get_db
from app.services.round_ocr import extract_round_data
from app.dependencies import get_current_user
from datetime import datetime
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
    owner_name: str | None = None,
) -> float | None:
    """
    Calculate Virtual Handicap for the round owner (logged-in user).
    HV = Handicap Index - (Stableford Points - 36) for 18 holes.
    Always uses 100% HDJ for Stableford calculation (for accurate stats).
    """
    if not players or not holes_data:
        return None

    user_player = None
    if owner_name:
        for p in players:
            player_name = p.get("name", "").lower().strip()
            owner_name_lower = owner_name.lower().strip()
            if player_name == owner_name_lower or owner_name_lower in player_name or player_name in owner_name_lower:
                user_player = p
                break
    if user_player is None:
        user_player = players[0]

    scores = user_player.get("scores", {})
    od_handicap_index = user_player.get("od_handicap_index", 0)
    playing_handicap = user_player.get("playing_handicap", 0)

    if not scores or od_handicap_index is None:
        return None

    if playing_handicap == 0 and od_handicap_index > 0 and tees:
        tee_box = user_player.get("tee_box", "")
        matching_tee = next((t for t in tees if t.get("name") == tee_box), None)
        if matching_tee:
            slope = matching_tee.get("slope", 113)
            playing_handicap = calculate_playing_handicap(od_handicap_index, slope, 100)

    effective_handicap = playing_handicap

    if course_length == "front9":
        holes_to_count = range(1, 10)
    elif course_length == "back9":
        holes_to_count = range(10, 19)
    else:
        holes_to_count = range(1, 19)

    holes_lookup = {h.get("number"): h for h in holes_data}

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

        strokes_received = 0
        if effective_handicap > 0:
            base_strokes = effective_handicap // 18
            remainder = effective_handicap % 18
            strokes_received = base_strokes + (1 if handicap_index <= remainder else 0)

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

    if holes_played == 0:
        return None

    is_9_hole_round = course_length in ["front9", "back9"]
    if is_9_hole_round:
        normalized_stableford = total_stableford * 2
    else:
        normalized_stableford = total_stableford

    virtual_handicap = od_handicap_index - (normalized_stableford - 36)
    return round(virtual_handicap, 1)


def round_model_to_dict(r: RoundModel, is_owner: bool = True) -> dict:
    return {
        "id": r.id,
        "od_id": r.od_id,
        "od_user_id": r.od_user_id,
        "is_finished": r.is_finished,
        "is_imported": r.is_imported or False,
        "course_id": r.course_id,
        "course_name": r.course_name,
        "round_date": r.round_date,
        "course_length": r.course_length,
        "game_mode": r.game_mode,
        "use_handicap": r.use_handicap,
        "handicap_percentage": r.handicap_percentage,
        "sindicato_points": r.sindicato_points,
        "team_mode": r.team_mode,
        "best_ball_points": r.best_ball_points,
        "worst_ball_points": r.worst_ball_points,
        "current_hole": r.current_hole,
        "completed_holes": r.completed_holes or [],
        "players": r.players or [],
        "virtual_handicap": r.virtual_handicap,
        "share_code": r.share_code,
        "collaborators": r.collaborators or [],
        "is_owner": is_owner,
        "created_at": r.created_at.isoformat() if r.created_at else None,
        "updated_at": r.updated_at.isoformat() if r.updated_at else None,
    }


@router.get("/", response_model=list[RoundResponse])
async def list_rounds(
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all rounds for the current user (owned and shared)."""
    try:
        # Get owned rounds
        result = await db.execute(
            select(RoundModel)
            .where(RoundModel.user_id == current_user.id)
            .order_by(RoundModel.round_date.desc())
        )
        owned_rounds = result.scalars().all()

        # Get shared rounds (where user is in collaborators)
        # We need to check JSON array contains the user ID
        result2 = await db.execute(
            select(RoundModel)
            .where(RoundModel.collaborators.op("@>")(f'["{current_user.id}"]'))
            .order_by(RoundModel.round_date.desc())
        )
        shared_rounds = result2.scalars().all()

        all_rounds = []
        for r in owned_rounds:
            all_rounds.append(round_model_to_dict(r, is_owner=True))
        for r in shared_rounds:
            all_rounds.append(round_model_to_dict(r, is_owner=False))

        all_rounds.sort(key=lambda x: x.get("round_date", ""), reverse=True)
        return all_rounds
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.get("/{round_id}", response_model=RoundResponse)
async def get_round(
    round_id: str,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get round by ID (owned or shared)."""
    result = await db.execute(select(RoundModel).where(RoundModel.id == round_id))
    round_data = result.scalar_one_or_none()

    if not round_data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Round not found")

    collaborators = round_data.collaborators or []
    if round_data.user_id != current_user.id and current_user.id not in collaborators:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    return round_model_to_dict(round_data, is_owner=(round_data.user_id == current_user.id))


@router.post("/", response_model=RoundResponse, status_code=status.HTTP_201_CREATED)
async def create_round(
    round_data: RoundCreate,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new round."""
    try:
        # Get course to calculate playing handicaps
        result = await db.execute(select(CourseModel).where(CourseModel.id == round_data.course_id))
        course = result.scalar_one_or_none()
        if not course:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found")

        tees_dict = {t["name"]: t for t in course.tees}

        players = []
        for player in round_data.players:
            tee = tees_dict.get(player.tee_box)
            if not tee:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Tee '{player.tee_box}' not found for course",
                )

            if player.playing_handicap is not None and player.playing_handicap > 0:
                playing_handicap = player.playing_handicap
            else:
                playing_handicap = calculate_playing_handicap(
                    player.od_handicap_index, tee["slope"], 100,
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

        current_hole = 1 if round_data.course_length in ["18", "front9"] else 10

        db_round = RoundModel(
            user_id=current_user.id,
            od_id=int(time.time() * 1000),
            od_user_id=current_user.id,
            course_id=round_data.course_id,
            course_name=round_data.course_name,
            round_date=round_data.round_date,
            course_length=round_data.course_length,
            game_mode=round_data.game_mode,
            use_handicap=round_data.use_handicap,
            handicap_percentage=round_data.handicap_percentage,
            sindicato_points=round_data.sindicato_points,
            team_mode=round_data.team_mode,
            best_ball_points=round_data.best_ball_points,
            worst_ball_points=round_data.worst_ball_points,
            current_hole=current_hole,
            completed_holes=[],
            players=players,
            is_finished=False,
            collaborators=[],
        )
        db.add(db_round)
        await db.commit()
        await db.refresh(db_round)
        return round_model_to_dict(db_round, is_owner=True)
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.put("/{round_id}", response_model=RoundResponse)
async def update_round(
    round_id: str,
    round_update: RoundUpdate,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update a round (owner or collaborator can update scores)."""
    try:
        result = await db.execute(select(RoundModel).where(RoundModel.id == round_id))
        existing = result.scalar_one_or_none()

        if not existing:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Round not found")

        collaborators = existing.collaborators or []
        is_owner = existing.user_id == current_user.id
        is_collaborator = current_user.id in collaborators

        if not is_owner and not is_collaborator:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

        if round_update.current_hole is not None:
            existing.current_hole = round_update.current_hole

        if round_update.completed_holes is not None:
            existing.completed_holes = round_update.completed_holes

        if round_update.players is not None:
            players_data = [p.model_dump() for p in round_update.players]
            existing.players = players_data

            # Calculate virtual handicap
            if existing.course_id:
                course_result = await db.execute(
                    select(CourseModel).where(CourseModel.id == existing.course_id)
                )
                course = course_result.scalar_one_or_none()
                if course and course.holes_data:
                    owner_display_name = None
                    if is_owner:
                        owner_display_name = current_user.display_name
                    else:
                        owner_result = await db.execute(
                            select(Profile.display_name).where(Profile.id == existing.user_id)
                        )
                        owner_row = owner_result.first()
                        if owner_row:
                            owner_display_name = owner_row[0]

                    virtual_handicap = calculate_virtual_handicap(
                        players_data,
                        existing.course_length,
                        course.holes_data,
                        use_handicap=existing.use_handicap,
                        handicap_percentage=existing.handicap_percentage,
                        tees=course.tees,
                        owner_name=owner_display_name,
                    )
                    if virtual_handicap is not None:
                        existing.virtual_handicap = virtual_handicap

        if round_update.is_finished is not None:
            existing.is_finished = round_update.is_finished

        # Handle share_enabled
        if round_update.share_enabled is not None and is_owner:
            if round_update.share_enabled:
                if not existing.share_code:
                    for _ in range(10):
                        code = generate_share_code()
                        check_result = await db.execute(
                            select(RoundModel.id).where(RoundModel.share_code == code)
                        )
                        if not check_result.first():
                            existing.share_code = code
                            break
                    else:
                        raise HTTPException(
                            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                            detail="Could not generate unique share code",
                        )
            else:
                existing.share_code = None
                existing.collaborators = []

        existing.updated_at = datetime.utcnow()
        await db.commit()
        await db.refresh(existing)

        return round_model_to_dict(existing, is_owner=is_owner)
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.delete("/{round_id}")
async def delete_round(
    round_id: str,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a round."""
    result = await db.execute(select(RoundModel).where(RoundModel.id == round_id))
    existing = result.scalar_one_or_none()
    if not existing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Round not found")
    if existing.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    await db.delete(existing)
    await db.commit()
    return {"message": "Round deleted successfully"}


@router.patch("/{round_id}/finish", response_model=RoundResponse)
async def finish_round(
    round_id: str,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Mark a round as finished."""
    result = await db.execute(select(RoundModel).where(RoundModel.id == round_id))
    existing = result.scalar_one_or_none()
    if not existing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Round not found")
    if existing.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    existing.is_finished = True
    existing.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(existing)
    return round_model_to_dict(existing, is_owner=True)


# Import round from image endpoints
@router.post("/import/extract")
async def extract_round_from_image(
    file: UploadFile = File(...),
    current_user: UserResponse = Depends(get_current_user),
):
    """Extract round data from a scorecard image using AI."""
    try:
        if not file.content_type or not file.content_type.startswith("image/"):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="File must be an image")

        contents = await file.read()
        image_base64 = base64.b64encode(contents).decode("utf-8")
        extracted_data = await extract_round_data(image_base64, file.content_type)

        return {
            "success": True,
            "message": "Round data extracted successfully",
            "round_data": extracted_data,
        }
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to extract round data: {str(e)}",
        )


@router.post("/import/save", response_model=RoundResponse, status_code=status.HTTP_201_CREATED)
async def save_imported_round(
    import_data: dict,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Save an imported round from extracted scorecard data."""
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
            result = await db.execute(select(CourseModel).where(CourseModel.id == existing_course_id))
            course_obj = result.scalar_one_or_none()
            if course_obj:
                course = {
                    "id": course_obj.id,
                    "name": course_obj.name,
                    "holes_data": course_obj.holes_data,
                    "tees": course_obj.tees,
                }
                course_id = course_obj.id
                course_name = course_obj.name

        # If no existing course selected, check by name or create new
        if not course_id:
            result = await db.execute(select(CourseModel).where(CourseModel.name == course_name))
            course_obj = result.scalar_one_or_none()

            if course_obj:
                course = {
                    "id": course_obj.id,
                    "name": course_obj.name,
                    "holes_data": course_obj.holes_data,
                    "tees": course_obj.tees,
                }
                course_id = course_obj.id
            else:
                tee_played = course_info.get("tee_played", {})
                new_course = CourseModel(
                    name=course_name,
                    holes=num_holes,
                    par=totals.get("par", 72),
                    tees=[{
                        "name": tee_played.get("name", "Standard"),
                        "slope": tee_played.get("slope", 113),
                        "rating": tee_played.get("rating", 72.0),
                    }],
                    holes_data=[
                        {
                            "number": h.get("number", i + 1),
                            "par": h.get("par", 4),
                            "handicap": h.get("handicap", i + 1),
                            "distance": h.get("distance", 350),
                        }
                        for i, h in enumerate(holes_data)
                    ],
                )
                db.add(new_course)
                await db.commit()
                await db.refresh(new_course)
                course = {
                    "id": new_course.id,
                    "name": new_course.name,
                    "holes_data": new_course.holes_data,
                    "tees": new_course.tees,
                }
                course_id = new_course.id

        tee_played = course_info.get("tee_played", {})
        tee_slope = tee_played.get("slope", 113)
        player_handicap_index = round_info.get("handicap_index", 24.0)

        calculated_hdj = round_info.get("calculated_hdj", 0)
        if calculated_hdj > 0:
            playing_handicap = calculated_hdj
        else:
            playing_handicap = calculate_playing_handicap(player_handicap_index, tee_slope)

        scores = {}
        completed_holes = []
        for hole in holes_data:
            hole_num = hole.get("number")
            strokes = hole.get("strokes")
            if hole_num and strokes:
                scores[str(hole_num)] = {
                    "strokes": strokes,
                    "putts": hole.get("putts", 0),
                }
                completed_holes.append(hole_num)

        imported_player_name = round_info.get("player_name", "Jugador")
        user_display_name = current_user.display_name or ""

        def names_match(imported: str, user: str) -> bool:
            if not imported or not user:
                return False
            imported_lower = imported.lower().strip()
            user_lower = user.lower().strip()
            if imported_lower in user_lower or user_lower in imported_lower:
                return True
            imported_parts = imported_lower.split()
            user_parts = user_lower.split()
            if imported_parts and user_parts:
                if imported_parts[0] == user_parts[0]:
                    return True
            return False

        player_name = user_display_name if names_match(imported_player_name, user_display_name) else imported_player_name

        player = {
            "id": str(uuid.uuid4()),
            "name": player_name or "Jugador",
            "od_handicap_index": player_handicap_index,
            "tee_box": tee_played.get("name", "Standard"),
            "team": None,
            "playing_handicap": playing_handicap,
            "scores": scores,
        }

        course_length = import_data.get("course_length", "18" if num_holes == 18 else "front9")

        course_holes_data = course.get("holes_data", []) if course else holes_data
        course_tees = course.get("tees", []) if course else [tee_played]
        virtual_handicap = calculate_virtual_handicap(
            [player],
            course_length,
            course_holes_data,
            use_handicap=True,
            handicap_percentage=100,
            tees=course_tees,
            owner_name=player_name,
        )

        db_round = RoundModel(
            user_id=current_user.id,
            od_id=int(time.time() * 1000),
            od_user_id=current_user.id,
            course_id=course_id,
            course_name=course_name,
            round_date=round_info.get("date", time.strftime("%Y-%m-%d")),
            course_length=course_length,
            game_mode="stableford",
            use_handicap=True,
            handicap_percentage=100,
            sindicato_points=None,
            team_mode=None,
            best_ball_points=None,
            worst_ball_points=None,
            current_hole=num_holes,
            completed_holes=completed_holes,
            players=[player],
            is_finished=True,
            is_imported=True,
            virtual_handicap=virtual_handicap,
            collaborators=[],
        )
        db.add(db_round)
        await db.commit()
        await db.refresh(db_round)
        return round_model_to_dict(db_round, is_owner=True)
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


# ============================================
# SHARED ROUNDS ENDPOINTS
# ============================================

@router.post("/join", response_model=JoinRoundResponse)
async def join_round_by_code(
    request: JoinRoundRequest,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Join a shared round by its share code."""
    try:
        share_code = request.share_code.upper()
        result = await db.execute(
            select(RoundModel).where(RoundModel.share_code == share_code)
        )
        round_data = result.scalar_one_or_none()

        if not round_data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Partida no encontrada con ese codigo",
            )

        if round_data.user_id == current_user.id:
            return JoinRoundResponse(
                round_id=round_data.id,
                message="Ya eres el propietario de esta partida",
            )

        collaborators = round_data.collaborators or []
        if current_user.id in collaborators:
            return JoinRoundResponse(
                round_id=round_data.id,
                message="Ya estas unido a esta partida",
            )

        if round_data.is_finished:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Esta partida ya ha finalizado",
            )

        collaborators.append(current_user.id)
        round_data.collaborators = collaborators
        round_data.updated_at = datetime.utcnow()
        await db.commit()

        return JoinRoundResponse(
            round_id=round_data.id,
            message="Te has unido a la partida correctamente",
        )
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))
