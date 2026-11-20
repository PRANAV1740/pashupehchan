"""End-to-end test of the reminder rules engine via the HTTP API (in-process)."""
from __future__ import annotations

import asyncio
import os
import sys
import tempfile
from pathlib import Path

_tmp = Path(tempfile.mkdtemp(prefix="pashu_rem_"))
os.environ["PASHU_DATABASE_URL"] = f"sqlite:///{(_tmp / 'rem.db').as_posix()}"
os.environ["PASHU_MEDIA_DIR"] = str(_tmp / "media")
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import httpx  # noqa: E402

from app.db import init_db  # noqa: E402
from app.main import app  # noqa: E402


async def main() -> int:
    init_db()
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as c:
        hh = (await c.post("/households", json={"name": "Rem Ghar"})).json()

        # Cattle -> 4 schedule reminders (fmd, deworm, hs, bq).
        cow = (await c.post("/animals", json={"household_id": hh["id"], "name": "Ganga", "species": "cattle"})).json()
        rem = (await c.get(f"/households/{hh['id']}/reminders")).json()
        cow_types = sorted(r["type"] for r in rem if r["animal_id"] == cow["id"])
        print("cattle reminders:", cow_types)
        assert cow_types == ["bq", "deworm", "fmd", "hs"], cow_types

        # Buffalo -> 3 (no bq).
        buf = (await c.post("/animals", json={"household_id": hh["id"], "name": "Yamuna", "species": "buffalo"})).json()
        rem = (await c.get(f"/households/{hh['id']}/reminders")).json()
        buf_types = sorted(r["type"] for r in rem if r["animal_id"] == buf["id"])
        print("buffalo reminders:", buf_types)
        assert buf_types == ["deworm", "fmd", "hs"], buf_types

        # Log a generic vaccination -> soonest-due vaccine (fmd) rescheduled ~6 months out.
        before = next(r for r in rem if r["animal_id"] == cow["id"] and r["type"] == "fmd")
        await c.post("/events", json={"animal_id": cow["id"], "type": "vaccination", "note_text": "FMD"})
        rem = (await c.get(f"/households/{hh['id']}/reminders")).json()
        fmd = [r for r in rem if r["animal_id"] == cow["id"] and r["type"] == "fmd"]
        assert len(fmd) == 1, fmd  # old marked done, new one pending
        print(f"fmd due moved {before['due_on']} -> {fmd[0]['due_on']} after logging a vaccination")
        assert fmd[0]["due_on"] > before["due_on"]

        # Illness -> a follow-up reminder appears.
        await c.post("/events", json={"animal_id": buf["id"], "type": "illness", "note_text": "fever"})
        rem = (await c.get(f"/households/{hh['id']}/reminders")).json()
        assert any(r["animal_id"] == buf["id"] and r["type"] == "followup" for r in rem)
        print("illness added a follow-up reminder")

        # Mark a reminder done via the endpoint -> it reschedules.
        deworm = next(r for r in rem if r["animal_id"] == cow["id"] and r["type"] == "deworm")
        await c.post(f"/reminders/{deworm['id']}/done")
        rem = (await c.get(f"/households/{hh['id']}/reminders")).json()
        deworm2 = [r for r in rem if r["animal_id"] == cow["id"] and r["type"] == "deworm"]
        assert len(deworm2) == 1 and deworm2[0]["due_on"] > deworm["due_on"]
        print(f"deworm rescheduled {deworm['due_on']} -> {deworm2[0]['due_on']} after marking done")

    print("\nPASS: reminder engine seeds, reschedules on events, and on manual done.")
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
