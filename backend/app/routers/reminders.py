from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import Animal, Household, Reminder
from ..reminders.engine import mark_done, seed_reminders
from ..schemas import ReminderOut

router = APIRouter(tags=["reminders"])


@router.get("/households/{household_id}/reminders", response_model=list[ReminderOut])
def list_reminders(household_id: str, db: Session = Depends(get_db)) -> list[Reminder]:
    if not db.get(Household, household_id):
        raise HTTPException(404, "Household not found")
    animals = db.query(Animal).filter(Animal.household_id == household_id).all()
    # Lazily seed the schedule for animals that predate the reminders engine.
    for animal in animals:
        if not animal.reminders:
            seed_reminders(db, animal)
    animal_ids = [a.id for a in animals]
    if not animal_ids:
        return []
    return (
        db.query(Reminder)
        .filter(Reminder.animal_id.in_(animal_ids), Reminder.status == "pending")
        .order_by(Reminder.due_on)
        .all()
    )


@router.post("/reminders/{reminder_id}/done", response_model=ReminderOut)
def complete_reminder(reminder_id: str, db: Session = Depends(get_db)) -> Reminder:
    r = db.get(Reminder, reminder_id)
    if not r:
        raise HTTPException(404, "Reminder not found")
    mark_done(db, r)  # marks done and schedules the next occurrence
    return r
