from __future__ import annotations

import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from ..config import get_settings
from ..db import get_db
from ..identity.embedder import get_embedder
from ..identity.quality import assess_quality
from ..models import Animal, Household, NosePrint
from ..reminders.engine import seed_reminders
from ..schemas import AnimalCreate, AnimalOut, EnrolResult
from .households import animal_to_out

router = APIRouter(prefix="/animals", tags=["animals"])


@router.post("", response_model=AnimalOut)
def create_animal(body: AnimalCreate, db: Session = Depends(get_db)) -> AnimalOut:
    if not db.get(Household, body.household_id):
        raise HTTPException(404, "Household not found")
    animal = Animal(
        household_id=body.household_id,
        name=body.name,
        species=body.species,
        approx_age_months=body.approx_age_months,
        ear_tag_number=body.ear_tag_number,
    )
    db.add(animal)
    db.commit()
    seed_reminders(db, animal)  # start the vaccination schedule for this animal
    return animal_to_out(animal)


@router.get("/{animal_id}", response_model=AnimalOut)
def get_animal(animal_id: str, db: Session = Depends(get_db)) -> AnimalOut:
    animal = db.get(Animal, animal_id)
    if not animal:
        raise HTTPException(404, "Animal not found")
    return animal_to_out(animal)


@router.post("/{animal_id}/enrol", response_model=EnrolResult)
async def enrol(
    animal_id: str,
    files: list[UploadFile] = File(...),
    db: Session = Depends(get_db),
) -> EnrolResult:
    """Enrol nose photos for an animal. Each photo passes the quality gate,
    then becomes a stored fingerprint vector. Low-quality shots are rejected
    and reported so the family is asked for a retake."""
    animal = db.get(Animal, animal_id)
    if not animal:
        raise HTTPException(404, "Animal not found")

    settings = get_settings()
    embedder = get_embedder()
    # Only touch disk when configured to (off in production — the FS is ephemeral).
    media_dir: Path | None = None
    if settings.store_images:
        media_dir = settings.media_path / "noseprints" / animal_id
        media_dir.mkdir(parents=True, exist_ok=True)

    accepted = 0
    rejected = []
    for upload in files:
        data = await upload.read()
        quality = assess_quality(data)
        if not quality.ok:
            rejected.append(quality)
            continue
        image_path: str | None = None
        if media_dir is not None:
            fname = f"{uuid.uuid4().hex}.jpg"
            (media_dir / fname).write_bytes(data)
            image_path = str(Path("noseprints") / animal_id / fname)
        print_row = NosePrint(
            animal_id=animal_id,
            image_path=image_path,
            quality_score=quality.sharpness,
            embedder=embedder.name,
        )
        print_row.embedding = embedder.embed(data)  # fingerprint vector -> always stored in DB
        db.add(print_row)
        accepted += 1

    db.commit()
    db.refresh(animal)
    return EnrolResult(animal=animal_to_out(animal), accepted_shots=accepted, rejected=rejected)
