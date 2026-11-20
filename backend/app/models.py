"""ORM data model — the product's spine.

Every later feature (voice logging, reminders, triage, co-op view) writes into
these tables. Embeddings are stored as JSON text so the schema stays portable
across SQLite (dev) and Postgres (prod).
"""
from __future__ import annotations

import json
import uuid
from datetime import date, datetime, timezone

from sqlalchemy import Date, DateTime, Float, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base


def _uuid() -> str:
    return uuid.uuid4().hex


def _now() -> datetime:
    return datetime.now(timezone.utc)


class Household(Base):
    __tablename__ = "households"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uuid)
    name: Mapped[str] = mapped_column(String(120))
    village: Mapped[str | None] = mapped_column(String(120), nullable=True)
    # Short code the family shares to give a co-op read access. The family owns the record.
    share_code: Mapped[str] = mapped_column(String(12), default=lambda: _uuid()[:8].upper(), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)

    animals: Mapped[list["Animal"]] = relationship(back_populates="household", cascade="all, delete-orphan")


class Animal(Base):
    __tablename__ = "animals"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uuid)
    household_id: Mapped[str] = mapped_column(ForeignKey("households.id"), index=True)
    name: Mapped[str] = mapped_column(String(80))
    species: Mapped[str] = mapped_column(String(20), default="cattle")  # cattle | buffalo
    approx_age_months: Mapped[int | None] = mapped_column(nullable=True)
    # Where a government ear tag (Pashu Aadhaar) exists, store it. We do not replace it.
    ear_tag_number: Mapped[str | None] = mapped_column(String(20), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)

    household: Mapped[Household] = relationship(back_populates="animals")
    noseprints: Mapped[list["NosePrint"]] = relationship(back_populates="animal", cascade="all, delete-orphan")
    events: Mapped[list["Event"]] = relationship(back_populates="animal", cascade="all, delete-orphan")
    reminders: Mapped[list["Reminder"]] = relationship(back_populates="animal", cascade="all, delete-orphan")


class NosePrint(Base):
    """One enrolled nose photo and its fingerprint vector."""

    __tablename__ = "noseprints"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uuid)
    animal_id: Mapped[str] = mapped_column(ForeignKey("animals.id"), index=True)
    embedding_json: Mapped[str] = mapped_column(Text)  # JSON list[float], L2-normalized
    image_path: Mapped[str | None] = mapped_column(String(255), nullable=True)
    quality_score: Mapped[float] = mapped_column(Float, default=0.0)
    embedder: Mapped[str] = mapped_column(String(40), default="unknown")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)

    animal: Mapped[Animal] = relationship(back_populates="noseprints")

    @property
    def embedding(self) -> list[float]:
        return json.loads(self.embedding_json)

    @embedding.setter
    def embedding(self, vector: list[float]) -> None:
        self.embedding_json = json.dumps([round(float(x), 6) for x in vector])


class Event(Base):
    """A health/record event: vaccination, illness, breeding, note, triage."""

    __tablename__ = "events"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uuid)
    animal_id: Mapped[str] = mapped_column(ForeignKey("animals.id"), index=True)
    type: Mapped[str] = mapped_column(String(30))  # vaccination | illness | breeding | note | triage
    note_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    payload_json: Mapped[str | None] = mapped_column(Text, nullable=True)  # structured extras
    source: Mapped[str] = mapped_column(String(20), default="manual")  # voice | icon | manual
    occurred_on: Mapped[date] = mapped_column(Date, default=lambda: date.today())
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)

    animal: Mapped[Animal] = relationship(back_populates="events")

    @property
    def payload(self) -> dict:
        return json.loads(self.payload_json) if self.payload_json else {}

    @payload.setter
    def payload(self, value: dict | None) -> None:
        self.payload_json = json.dumps(value) if value else None


class Reminder(Base):
    __tablename__ = "reminders"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uuid)
    animal_id: Mapped[str] = mapped_column(ForeignKey("animals.id"), index=True)
    type: Mapped[str] = mapped_column(String(30))  # vaccination | breeding | followup
    label: Mapped[str] = mapped_column(String(120))
    due_on: Mapped[date] = mapped_column(Date, index=True)
    status: Mapped[str] = mapped_column(String(20), default="pending")  # pending | done | missed
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)

    animal: Mapped[Animal] = relationship(back_populates="reminders")
