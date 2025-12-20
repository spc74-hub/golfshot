from fastapi import APIRouter, HTTPException, status, Depends, UploadFile, File
from app.models.schemas import CourseCreate, CourseUpdate, CourseResponse, UserResponse
from app.services.supabase import get_supabase_client
from app.dependencies import get_current_user, get_admin_user
from app.services.scorecard_ocr import extract_scorecard_data
from app.config import get_settings
import base64

router = APIRouter(prefix="/courses", tags=["courses"])

# Initial courses data for migration
INITIAL_COURSES = [
    {
        "name": "Club de Campo Villa de Madrid (Negro)",
        "holes": 18,
        "par": 71,
        "tees": [
            {"name": "Blancas", "slope": 135, "rating": 72.5},
            {"name": "Amarillas", "slope": 132, "rating": 71.0},
            {"name": "Azules", "slope": 128, "rating": 69.5},
            {"name": "Rojas", "slope": 125, "rating": 68.0},
        ],
        "holes_data": [
            {"number": 1, "par": 4, "handicap": 7, "distance": 375},
            {"number": 2, "par": 4, "handicap": 11, "distance": 345},
            {"number": 3, "par": 3, "handicap": 17, "distance": 165},
            {"number": 4, "par": 5, "handicap": 1, "distance": 495},
            {"number": 5, "par": 4, "handicap": 9, "distance": 380},
            {"number": 6, "par": 4, "handicap": 5, "distance": 390},
            {"number": 7, "par": 3, "handicap": 15, "distance": 175},
            {"number": 8, "par": 4, "handicap": 13, "distance": 340},
            {"number": 9, "par": 4, "handicap": 3, "distance": 405},
            {"number": 10, "par": 4, "handicap": 8, "distance": 365},
            {"number": 11, "par": 3, "handicap": 16, "distance": 155},
            {"number": 12, "par": 5, "handicap": 2, "distance": 510},
            {"number": 13, "par": 4, "handicap": 10, "distance": 370},
            {"number": 14, "par": 4, "handicap": 6, "distance": 385},
            {"number": 15, "par": 3, "handicap": 18, "distance": 145},
            {"number": 16, "par": 5, "handicap": 4, "distance": 485},
            {"number": 17, "par": 4, "handicap": 12, "distance": 350},
            {"number": 18, "par": 4, "handicap": 14, "distance": 360},
        ],
    },
    {
        "name": "Real Club de Golf El Prat (Rosa)",
        "holes": 18,
        "par": 72,
        "tees": [
            {"name": "Blancas", "slope": 138, "rating": 73.5},
            {"name": "Amarillas", "slope": 134, "rating": 71.8},
            {"name": "Rojas", "slope": 126, "rating": 68.2},
        ],
        "holes_data": [
            {"number": 1, "par": 4, "handicap": 9, "distance": 365},
            {"number": 2, "par": 5, "handicap": 5, "distance": 505},
            {"number": 3, "par": 3, "handicap": 17, "distance": 160},
            {"number": 4, "par": 4, "handicap": 1, "distance": 420},
            {"number": 5, "par": 4, "handicap": 11, "distance": 355},
            {"number": 6, "par": 4, "handicap": 7, "distance": 385},
            {"number": 7, "par": 3, "handicap": 15, "distance": 180},
            {"number": 8, "par": 5, "handicap": 3, "distance": 520},
            {"number": 9, "par": 4, "handicap": 13, "distance": 370},
            {"number": 10, "par": 4, "handicap": 10, "distance": 375},
            {"number": 11, "par": 4, "handicap": 2, "distance": 410},
            {"number": 12, "par": 3, "handicap": 18, "distance": 150},
            {"number": 13, "par": 5, "handicap": 6, "distance": 495},
            {"number": 14, "par": 4, "handicap": 8, "distance": 380},
            {"number": 15, "par": 4, "handicap": 4, "distance": 395},
            {"number": 16, "par": 3, "handicap": 16, "distance": 170},
            {"number": 17, "par": 5, "handicap": 12, "distance": 485},
            {"number": 18, "par": 4, "handicap": 14, "distance": 360},
        ],
    },
    {
        "name": "Las Lomas Bosque",
        "holes": 18,
        "par": 72,
        "tees": [
            {"name": "Negras", "slope": 135, "rating": 73.0},
            {"name": "Blancas", "slope": 132, "rating": 71.5},
            {"name": "Amarillas", "slope": 128, "rating": 69.8},
            {"name": "Azules", "slope": 126, "rating": 68.5},
            {"name": "Rojas", "slope": 123, "rating": 67.0},
        ],
        "holes_data": [
            {"number": 1, "par": 4, "handicap": 5, "distance": 380},
            {"number": 2, "par": 3, "handicap": 15, "distance": 165},
            {"number": 3, "par": 5, "handicap": 1, "distance": 510},
            {"number": 4, "par": 4, "handicap": 9, "distance": 360},
            {"number": 5, "par": 4, "handicap": 7, "distance": 375},
            {"number": 6, "par": 3, "handicap": 17, "distance": 155},
            {"number": 7, "par": 5, "handicap": 3, "distance": 495},
            {"number": 8, "par": 4, "handicap": 11, "distance": 350},
            {"number": 9, "par": 4, "handicap": 13, "distance": 365},
            {"number": 10, "par": 4, "handicap": 6, "distance": 385},
            {"number": 11, "par": 3, "handicap": 16, "distance": 170},
            {"number": 12, "par": 5, "handicap": 2, "distance": 520},
            {"number": 13, "par": 4, "handicap": 10, "distance": 355},
            {"number": 14, "par": 4, "handicap": 4, "distance": 400},
            {"number": 15, "par": 3, "handicap": 18, "distance": 145},
            {"number": 16, "par": 5, "handicap": 8, "distance": 480},
            {"number": 17, "par": 4, "handicap": 12, "distance": 370},
            {"number": 18, "par": 4, "handicap": 14, "distance": 345},
        ],
    },
    {
        "name": "La Faisanera",
        "holes": 18,
        "par": 71,
        "tees": [
            {"name": "Amarillas", "slope": 125, "rating": 69.5},
        ],
        "holes_data": [
            {"number": 1, "par": 4, "handicap": 11, "distance": 340},
            {"number": 2, "par": 4, "handicap": 3, "distance": 385},
            {"number": 3, "par": 3, "handicap": 17, "distance": 150},
            {"number": 4, "par": 5, "handicap": 7, "distance": 470},
            {"number": 5, "par": 4, "handicap": 1, "distance": 395},
            {"number": 6, "par": 4, "handicap": 9, "distance": 355},
            {"number": 7, "par": 3, "handicap": 15, "distance": 165},
            {"number": 8, "par": 4, "handicap": 5, "distance": 375},
            {"number": 9, "par": 5, "handicap": 13, "distance": 455},
            {"number": 10, "par": 4, "handicap": 10, "distance": 350},
            {"number": 11, "par": 3, "handicap": 18, "distance": 140},
            {"number": 12, "par": 4, "handicap": 2, "distance": 390},
            {"number": 13, "par": 4, "handicap": 8, "distance": 365},
            {"number": 14, "par": 5, "handicap": 6, "distance": 485},
            {"number": 15, "par": 3, "handicap": 16, "distance": 155},
            {"number": 16, "par": 4, "handicap": 4, "distance": 380},
            {"number": 17, "par": 4, "handicap": 12, "distance": 345},
            {"number": 18, "par": 4, "handicap": 14, "distance": 335},
        ],
    },
]


