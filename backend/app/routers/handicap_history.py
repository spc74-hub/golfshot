from fastapi import APIRouter, HTTPException, status, Depends
from app.models.schemas import (
    HandicapHistoryCreate,
    HandicapHistoryUpdate,
    HandicapHistoryResponse,
    UserResponse,
)
from app.services.supabase import get_supabase_client
from app.dependencies import get_current_user
from typing import Optional

router = APIRouter(prefix="/handicap-history", tags=["handicap-history"])


@router.get("/", response_model=list[HandicapHistoryResponse])
async def list_handicap_history(current_user: UserResponse = Depends(get_current_user)):
    """List all handicap history entries for the current user, ordered by date desc."""
    supabase = get_supabase_client()

    try:
        response = (
            supabase.table("handicap_history")
            .select("*")
            .eq("user_id", current_user.id)
            .order("effective_date", desc=True)
            .execute()
        )
        return response.data or []
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )


@router.get("/current", response_model=Optional[HandicapHistoryResponse])
async def get_current_handicap(current_user: UserResponse = Depends(get_current_user)):
    """Get the most recent (current) handicap index for the user."""
    supabase = get_supabase_client()

    try:
        response = (
            supabase.table("handicap_history")
            .select("*")
            .eq("user_id", current_user.id)
            .order("effective_date", desc=True)
            .limit(1)
            .execute()
        )

        if response.data and len(response.data) > 0:
            return response.data[0]
        return None
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )


@router.get("/at-date/{date}", response_model=Optional[HandicapHistoryResponse])
async def get_handicap_at_date(
    date: str,
    current_user: UserResponse = Depends(get_current_user),
):
    """Get the handicap index that was effective on a specific date."""
    supabase = get_supabase_client()

    try:
        # Get the most recent handicap entry that was effective on or before the given date
        response = (
            supabase.table("handicap_history")
            .select("*")
            .eq("user_id", current_user.id)
            .lte("effective_date", date)
            .order("effective_date", desc=True)
            .limit(1)
            .execute()
        )

        if response.data and len(response.data) > 0:
            return response.data[0]
        return None
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )


@router.post("/", response_model=HandicapHistoryResponse, status_code=status.HTTP_201_CREATED)
async def create_handicap_entry(
    entry: HandicapHistoryCreate,
    current_user: UserResponse = Depends(get_current_user),
):
    """Create a new handicap history entry."""
    supabase = get_supabase_client()

    try:
        entry_data = {
            "user_id": current_user.id,
            "handicap_index": entry.handicap_index,
            "effective_date": entry.effective_date,
            "notes": entry.notes,
        }

        response = supabase.table("handicap_history").insert(entry_data).execute()

        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to create handicap entry",
            )

        return response.data[0]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )


@router.put("/{entry_id}", response_model=HandicapHistoryResponse)
async def update_handicap_entry(
    entry_id: str,
    entry: HandicapHistoryUpdate,
    current_user: UserResponse = Depends(get_current_user),
):
    """Update a handicap history entry."""
    supabase = get_supabase_client()

    try:
        # Check ownership
        existing = (
            supabase.table("handicap_history")
            .select("user_id")
            .eq("id", entry_id)
            .single()
            .execute()
        )

        if not existing.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Handicap entry not found",
            )

        if existing.data["user_id"] != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied",
            )

        # Prepare update data (only include non-None values)
        update_data = {k: v for k, v in entry.model_dump().items() if v is not None}

        if not update_data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No fields to update",
            )

        response = (
            supabase.table("handicap_history")
            .update(update_data)
            .eq("id", entry_id)
            .execute()
        )

        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Handicap entry not found",
            )

        return response.data[0]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )


@router.delete("/{entry_id}")
async def delete_handicap_entry(
    entry_id: str,
    current_user: UserResponse = Depends(get_current_user),
):
    """Delete a handicap history entry."""
    supabase = get_supabase_client()

    try:
        # Check ownership
        existing = (
            supabase.table("handicap_history")
            .select("user_id")
            .eq("id", entry_id)
            .single()
            .execute()
        )

        if not existing.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Handicap entry not found",
            )

        if existing.data["user_id"] != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied",
            )

        supabase.table("handicap_history").delete().eq("id", entry_id).execute()

        return {"message": "Handicap entry deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )
