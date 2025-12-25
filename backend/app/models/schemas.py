from pydantic import BaseModel, EmailStr, Field
from typing import Optional, Literal
from datetime import datetime


# Permission types
Permission = Literal[
    "rounds.create",
    "rounds.import",
    "courses.create",
    "courses.edit",
    "players.manage"
]

# Role types
Role = Literal["user", "admin", "owner"]


# Auth schemas
class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    display_name: Optional[str] = None


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: "UserResponse"


# User schemas
class UserResponse(BaseModel):
    id: str
    email: str
    display_name: Optional[str] = None
    role: Role = "user"
    status: Literal["active", "disabled"] = "active"
    permissions: list[str] = []
    linked_player_id: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class UserUpdate(BaseModel):
    display_name: Optional[str] = None
    role: Optional[Role] = None
    status: Optional[Literal["active", "disabled"]] = None
    permissions: Optional[list[str]] = None
    linked_player_id: Optional[str] = None


class UserPermissionsUpdate(BaseModel):
    """Schema for updating user permissions (owner only)"""
    permissions: list[str]


class UserWithStats(BaseModel):
    """Extended user info with stats for owner panel"""
    id: str
    email: str
    display_name: Optional[str] = None
    role: Role = "user"
    status: Literal["active", "disabled"] = "active"
    permissions: list[str] = []
    linked_player_id: Optional[str] = None
    linked_player_name: Optional[str] = None
    total_rounds: int = 0
    created_at: datetime
    updated_at: datetime


# Tee schema
class Tee(BaseModel):
    name: str
    slope: int = Field(ge=55, le=155)
    rating: float


# HoleData schema
class HoleData(BaseModel):
    number: int = Field(ge=1, le=18)
    par: Literal[3, 4, 5]
    handicap: int = Field(ge=1, le=18)
    distance: int = Field(ge=0)


# Course schemas
class CourseCreate(BaseModel):
    name: str
    holes: Literal[9, 18]
    par: int = Field(ge=27, le=80)
    tees: list[Tee]
    holes_data: list[HoleData]
    is_favorite: bool = False


class CourseUpdate(BaseModel):
    name: Optional[str] = None
    holes: Optional[Literal[9, 18]] = None
    par: Optional[int] = Field(default=None, ge=27, le=80)
    tees: Optional[list[Tee]] = None
    holes_data: Optional[list[HoleData]] = None
    is_favorite: Optional[bool] = None


class CourseResponse(BaseModel):
    id: str
    name: str
    holes: int
    par: int
    tees: list[Tee]
    holes_data: list[HoleData]
    is_favorite: bool = False
    created_at: datetime
    updated_at: datetime


# Score schema
class Score(BaseModel):
    strokes: int = Field(ge=1)
    putts: int = Field(ge=0)


# Player schema
class PlayerCreate(BaseModel):
    name: str
    od_handicap_index: float = Field(ge=0, le=54, default=24.0)
    tee_box: str
    team: Optional[Literal["A", "B"]] = None
    playing_handicap: Optional[int] = None  # HDJ - Can be set manually


class PlayerResponse(BaseModel):
    id: str
    name: str
    od_handicap_index: float
    tee_box: str
    team: Optional[Literal["A", "B"]] = None
    playing_handicap: int
    scores: dict[str, Score] = {}  # Keys are strings in JSON, we'll handle conversion


# Round schemas
class RoundCreate(BaseModel):
    course_id: str
    course_name: str
    round_date: str
    course_length: Literal["18", "front9", "back9"]
    game_mode: Literal["stableford", "stroke", "sindicato", "team", "matchplay"]
    use_handicap: bool = True
    handicap_percentage: Literal[100, 75] = 100
    sindicato_points: Optional[list[int]] = None
    team_mode: Optional[Literal["bestBall", "goodBadBall"]] = None
    best_ball_points: Optional[int] = None
    worst_ball_points: Optional[int] = None
    players: list[PlayerCreate]


class RoundUpdate(BaseModel):
    current_hole: Optional[int] = None
    completed_holes: Optional[list[int]] = None
    players: Optional[list[PlayerResponse]] = None
    is_finished: Optional[bool] = None
    share_enabled: Optional[bool] = None  # Enable/disable sharing


