from pydantic import BaseModel, EmailStr, Field
from typing import Optional, Literal
from datetime import datetime


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
    role: Literal["user", "admin"] = "user"
    status: Literal["active", "disabled"] = "active"
    created_at: datetime
    updated_at: datetime


class UserUpdate(BaseModel):
    display_name: Optional[str] = None
    role: Optional[Literal["user", "admin"]] = None
    status: Optional[Literal["active", "disabled"]] = None


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


class CourseUpdate(BaseModel):
    name: Optional[str] = None
    holes: Optional[Literal[9, 18]] = None
    par: Optional[int] = Field(default=None, ge=27, le=80)
    tees: Optional[list[Tee]] = None
    holes_data: Optional[list[HoleData]] = None


class CourseResponse(BaseModel):
    id: str
    name: str
    holes: int
    par: int
    tees: list[Tee]
    holes_data: list[HoleData]
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
    game_mode: Literal["stableford", "stroke", "sindicato", "team"]
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
    game_mode: Literal["stableford", "stroke", "sindicato", "team"]
    use_handicap: bool
    handicap_percentage: int
    sindicato_points: Optional[list[int]] = None
    team_mode: Optional[Literal["bestBall", "goodBadBall"]] = None
    best_ball_points: Optional[int] = None
    worst_ball_points: Optional[int] = None
    current_hole: int
    completed_holes: list[int]
    players: list[PlayerResponse]
    created_at: datetime
    updated_at: datetime


# Admin stats schema
class AdminStats(BaseModel):
    total_users: int
    total_rounds: int
    rounds_this_month: int
    total_courses: int
