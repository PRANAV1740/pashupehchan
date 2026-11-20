from __future__ import annotations

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from ..db import get_db
from ..identity.embedder import get_embedder
from ..identity.matcher import identify as run_identify
from ..identity.quality import assess_quality
from ..models import Household
from ..schemas import IdentifyResult

router = APIRouter(tags=["identify"])


@router.post("/households/{household_id}/identify", response_model=IdentifyResult)
async def identify_animal(
    household_id: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
) -> IdentifyResult:
    if not db.get(Household, household_id):
        raise HTTPException(404, "Household not found")

    data = await file.read()
    quality = assess_quality(data)
    if not quality.ok:
        return IdentifyResult(
            decision="low_quality",
            quality=quality,
            message="Photo saaf nahi hai. Dobara, roshni mein aur paas se lein.",
        )

    embedder = get_embedder()
    query = embedder.embed(data)
    return run_identify(db, household_id, query, embedder.name, quality)
