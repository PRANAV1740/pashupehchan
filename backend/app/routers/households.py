from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import Animal, Household
from ..schemas import AnimalOut, HouseholdCreate, HouseholdOut

router = APIRouter(prefix="/households", tags=["households"])


def animal_to_out(a: Animal) -> AnimalOut:
    return AnimalOut(
        id=a.id,
        household_id=a.household_id,
        name=a.name,
        species=a.species,
        approx_age_months=a.approx_age_months,
        ear_tag_number=a.ear_tag_number,
        created_at=a.created_at,
        noseprint_count=len(a.noseprints),
    )


@router.post("", response_model=HouseholdOut)
def create_household(body: HouseholdCreate, db: Session = Depends(get_db)) -> Household:
    hh = Household(name=body.name, village=body.village)
    db.add(hh)
    db.commit()
    return hh


@router.get("", response_model=list[HouseholdOut])
def list_households(db: Session = Depends(get_db)) -> list[Household]:
    return db.query(Household).order_by(Household.created_at.desc()).all()


@router.get("/{household_id}", response_model=HouseholdOut)
def get_household(household_id: str, db: Session = Depends(get_db)) -> Household:
    hh = db.get(Household, household_id)
    if not hh:
        raise HTTPException(404, "Household not found")
    return hh


@router.get("/{household_id}/animals", response_model=list[AnimalOut])
def list_animals(household_id: str, db: Session = Depends(get_db)) -> list[AnimalOut]:
    if not db.get(Household, household_id):
        raise HTTPException(404, "Household not found")
    animals = db.query(Animal).filter(Animal.household_id == household_id).order_by(Animal.created_at).all()
    return [animal_to_out(a) for a in animals]
