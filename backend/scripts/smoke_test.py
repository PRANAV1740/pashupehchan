"""End-to-end smoke test for the identity core.

Runs against a throwaway SQLite file. Generates synthetic textured "nose"
images (structured low-frequency pattern + per-animal fine grain) so that:
  * the quality gate passes (enough sharpness),
  * shots of the same animal embed close together,
  * different animals embed apart,
and checks that within-household matching picks the right animal.

Run:  .venv\\Scripts\\python.exe scripts\\smoke_test.py
"""
from __future__ import annotations

import io
import os
import sys
import tempfile
from pathlib import Path

import numpy as np
from PIL import Image

# Point the app at a temp DB BEFORE importing it (settings are cached).
_tmp = Path(tempfile.mkdtemp(prefix="pashu_smoke_"))
os.environ["PASHU_DATABASE_URL"] = f"sqlite:///{(_tmp / 'smoke.db').as_posix()}"
os.environ["PASHU_MEDIA_DIR"] = str(_tmp / "media")

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.db import SessionLocal, init_db  # noqa: E402
from app.identity.embedder import get_embedder  # noqa: E402
from app.identity.matcher import identify  # noqa: E402
from app.identity.quality import assess_quality  # noqa: E402
from app.models import Animal, Household, NosePrint  # noqa: E402


def make_nose(animal_seed: int, jitter: int = 0) -> bytes:
    """Per-animal structure + fine grain; jitter adds a fresh small perturbation
    to simulate a different photo of the same animal."""
    rng = np.random.default_rng(animal_seed)
    low = rng.random((20, 20)).astype(np.float32)
    low_img = Image.fromarray((low * 255).astype("uint8")).resize((256, 256), Image.BICUBIC)
    structure = np.asarray(low_img, dtype=np.float32) * 0.7
    fine = rng.random((256, 256)).astype(np.float32) * 70.0  # consistent per animal -> sharpness
    arr = structure + fine
    if jitter:
        jr = np.random.default_rng(animal_seed * 1000 + jitter)
        arr = arr + jr.normal(0, 5, arr.shape)
        arr = np.roll(arr, jitter % 3 - 1, axis=0)
    arr = np.clip(arr, 0, 255).astype("uint8")
    buf = io.BytesIO()
    Image.fromarray(arr).convert("RGB").save(buf, format="JPEG", quality=92)
    return buf.getvalue()


def main() -> int:
    init_db()
    embedder = get_embedder()
    print(f"embedder = {embedder.name} (dim={embedder.dim})")

    db = SessionLocal()
    hh = Household(name="Smoke Household", village="Testpur")
    db.add(hh)
    db.commit()

    # Enrol 3 animals, 5 shots each.
    animal_seeds = {"Gauri": 11, "Kali": 29, "Lali": 47}
    animals: dict[str, Animal] = {}
    for name, seed in animal_seeds.items():
        a = Animal(household_id=hh.id, name=name, species="cattle")
        db.add(a)
        db.commit()
        animals[name] = a
        for shot in range(5):
            data = make_nose(seed, jitter=shot + 1)
            q = assess_quality(data)
            assert q.ok, f"quality gate rejected an enrol shot for {name}: {q.reason} (sharp={q.sharpness})"
            p = NosePrint(animal_id=a.id, embedder=embedder.name, quality_score=q.sharpness)
            p.embedding = embedder.embed(data)
            db.add(p)
        db.commit()
    print(f"enrolled {len(animals)} animals, 5 shots each")

    # Re-identify each animal with a fresh unseen shot.
    correct = 0
    for name, seed in animal_seeds.items():
        probe = make_nose(seed, jitter=99)  # a shot never used in enrolment
        q = assess_quality(probe)
        res = identify(db, hh.id, embedder.embed(probe), embedder.name, q)
        got = res.best.name if res.best else None
        ok = got == name
        correct += ok
        top = ", ".join(f"{c.name}:{c.similarity:.3f}" for c in res.candidates)
        print(f"  probe {name:6s} -> {got!s:6s} [{res.decision:8s}]  ({top})")
        assert ok, f"wrong animal: expected {name}, got {got}"

    # A blurred photo must be rejected by the gate.
    blurry = Image.new("RGB", (256, 256), (120, 120, 120))
    bbuf = io.BytesIO()
    blurry.save(bbuf, format="JPEG")
    assert assess_quality(bbuf.getvalue()).ok is False, "blurred/flat image should fail the quality gate"

    db.close()
    print(f"\nPASS: {correct}/{len(animal_seeds)} identified correctly; quality gate works.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
