"""Within-household matcher.

Compares a query embedding against the enrolled nose-prints of one household's
animals (3-10, not thousands) and returns a ranked, confidence-scored result.
Each animal's score is the mean of its top-2 print similarities, which is more
stable than a single best match.
"""
from __future__ import annotations

import numpy as np
from sqlalchemy.orm import Session

from ..config import get_settings
from ..models import Animal, NosePrint
from ..schemas import IdentifyResult, MatchCandidate, QualityReport


def _cosine(a: np.ndarray, b: np.ndarray) -> float:
    # Vectors are stored L2-normalized, so a dot product is the cosine similarity.
    return float(np.dot(a, b))


def _score_animal(query: np.ndarray, prints: list[NosePrint]) -> float:
    sims = sorted((_cosine(query, np.asarray(p.embedding, dtype=np.float32)) for p in prints), reverse=True)
    top = sims[:2] if len(sims) >= 2 else sims
    return float(np.mean(top)) if top else -1.0


def identify(
    db: Session,
    household_id: str,
    query_embedding: list[float],
    embedder_name: str,
    quality: QualityReport,
) -> IdentifyResult:
    s = get_settings()
    q = np.asarray(query_embedding, dtype=np.float32)

    animals = db.query(Animal).filter(Animal.household_id == household_id).all()
    scored: list[MatchCandidate] = []
    for animal in animals:
        # Only compare vectors produced by the same embedder.
        prints = [p for p in animal.noseprints if p.embedder == embedder_name]
        if not prints:
            continue
        sim = _score_animal(q, prints)
        scored.append(MatchCandidate(animal_id=animal.id, name=animal.name, species=animal.species, similarity=round(sim, 4)))

    scored.sort(key=lambda c: c.similarity, reverse=True)
    best = scored[0] if scored else None

    if best is None:
        return IdentifyResult(
            decision="no_match",
            quality=quality,
            candidates=scored,
            message="Koi enrolled jaanwar nahi mila. Pehle enrol karein.",
        )

    if best.similarity >= s.match_accept_threshold:
        decision, message = "match", f"{best.name} pehchani gayi."
    elif best.similarity >= s.match_review_threshold:
        decision, message = "review", "Pakka nahi. Dobara photo lein ya kisi insaan se jaanch karayein."
    else:
        decision, message = "no_match", "Yeh jaanwar enrolled nahi lagti. Nayi enrol karein?"

    return IdentifyResult(
        decision=decision,
        quality=quality,
        best=best,
        candidates=scored[:5],
        message=message,
    )
