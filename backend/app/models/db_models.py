import uuid
from datetime import datetime, date
from sqlalchemy import (
    Column, String, Integer, BigInteger, Float, Boolean, Text, Date,
    DateTime, ForeignKey, JSON, CheckConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.database import Base


def gen_uuid():
    return str(uuid.uuid4())


class Profile(Base):
    __tablename__ = "profiles"

    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    email = Column(String, unique=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    display_name = Column(Text, nullable=True)
    role = Column(String, default="user")
    status = Column(String, default="active")
    permissions = Column(JSON, default=list)
    linked_player_id = Column(UUID(as_uuid=False), nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    rounds = relationship("Round", back_populates="user", cascade="all, delete-orphan")
    saved_players = relationship("SavedPlayer", back_populates="user", cascade="all, delete-orphan")
    round_templates = relationship("RoundTemplate", back_populates="user", cascade="all, delete-orphan")
    handicap_history = relationship("HandicapHistory", back_populates="user", cascade="all, delete-orphan")


class Course(Base):
    __tablename__ = "courses"

    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    name = Column(Text, nullable=False)
    holes = Column(Integer, nullable=False)
    par = Column(Integer, nullable=False)
    tees = Column(JSON, nullable=False)
    holes_data = Column(JSON, nullable=False)
    is_favorite = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)


class Round(Base):
    __tablename__ = "rounds"

    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    user_id = Column(UUID(as_uuid=False), ForeignKey("profiles.id", ondelete="CASCADE"), nullable=False)
    od_id = Column(BigInteger, nullable=False)
    od_user_id = Column(String, nullable=False)
    course_id = Column(UUID(as_uuid=False), ForeignKey("courses.id", ondelete="SET NULL"), nullable=True)
    course_name = Column(Text, nullable=False)
    round_date = Column(String, nullable=False)  # ISO date string
    course_length = Column(String, nullable=False)
    game_mode = Column(String, nullable=False)
    use_handicap = Column(Boolean, default=True)
    handicap_percentage = Column(Integer, default=100)
    sindicato_points = Column(JSON, nullable=True)
    team_mode = Column(String, nullable=True)
    best_ball_points = Column(Integer, nullable=True)
    worst_ball_points = Column(Integer, nullable=True)
    current_hole = Column(Integer, default=1)
    completed_holes = Column(JSON, default=list)
    players = Column(JSON, nullable=False)
    is_finished = Column(Boolean, default=False)
    is_imported = Column(Boolean, default=False)
    virtual_handicap = Column(Float, nullable=True)
    share_code = Column(String(6), nullable=True, unique=True)
    collaborators = Column(JSON, default=list)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    user = relationship("Profile", back_populates="rounds")


class SavedPlayer(Base):
    __tablename__ = "saved_players"

    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    user_id = Column(UUID(as_uuid=False), ForeignKey("profiles.id", ondelete="CASCADE"), nullable=False)
    name = Column(Text, nullable=False)
    handicap_index = Column(Float, default=24.0)
    preferred_tee = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    user = relationship("Profile", back_populates="saved_players")


class RoundTemplate(Base):
    __tablename__ = "round_templates"

    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    user_id = Column(UUID(as_uuid=False), ForeignKey("profiles.id", ondelete="CASCADE"), nullable=False)
    name = Column(Text, nullable=False)
    course_id = Column(UUID(as_uuid=False), nullable=True)
    course_name = Column(Text, nullable=True)
    course_length = Column(String, nullable=True)
    game_mode = Column(String, nullable=False)
    use_handicap = Column(Boolean, default=True)
    handicap_percentage = Column(Integer, default=100)
    sindicato_points = Column(JSON, nullable=True)
    team_mode = Column(String, nullable=True)
    best_ball_points = Column(Integer, nullable=True)
    worst_ball_points = Column(Integer, nullable=True)
    player_ids = Column(JSON, default=list)
    default_tee = Column(Text, nullable=True)
    is_favorite = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    user = relationship("Profile", back_populates="round_templates")


class HandicapHistory(Base):
    __tablename__ = "handicap_history"

    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    user_id = Column(UUID(as_uuid=False), ForeignKey("profiles.id", ondelete="CASCADE"), nullable=False)
    handicap_index = Column(Float, nullable=False)
    effective_date = Column(String, nullable=False)  # ISO date string
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)

    # Relationships
    user = relationship("Profile", back_populates="handicap_history")
