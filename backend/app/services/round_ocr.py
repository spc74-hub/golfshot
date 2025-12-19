"""
Round OCR Service using Claude Vision
Extracts historical round data from scorecard images
"""
import anthropic
import json
from app.config import get_settings


ROUND_EXTRACTION_PROMPT = """Analyze this golf scorecard/round image and extract ALL data in JSON format.

This is a historical round scorecard from a golf app. Extract the following information:

1. COURSE INFORMATION:
   - Course name (nombre del campo)
   - Location if visible
   - Tee played (color/name) with slope and rating if visible

2. ROUND INFORMATION:
   - Date of the round (format: YYYY-MM-DD)
   - Player name

3. SCORES - For each hole (1-18 or 1-9):
   - Hole number
   - Par value
   - Handicap/Stroke Index (if visible)
   - Strokes taken (the actual score)
   - Net score (if shown)
   - Stableford points (if shown)

4. COURSE DATA (if visible):
   - Distance for each hole
   - Par for each hole
   - Handicap for each hole

Return ONLY valid JSON in this exact format:
{
  "course": {
    "name": "Course Name",
    "location": "City, Country",
    "tee_played": {
      "name": "Yellow",
      "slope": 125,
      "rating": 69.7
    }
  },
  "round": {
    "date": "2025-11-23",
    "player_name": "Player Name",
    "handicap_index": 14.2
  },
  "holes_data": [
    {"number": 1, "par": 5, "handicap": 8, "strokes": 6, "distance": 492},
    {"number": 2, "par": 3, "handicap": 18, "strokes": 2, "distance": 126}
  ],
  "totals": {
    "strokes": 86,
    "par": 71,
    "stableford_points": 35
  }
}

Important rules:
- Extract the ACTUAL strokes taken by the player for each hole
- If you see colored cells (green=birdie, blue/grey=par, red=bogey+), use that to validate scores
- Par values are 3, 4, or 5 only
- Handicap values are 1-18 for 18 holes
- Distances should be in meters
- If date format is different, convert to YYYY-MM-DD
- Return ONLY the JSON, no additional text or markdown code blocks"""


async def extract_round_data(image_base64: str, media_type: str = "image/jpeg") -> dict:
    """
    Extract historical round data from a scorecard image using Claude Vision.

    Args:
        image_base64: Base64 encoded image data
        media_type: MIME type of the image (image/jpeg, image/png, etc.)

    Returns:
        Dictionary with extracted round data
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
                        "text": ROUND_EXTRACTION_PROMPT,
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
        return validate_and_normalize_round(data)
    except json.JSONDecodeError as e:
        raise ValueError(f"Failed to parse AI response as JSON: {e}\nResponse: {response_text[:500]}")


def validate_and_normalize_round(data: dict) -> dict:
    """
    Validate and normalize the extracted round data.
    """
    # Course info
    course_data = data.get("course", {})
    course_name = course_data.get("name", "Campo Importado")
    course_location = course_data.get("location", "")

    tee_played = course_data.get("tee_played", {})
    tee_name = tee_played.get("name", "Standard")
    tee_slope = tee_played.get("slope", 113)
    tee_rating = tee_played.get("rating", 72.0)

    # Validate slope (55-155)
    if not isinstance(tee_slope, (int, float)) or tee_slope < 55 or tee_slope > 155:
        tee_slope = 113

    # Validate rating (50-90)
    if not isinstance(tee_rating, (int, float)) or tee_rating < 50 or tee_rating > 90:
        tee_rating = 72.0

    # Round info
    round_data = data.get("round", {})
    round_date = round_data.get("date", "")
    player_name = round_data.get("player_name", "Jugador")
    handicap_index = round_data.get("handicap_index", 24.0)

    if not isinstance(handicap_index, (int, float)) or handicap_index < 0 or handicap_index > 54:
        handicap_index = 24.0

    # Holes data
    holes_data = data.get("holes_data", [])
    num_holes = len(holes_data)
    if num_holes not in [9, 18]:
        num_holes = 18 if num_holes > 9 else 9

    normalized_holes = []
    total_strokes = 0
    total_par = 0

    for i, hole in enumerate(holes_data[:num_holes], start=1):
        par = hole.get("par", 4)
        if par not in [3, 4, 5]:
            par = 4

        handicap = hole.get("handicap", i)
        if not (1 <= handicap <= num_holes):
            handicap = i

        strokes = hole.get("strokes", par)
        if not isinstance(strokes, (int, float)) or strokes < 1:
            strokes = par
        strokes = int(strokes)

        distance = hole.get("distance", 0)
        if not isinstance(distance, (int, float)) or distance < 0:
            distance = 350 if par == 4 else (180 if par == 3 else 480)
        distance = int(distance)

        total_strokes += strokes
        total_par += par

        normalized_holes.append({
            "number": i,
            "par": par,
            "handicap": handicap,
            "strokes": strokes,
            "distance": distance,
        })

    # Fill missing holes with defaults if needed
    while len(normalized_holes) < num_holes:
        i = len(normalized_holes) + 1
        par = 4
        normalized_holes.append({
            "number": i,
            "par": par,
            "handicap": i,
            "strokes": par,
            "distance": 350,
        })
        total_strokes += par
        total_par += par

    # Totals
    totals = data.get("totals", {})
    stableford_points = totals.get("stableford_points", 0)

    return {
        "course": {
            "name": course_name,
            "location": course_location,
            "tee_played": {
                "name": tee_name,
                "slope": int(tee_slope),
                "rating": float(tee_rating),
            }
        },
        "round": {
            "date": round_date,
            "player_name": player_name,
            "handicap_index": float(handicap_index),
        },
        "holes": num_holes,
        "holes_data": normalized_holes,
        "totals": {
            "strokes": total_strokes,
            "par": total_par,
            "stableford_points": stableford_points,
        }
    }
