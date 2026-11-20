from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import Animal, Event
from ..reminders.engine import on_event
from ..schemas import EventCreate, EventOut

router = APIRouter(tags=["events"])


@router.post("/events", response_model=EventOut)
def create_event(body: EventCreate, db: Session = Depends(get_db)) -> Event:
    if not db.get(Animal, body.animal_id):
        raise HTTPException(404, "Animal not found")
    ev = Event(
        animal_id=body.animal_id,
        type=body.type,
        note_text=body.note_text,
        source=body.source,
        occurred_on=body.occurred_on or date.today(),
    )
    ev.payload = body.payload
    db.add(ev)
    db.commit()

    animal = db.get(Animal, body.animal_id)
    if animal is not None:
        on_event(db, animal, ev)  # update reminders from this event
    return ev


@router.get("/animals/{animal_id}/events", response_model=list[EventOut])
def list_events(animal_id: str, db: Session = Depends(get_db)) -> list[Event]:
    if not db.get(Animal, animal_id):
        raise HTTPException(404, "Animal not found")
    return (
        db.query(Event)
        .filter(Event.animal_id == animal_id)
        .order_by(Event.occurred_on.desc(), Event.created_at.desc())
        .all()
    )
