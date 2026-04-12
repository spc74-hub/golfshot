from fastapi import APIRouter, HTTPException, status, Depends, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.models.schemas import (
    UserResponse, UserUpdate, UserStats, UserWithStats, UserPermissionsUpdate,
    UserStatsExtended, StatsComparisonResponse,
)
from app.models.db_models import (
    Profile, Round as RoundModel, Course as CourseModel,
    SavedPlayer as SavedPlayerModel, HandicapHistory as HandicapHistoryModel,
)
from app.database import get_db
from app.auth import get_password_hash
from app.dependencies import get_current_user, get_admin_user, get_owner_user
from typing import Dict, Any, Literal, Optional
from datetime import datetime, date
from dateutil.relativedelta import relativedelta


class ResetPasswordRequest(BaseModel):
    new_password: str

router = APIRouter(prefix="/users", tags=["users"])


class UpdateMyProfileRequest(BaseModel):
    display_name: str | None = None
    linked_player_id: str | None = None


def profile_to_response(profile: Profile) -> UserResponse:
    permissions = profile.permissions or []
    return UserResponse(
        id=profile.id,
        email=profile.email,
        display_name=profile.display_name,
        role=profile.role or "user",
        status=profile.status or "active",
        permissions=permissions,
        linked_player_id=profile.linked_player_id,
        created_at=profile.created_at,
        updated_at=profile.updated_at or profile.created_at,
    )


@router.patch("/me")
async def update_my_profile(
    request: UpdateMyProfileRequest,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update the current user's profile."""
    result = await db.execute(select(Profile).where(Profile.id == current_user.id))
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Profile not found")

    update_data = {}
    if request.display_name is not None:
        update_data["display_name"] = request.display_name
    if request.linked_player_id is not None:
        update_data["linked_player_id"] = request.linked_player_id

    if not update_data:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No fields to update")

    for key, value in update_data.items():
        setattr(profile, key, value)

    profile.updated_at = datetime.utcnow()
    await db.commit()
    return {"message": "Profile updated successfully"}


@router.get("/", response_model=list[UserResponse])
async def list_users(
    admin_user: UserResponse = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """List all users (admin only)."""
    result = await db.execute(select(Profile).order_by(Profile.created_at))
    profiles = result.scalars().all()
    return [profile_to_response(p) for p in profiles]


@router.get("/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: str,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get user by ID."""
    if user_id in ("me", "owner"):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    if current_user.id != user_id and current_user.role not in ("admin", "owner"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    result = await db.execute(select(Profile).where(Profile.id == user_id))
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return profile_to_response(profile)


@router.patch("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: str,
    update: UserUpdate,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update user profile."""
    if user_id in ("me", "owner"):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    if current_user.id != user_id and current_user.role not in ("admin", "owner"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    if update.role is not None and current_user.role != "owner":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only owner can change roles")

    if update.permissions is not None and current_user.role != "owner":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only owner can change permissions")

    if update.status is not None and current_user.role not in ("admin", "owner"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only admins can change status")

    if update.role == "owner":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot assign owner role via API")

    result = await db.execute(select(Profile).where(Profile.id == user_id))
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    update_data = {k: v for k, v in update.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No fields to update")

    for key, value in update_data.items():
        setattr(profile, key, value)

    profile.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(profile)
    return profile_to_response(profile)


@router.delete("/{user_id}")
async def delete_user(
    user_id: str,
    owner_user: UserResponse = Depends(get_owner_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete user (owner only)."""
    if user_id in ("me", "owner"):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    if owner_user.id == user_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot delete your own account")

    result = await db.execute(select(Profile).where(Profile.id == user_id))
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    if profile.role == "owner":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot delete owner account")

    await db.delete(profile)
    await db.commit()
    return {"message": "User deleted successfully"}


@router.patch("/{user_id}/block")
async def toggle_block_user(
    user_id: str,
    owner_user: UserResponse = Depends(get_owner_user),
    db: AsyncSession = Depends(get_db),
):
    """Block or unblock a user (owner only)."""
    if user_id in ("me", "owner"):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    if owner_user.id == user_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot block your own account")

    result = await db.execute(select(Profile).where(Profile.id == user_id))
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    if profile.role == "owner":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot block owner account")

    new_status = "active" if profile.status == "blocked" else "blocked"
    profile.status = new_status
    profile.updated_at = datetime.utcnow()
    await db.commit()
    return {"message": f"User {'unblocked' if new_status == 'active' else 'blocked'} successfully", "status": new_status}


@router.patch("/{user_id}/reset-password")
async def reset_user_password(
    user_id: str,
    request: ResetPasswordRequest,
    owner_user: UserResponse = Depends(get_owner_user),
    db: AsyncSession = Depends(get_db),
):
    """Reset a user's password (owner only)."""
    if user_id in ("me", "owner"):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    if len(request.new_password) < 6:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Password must be at least 6 characters")

    result = await db.execute(select(Profile).where(Profile.id == user_id))
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    if profile.role == "owner":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot reset owner password via this endpoint")

    profile.hashed_password = get_password_hash(request.new_password)
    profile.updated_at = datetime.utcnow()
    await db.commit()
    return {"message": "Password reset successfully"}


# ============================================
# STATS ENDPOINTS
# ============================================


@router.get("/me/stats", response_model=UserStats)
async def get_my_stats(
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get statistics for the current user."""
    try:
        # Get user's handicap index
        sp_result = await db.execute(
            select(SavedPlayerModel)
            .where(SavedPlayerModel.user_id == current_user.id)
            .order_by(SavedPlayerModel.created_at)
            .limit(1)
        )
        sp = sp_result.scalar_one_or_none()
        user_handicap_index = sp.handicap_index if sp else None

        # Get finished rounds
        rounds_result = await db.execute(
            select(RoundModel)
            .where(RoundModel.user_id == current_user.id, RoundModel.is_finished == True)
            .order_by(RoundModel.round_date.desc())
        )
        rounds = rounds_result.scalars().all()
        total_rounds = len(rounds)

        today = date.today()
        month_start = date(today.year, today.month, 1).isoformat()
        rounds_this_month = len([r for r in rounds if (r.round_date or "") >= month_start])

        if total_rounds == 0:
            return UserStats(total_rounds=0, rounds_this_month=0, user_handicap_index=user_handicap_index)

        # Get courses
        courses_result = await db.execute(select(CourseModel))
        courses = {c.id: c for c in courses_result.scalars().all()}

        stats = _calculate_stats(rounds, courses, today)
        stats["total_rounds"] = total_rounds
        stats["rounds_this_month"] = rounds_this_month
        stats["user_handicap_index"] = user_handicap_index
        return UserStats(**stats)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.get("/me/stats/filtered", response_model=UserStatsExtended)
async def get_my_stats_filtered(
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    period: Optional[Literal["1m", "3m", "6m", "1y", "all"]] = Query("all"),
    year: Optional[int] = Query(None),
    course_id: Optional[str] = Query(None),
    course_length: Optional[Literal["9", "18", "all"]] = Query("all"),
    previous: bool = Query(False),
):
    """Get statistics with period filters."""
    try:
        today = date.today()
        start_date = None
        end_date = today
        period_label = "Todo el tiempo"

        if year:
            target_year = year - 1 if previous else year
            start_date = date(target_year, 1, 1)
            end_date = date(target_year, 12, 31)
            period_label = f"Ano {target_year}"
        elif period == "1m":
            if previous:
                prev_month = today.month - 1 if today.month > 1 else 12
                prev_year = today.year if today.month > 1 else today.year - 1
                start_date = date(prev_year, prev_month, 1)
                end_date = date(today.year, today.month, 1) - relativedelta(days=1)
                period_label = "Mes anterior"
            else:
                start_date = date(today.year, today.month, 1)
                period_label = "Este mes"
        elif period == "3m":
            current_quarter = (today.month - 1) // 3
            if previous:
                prev_quarter = current_quarter - 1 if current_quarter > 0 else 3
                prev_year = today.year if current_quarter > 0 else today.year - 1
                quarter_start_month = prev_quarter * 3 + 1
                start_date = date(prev_year, quarter_start_month, 1)
                end_date = date(prev_year, quarter_start_month + 2, 1) + relativedelta(months=1) - relativedelta(days=1)
                period_label = "Trimestre anterior"
            else:
                quarter_start_month = current_quarter * 3 + 1
                start_date = date(today.year, quarter_start_month, 1)
                period_label = "Este trimestre"
        elif period == "6m":
            current_semester = 0 if today.month <= 6 else 1
            if previous:
                if current_semester == 0:
                    start_date = date(today.year - 1, 7, 1)
                    end_date = date(today.year - 1, 12, 31)
                else:
                    start_date = date(today.year, 1, 1)
                    end_date = date(today.year, 6, 30)
                period_label = "Semestre anterior"
            else:
                semester_start_month = 1 if today.month <= 6 else 7
                start_date = date(today.year, semester_start_month, 1)
                period_label = "Este semestre"
        elif period == "1y":
            target_year = today.year - 1 if previous else today.year
            start_date = date(target_year, 1, 1)
            end_date = date(target_year, 12, 31)
            period_label = f"Ano {target_year}" if previous else "Este ano"

        # Get handicap history
        hi_result = await db.execute(
            select(HandicapHistoryModel)
            .where(HandicapHistoryModel.user_id == current_user.id)
            .order_by(HandicapHistoryModel.effective_date.desc())
        )
        hi_history = hi_result.scalars().all()

        user_handicap_index = None
        if hi_history:
            user_handicap_index = hi_history[0].handicap_index
        else:
            sp_result = await db.execute(
                select(SavedPlayerModel.handicap_index)
                .where(SavedPlayerModel.user_id == current_user.id)
                .order_by(SavedPlayerModel.created_at)
                .limit(1)
            )
            sp_row = sp_result.first()
            if sp_row:
                user_handicap_index = sp_row[0]

        # Build query
        query = (
            select(RoundModel)
            .where(RoundModel.user_id == current_user.id, RoundModel.is_finished == True)
        )
        if course_id:
            query = query.where(RoundModel.course_id == course_id)
        if course_length == "9":
            query = query.where(RoundModel.course_length.in_(["front9", "back9"]))
        elif course_length == "18":
            query = query.where(RoundModel.course_length == "18")
        if start_date:
            query = query.where(RoundModel.round_date >= start_date.isoformat())
            query = query.where(RoundModel.round_date <= end_date.isoformat())

        rounds_result = await db.execute(query.order_by(RoundModel.round_date.desc()))
        rounds = rounds_result.scalars().all()
        total_rounds = len(rounds)

        if total_rounds == 0:
            return UserStatsExtended(
                total_rounds=0, rounds_this_month=0, user_handicap_index=user_handicap_index,
                period_label=period_label, rounds_in_period=0,
            )

        courses_result = await db.execute(select(CourseModel))
        courses = {c.id: c for c in courses_result.scalars().all()}

        # Get HI at date helper
        def get_hi_at_date(round_date_str: str) -> float | None:
            if not hi_history:
                return user_handicap_index
            try:
                round_date = datetime.strptime(round_date_str, "%Y-%m-%d").date()
            except (ValueError, TypeError):
                return user_handicap_index
            for entry in hi_history:
                try:
                    effective = datetime.strptime(entry.effective_date, "%Y-%m-%d").date()
                    if effective <= round_date:
                        return entry.handicap_index
                except (ValueError, TypeError):
                    continue
            return user_handicap_index

        stats = _calculate_stats_extended(rounds, courses, today, get_hi_at_date)

        month_start_str = date(today.year, today.month, 1).isoformat()
        rounds_this_month = len([r for r in rounds if (r.round_date or "") >= month_start_str])

        stats["total_rounds"] = total_rounds
        stats["rounds_this_month"] = rounds_this_month
        stats["user_handicap_index"] = user_handicap_index
        stats["period_label"] = period_label
        stats["rounds_in_period"] = total_rounds
        return UserStatsExtended(**stats)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.get("/me/stats/compare", response_model=StatsComparisonResponse)
async def compare_stats(
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    period: Literal["1m", "3m", "6m", "1y", "all"] = Query("3m"),
    year: Optional[int] = Query(None),
):
    """Compare statistics between current period and previous period."""
    try:
        stats1 = await get_my_stats_filtered(
            current_user=current_user, db=db,
            period=period if not year else "all", year=year,
            course_id=None, course_length="all", previous=False,
        )
        stats2 = await get_my_stats_filtered(
            current_user=current_user, db=db,
            period=period if not year else "all", year=year,
            course_id=None, course_length="all", previous=True,
        )

        def safe_diff(val1, val2):
            if val1 is None or val2 is None:
                return None
            return round(val1 - val2, 2)

        return StatsComparisonResponse(
            period1=stats1, period2=stats2,
            diff_avg_strokes_9holes=safe_diff(stats1.avg_strokes_9holes, stats2.avg_strokes_9holes),
            diff_avg_strokes_18holes=safe_diff(stats1.avg_strokes_18holes, stats2.avg_strokes_18holes),
            diff_hvp_total=safe_diff(stats1.hvp_total, stats2.hvp_total),
            diff_gir_pct=safe_diff(stats1.gir_pct, stats2.gir_pct),
            diff_avg_putts_per_round=safe_diff(stats1.avg_putts_per_round, stats2.avg_putts_per_round),
            diff_strokes_gap_9holes=safe_diff(stats1.strokes_gap_9holes, stats2.strokes_gap_9holes),
            diff_strokes_gap_18holes=safe_diff(stats1.strokes_gap_18holes, stats2.strokes_gap_18holes),
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


# ============================================
# OWNER-ONLY ENDPOINTS
# ============================================

@router.get("/owner/users", response_model=list[UserWithStats])
async def list_users_with_stats(
    owner_user: UserResponse = Depends(get_owner_user),
    db: AsyncSession = Depends(get_db),
):
    """List all users with their stats (owner only)."""
    profiles_result = await db.execute(select(Profile))
    profiles = profiles_result.scalars().all()

    # Get saved players for linking
    players_result = await db.execute(select(SavedPlayerModel.id, SavedPlayerModel.name))
    players_map = {row[0]: row[1] for row in players_result.all()}

    # Get round counts
    counts_result = await db.execute(
        select(RoundModel.user_id, func.count(RoundModel.id)).group_by(RoundModel.user_id)
    )
    round_counts = {row[0]: row[1] for row in counts_result.all()}

    result = []
    for p in profiles:
        permissions = p.permissions or []
        linked_player_id = p.linked_player_id
        result.append(UserWithStats(
            id=p.id, email=p.email,
            display_name=p.display_name,
            role=p.role or "user",
            status=p.status or "active",
            permissions=permissions,
            linked_player_id=linked_player_id,
            linked_player_name=players_map.get(linked_player_id) if linked_player_id else None,
            total_rounds=round_counts.get(p.id, 0),
            created_at=p.created_at,
            updated_at=p.updated_at or p.created_at,
        ))
    return result


@router.get("/owner/rounds")
async def list_all_rounds(
    owner_user: UserResponse = Depends(get_owner_user),
    db: AsyncSession = Depends(get_db),
    limit: int = 50,
    offset: int = 0,
):
    """List all rounds from all users (owner only)."""
    rounds_result = await db.execute(
        select(RoundModel)
        .order_by(RoundModel.round_date.desc())
        .offset(offset).limit(limit)
    )
    rounds = rounds_result.scalars().all()

    profiles_result = await db.execute(select(Profile.id, Profile.display_name))
    profiles_map = {row[0]: row[1] for row in profiles_result.all()}

    count_result = await db.execute(select(func.count(RoundModel.id)))
    total = count_result.scalar() or 0

    from app.routers.rounds import round_model_to_dict
    rounds_data = []
    for r in rounds:
        d = round_model_to_dict(r, is_owner=True)
        d["user_display_name"] = profiles_map.get(r.user_id) or "Unknown"
        rounds_data.append(d)

    return {"rounds": rounds_data, "total": total, "limit": limit, "offset": offset}


@router.patch("/owner/users/{user_id}/permissions", response_model=UserResponse)
async def update_user_permissions(
    user_id: str,
    update: UserPermissionsUpdate,
    owner_user: UserResponse = Depends(get_owner_user),
    db: AsyncSession = Depends(get_db),
):
    """Update user permissions (owner only)."""
    valid_permissions = ["rounds.create", "rounds.import", "courses.create", "courses.edit", "players.manage"]
    for perm in update.permissions:
        if perm not in valid_permissions:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid permission: {perm}. Valid: {valid_permissions}",
            )

    result = await db.execute(select(Profile).where(Profile.id == user_id))
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    profile.permissions = update.permissions
    profile.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(profile)
    return profile_to_response(profile)


@router.get("/owner/stats")
async def get_owner_stats(
    owner_user: UserResponse = Depends(get_owner_user),
    db: AsyncSession = Depends(get_db),
):
    """Get global platform statistics (owner only)."""
    total_users = (await db.execute(select(func.count(Profile.id)))).scalar() or 0
    total_rounds = (await db.execute(select(func.count(RoundModel.id)))).scalar() or 0
    finished_rounds = (await db.execute(
        select(func.count(RoundModel.id)).where(RoundModel.is_finished == True)
    )).scalar() or 0

    today = date.today()
    month_start = date(today.year, today.month, 1).isoformat()
    rounds_this_month = (await db.execute(
        select(func.count(RoundModel.id)).where(RoundModel.round_date >= month_start)
    )).scalar() or 0

    total_courses = (await db.execute(select(func.count(CourseModel.id)))).scalar() or 0
    total_players = (await db.execute(select(func.count(SavedPlayerModel.id)))).scalar() or 0

    roles_result = await db.execute(select(Profile.role, func.count(Profile.id)).group_by(Profile.role))
    roles_count = {"user": 0, "admin": 0, "owner": 0}
    for role, cnt in roles_result.all():
        roles_count[role or "user"] = cnt

    return {
        "total_users": total_users,
        "users_by_role": roles_count,
        "total_rounds": total_rounds,
        "finished_rounds": finished_rounds,
        "rounds_this_month": rounds_this_month,
        "total_courses": total_courses,
        "total_players": total_players,
    }


# ============================================
# STATS CALCULATION HELPERS
# ============================================

def _calculate_stats(rounds, courses, today):
    """Calculate user stats from rounds data. Common logic."""
    par3_strokes = []
    par4_strokes = []
    par5_strokes = []
    total_putts = []
    putts_9holes = []
    putts_18holes = []
    strokes_9holes = []
    strokes_18holes = []
    stableford_points_normalized = []
    hvp_data = []
    best_score_18 = None
    best_score_18_info = None
    best_score_9 = None
    best_score_9_info = None
    eagles_or_better = 0
    birdies = 0
    pars = 0
    bogeys = 0
    double_bogeys = 0
    triple_or_worse = 0
    total_holes_for_distribution = 0
    gir_hit = 0
    gir_total = 0

    current_month_start = date(today.year, today.month, 1)
    current_quarter = (today.month - 1) // 3
    current_quarter_start = date(today.year, current_quarter * 3 + 1, 1)
    current_year_start = date(today.year, 1, 1)

    for round_data in rounds:
        course = courses.get(round_data.course_id)
        if not course:
            continue

        holes_data_map = {h["number"]: h for h in (course.holes_data or [])}
        players = round_data.players or []
        user_player = players[0] if players else None
        if not user_player:
            continue

        scores = user_player.get("scores", {})
        course_length = round_data.course_length or "18"

        if course_length == "front9":
            holes_to_count = range(1, 10)
        elif course_length == "back9":
            holes_to_count = range(10, 19)
        else:
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
            hole_data = holes_data_map.get(hole_num)
            if not hole_data:
                continue

            par = hole_data.get("par", 4)
            handicap = hole_data.get("handicap", 1)

            if par == 3:
                par3_strokes.append(strokes)
            elif par == 4:
                par4_strokes.append(strokes)
            elif par == 5:
                par5_strokes.append(strokes)

            round_strokes += strokes
            round_putts += putts

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

            if putts > 0:
                strokes_to_green = strokes - putts
                gir_total += 1
                if strokes_to_green <= par - 2:
                    gir_hit += 1

            playing_hcp = user_player.get("playing_handicap", 0)
            strokes_received = 0
            if playing_hcp > 0:
                base_s = playing_hcp // 18
                remainder = playing_hcp % 18
                strokes_received = base_s + (1 if handicap <= remainder else 0)

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

        is_9_hole = course_length in ["front9", "back9"]
        if is_9_hole:
            strokes_9holes.append(round_strokes)
            if round_putts > 0:
                putts_9holes.append(round_putts)
            if round_strokes > 0 and (best_score_9 is None or round_strokes < best_score_9):
                best_score_9 = round_strokes
                best_score_9_info = {"score": round_strokes, "date": round_data.round_date, "course": round_data.course_name}
        else:
            strokes_18holes.append(round_strokes)
            if round_putts > 0:
                putts_18holes.append(round_putts)
            if round_strokes > 0 and (best_score_18 is None or round_strokes < best_score_18):
                best_score_18 = round_strokes
                best_score_18_info = {"score": round_strokes, "date": round_data.round_date, "course": round_data.course_name}

        if round_putts > 0:
            total_putts.append(round_putts)

        if round_stableford > 0:
            normalized = round_stableford * 2 if is_9_hole else round_stableford
            if round_data.game_mode == "stableford":
                stableford_points_normalized.append(normalized)

        stored_vh = round_data.virtual_handicap
        if stored_vh is not None:
            hvp_value = stored_vh
        elif round_stableford > 0:
            od_hi = user_player.get("od_handicap_index", 0)
            if od_hi:
                norm_stab = round_stableford * 2 if is_9_hole else round_stableford
                hvp_value = od_hi - (norm_stab - 36)
            else:
                hvp_value = None
        else:
            hvp_value = None

        if hvp_value is not None:
            try:
                rd = datetime.strptime(round_data.round_date, "%Y-%m-%d").date()
            except (ValueError, TypeError):
                rd = None
            hvp_data.append((hvp_value, rd))

    avg_par3 = sum(par3_strokes) / len(par3_strokes) if par3_strokes else None
    avg_par4 = sum(par4_strokes) / len(par4_strokes) if par4_strokes else None
    avg_par5 = sum(par5_strokes) / len(par5_strokes) if par5_strokes else None
    avg_putts = sum(total_putts) / len(total_putts) if total_putts else None
    avg_putts_9 = sum(putts_9holes) / len(putts_9holes) if putts_9holes else None
    avg_putts_18 = sum(putts_18holes) / len(putts_18holes) if putts_18holes else None
    avg_9 = sum(strokes_9holes) / len(strokes_9holes) if strokes_9holes else None
    avg_18 = sum(strokes_18holes) / len(strokes_18holes) if strokes_18holes else None
    avg_stab = sum(stableford_points_normalized) / len(stableford_points_normalized) if stableford_points_normalized else None

    hvp_total = hvp_month = hvp_quarter = hvp_year = None
    if hvp_data:
        all_hvp = [h for h, _ in hvp_data]
        hvp_total = sum(all_hvp) / len(all_hvp)
        month_hvp = [h for h, d in hvp_data if d and d >= current_month_start]
        quarter_hvp = [h for h, d in hvp_data if d and d >= current_quarter_start]
        year_hvp = [h for h, d in hvp_data if d and d >= current_year_start]
        if month_hvp:
            hvp_month = sum(month_hvp) / len(month_hvp)
        if quarter_hvp:
            hvp_quarter = sum(quarter_hvp) / len(quarter_hvp)
        if year_hvp:
            hvp_year = sum(year_hvp) / len(year_hvp)

    eagles_pct = birdies_pct = pars_pct = bogeys_pct = double_bogeys_pct = triple_pct = None
    if total_holes_for_distribution > 0:
        t = total_holes_for_distribution
        eagles_pct = round(eagles_or_better / t * 100, 1)
        birdies_pct = round(birdies / t * 100, 1)
        pars_pct = round(pars / t * 100, 1)
        bogeys_pct = round(bogeys / t * 100, 1)
        double_bogeys_pct = round(double_bogeys / t * 100, 1)
        triple_pct = round(triple_or_worse / t * 100, 1)

    gir_pct = round(gir_hit / gir_total * 100, 1) if gir_total > 0 else None

    return {
        "avg_strokes_par3": round(avg_par3, 2) if avg_par3 else None,
        "avg_strokes_par4": round(avg_par4, 2) if avg_par4 else None,
        "avg_strokes_par5": round(avg_par5, 2) if avg_par5 else None,
        "avg_putts_per_round": round(avg_putts, 2) if avg_putts else None,
        "avg_putts_9holes": round(avg_putts_9, 2) if avg_putts_9 else None,
        "avg_putts_18holes": round(avg_putts_18, 2) if avg_putts_18 else None,
        "avg_strokes_9holes": round(avg_9, 2) if avg_9 else None,
        "avg_strokes_18holes": round(avg_18, 2) if avg_18 else None,
        "avg_stableford_points": round(avg_stab, 2) if avg_stab else None,
        "hvp_total": round(hvp_total, 1) if hvp_total else None,
        "hvp_month": round(hvp_month, 1) if hvp_month else None,
        "hvp_quarter": round(hvp_quarter, 1) if hvp_quarter else None,
        "hvp_year": round(hvp_year, 1) if hvp_year else None,
        "best_round_score": best_score_18_info["score"] if best_score_18_info else None,
        "best_round_date": best_score_18_info["date"] if best_score_18_info else None,
        "best_round_course": best_score_18_info["course"] if best_score_18_info else None,
        "best_round_9_score": best_score_9_info["score"] if best_score_9_info else None,
        "best_round_9_date": best_score_9_info["date"] if best_score_9_info else None,
        "best_round_9_course": best_score_9_info["course"] if best_score_9_info else None,
        "eagles_or_better_pct": eagles_pct,
        "birdies_pct": birdies_pct,
        "pars_pct": pars_pct,
        "bogeys_pct": bogeys_pct,
        "double_bogeys_pct": double_bogeys_pct,
        "triple_or_worse_pct": triple_pct,
        "gir_pct": gir_pct,
    }


def _calculate_stats_extended(rounds, courses, today, get_hi_at_date):
    """Extended stats with target strokes."""
    base = _calculate_stats(rounds, courses, today)

    target_strokes_9 = []
    target_strokes_18 = []

    for round_data in rounds:
        course = courses.get(round_data.course_id)
        if not course:
            continue

        players = round_data.players or []
        user_player = players[0] if players else None
        if not user_player:
            continue

        tee_box = user_player.get("tee_box", "")
        tees = course.tees or []
        tee_info = next((t for t in tees if t["name"] == tee_box), None)
        course_rating = tee_info["rating"] if tee_info else 72.0
        slope = tee_info["slope"] if tee_info else 113

        hi_at_round = get_hi_at_date(round_data.round_date or "")
        course_length = round_data.course_length or "18"
        is_9 = course_length in ["front9", "back9"]

        if hi_at_round is not None:
            hi_strokes = (hi_at_round * slope) / 113
            if is_9:
                target = (course_rating / 2) + (hi_strokes / 2)
                target_strokes_9.append(target)
            else:
                target = course_rating + hi_strokes
                target_strokes_18.append(target)

    avg_target_9 = sum(target_strokes_9) / len(target_strokes_9) if target_strokes_9 else None
    avg_target_18 = sum(target_strokes_18) / len(target_strokes_18) if target_strokes_18 else None

    strokes_gap_9 = None
    strokes_gap_18 = None
    if base.get("avg_strokes_9holes") is not None and avg_target_9 is not None:
        strokes_gap_9 = round(base["avg_strokes_9holes"] - avg_target_9, 1)
    if base.get("avg_strokes_18holes") is not None and avg_target_18 is not None:
        strokes_gap_18 = round(base["avg_strokes_18holes"] - avg_target_18, 1)

    base["avg_target_strokes_9holes"] = round(avg_target_9, 1) if avg_target_9 else None
    base["avg_target_strokes_18holes"] = round(avg_target_18, 1) if avg_target_18 else None
    base["strokes_gap_9holes"] = strokes_gap_9
    base["strokes_gap_18holes"] = strokes_gap_18
    return base
