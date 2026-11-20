"""Co-op partner view.

A read-only dashboard for the dairy co-op: enrolled animals, vaccination
coverage and open alerts, village by village, plus a field-worker worklist of
overdue vaccinations and open triage alerts.

Prototype scope: aggregates all households (the co-op's members). In production
this is gated by the share code each family hands the co-op — the family owns
the record. The page itself is served at /coop.
"""
from __future__ import annotations

from collections import defaultdict
from datetime import date, timedelta
from pathlib import Path

from fastapi import APIRouter, Depends
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import Animal, Event, Household, Reminder
from ..reminders.engine import VACCINE_KEYS, seed_reminders

router = APIRouter(tags=["coop"])
STATIC_DIR = Path(__file__).resolve().parent.parent / "static"
ALERT_WINDOW_DAYS = 7


@router.get("/coop")
def coop_page() -> FileResponse:
    return FileResponse(STATIC_DIR / "coop.html")


@router.get("/coop/summary")
def coop_summary(db: Session = Depends(get_db)) -> dict:
    today = date.today()

    households = db.query(Household).all()
    hh_by_id = {h.id: h for h in households}
    animals = db.query(Animal).all()
    an_by_id = {a.id: a for a in animals}

    # Make sure every animal has its schedule, so coverage is meaningful.
    for a in animals:
        if not a.reminders:
            seed_reminders(db, a)

    pending = db.query(Reminder).filter(Reminder.status == "pending").all()
    overdue = [r for r in pending if r.type in VACCINE_KEYS and r.due_on < today]
    overdue_by_animal: dict[str, list[Reminder]] = defaultdict(list)
    for r in overdue:
        overdue_by_animal[r.animal_id].append(r)

    total = len(animals)
    covered = sum(1 for a in animals if a.id not in overdue_by_animal)
    coverage_pct = round(covered / total * 100) if total else 100

    def village_of(animal: Animal) -> str:
        hh = hh_by_id.get(animal.household_id)
        return (hh.village or "—") if hh else "—"

    # Open triage alerts (red/amber) in the recent window.
    since = today - timedelta(days=ALERT_WINDOW_DAYS)
    triage_events = (
        db.query(Event)
        .filter(Event.type == "triage", Event.occurred_on >= since)
        .order_by(Event.occurred_on.desc())
        .all()
    )
    alert_list = []
    for e in triage_events:
        level = e.payload.get("level")
        if level not in ("red", "amber"):
            continue
        a = an_by_id.get(e.animal_id)
        if not a:
            continue
        hh = hh_by_id.get(a.household_id)
        alert_list.append(
            {
                "animal": a.name,
                "species": a.species,
                "level": level,
                "symptoms": e.payload.get("symptoms", []),  # keys, mapped to labels by the page
                "date": str(e.occurred_on),
                "village": village_of(a),
                "household": hh.name if hh else "",
            }
        )

    # Village aggregation.
    village: dict[str, dict] = {}
    for a in animals:
        v = village_of(a)
        vm = village.setdefault(v, {"village": v, "animals": 0, "covered": 0, "overdue": 0, "alerts": 0})
        vm["animals"] += 1
        if a.id not in overdue_by_animal:
            vm["covered"] += 1
        vm["overdue"] += len(overdue_by_animal.get(a.id, []))
    for al in alert_list:
        vm = village.setdefault(al["village"], {"village": al["village"], "animals": 0, "covered": 0, "overdue": 0, "alerts": 0})
        vm["alerts"] += 1

    villages = []
    for vm in village.values():
        cov = round(vm["covered"] / vm["animals"] * 100) if vm["animals"] else 100
        villages.append(
            {
                "village": vm["village"],
                "animals": vm["animals"],
                "coverage_pct": cov,
                "overdue": vm["overdue"],
                "alerts": vm["alerts"],
            }
        )
    villages.sort(key=lambda x: (-x["overdue"], -x["alerts"], x["village"]))

    overdue_list = []
    for r in overdue:
        a = an_by_id.get(r.animal_id)
        hh = hh_by_id.get(a.household_id) if a else None
        overdue_list.append(
            {
                "animal": a.name if a else "?",
                "species": a.species if a else "",
                "vaccine": r.type,
                "days_overdue": (today - r.due_on).days,
                "village": (hh.village or "—") if hh else "—",
                "household": hh.name if hh else "",
            }
        )
    overdue_list.sort(key=lambda x: -x["days_overdue"])

    return {
        "generated_on": str(today),
        "totals": {
            "households": len(households),
            "animals": total,
            "villages": len(village),
            "coverage_pct": coverage_pct,
            "overdue_vaccinations": len(overdue),
            "open_alerts": len(alert_list),
        },
        "villages": villages,
        "overdue_list": overdue_list[:50],
        "alert_list": alert_list[:50],
    }