@router.get("/", response_model=list[CourseResponse])
async def list_courses(current_user: UserResponse = Depends(get_current_user)):
    """List all courses."""
    supabase = get_supabase_client()

    try:
        response = supabase.table("courses").select("*").order("name").execute()
        return response.data or []
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )


@router.get("/{course_id}", response_model=CourseResponse)
async def get_course(
    course_id: str,
    current_user: UserResponse = Depends(get_current_user),
):
    """Get course by ID."""
    supabase = get_supabase_client()

    try:
        response = supabase.table("courses").select("*").eq("id", course_id).single().execute()

        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Course not found",
            )

        return response.data
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )


@router.post("/", response_model=CourseResponse, status_code=status.HTTP_201_CREATED)
async def create_course(
    course: CourseCreate,
    admin_user: UserResponse = Depends(get_admin_user),
):
    """Create a new course (admin only)."""
    supabase = get_supabase_client()

    try:
        response = supabase.table("courses").insert(course.model_dump()).execute()

        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to create course",
            )

        return response.data[0]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )


@router.put("/{course_id}", response_model=CourseResponse)
async def update_course(
    course_id: str,
    course: CourseUpdate,
    current_user: UserResponse = Depends(get_current_user),
):
    """Update a course."""
    supabase = get_supabase_client()

    try:
        update_data = {k: v for k, v in course.model_dump().items() if v is not None}

        if not update_data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No fields to update",
            )

        response = supabase.table("courses").update(update_data).eq("id", course_id).execute()

        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Course not found",
            )

        return response.data[0]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )


@router.get("/{course_id}/rounds-count")
async def get_course_rounds_count(
    course_id: str,
    current_user: UserResponse = Depends(get_current_user),
):
    """Get the count of rounds associated with a course."""
    supabase = get_supabase_client()

    try:
        response = supabase.table("rounds").select("id", count="exact").eq("course_id", course_id).execute()
        return {"count": response.count or 0}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )


@router.get("/{course_id}/rounds")
async def get_course_rounds(
    course_id: str,
    current_user: UserResponse = Depends(get_current_user),
):
    """Get all rounds associated with a course."""
    supabase = get_supabase_client()

    try:
        response = (
            supabase.table("rounds")
            .select("id, round_date, players, is_finished, course_length, game_mode")
            .eq("course_id", course_id)
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


@router.delete("/{course_id}")
async def delete_course(
    course_id: str,
    current_user: UserResponse = Depends(get_current_user),
):
    """Delete a course."""
    supabase = get_supabase_client()

    try:
        response = supabase.table("courses").delete().eq("id", course_id).execute()

        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Course not found",
            )

        return {"message": "Course deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )


@router.post("/migrate")
async def migrate_courses(admin_user: UserResponse = Depends(get_admin_user)):
    """Migrate initial courses data (admin only)."""
    supabase = get_supabase_client()

    try:
        # Check if courses already exist
        existing = supabase.table("courses").select("name").execute()
        existing_names = {c["name"] for c in existing.data} if existing.data else set()

        migrated = []
        skipped = []

        for course in INITIAL_COURSES:
            if course["name"] in existing_names:
                skipped.append(course["name"])
                continue

            response = supabase.table("courses").insert(course).execute()
            if response.data:
                migrated.append(course["name"])

        return {
            "message": "Migration completed",
            "migrated": migrated,
            "skipped": skipped,
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )


# ============================================
# Scorecard Image OCR - Extract course from image
# ============================================

@router.post("/from-image/extract")
async def extract_course_from_image(
    file: UploadFile = File(..., description="Scorecard image (JPEG, PNG)"),
    current_user: UserResponse = Depends(get_current_user),
):
    """
    Extract golf course data from a scorecard image using AI vision.
    Returns the extracted data for review before saving.
    """
    settings = get_settings()

    if not settings.anthropic_api_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI service not configured. Please add ANTHROPIC_API_KEY to .env",
        )

    # Validate file type
    allowed_types = ["image/jpeg", "image/png", "image/webp", "image/gif"]
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid file type. Allowed: {', '.join(allowed_types)}",
        )

    # Check file size (max 10MB)
    contents = await file.read()
    if len(contents) > 10 * 1024 * 1024:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File too large. Maximum size is 10MB",
        )

    try:
        # Convert to base64
        image_base64 = base64.standard_b64encode(contents).decode("utf-8")

        # Extract data using Claude Vision
        extracted_data = await extract_scorecard_data(image_base64, file.content_type)

        return {
            "success": True,
            "message": "Data extracted successfully. Review and confirm to save.",
            "course_data": extracted_data,
        }

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e),
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error processing image: {str(e)}",
        )


@router.post("/from-image/save", response_model=CourseResponse)
async def save_extracted_course(
    course_data: CourseCreate,
    current_user: UserResponse = Depends(get_current_user),
):
    """
    Save an extracted course to the database.
    Called after reviewing the extracted data from /from-image/extract.
    """
    supabase = get_supabase_client()

    try:
        # Check if course already exists by name
        existing = supabase.table("courses").select("*").eq("name", course_data.name).execute()

        if existing.data and len(existing.data) > 0:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"A course named '{course_data.name}' already exists",
            )

        # Insert new course
        response = supabase.table("courses").insert(course_data.model_dump()).execute()

        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to save course",
            )

        return response.data[0]

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )
