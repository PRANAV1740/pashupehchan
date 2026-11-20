"""Reminder rules engine.

Plain rules from the NDDB vaccination schedule — no AI. Each animal is seeded
with a pending reminder per applicable vaccine; logging a vaccination clears the
soonest-due one and schedules the next at the right interval. The national
schedule is the default; a vet or co-op can adjust individual due dates later.

Intervals (months):
  FMD        every 6   (foot-and-mouth disease)
  HS         every 12  (haemorrhagic septicaemia)
  BQ         every 12  (black quarter — cattle)
  Deworming  every 3
Breeding and illness events also create follow-up reminders.
"""
from __future__ import annotations

import calendar
from dataclasses import dataclass
from datetime import date, timedelta

from sqlalchemy.orm import Session

from ..models import Animal, Event, Reminder


@dataclass(frozen=True)
class Sched:
    key: str
    label: str  # default English label; the UI localizes by key and falls back to this
    interval_months: int
    initial_lead_days: int
    species: tuple[str, ...]


SCHEDULE: list[Sched] = [
    Sched("fmd", "FMD vaccine", 6, 7, ("cattle", "buffalo")),
    Sched("deworm", "Deworming", 3, 14, ("cattle", "buffalo")),
    Sched("hs", "HS vaccine", 12, 30, ("cattle", "buffalo")),
    Sched("bq", "BQ vaccine", 12, 45, ("cattle",)),
]
SCHED_BY_KEY = {s.key: s for s in SCHEDULE}
VACCINE_KEYS = set(SCHED_BY_KEY)


def add_months(d: date, months: int) -> date:
    m = d.month - 1 + months
    y = d.year + m // 12
    m = m % 12 + 1
    day = min(d.day, calendar.monthrange(y, m)[1])
    return date(y, m, day)


def seed_reminders(db: Session, animal: Animal) -> bool:
    """Create any missing schedule reminders for an animal. Idempotent."""
    existing = {r.type for r in animal.reminders}
    today = date.today()
    created = False
    for s in SCHEDULE:
        if animal.species not in s.species or s.key in existing:
            continue
        db.add(
            Reminder(
                animal_id=animal.id,
                type=s.key,
                label=s.label,
                due_on=today + timedelta(days=s.initial_lead_days),
                status="pending",
            )
        )
        created = True
    if created:
        db.commit()
    return created


def _reschedule(db: Session, reminder: Reminder, done_on: date) -> None:
    reminder.status = "done"
    s = SCHED_BY_KEY.get(reminder.type)
    if s:
        db.add(
            Reminder(
                animal_id=reminder.animal_id,
                type=s.key,
                label=s.label,
                due_on=add_months(done_on, s.interval_months),
                status="pending",
            )
        )


def mark_done(db: Session, reminder: Reminder, done_on: date | None = None) -> None:
    """Mark a reminder done and schedule its next occurrence."""
    _reschedule(db, reminder, done_on or date.today())
    db.commit()


def on_event(db: Session, animal: Animal, event: Event) -> None:
    """React to a newly logged event by updating reminders."""
    pending = sorted((r for r in animal.reminders if r.status == "pending"), key=lambda r: r.due_on)

    if event.type in VACCINE_KEYS:
        target = next((r for r in pending if r.type == event.type), None)
    elif event.type == "vaccination":
        # Generic voice log — clear the soonest-due vaccine reminder.
        target = next((r for r in pending if r.type in VACCINE_KEYS), None)
    else:
        target = None

    if target is not None:
        _reschedule(db, target, event.occurred_on)
        db.commit()
        return

    if event.type == "breeding":
        if not any(r.status == "pending" and r.type == "breeding_check" for r in animal.reminders):
            db.add(
                Reminder(
                    animal_id=animal.id,
                    type="breeding_check",
                    label="Pregnancy check",
                    due_on=event.occurred_on + timedelta(days=60),
                    status="pending",
                )
            )
            db.commit()
    elif event.type == "illness":
        db.add(
            Reminder(
                animal_id=animal.id,
                type="followup",
                label="Follow-up check",
                due_on=event.occurred_on + timedelta(days=2),
                status="pending",
            )
        )
        db.commit()
    elif event.type == "triage":
        # Green/amber triage results promise a next-day check-in.
        level = (event.payload or {}).get("level")
        has_followup = any(r.status == "pending" and r.type == "followup" for r in animal.reminders)
        if level in ("green", "amber") and not has_followup:
            db.add(
                Reminder(
                    animal_id=animal.id,
                    type="followup",
                    label="Follow-up check",
                    due_on=event.occurred_on + timedelta(days=1),
                    status="pending",
                )
            )
            db.commit()
