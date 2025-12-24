from fastapi import APIRouter, HTTPException, status, Depends
from pydantic import BaseModel
from app.models.schemas import UserResponse, UserUpdate, UserStats, UserWithStats, UserPermissionsUpdate
from app.services.supabase import get_supabase_client, get_supabase_admin_client
from app.dependencies import get_current_user, get_admin_user, get_owner_user
from typing import Dict, Any
from datetime import datetime, date


class ResetPasswordRequest(BaseModel):
    new_password: str

router = APIRouter(prefix="/users", tags=["users"])


class UpdateMyProfileRequest(BaseModel):
    display_name: str | None = None
    linked_player_id: str | None = None


@router.patch("/me")
async def update_my_profile(
    request: UpdateMyProfileRequest,
    current_user: UserResponse = Depends(get_current_user),
):
    """Update the current user's profile."""
    supabase = get_supabase_admin_client()

    try:
        update_data = {}
        if request.display_name is not None:
            update_data["display_name"] = request.display_name
        if request.linked_player_id is not None:
            update_data["linked_player_id"] = request.linked_player_id

        if not update_data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No fields to update",
            )

        response = (
            supabase.table("profiles")
            .update(update_data)
            .eq("id", current_user.id)
            .execute()
        )

        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Profile not found",
            )

        return {"message": "Profile updated successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )


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
            permissions = profile.get("permissions", [])
            if permissions is None:
                permissions = []
            result.append(UserResponse(
                id=user.id,
                email=user.email,
                display_name=profile.get("display_name"),
                role=profile.get("role", "user"),
                status=profile.get("status", "active"),
                permissions=permissions,
                linked_player_id=profile.get("linked_player_id"),
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
    # Skip reserved paths - they have their own endpoints
    if user_id in ("me", "owner"):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    # Users can only view their own profile unless admin/owner
    if current_user.id != user_id and current_user.role not in ("admin", "owner"):
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
        permissions = profile.get("permissions", [])
        if permissions is None:
            permissions = []

        return UserResponse(
            id=profile["id"],
            email=current_user.email if current_user.id == user_id else "",
            display_name=profile.get("display_name"),
            role=profile.get("role", "user"),
            status=profile.get("status", "active"),
            permissions=permissions,
            linked_player_id=profile.get("linked_player_id"),
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
    # Skip reserved paths - they have their own endpoints
    if user_id in ("me", "owner"):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    # Users can update their own profile (display_name, linked_player_id only)
    # Admins can update any user (including status)
    # Only owner can change roles and permissions
    if current_user.id != user_id and current_user.role not in ("admin", "owner"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied",
        )

    # Only owner can change role
    if update.role is not None and current_user.role != "owner":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only owner can change roles",
        )

    # Only owner can change permissions
    if update.permissions is not None and current_user.role != "owner":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only owner can change permissions",
        )

    # Non-admin/owner cannot change status
    if update.status is not None and current_user.role not in ("admin", "owner"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can change status",
        )

    # Cannot set anyone to owner (except by direct DB update)
    if update.role == "owner":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot assign owner role via API",
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
        permissions = profile.get("permissions", [])
        if permissions is None:
            permissions = []

        return UserResponse(
            id=profile["id"],
            email=current_user.email if current_user.id == user_id else "",
            display_name=profile.get("display_name"),
            role=profile.get("role", "user"),
            status=profile.get("status", "active"),
            permissions=permissions,
            linked_player_id=profile.get("linked_player_id"),
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
    owner_user: UserResponse = Depends(get_owner_user),
):
    """Delete user (owner only)."""
    # Skip reserved paths
    if user_id in ("me", "owner"):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    if owner_user.id == user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete your own account",
        )

    supabase = get_supabase_admin_client()

    try:
        # Check if user exists and is not owner
        profile_response = supabase.table("profiles").select("role").eq("id", user_id).single().execute()
        if profile_response.data and profile_response.data.get("role") == "owner":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Cannot delete owner account",
            )

        # Delete user from auth (cascade will delete profile and rounds)
        supabase.auth.admin.delete_user(user_id)

        return {"message": "User deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )


@router.patch("/{user_id}/block")
async def toggle_block_user(
    user_id: str,
    owner_user: UserResponse = Depends(get_owner_user),
):
    """Block or unblock a user (owner only). Toggles between 'active' and 'blocked' status."""
    # Skip reserved paths
    if user_id in ("me", "owner"):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    if owner_user.id == user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot block your own account",
        )

    supabase = get_supabase_admin_client()

    try:
        # Get current status
        profile_response = supabase.table("profiles").select("role, status").eq("id", user_id).single().execute()

        if not profile_response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found",
            )

        if profile_response.data.get("role") == "owner":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Cannot block owner account",
            )

        current_status = profile_response.data.get("status", "active")
        new_status = "active" if current_status == "blocked" else "blocked"

        # Update status
        update_response = supabase.table("profiles").update({"status": new_status}).eq("id", user_id).execute()

        if not update_response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found",
            )

        return {"message": f"User {'unblocked' if new_status == 'active' else 'blocked'} successfully", "status": new_status}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )


