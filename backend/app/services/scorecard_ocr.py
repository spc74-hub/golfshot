"""
Scorecard OCR Service using Claude Vision
Extracts golf course data from scorecard images
"""
import anthropic
import base64
import json
import re
from typing import Optional
from app.config import get_settings


EXTRACTION_PROMPT = """Analyze this golf scorecard image and extract ALL data in JSON format.

CRITICAL - Look carefully for these elements:
1. Course name (nombre del campo) - usually at the top
2. MULTIPLE TEE COLORS/ROWS - Each row of distances typically represents a different tee:
   - Look for colored markers (circles, squares) or color names
   - Common Spanish tee colors: Negras (black), Blancas (white), Amarillas (yellow), Azules (blue), Rojas (red)
   - Each tee should have a SLOPE and RATING (often shown as "Slope: XXX" "Valor: XX.X" or "Rating: XX.X")
   - Look for tables showing tee information with slope and rating values

3. For each hole (1-18 or 1-9):
   - Hole number
   - Par value (3, 4, or 5)
   - Handicap/Stroke Index (HCP or S.I.) - usually a number from 1-18
   - Distance for EACH tee color visible (in meters)

IMPORTANT: If you see multiple rows of numbers (distances) for each hole, each row represents a different tee color. Extract ALL of them.

Return ONLY valid JSON in this exact format:
{
  "name": "Course Name",
  "holes": 18,
  "holes_data": [
    {"number": 1, "par": 4, "handicap": 7, "distances": {"Amarillas": 350, "Blancas": 380, "Rojas": 320}},
    {"number": 2, "par": 3, "handicap": 15, "distances": {"Amarillas": 150, "Blancas": 165, "Rojas": 130}}
  ],
  "tees": [
    {"name": "Amarillas", "slope": 128, "rating": 71.5},
    {"name": "Blancas", "slope": 135, "rating": 73.2},
    {"name": "Rojas", "slope": 120, "rating": 68.0}
  ],
  "total_par": 72
}

Important rules:
- Extract ALL tee colors you can identify - scorecards often have 2-5 different tees
- If slope/rating aren't visible for a tee, estimate based on distance (longer tees = higher slope)
- Par values are 3, 4, or 5 only
- Handicap values are 1-18 for 18 holes
- Distances should be in meters
- If the scorecard shows front 9 and back 9 separately, combine them
- Return ONLY the JSON, no additional text or markdown code blocks"""


async def extract_scorecard_data(image_base64: str, media_type: str = "image/jpeg") -> dict:
    """
    Extract golf course data from a scorecard image using Claude Vision.

    Args:
        image_base64: Base64 encoded image data
        media_type: MIME type of the image (image/jpeg, image/png, etc.)

    Returns:
        Dictionary with extracted course data
    """
    settings = get_settings()

    if not settings.anthropic_api_key:
        raise ValueError("ANTHROPIC_API_KEY not configured")

    client = anthropic.Anthropic(api_key=settings.anthropic_api_key)

    message = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=4096,
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": media_type,
                            "data": image_base64,
                        },
                    },
                    {
                        "type": "text",
                        "text": EXTRACTION_PROMPT,
                    }
                ],
            }
        ],
    )

    # Extract the response text
    response_text = message.content[0].text

    # Try to parse JSON from response
    try:
        # Remove markdown code blocks if present
        json_text = response_text
        if "```json" in json_text:
            json_text = json_text.split("```json")[1].split("```")[0]
        elif "```" in json_text:
            json_text = json_text.split("```")[1].split("```")[0]

        data = json.loads(json_text.strip())
        return validate_and_normalize(data)
    except json.JSONDecodeError as e:
        raise ValueError(f"Failed to parse AI response as JSON: {e}\nResponse: {response_text[:500]}")


def validate_and_normalize(data: dict) -> dict:
    """
    Validate and normalize the extracted data to match our schema.
    """
    # Ensure required fields
    name = data.get("name", "Campo Importado")
    holes_data = data.get("holes_data", [])
    tees_data = data.get("tees", [])

    num_holes = len(holes_data) if holes_data else data.get("holes", 18)
    if num_holes not in [9, 18]:
        num_holes = 18 if num_holes > 9 else 9

    # Normalize holes data
    normalized_holes = []
    total_par = 0

    for i, hole in enumerate(holes_data[:num_holes], start=1):
        par = hole.get("par", 4)
        if par not in [3, 4, 5]:
            par = 4

        handicap = hole.get("handicap", i)
        if not (1 <= handicap <= num_holes):
            handicap = i

        # Preserve distances per tee
        distances = hole.get("distances", {})
        normalized_distances = {}
        for tee_name, dist in distances.items():
            if isinstance(dist, (int, float)) and dist > 0:
                normalized_distances[tee_name] = int(dist)

        # Get default distance from first available tee
        distance = 0
        if normalized_distances:
            distance = list(normalized_distances.values())[0]

        if distance == 0:
            distance = 350 if par == 4 else (180 if par == 3 else 480)

        total_par += par
        hole_data = {
            "number": i,
            "par": par,
            "handicap": handicap,
            "distance": distance,
        }
        # Include distances per tee if we have multiple
        if normalized_distances:
            hole_data["distances"] = normalized_distances
        normalized_holes.append(hole_data)

    # Fill missing holes with defaults
    while len(normalized_holes) < num_holes:
        i = len(normalized_holes) + 1
        normalized_holes.append({
            "number": i,
            "par": 4,
            "handicap": i,
            "distance": 350,
        })
        total_par += 4

    # Normalize tees
    normalized_tees = []
    for tee in tees_data:
        tee_name = tee.get("name", tee.get("color", "Standard"))
        slope = tee.get("slope", 113)
        rating = tee.get("rating", 72.0)

        # Validate slope (55-155)
        if not isinstance(slope, (int, float)) or slope < 55 or slope > 155:
            slope = 113

        # Validate rating (50-90)
        if not isinstance(rating, (int, float)) or rating < 50 or rating > 90:
            rating = 72.0

        normalized_tees.append({
            "name": str(tee_name),
            "slope": int(slope),
            "rating": float(rating),
        })

    # Add default tee if none found
    if not normalized_tees:
        normalized_tees = [{"name": "Standard", "slope": 113, "rating": 72.0}]

    return {
        "name": name,
        "holes": num_holes,
        "par": total_par if total_par > 0 else (72 if num_holes == 18 else 36),
        "tees": normalized_tees,
        "holes_data": normalized_holes,
    }
