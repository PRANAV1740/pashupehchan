"""End-to-end HTTP test of the exact request/response path the PWA uses.

Drives the ASGI app in-process (httpx ASGITransport) against a throwaway DB, so
it exercises real multipart uploads, routing and JSON responses without a live
server and without touching the dev database.

Run:  .venv\\Scripts\\python.exe scripts\\e2e_http_test.py
"""
from __future__ import annotations

import asyncio
import io
import os
import sys
import tempfile
from pathlib import Path

import numpy as np
from PIL import Image

_tmp = Path(tempfile.mkdtemp(prefix="pashu_e2e_"))
os.environ["PASHU_DATABASE_URL"] = f"sqlite:///{(_tmp / 'e2e.db').as_posix()}"
os.environ["PASHU_MEDIA_DIR"] = str(_tmp / "media")
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import httpx  # noqa: E402

from app.db import init_db  # noqa: E402
from app.main import app  # noqa: E402


def make_nose(seed: int, jitter: int = 0) -> bytes:
    rng = np.random.default_rng(seed)
    low = rng.random((20, 20)).astype(np.float32)
    structure = np.asarray(
        Image.fromarray((low * 255).astype("uint8")).resize((256, 256), Image.BICUBIC), dtype=np.float32
    ) * 0.7
    fine = rng.random((256, 256)).astype(np.float32) * 70.0
    arr = structure + fine
    if jitter:
        jr = np.random.default_rng(seed * 1000 + jitter)
        arr = np.clip(arr + jr.normal(0, 5, arr.shape), 0, 255)
    buf = io.BytesIO()
    Image.fromarray(arr.astype("uint8")).convert("RGB").save(buf, format="JPEG", quality=92)
    return buf.getvalue()


async def main() -> int:
    init_db()
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as c:
        assert (await c.get("/health")).json()["status"] == "ok"

        hh = (await c.post("/households", json={"name": "E2E Ghar"})).json()
        print(f"household {hh['id'][:8]}  share_code={hh['share_code']}")

        # Enrol two animals via multipart, 5 shots each.
        seeds = {"Radha": 7, "Shyama": 23}
        ids: dict[str, str] = {}
        for name, seed in seeds.items():
            a = (await c.post("/animals", json={"household_id": hh["id"], "name": name, "species": "cattle"})).json()
            ids[name] = a["id"]
            files = [("files", (f"s{i}.jpg", make_nose(seed, i + 1), "image/jpeg")) for i in range(5)]
            res = (await c.post(f"/animals/{a['id']}/enrol", files=files)).json()
            assert res["accepted_shots"] == 5, res
            print(f"enrol {name:7s} -> accepted {res['accepted_shots']}, print_count {res['animal']['noseprint_count']}")

        # Identify with an unseen shot of Radha.
        probe = make_nose(7, 99)
        r = (await c.post(f"/households/{hh['id']}/identify", files={"file": ("p.jpg", probe, "image/jpeg")})).json()
        print(f"identify -> {r['decision']} : {r['best']['name'] if r['best'] else None} ({r['best']['similarity'] if r['best'] else '-'})")
        assert r["decision"] == "match" and r["best"]["name"] == "Radha", r

        # Low-quality image must be gated.
        flat = io.BytesIO()
        Image.new("RGB", (256, 256), (120, 120, 120)).save(flat, format="JPEG")
        rq = (await c.post(f"/households/{hh['id']}/identify", files={"file": ("f.jpg", flat.getvalue(), "image/jpeg")})).json()
        assert rq["decision"] == "low_quality", rq
        print(f"low-quality probe -> {rq['decision']} ({rq['quality']['reason']})")

        # Log an event and read the passbook back.
        await c.post("/events", json={"animal_id": ids["Radha"], "type": "vaccination", "note_text": "FMD teeka"})
        evs = (await c.get(f"/animals/{ids['Radha']}/events")).json()
        assert len(evs) == 1 and evs[0]["type"] == "vaccination"
        print(f"events for Radha -> {len(evs)} ({evs[0]['type']})")

    print("\nPASS: full HTTP path (enrol, identify, quality gate, events) works.")
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