@router.patch("/{user_id}/reset-password")
async def reset_user_password(
    user_id: str,
    request: ResetPasswordRequest,
    owner_user: UserResponse = Depends(get_owner_user),
):
    """Reset a user's password (owner only)."""
    # Skip reserved paths
    if user_id in ("me", "owner"):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    if len(request.new_password) < 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must be at least 6 characters",
        )

    supabase = get_supabase_admin_client()

    try:
        # Check if user exists and is not owner
        profile_response = supabase.table("profiles").select("role").eq("id", user_id).single().execute()

        if not profile_response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found",
            )

        if profile_response.data.get("role") == "owner":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Cannot reset owner password via this endpoint",
            )

        # Update user password using admin API
        supabase.auth.admin.update_user_by_id(
            user_id,
            {"password": request.new_password}
        )

        return {"message": "Password reset successfully"}
    except HTTPException:
        raise
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

        # Calculate rounds this month
        today = date.today()
        month_start = date(today.year, today.month, 1).isoformat()
        rounds_this_month = len([
            r for r in rounds
            if r.get("round_date", "") >= month_start
        ])

        if total_rounds == 0:
            return UserStats(
                total_rounds=0,
                rounds_this_month=0,
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
        # HVP data: list of (hvp_value, round_date) tuples
        # Uses stored virtual_handicap from each round (or calculates for legacy rounds)
        # HV = Handicap Index - (Stableford Points - 36) for 18 holes
        hvp_data = []
        best_score_18 = None
        best_score_18_info = None
        best_score_9 = None
        best_score_9_info = None
        # Score distribution counters (gross score vs par)
        eagles_or_better = 0
        birdies = 0
        pars = 0
        bogeys = 0
        double_bogeys = 0
        triple_or_worse = 0
        total_holes_for_distribution = 0
        # GIR tracking
        gir_hit = 0
        gir_total = 0

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
            round_par = 0  # Total par for played holes

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

                par = hole_data.get("par", 4)
                handicap = hole_data.get("handicap", 1)
                round_par += par

                # Track strokes by par
                if par == 3:
                    par3_strokes.append(strokes)
                elif par == 4:
                    par4_strokes.append(strokes)
                elif par == 5:
                    par5_strokes.append(strokes)

                round_strokes += strokes
                round_putts += putts

                # Track score distribution (gross score vs par)
                gross_diff = strokes - par
                total_holes_for_distribution += 1
                if gross_diff <= -2:
                    eagles_or_better += 1
                elif gross_diff == -1:
                    birdies += 1
                elif gross_diff == 0:
                    pars += 1
                elif gross_diff == 1:
                    bogeys += 1
                elif gross_diff == 2:
                    double_bogeys += 1
                else:
                    triple_or_worse += 1

                # Track GIR (Green in Regulation)
                # GIR = reaching the green in (par - 2) strokes or less
                if putts > 0:  # Only count if putts were recorded
                    strokes_to_green = strokes - putts
                    target_strokes = par - 2
                    gir_total += 1
                    if strokes_to_green <= target_strokes:
                        gir_hit += 1

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
            if round_stableford > 0:
                if is_9_hole_round:
                    # Double the points to get 18-hole equivalent
                    normalized_points = round_stableford * 2
                else:
                    normalized_points = round_stableford

                # For avg_stableford_points (only stableford mode)
                if round_data.get("game_mode") == "stableford":
                    stableford_points_normalized.append(normalized_points)

            # For HVP - use stored virtual_handicap if available, otherwise calculate
            # HV = Handicap Index - (Stableford Points - 36) for 18 holes
            stored_vh = round_data.get("virtual_handicap")
            if stored_vh is not None:
                hvp_value = stored_vh
            elif round_stableford > 0:
                # Fallback: calculate from Stableford points for legacy rounds
                od_handicap_index = user_player.get("od_handicap_index", 0)
                if od_handicap_index is not None:
                    if is_9_hole_round:
                        normalized_stableford = round_stableford * 2
                    else:
                        normalized_stableford = round_stableford
                    hvp_value = od_handicap_index - (normalized_stableford - 36)
                else:
                    hvp_value = None
            else:
                hvp_value = None

            if hvp_value is not None:
                round_date_str = round_data.get("round_date", "")
                try:
                    round_date_parsed = datetime.strptime(round_date_str, "%Y-%m-%d").date()
                except (ValueError, TypeError):
                    round_date_parsed = None
                hvp_data.append((hvp_value, round_date_parsed))

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
        # HVP = Handicap Index - (Stableford Points - 36)
        # Example: Handicap Index 14.2, you get 40 points -> HVP = 14.2 - 4 = 10.2
        hvp_total = None
        hvp_month = None
        hvp_quarter = None
        hvp_year = None

        if hvp_data:
            # Total (all-time)
            all_hvp_values = [hvp for hvp, _ in hvp_data]
            hvp_total = sum(all_hvp_values) / len(all_hvp_values)

            # Filter by periods
            month_hvp = [hvp for hvp, d in hvp_data if d and d >= current_month_start]
            quarter_hvp = [hvp for hvp, d in hvp_data if d and d >= current_quarter_start]
            year_hvp = [hvp for hvp, d in hvp_data if d and d >= current_year_start]

            if month_hvp:
                hvp_month = sum(month_hvp) / len(month_hvp)
            if quarter_hvp:
                hvp_quarter = sum(quarter_hvp) / len(quarter_hvp)
            if year_hvp:
                hvp_year = sum(year_hvp) / len(year_hvp)

        # Calculate score distribution percentages
        eagles_pct = None
        birdies_pct = None
        pars_pct = None
        bogeys_pct = None
        double_bogeys_pct = None
        triple_or_worse_pct = None
        if total_holes_for_distribution > 0:
            eagles_pct = round((eagles_or_better / total_holes_for_distribution) * 100, 1)
            birdies_pct = round((birdies / total_holes_for_distribution) * 100, 1)
            pars_pct = round((pars / total_holes_for_distribution) * 100, 1)
            bogeys_pct = round((bogeys / total_holes_for_distribution) * 100, 1)
            double_bogeys_pct = round((double_bogeys / total_holes_for_distribution) * 100, 1)
            triple_or_worse_pct = round((triple_or_worse / total_holes_for_distribution) * 100, 1)

        # Calculate GIR percentage
        gir_pct = round((gir_hit / gir_total) * 100, 1) if gir_total > 0 else None

        return UserStats(
            total_rounds=total_rounds,
            rounds_this_month=rounds_this_month,
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
            # Score distribution percentages
            eagles_or_better_pct=eagles_pct,
            birdies_pct=birdies_pct,
            pars_pct=pars_pct,
            bogeys_pct=bogeys_pct,
            double_bogeys_pct=double_bogeys_pct,
            triple_or_worse_pct=triple_or_worse_pct,
            # GIR percentage
            gir_pct=gir_pct,
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )


# ============================================
# OWNER-ONLY ENDPOINTS
# ============================================


@router.get("/owner/users", response_model=list[UserWithStats])
async def list_users_with_stats(owner_user: UserResponse = Depends(get_owner_user)):
    """List all users with their stats (owner only)."""
    supabase = get_supabase_admin_client()

    try:
        # Get all users from auth
        users_response = supabase.auth.admin.list_users()
        users = users_response if isinstance(users_response, list) else []

        # Get all profiles
        profiles_response = supabase.table("profiles").select("*").execute()
        profiles = {p["id"]: p for p in profiles_response.data} if profiles_response.data else {}

        # Get saved players for linking
        players_response = supabase.table("saved_players").select("id, name").execute()
        players = {p["id"]: p["name"] for p in (players_response.data or [])}

        # Get round counts per user
        rounds_response = supabase.table("rounds").select("user_id").execute()
        round_counts: Dict[str, int] = {}
        for r in (rounds_response.data or []):
            uid = r.get("user_id")
            if uid:
                round_counts[uid] = round_counts.get(uid, 0) + 1

        result = []
        for user in users:
            profile = profiles.get(user.id, {})
            permissions = profile.get("permissions", [])
            if permissions is None:
                permissions = []
            linked_player_id = profile.get("linked_player_id")

            result.append(UserWithStats(
                id=user.id,
                email=user.email,
                display_name=profile.get("display_name"),
                role=profile.get("role", "user"),
                status=profile.get("status", "active"),
                permissions=permissions,
                linked_player_id=linked_player_id,
                linked_player_name=players.get(linked_player_id) if linked_player_id else None,
                total_rounds=round_counts.get(user.id, 0),
                created_at=user.created_at,
                updated_at=profile.get("updated_at", user.created_at),
            ))

        return result
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )


@router.get("/owner/rounds")
async def list_all_rounds(
    owner_user: UserResponse = Depends(get_owner_user),
    limit: int = 50,
    offset: int = 0,
):
    """List all rounds from all users (owner only)."""
    supabase = get_supabase_admin_client()

    try:
        # Get rounds with pagination
        rounds_response = (
            supabase.table("rounds")
            .select("*")
            .order("round_date", desc=True)
            .range(offset, offset + limit - 1)
            .execute()
        )

        # Get profiles for user names
        profiles_response = supabase.table("profiles").select("id, display_name").execute()
        profiles = {p["id"]: p.get("display_name") for p in (profiles_response.data or [])}

        rounds = []
        for r in (rounds_response.data or []):
            user_id = r.get("user_id")
            rounds.append({
                **r,
                "user_display_name": profiles.get(user_id) or "Unknown",
            })

        # Get total count
        count_response = supabase.table("rounds").select("id", count="exact").execute()
        total = count_response.count if hasattr(count_response, 'count') else len(rounds_response.data or [])

        return {
            "rounds": rounds,
            "total": total,
            "limit": limit,
            "offset": offset,
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )


@router.patch("/owner/users/{user_id}/permissions", response_model=UserResponse)
async def update_user_permissions(
    user_id: str,
    update: UserPermissionsUpdate,
    owner_user: UserResponse = Depends(get_owner_user),
):
    """Update user permissions (owner only)."""
    supabase = get_supabase_admin_client()

    try:
        # Validate permissions
        valid_permissions = [
            "rounds.create",
            "rounds.import",
            "courses.create",
            "courses.edit",
            "players.manage",
        ]
        for perm in update.permissions:
            if perm not in valid_permissions:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid permission: {perm}. Valid: {valid_permissions}",
                )

        # Update permissions
        response = (
            supabase.table("profiles")
            .update({"permissions": update.permissions})
            .eq("id", user_id)
            .execute()
        )

        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found",
            )

        profile = response.data[0]

        # Get user email from auth
        user_response = supabase.auth.admin.get_user_by_id(user_id)
        email = user_response.user.email if user_response and user_response.user else ""

        return UserResponse(
            id=profile["id"],
            email=email,
            display_name=profile.get("display_name"),
            role=profile.get("role", "user"),
            status=profile.get("status", "active"),
            permissions=profile.get("permissions", []),
            linked_player_id=profile.get("linked_player_id"),
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


@router.get("/owner/stats")
async def get_owner_stats(owner_user: UserResponse = Depends(get_owner_user)):
    """Get global platform statistics (owner only)."""
    supabase = get_supabase_admin_client()

    try:
        # Total users
        users_response = supabase.auth.admin.list_users()
        total_users = len(users_response) if isinstance(users_response, list) else 0

        # Total rounds
        rounds_response = supabase.table("rounds").select("id, round_date, is_finished", count="exact").execute()
        total_rounds = rounds_response.count if hasattr(rounds_response, 'count') else len(rounds_response.data or [])

        # Finished rounds
        finished_rounds = len([r for r in (rounds_response.data or []) if r.get("is_finished")])

        # Rounds this month
        today = date.today()
        month_start = date(today.year, today.month, 1).isoformat()
        rounds_this_month = len([
            r for r in (rounds_response.data or [])
            if r.get("round_date", "") >= month_start
        ])

        # Total courses
        courses_response = supabase.table("courses").select("id", count="exact").execute()
        total_courses = courses_response.count if hasattr(courses_response, 'count') else len(courses_response.data or [])

        # Total saved players
        players_response = supabase.table("saved_players").select("id", count="exact").execute()
        total_players = players_response.count if hasattr(players_response, 'count') else len(players_response.data or [])

        # Users by role
        profiles_response = supabase.table("profiles").select("role").execute()
        roles_count: Dict[str, int] = {"user": 0, "admin": 0, "owner": 0}
        for p in (profiles_response.data or []):
            role = p.get("role", "user")
            roles_count[role] = roles_count.get(role, 0) + 1

        return {
            "total_users": total_users,
            "users_by_role": roles_count,
            "total_rounds": total_rounds,
            "finished_rounds": finished_rounds,
            "rounds_this_month": rounds_this_month,
            "total_courses": total_courses,
            "total_players": total_players,
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )


@router.post("/owner/backfill-virtual-handicap")
async def backfill_virtual_handicap(owner_user: UserResponse = Depends(get_owner_user)):
    """
    Backfill virtual_handicap for all historical rounds that don't have it.
    This calculates HV = Handicap Index - (Stableford Points - 36) for each round.
    Owner only endpoint.
    """
    supabase = get_supabase_admin_client()

    try:
        # Get all finished rounds without virtual_handicap
        rounds_response = (
            supabase.table("rounds")
            .select("id, course_id, course_length, players, use_handicap, handicap_percentage")
            .eq("is_finished", True)
            .is_("virtual_handicap", "null")
            .execute()
        )

        rounds = rounds_response.data or []
        if not rounds:
            return {"message": "No rounds to process", "updated": 0, "skipped": 0}

        # Get all courses for holes_data and tees
        courses_response = supabase.table("courses").select("id, holes_data, tees").execute()
        courses = {
            c["id"]: {
                "holes_data": c.get("holes_data", []),
                "tees": c.get("tees", []),
            }
            for c in (courses_response.data or [])
        }

        updated = 0
        skipped = 0
        errors = []

        for round_data in rounds:
            round_id = round_data["id"]
            course_id = round_data.get("course_id")
            course_length = round_data.get("course_length", "18")
            players = round_data.get("players", [])
            use_handicap = round_data.get("use_handicap", True)
            handicap_percentage = round_data.get("handicap_percentage", 100)

            if not course_id or not players:
                skipped += 1
                continue

            course_data = courses.get(course_id, {})
            holes_data = course_data.get("holes_data", [])
            tees = course_data.get("tees", [])
            if not holes_data:
                skipped += 1
                continue

            # Calculate virtual handicap
            virtual_handicap = calculate_vh_for_backfill(
                players,
                course_length,
                holes_data,
                use_handicap=use_handicap,
                handicap_percentage=handicap_percentage,
                tees=tees,
            )

            if virtual_handicap is not None:
                try:
                    supabase.table("rounds").update(
                        {"virtual_handicap": virtual_handicap}
                    ).eq("id", round_id).execute()
                    updated += 1
                except Exception as e:
                    errors.append(f"Round {round_id}: {str(e)}")
            else:
                skipped += 1

        return {
            "message": "Backfill completed",
            "updated": updated,
            "skipped": skipped,
            "errors": errors[:10] if errors else [],
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )


def calculate_playing_handicap_for_backfill(handicap_index: float, slope: int, percentage: int = 100) -> int:
    """Calculate playing handicap from handicap index and slope."""
    playing_hcp = (handicap_index * slope) / 113
    return round(playing_hcp * percentage / 100)


def calculate_vh_for_backfill(
    players: list,
    course_length: str,
    holes_data: list,
    use_handicap: bool = True,
    handicap_percentage: int = 100,
    tees: list | None = None,
) -> float | None:
    """
    Calculate Virtual Handicap for backfill: HV = Handicap Index - (Stableford Points - 36).

    Args:
        players: List of player data
        course_length: "18", "front9", or "back9"
        holes_data: List of hole data with par and handicap
        use_handicap: If False, all players use the first player's handicap ("común" mode)
        handicap_percentage: Percentage of handicap to use (100 or 75)
        tees: List of tees with slope data (for recalculating HDJ if stored as 0)
    """
    if not players or not holes_data:
        return None

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
            playing_handicap = calculate_playing_handicap_for_backfill(od_handicap_index, slope, handicap_percentage)

    # If use_handicap is False ("común" mode), we still use the first player's handicap
    # for Stableford calculation internally
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
        hcp_index = hole_data.get("handicap", 1)

        strokes_received = 0
        if effective_handicap > 0:
            base_strokes = effective_handicap // 18
            remainder = effective_handicap % 18
            strokes_received = base_strokes + (1 if hcp_index <= remainder else 0)

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

    is_9_hole = course_length in ["front9", "back9"]
    normalized = total_stableford * 2 if is_9_hole else total_stableford
    virtual_handicap = od_handicap_index - (normalized - 36)
    return round(virtual_handicap, 1)