class RoundResponse(BaseModel):
    id: str
    od_id: int
    od_user_id: str
    is_finished: bool
    is_imported: Optional[bool] = False
    course_id: Optional[str] = None
    course_name: Optional[str] = None
    round_date: str
    course_length: Literal["18", "front9", "back9"]
    game_mode: Literal["stableford", "stroke", "sindicato", "team", "matchplay"]
    use_handicap: bool
    handicap_percentage: int
    sindicato_points: Optional[list[int]] = None
    team_mode: Optional[Literal["bestBall", "goodBadBall"]] = None
    best_ball_points: Optional[int] = None
    worst_ball_points: Optional[int] = None
    current_hole: int
    completed_holes: list[int]
    players: list[PlayerResponse]
    # Virtual Handicap for this round (calculated from Stableford points)
    # HV = Handicap Index - (Stableford Points - 36) for 18 holes
    virtual_handicap: Optional[float] = None
    # Shared round fields
    share_code: Optional[str] = None
    collaborators: list[str] = []
    is_owner: bool = True  # True if current user is the round owner
    created_at: datetime
    updated_at: datetime


class JoinRoundRequest(BaseModel):
    """Request to join a shared round by code"""
    share_code: str = Field(min_length=6, max_length=6)


class JoinRoundResponse(BaseModel):
    """Response after joining a shared round"""
    round_id: str
    message: str


# Admin stats schema
class AdminStats(BaseModel):
    total_users: int
    total_rounds: int
    rounds_this_month: int
    total_courses: int


# Saved Player schemas (for player management)
class SavedPlayerCreate(BaseModel):
    name: str
    handicap_index: float = Field(ge=0, le=54, default=24.0)
    preferred_tee: Optional[str] = None


class SavedPlayerUpdate(BaseModel):
    name: Optional[str] = None
    handicap_index: Optional[float] = Field(default=None, ge=0, le=54)
    preferred_tee: Optional[str] = None


class SavedPlayerResponse(BaseModel):
    id: str
    user_id: str
    name: str
    handicap_index: float
    preferred_tee: Optional[str] = None
    created_at: datetime
    updated_at: datetime


# User Statistics schemas
class UserStats(BaseModel):
    total_rounds: int
    rounds_this_month: int = 0  # Rounds completed this month
    user_handicap_index: Optional[float] = None  # User's official handicap index
    avg_strokes_par3: Optional[float] = None
    avg_strokes_par4: Optional[float] = None
    avg_strokes_par5: Optional[float] = None
    avg_putts_per_round: Optional[float] = None
    avg_putts_9holes: Optional[float] = None
    avg_putts_18holes: Optional[float] = None
    avg_strokes_9holes: Optional[float] = None
    avg_strokes_18holes: Optional[float] = None
    avg_stableford_points: Optional[float] = None  # Normalized to 18-hole equivalent
    # HVP - Handicap Virtual Promedio (average Stableford points, 9-hole mirrored)
    hvp_total: Optional[float] = None  # All-time average
    hvp_month: Optional[float] = None  # Current month average
    hvp_quarter: Optional[float] = None  # Current quarter average
    hvp_year: Optional[float] = None  # Current year average
    # Best round for 18 holes
    best_round_score: Optional[int] = None
    best_round_date: Optional[str] = None
    best_round_course: Optional[str] = None
    # Best round for 9 holes
    best_round_9_score: Optional[int] = None
    best_round_9_date: Optional[str] = None
    best_round_9_course: Optional[str] = None
    # Score distribution (percentage of each result type)
    eagles_or_better_pct: Optional[float] = None
    birdies_pct: Optional[float] = None
    pars_pct: Optional[float] = None
    bogeys_pct: Optional[float] = None
    double_bogeys_pct: Optional[float] = None
    triple_or_worse_pct: Optional[float] = None
    # GIR (Green in Regulation) percentage
    gir_pct: Optional[float] = None


