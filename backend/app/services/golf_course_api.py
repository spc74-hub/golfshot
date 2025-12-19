"""
Golf Course API Integration Service
Integrates with GolfCourseAPI.com to search and fetch golf course data
"""
import httpx
from typing import Optional
from app.config import get_settings


GOLF_COURSE_API_BASE_URL = "https://api.golfcourseapi.com/v1"


async def search_courses(query: str, limit: int = 20) -> list[dict]:
    """
    Search golf courses by name or location.
    Returns a list of course summaries transformed to our expected format.
    """
    settings = get_settings()

    if not settings.golf_course_api_key:
        raise ValueError("GOLF_COURSE_API_KEY not configured")

    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"{GOLF_COURSE_API_BASE_URL}/courses",
            params={"search": query, "limit": limit},
            headers={"Authorization": f"Key {settings.golf_course_api_key}"},
            timeout=10.0,
        )
        response.raise_for_status()
        data = response.json()
        raw_courses = data.get("courses", [])

        # Transform to frontend expected format
        return [transform_search_result(course) for course in raw_courses]


def transform_search_result(api_course: dict) -> dict:
    """
    Transform API search result to frontend ExternalCourseResult format.
    Maps: club_name/course_name -> name, location.* -> top-level fields
    """
    location = api_course.get("location", {}) or {}

    # Use course_name if available, otherwise club_name
    name = api_course.get("course_name") or api_course.get("club_name") or "Unknown Course"

    return {
        "id": str(api_course.get("id", "")),
        "name": name,
        "city": location.get("city"),
        "state": location.get("state"),
        "country": location.get("country"),
        "address": location.get("address"),
        "latitude": location.get("latitude"),
        "longitude": location.get("longitude"),
    }


async def get_course_details(course_id: str) -> Optional[dict]:
    """
    Get full details for a specific course including scorecard, tees, etc.
    """
    settings = get_settings()

    if not settings.golf_course_api_key:
        raise ValueError("GOLF_COURSE_API_KEY not configured")

    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"{GOLF_COURSE_API_BASE_URL}/courses/{course_id}",
            headers={"Authorization": f"Key {settings.golf_course_api_key}"},
            timeout=10.0,
        )

        if response.status_code == 404:
            return None

        response.raise_for_status()
        return response.json()


def transform_api_course_to_local(api_course: dict) -> dict:
    """
    Transform API course data to our local schema format.
    Maps external API fields to our CourseCreate schema.
    """
    # Extract basic info
    name = api_course.get("name", "Unknown Course")

    # Get scorecard/holes data
    scorecard = api_course.get("scorecard", {})
    holes_info = api_course.get("holes", [])
    num_holes = len(holes_info) if holes_info else 18

    # Calculate total par
    total_par = 0
    holes_data = []

    for i, hole in enumerate(holes_info, start=1):
        par = hole.get("par", 4)
        handicap = hole.get("handicap", i)  # Default to hole number if no handicap
        distance = hole.get("distance", {})

        # Get distance from first available tee
        dist_value = 0
        if isinstance(distance, dict):
            for tee_dist in distance.values():
                if isinstance(tee_dist, (int, float)) and tee_dist > 0:
                    dist_value = int(tee_dist)
                    break
        elif isinstance(distance, (int, float)):
            dist_value = int(distance)

        total_par += par
        holes_data.append({
            "number": i,
            "par": par,
            "handicap": handicap if 1 <= handicap <= 18 else i,
            "distance": dist_value,
        })

    # If no holes data, create default 18 holes
    if not holes_data:
        holes_data = [
            {"number": i, "par": 4, "handicap": i, "distance": 350}
            for i in range(1, 19)
        ]
        total_par = 72
        num_holes = 18

    # Extract tees
    tees_data = api_course.get("tees", [])
    tees = []

    for tee in tees_data:
        tee_name = tee.get("name", tee.get("color", "Standard"))
        slope = tee.get("slope", tee.get("slope_rating", 113))
        rating = tee.get("rating", tee.get("course_rating", 72.0))

        # Validate slope (must be 55-155)
        if not isinstance(slope, (int, float)) or slope < 55 or slope > 155:
            slope = 113

        # Validate rating
        if not isinstance(rating, (int, float)) or rating < 50 or rating > 90:
            rating = 72.0

        tees.append({
            "name": tee_name,
            "slope": int(slope),
            "rating": float(rating),
        })

    # If no tees, create a default
    if not tees:
        tees = [{"name": "Standard", "slope": 113, "rating": 72.0}]

    return {
        "name": name,
        "holes": num_holes if num_holes in [9, 18] else 18,
        "par": total_par if total_par > 0 else 72,
        "tees": tees,
        "holes_data": holes_data,
        "external_id": api_course.get("id", ""),  # Keep reference to external API
    }
