from fastapi import APIRouter, HTTPException, status, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from datetime import datetime, date
from app.models.schemas import AdminStats, UserResponse
from app.models.db_models import Profile, Round as RoundModel, Course as CourseModel
from app.database import get_db
from app.dependencies import get_admin_user

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/stats", response_model=AdminStats)
async def get_admin_stats(
    admin_user: UserResponse = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Get admin statistics (admin only)."""
    try:
        # Get total users
        result = await db.execute(select(func.count(Profile.id)))
        total_users = result.scalar() or 0

        # Get total rounds
        result = await db.execute(select(func.count(RoundModel.id)))
        total_rounds = result.scalar() or 0

        # Get rounds this month
        today = date.today()
        month_start = date(today.year, today.month, 1).isoformat()
        result = await db.execute(
            select(func.count(RoundModel.id)).where(RoundModel.round_date >= month_start)
        )
        rounds_this_month = result.scalar() or 0

        # Get total courses
        result = await db.execute(select(func.count(CourseModel.id)))
        total_courses = result.scalar() or 0

        return AdminStats(
            total_users=total_users,
            total_rounds=total_rounds,
            rounds_this_month=rounds_this_month,
            total_courses=total_courses,
        )
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))