# Round Template schemas (Plantillas de Partida)
class RoundTemplateCreate(BaseModel):
    name: str
    course_id: Optional[str] = None
    course_name: Optional[str] = None
    course_length: Optional[Literal["18", "front9", "back9"]] = None
    game_mode: Literal["stableford", "stroke", "sindicato", "team", "matchplay"]
    use_handicap: bool = True
    handicap_percentage: Literal[100, 75] = 100
    sindicato_points: Optional[list[int]] = None
    team_mode: Optional[Literal["bestBall", "goodBadBall"]] = None
    best_ball_points: Optional[int] = None
    worst_ball_points: Optional[int] = None
    player_ids: list[str] = []  # List of saved_player IDs
    default_tee: Optional[str] = None
    is_favorite: bool = False


class RoundTemplateUpdate(BaseModel):
    name: Optional[str] = None
    course_id: Optional[str] = None
    course_name: Optional[str] = None
    course_length: Optional[Literal["18", "front9", "back9"]] = None
    game_mode: Optional[Literal["stableford", "stroke", "sindicato", "team", "matchplay"]] = None
    use_handicap: Optional[bool] = None
    handicap_percentage: Optional[Literal[100, 75]] = None
    sindicato_points: Optional[list[int]] = None
    team_mode: Optional[Literal["bestBall", "goodBadBall"]] = None
    best_ball_points: Optional[int] = None
    worst_ball_points: Optional[int] = None
    player_ids: Optional[list[str]] = None
    default_tee: Optional[str] = None
    is_favorite: Optional[bool] = None


class RoundTemplateResponse(BaseModel):
    id: str
    user_id: str
    name: str
    course_id: Optional[str] = None
    course_name: Optional[str] = None
    course_length: Optional[Literal["18", "front9", "back9"]] = None
    game_mode: Literal["stableford", "stroke", "sindicato", "team", "matchplay"]
    use_handicap: bool
    handicap_percentage: int
    sindicato_points: Optional[list[int]] = None
    team_mode: Optional[Literal["bestBall", "goodBadBall"]] = None
    best_ball_points: Optional[int] = None
    worst_ball_points: Optional[int] = None
    player_ids: list[str] = []
    default_tee: Optional[str] = None
    is_favorite: bool = False
    created_at: datetime
    updated_at: datetime


# Handicap History schemas
class HandicapHistoryCreate(BaseModel):
    handicap_index: float = Field(ge=-10, le=54)
    effective_date: str  # ISO date string (YYYY-MM-DD)
    notes: Optional[str] = None


class HandicapHistoryUpdate(BaseModel):
    handicap_index: Optional[float] = Field(default=None, ge=-10, le=54)
    effective_date: Optional[str] = None
    notes: Optional[str] = None


class HandicapHistoryResponse(BaseModel):
    id: str
    user_id: str
    handicap_index: float
    effective_date: str
    notes: Optional[str] = None
    created_at: datetime


# Stats request with filters
class StatsFilters(BaseModel):
    """Filters for statistics calculation"""
    period: Optional[Literal["1m", "3m", "6m", "1y", "all"]] = "all"
    year: Optional[int] = None  # Specific year (2025, 2024, etc.)
    course_id: Optional[str] = None
    course_length: Optional[Literal["9", "18", "all"]] = "all"


class StatsComparison(BaseModel):
    """Compare stats between two periods"""
    period1: StatsFilters
    period2: StatsFilters


class UserStatsExtended(UserStats):
    """Extended stats with target strokes calculation"""
    # Target strokes based on HI + Slope + CR
    avg_target_strokes_9holes: Optional[float] = None
    avg_target_strokes_18holes: Optional[float] = None
    # Gap between actual and target
    strokes_gap_9holes: Optional[float] = None  # Actual - Target
    strokes_gap_18holes: Optional[float] = None
    # Period info
    period_label: Optional[str] = None
    rounds_in_period: int = 0


class StatsComparisonResponse(BaseModel):
    """Response for comparing stats between two periods"""
    period1: UserStatsExtended
    period2: UserStatsExtended
    # Differences (period1 - period2, negative = improvement)
    diff_avg_strokes_9holes: Optional[float] = None
    diff_avg_strokes_18holes: Optional[float] = None
    diff_hvp_total: Optional[float] = None
    diff_gir_pct: Optional[float] = None
    diff_avg_putts_per_round: Optional[float] = None
    diff_strokes_gap_9holes: Optional[float] = None
    diff_strokes_gap_18holes: Optional[float] = None
