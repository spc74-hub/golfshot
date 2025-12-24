from fastapi import APIRouter, HTTPException, status, Depends
from app.models.schemas import (
    RoundTemplateCreate,
    RoundTemplateUpdate,
    RoundTemplateResponse,
    UserResponse,
)
from app.services.supabase import get_supabase_client
from app.dependencies import get_current_user

router = APIRouter(prefix="/templates", tags=["templates"])


@router.get("/", response_model=list[RoundTemplateResponse])
async def list_templates(current_user: UserResponse = Depends(get_current_user)):
    """List all round templates for the current user."""
    supabase = get_supabase_client()

    try:
        response = (
            supabase.table("round_templates")
            .select("*")
            .eq("user_id", current_user.id)
            .order("is_favorite", desc=True)
            .order("name")
            .execute()
        )
        return response.data or []
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )


@router.get("/{template_id}", response_model=RoundTemplateResponse)
async def get_template(
    template_id: str,
    current_user: UserResponse = Depends(get_current_user),
):
    """Get a round template by ID."""
    supabase = get_supabase_client()

    try:
        response = (
            supabase.table("round_templates")
            .select("*")
            .eq("id", template_id)
            .eq("user_id", current_user.id)
            .single()
            .execute()
        )

        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Template not found",
            )

        return response.data
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )


@router.post("/", response_model=RoundTemplateResponse, status_code=status.HTTP_201_CREATED)
async def create_template(
    template: RoundTemplateCreate,
    current_user: UserResponse = Depends(get_current_user),
):
    """Create a new round template."""
    supabase = get_supabase_client()

    try:
        template_data = {
            "user_id": current_user.id,
            "name": template.name,
            "course_id": template.course_id,
            "course_name": template.course_name,
            "course_length": template.course_length,
            "game_mode": template.game_mode,
            "use_handicap": template.use_handicap,
            "handicap_percentage": template.handicap_percentage,
            "sindicato_points": template.sindicato_points,
            "team_mode": template.team_mode,
            "best_ball_points": template.best_ball_points,
            "worst_ball_points": template.worst_ball_points,
            "player_ids": template.player_ids,
            "default_tee": template.default_tee,
            "is_favorite": template.is_favorite,
        }

        response = supabase.table("round_templates").insert(template_data).execute()

        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to create template",
            )

        return response.data[0]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )


@router.put("/{template_id}", response_model=RoundTemplateResponse)
async def update_template(
    template_id: str,
    template: RoundTemplateUpdate,
    current_user: UserResponse = Depends(get_current_user),
):
    """Update a round template."""
    supabase = get_supabase_client()

    try:
        # Check ownership
        existing = (
            supabase.table("round_templates")
            .select("user_id")
            .eq("id", template_id)
            .single()
            .execute()
        )

        if not existing.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Template not found",
            )

        if existing.data["user_id"] != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied",
            )

        # Prepare update data (only include non-None values)
        update_data = {k: v for k, v in template.model_dump().items() if v is not None}

        if not update_data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No fields to update",
            )

        response = (
            supabase.table("round_templates")
            .update(update_data)
            .eq("id", template_id)
            .execute()
        )

        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Template not found",
            )

        return response.data[0]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )


@router.delete("/{template_id}")
async def delete_template(
    template_id: str,
    current_user: UserResponse = Depends(get_current_user),
):
    """Delete a round template."""
    supabase = get_supabase_client()

    try:
        # Check ownership
        existing = (
            supabase.table("round_templates")
            .select("user_id")
            .eq("id", template_id)
            .single()
            .execute()
        )

        if not existing.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Template not found",
            )

        if existing.data["user_id"] != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied",
            )

        supabase.table("round_templates").delete().eq("id", template_id).execute()

        return {"message": "Template deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )


@router.patch("/{template_id}/favorite")
async def toggle_favorite(
    template_id: str,
    current_user: UserResponse = Depends(get_current_user),
):
    """Toggle the favorite status of a template."""
    supabase = get_supabase_client()

    try:
        # Get current template
        existing = (
            supabase.table("round_templates")
            .select("user_id, is_favorite")
            .eq("id", template_id)
            .single()
            .execute()
        )

        if not existing.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Template not found",
            )

        if existing.data["user_id"] != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied",
            )

        new_favorite = not existing.data.get("is_favorite", False)

        response = (
            supabase.table("round_templates")
            .update({"is_favorite": new_favorite})
            .eq("id", template_id)
            .execute()
        )

        return {"is_favorite": new_favorite}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )
