from fastapi import APIRouter, HTTPException, status, Depends
from datetime import datetime, timedelta
from app.models.schemas import AdminStats, UserResponse
from app.services.supabase import get_supabase_admin_client
from app.dependencies import get_admin_user

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/stats", response_model=AdminStats)
async def get_admin_stats(admin_user: UserResponse = Depends(get_admin_user)):
    """Get admin statistics (admin only)."""
    supabase = get_supabase_admin_client()

    try:
        # Get total users
        users_response = supabase.auth.admin.list_users()
        total_users = len(users_response) if isinstance(users_response, list) else 0

        # Get total rounds
        rounds_response = supabase.table("rounds").select("id, created_at").execute()
        rounds = rounds_response.data or []
        total_rounds = len(rounds)

        # Get rounds this month
        first_of_month = datetime.now().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        rounds_this_month = sum(
            1 for r in rounds
            if datetime.fromisoformat(r["created_at"].replace("Z", "+00:00")) >= first_of_month
        )

        # Get total courses
        courses_response = supabase.table("courses").select("id").execute()
        total_courses = len(courses_response.data) if courses_response.data else 0

        return AdminStats(
            total_users=total_users,
            total_rounds=total_rounds,
            rounds_this_month=rounds_this_month,
            total_courses=total_courses,
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )
