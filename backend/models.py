"""Pydantic models and shared constants."""
import re
from typing import Literal, Optional

from pydantic import BaseModel, field_validator, model_validator

DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"]
Day = Literal["Mon", "Tue", "Wed", "Thu", "Fri"]

# 24h "HH:MM", e.g. "09:05" or "17:30"
TIME_RE = r"^([01]\d|2[0-3]):[0-5]\d$"


class ClassIn(BaseModel):
    """Payload for creating a class (everything except the id)."""

    course_code: str
    course_name: str
    instructor: str
    room: str
    building: str
    days: list[Day]
    start_time: str
    end_time: str

    @field_validator("course_code", "course_name", "instructor", "room", "building")
    @classmethod
    def not_blank(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("must not be empty")
        return v

    @field_validator("course_code", "room")
    @classmethod
    def upper(cls, v: str) -> str:
        return v.upper()

    @field_validator("days")
    @classmethod
    def clean_days(cls, v: list[str]) -> list[str]:
        if not v:
            raise ValueError("select at least one day")
        # De-duplicate and put in week order
        return [d for d in DAYS if d in v]

    @field_validator("start_time", "end_time")
    @classmethod
    def valid_time(cls, v: str) -> str:
        if not re.match(TIME_RE, v):
            raise ValueError('must be 24h time formatted "HH:MM"')
        return v

    @model_validator(mode="after")
    def end_after_start(self):
        if self.start_time >= self.end_time:  # zero-padded, so string compare works
            raise ValueError("end_time must be after start_time")
        return self


class ClassOut(ClassIn):
    id: int


class Room(BaseModel):
    room: str
    building: str


class FreeRoom(Room):
    # Start of the room's next class later that day, or None if it stays free
    next_class_start: Optional[str] = None
    next_course: Optional[str] = None
