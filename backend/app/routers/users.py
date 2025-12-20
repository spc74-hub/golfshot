from fastapi import APIRouter, HTTPException, status, Depends
from app.models.schemas import UserResponse, UserUpdate, UserStats
from app.services.supabase import get_supabase_client, get_supabase_admin_client
from app.dependencies import get_current_user, get_admin_user
from typing import Dict, Any
from datetime import datetime, date

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/", response_model=list[UserResponse])
async def list_users(admin_user: UserResponse = Depends(get_admin_user)):
    """List all users (admin only)."""
    supabase = get_supabase_admin_client()

    try:
        # Get all users from auth
        users_response = supabase.auth.admin.list_users()
        users = users_response if isinstance(users_response, list) else []

        # Get all profiles
        profiles_response = supabase.table("profiles").select("*").execute()
        profiles = {p["id"]: p for p in profiles_response.data} if profiles_response.data else {}

        result = []
        for user in users:
            profile = profiles.get(user.id, {})
            result.append(UserResponse(
                id=user.id,
                email=user.email,
                display_name=profile.get("display_name"),
                role=profile.get("role", "user"),
                status=profile.get("status", "active"),
                created_at=user.created_at,
                updated_at=profile.get("updated_at", user.created_at),
            ))

        return result
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )


@router.get("/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: str,
    current_user: UserResponse = Depends(get_current_user),
):
    """Get user by ID."""
    # Users can only view their own profile unless admin
    if current_user.id != user_id and current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied",
        )

    supabase = get_supabase_client()

    try:
        # Get profile
        profile_response = supabase.table("profiles").select("*").eq("id", user_id).single().execute()

        if not profile_response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found",
            )

        profile = profile_response.data

        return UserResponse(
            id=profile["id"],
            email=current_user.email if current_user.id == user_id else "",
            display_name=profile.get("display_name"),
            role=profile.get("role", "user"),
            status=profile.get("status", "active"),
            created_at=profile.get("created_at"),
            updated_at=profile.get("updated_at"),
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )


@router.patch("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: str,
    update: UserUpdate,
    current_user: UserResponse = Depends(get_current_user),
):
    """Update user profile."""
    # Users can update their own profile (name only)
    # Admins can update any user (including role and status)
    if current_user.id != user_id and current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied",
        )

    # Non-admins cannot change role or status
    if current_user.role != "admin" and (update.role or update.status):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can change role or status",
        )

    supabase = get_supabase_client()

    try:
        update_data = {k: v for k, v in update.model_dump().items() if v is not None}

        if not update_data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No fields to update",
            )

        response = supabase.table("profiles").update(update_data).eq("id", user_id).execute()

        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found",
            )

        profile = response.data[0]

        return UserResponse(
            id=profile["id"],
            email=current_user.email if current_user.id == user_id else "",
            display_name=profile.get("display_name"),
            role=profile.get("role", "user"),
            status=profile.get("status", "active"),
            created_at=profile.get("created_at"),
            updated_at=profile.get("updated_at"),
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )


@router.delete("/{user_id}")
async def delete_user(
    user_id: str,
    admin_user: UserResponse = Depends(get_admin_user),
):
    """Delete user (admin only)."""
    if admin_user.id == user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete your own account",
        )

    supabase = get_supabase_admin_client()

    try:
        # Delete user from auth (cascade will delete profile and rounds)
        supabase.auth.admin.delete_user(user_id)

        return {"message": "User deleted successfully"}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )


