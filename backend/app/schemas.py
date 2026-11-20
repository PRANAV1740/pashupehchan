"""Pydantic request/response schemas."""
from __future__ import annotations

from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field


class HouseholdCreate(BaseModel):
    name: str
    village: str | None = None


class HouseholdOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    name: str
    village: str | None
    share_code: str
    created_at: datetime


class AnimalCreate(BaseModel):
    household_id: str
    name: str
    species: str = "cattle"
    approx_age_months: int | None = None
    ear_tag_number: str | None = None


class AnimalOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    household_id: str
    name: str
    species: str
    approx_age_months: int | None
    ear_tag_number: str | None
    created_at: datetime
    noseprint_count: int = 0


class QualityReport(BaseModel):
    ok: bool
    sharpness: float
    brightness: float
    reason: str | None = None


class EnrolResult(BaseModel):
    animal: AnimalOut
    accepted_shots: int
    rejected: list[QualityReport] = Field(default_factory=list)


class MatchCandidate(BaseModel):
    animal_id: str
    name: str
    species: str
    similarity: float


class IdentifyResult(BaseModel):
    decision: str  # match | review | no_match | low_quality
    quality: QualityReport
    best: MatchCandidate | None = None
    candidates: list[MatchCandidate] = Field(default_factory=list)
    message: str


class EventCreate(BaseModel):
    animal_id: str
    type: str
    note_text: str | None = None
    source: str = "manual"
    occurred_on: date | None = None
    payload: dict | None = None


class EventOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    animal_id: str
    type: str
    note_text: str | None
    source: str
    occurred_on: date
    created_at: datetime


class ReminderOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    animal_id: str
    type: str
    label: str
    due_on: date
    status: str