@router.get("/me/stats", response_model=UserStats)
async def get_my_stats(current_user: UserResponse = Depends(get_current_user)):
    """Get statistics for the current user."""
    supabase = get_supabase_client()

    try:
        # Get user's handicap index from saved_players (first player with matching user)
        saved_players_response = (
            supabase.table("saved_players")
            .select("*")
            .eq("user_id", current_user.id)
            .order("created_at", desc=False)
            .limit(1)
            .execute()
        )
        user_handicap_index = None
        if saved_players_response.data and len(saved_players_response.data) > 0:
            user_handicap_index = saved_players_response.data[0].get("handicap_index")

        # Get all finished rounds for the user
        rounds_response = (
            supabase.table("rounds")
            .select("*")
            .eq("user_id", current_user.id)
            .eq("is_finished", True)
            .order("round_date", desc=True)
            .execute()
        )

        rounds = rounds_response.data or []
        total_rounds = len(rounds)

        if total_rounds == 0:
            return UserStats(
                total_rounds=0,
                user_handicap_index=user_handicap_index,
                avg_strokes_par3=None,
                avg_strokes_par4=None,
                avg_strokes_par5=None,
                avg_putts_per_round=None,
                avg_putts_9holes=None,
                avg_putts_18holes=None,
                avg_strokes_9holes=None,
                avg_strokes_18holes=None,
                avg_stableford_points=None,
                hvp_total=None,
                hvp_month=None,
                hvp_quarter=None,
                hvp_year=None,
                best_round_score=None,
                best_round_date=None,
                best_round_course=None,
                best_round_9_score=None,
                best_round_9_date=None,
                best_round_9_course=None,
            )

        # Get all courses for hole data
        courses_response = supabase.table("courses").select("*").execute()
        courses = {c["id"]: c for c in (courses_response.data or [])}

        # Calculate statistics
        par3_strokes = []
        par4_strokes = []
        par5_strokes = []
        total_putts = []
        putts_9holes = []
        putts_18holes = []
        strokes_9holes = []
        strokes_18holes = []
        stableford_points_normalized = []  # Normalized to 18-hole equivalent
        # HVP data: list of (normalized_points, round_date) tuples
        hvp_data = []
        best_score_18 = None
        best_score_18_info = None
        best_score_9 = None
        best_score_9_info = None

        # Get current date info for period filtering
        today = date.today()
        current_month_start = date(today.year, today.month, 1)
        current_quarter = (today.month - 1) // 3
        current_quarter_start = date(today.year, current_quarter * 3 + 1, 1)
        current_year_start = date(today.year, 1, 1)

        for round_data in rounds:
            course = courses.get(round_data.get("course_id"))
            if not course:
                continue

            holes_data = {h["number"]: h for h in course.get("holes_data", [])}
            players = round_data.get("players", [])

            # Find the user's player (first player is usually the user)
            user_player = players[0] if players else None
            if not user_player:
                continue

            scores = user_player.get("scores", {})
            tee_box = user_player.get("tee_box", "")

            # Get tee info for course rating and slope
            tees = course.get("tees", [])
            tee_info = next((t for t in tees if t["name"] == tee_box), None)
            course_rating = tee_info["rating"] if tee_info else 72.0
            slope = tee_info["slope"] if tee_info else 113

            # Determine which holes to count based on course_length
            course_length = round_data.get("course_length", "18")
            if course_length == "front9":
                holes_to_count = range(1, 10)
            elif course_length == "back9":
                holes_to_count = range(10, 19)
            else:  # "18"
                holes_to_count = range(1, 19)

            round_strokes = 0
            round_putts = 0
            round_stableford = 0

            for hole_num in holes_to_count:
                hole_num_str = str(hole_num)
                if hole_num_str not in scores:
                    continue

                score = scores[hole_num_str]
                strokes = score.get("strokes", 0)
                putts = score.get("putts", 0)

                hole_data = holes_data.get(hole_num)
                if not hole_data:
                    continue

                par = hole_data.get("par")
                handicap = hole_data.get("handicap", 1)

                # Track strokes by par
                if par == 3:
                    par3_strokes.append(strokes)
                elif par == 4:
                    par4_strokes.append(strokes)
                elif par == 5:
                    par5_strokes.append(strokes)

                round_strokes += strokes
                round_putts += putts

                # Calculate stableford points
                playing_hcp = user_player.get("playing_handicap", 0)
                strokes_received = 0
                if playing_hcp > 0:
                    base_strokes = playing_hcp // 18
                    remainder = playing_hcp % 18
                    strokes_received = base_strokes + (1 if handicap <= remainder else 0)

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

                round_stableford += points

            # Track round totals
            is_9_hole_round = course_length in ["front9", "back9"]
            if is_9_hole_round:
                strokes_9holes.append(round_strokes)
                if round_putts > 0:
                    putts_9holes.append(round_putts)
                # Track best 9-hole score
                if round_strokes > 0 and (best_score_9 is None or round_strokes < best_score_9):
                    best_score_9 = round_strokes
                    best_score_9_info = {
                        "score": round_strokes,
                        "date": round_data.get("round_date"),
                        "course": round_data.get("course_name"),
                    }
            else:
                strokes_18holes.append(round_strokes)
                if round_putts > 0:
                    putts_18holes.append(round_putts)
                # Track best 18-hole score
                if round_strokes > 0 and (best_score_18 is None or round_strokes < best_score_18):
                    best_score_18 = round_strokes
                    best_score_18_info = {
                        "score": round_strokes,
                        "date": round_data.get("round_date"),
                        "course": round_data.get("course_name"),
                    }

            if round_putts > 0:
                total_putts.append(round_putts)

            # Track Stableford points - normalize to 18-hole equivalent
            # For HVP, we track ALL rounds (not just stableford mode) and normalize 9-hole
            if round_stableford > 0:
                if is_9_hole_round:
                    # Double the points to get 18-hole equivalent
                    normalized_points = round_stableford * 2
                else:
                    normalized_points = round_stableford

                # For avg_stableford_points (only stableford mode)
                if round_data.get("game_mode") == "stableford":
                    stableford_points_normalized.append(normalized_points)

                # For HVP - all rounds with stableford points calculated
                round_date_str = round_data.get("round_date", "")
                try:
                    round_date_parsed = datetime.strptime(round_date_str, "%Y-%m-%d").date()
                except (ValueError, TypeError):
                    round_date_parsed = None
                hvp_data.append((normalized_points, round_date_parsed))

        # Calculate averages
        avg_par3 = sum(par3_strokes) / len(par3_strokes) if par3_strokes else None
        avg_par4 = sum(par4_strokes) / len(par4_strokes) if par4_strokes else None
        avg_par5 = sum(par5_strokes) / len(par5_strokes) if par5_strokes else None
        avg_putts = sum(total_putts) / len(total_putts) if total_putts else None
        avg_putts_9 = sum(putts_9holes) / len(putts_9holes) if putts_9holes else None
        avg_putts_18 = sum(putts_18holes) / len(putts_18holes) if putts_18holes else None
        avg_9holes = sum(strokes_9holes) / len(strokes_9holes) if strokes_9holes else None
        avg_18holes = sum(strokes_18holes) / len(strokes_18holes) if strokes_18holes else None
        # Stableford average using normalized 18-hole equivalent points
        avg_stableford = sum(stableford_points_normalized) / len(stableford_points_normalized) if stableford_points_normalized else None

        # Calculate HVP (Handicap Virtual Promedio) for different periods
        # HVP = 36 - average Stableford points (normalized to 18 holes)
        # 36 points = handicap 0 (scratch), 30 points = handicap 6, etc.
        hvp_total = None
        hvp_month = None
        hvp_quarter = None
        hvp_year = None

        if hvp_data:
            # Total (all-time)
            all_points = [p for p, _ in hvp_data]
            avg_points_total = sum(all_points) / len(all_points)
            hvp_total = 36 - avg_points_total

            # Filter by periods
            month_points = [p for p, d in hvp_data if d and d >= current_month_start]
            quarter_points = [p for p, d in hvp_data if d and d >= current_quarter_start]
            year_points = [p for p, d in hvp_data if d and d >= current_year_start]

            if month_points:
                avg_month = sum(month_points) / len(month_points)
                hvp_month = 36 - avg_month
            if quarter_points:
                avg_quarter = sum(quarter_points) / len(quarter_points)
                hvp_quarter = 36 - avg_quarter
            if year_points:
                avg_year = sum(year_points) / len(year_points)
                hvp_year = 36 - avg_year

        return UserStats(
            total_rounds=total_rounds,
            user_handicap_index=user_handicap_index,
            avg_strokes_par3=round(avg_par3, 2) if avg_par3 else None,
            avg_strokes_par4=round(avg_par4, 2) if avg_par4 else None,
            avg_strokes_par5=round(avg_par5, 2) if avg_par5 else None,
            avg_putts_per_round=round(avg_putts, 2) if avg_putts else None,
            avg_putts_9holes=round(avg_putts_9, 2) if avg_putts_9 else None,
            avg_putts_18holes=round(avg_putts_18, 2) if avg_putts_18 else None,
            avg_strokes_9holes=round(avg_9holes, 2) if avg_9holes else None,
            avg_strokes_18holes=round(avg_18holes, 2) if avg_18holes else None,
            avg_stableford_points=round(avg_stableford, 2) if avg_stableford else None,
            # HVP - Handicap Virtual Promedio
            hvp_total=round(hvp_total, 1) if hvp_total else None,
            hvp_month=round(hvp_month, 1) if hvp_month else None,
            hvp_quarter=round(hvp_quarter, 1) if hvp_quarter else None,
            hvp_year=round(hvp_year, 1) if hvp_year else None,
            # Best 18-hole round
            best_round_score=best_score_18_info["score"] if best_score_18_info else None,
            best_round_date=best_score_18_info["date"] if best_score_18_info else None,
            best_round_course=best_score_18_info["course"] if best_score_18_info else None,
            # Best 9-hole round
            best_round_9_score=best_score_9_info["score"] if best_score_9_info else None,
            best_round_9_date=best_score_9_info["date"] if best_score_9_info else None,
            best_round_9_course=best_score_9_info["course"] if best_score_9_info else None,
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )
