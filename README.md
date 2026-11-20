# PashuPehchan 🐃

**पशु पहचान, "animal identity"**

> **Naak se pehchan, awaaz se khata**: identity by the nose, a record kept by voice.

PashuPehchan gives every **untagged** cattle or buffalo an identity from a photo of
its nose, and keeps its health record by **voice**, so vaccinations aren't missed,
sick animals reach a vet sooner, and dairy co-ops and insurers can trust the record.
Phone-first, works in **9 Indian languages**, and designed for people who don't type.

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](./LICENSE)
![Backend](https://img.shields.io/badge/backend-FastAPI-009688)
![Frontend](https://img.shields.io/badge/frontend-React%20%2B%20Vite-61dafb)

## 🔗 Live

| | Link |
| --- | --- |
| **App** | https://pashupehchan-psi.vercel.app |
| **API** | https://pashupehchan-api.onrender.com ([docs](https://pashupehchan-api.onrender.com/docs)) |
| **Co-op dashboard** | https://pashupehchan-api.onrender.com/coop |

> The backend is on a free tier that sleeps when idle, so the **first request after a
> pause takes about 30 to 60 seconds** (cold start). Open the app a minute before using it.

## The problem

Most animals a small farmer keeps carry **no ear tag**, records live in memory, and the
vet is far. Without a reliable identity per animal, vaccination reminders, a trustworthy
health history, insurance and co-op payments all break down.

## What it does

| Module | What it does |
| --- | --- |
| 🐽 **Nose-photo identity** | Enrol 5 nose photos, which become a fingerprint vector per animal. Re-identify an animal from one photo, matched **within the household** (one of a few, not one of thousands). A quality gate rejects blurry or dark photos. |
| 🎙️ **Voice logging** | Speak an event ("aaj teeka laga") or tap an icon; the app repeats what it understood, waits for confirmation, and saves it to the passbook. Icon buttons work with no speech. |
| 🔔 **Reminders** | Rules from the NDDB vaccination schedule (FMD, HS, BQ, deworming). Logging a vaccination reschedules the next one; overdue and upcoming are flagged. No AI. |
| 🚑 **Triage and vet routing** | A vet-style red-flag checklist sorts a case into **green, amber or red**, routes to a paravet or the **1962** helpline, and shares the animal's history. It **never names a disease or a medicine**. |
| 📊 **Co-op dashboard** | For the dairy co-op: enrolled animals, vaccination coverage, and open alerts, village by village, plus a field-worker worklist. |

**Languages:** English, हिन्दी, मराठी, ગુજરાતી, ਪੰਜਾਬੀ, বাংলা, தமிழ், తెలుగు, ಕನ್ನಡ, with a
first-run picker and an in-app switcher.

## How the identity works

Identity is an **embedding, not a classifier**: the model turns any nose photo into a
vector, so a new animal is enrolled just by storing its vectors, with no retraining, and it
scales to any number of animals. The embedder is pluggable: a pretrained **MobileNetV3**
backbone (fine-tunable on field photos later) with a dependency-free **classical** fallback
so the API always runs. Matching is cosine similarity within the household.

## Tech stack

- **Backend:** FastAPI, SQLAlchemy 2.0, Pillow and NumPy (plus optional PyTorch and
  torchvision for the MobileNet embedder). SQLite for dev, Postgres in production.
- **Frontend:** Vite, React and TypeScript PWA, phone-first, offline app shell.

```
backend/
  app/
    models.py            households, animals, noseprints, events, reminders
    identity/            embedder, quality gate, matcher
    reminders/engine.py  NDDB schedule rules
    routers/             households, animals, identify, events, reminders, coop
    static/coop.html     co-op dashboard page
  scripts/               smoke_test, e2e_http_test, reminders_test
frontend/
  src/
    i18n/                9-language dictionaries + provider
    screens/             Home, Enrol, Identify, Animal, VoiceLog, Reminders, Triage
    triageRules.ts, voiceParse.ts
```

## Run locally

**Backend**
```bash
cd backend
python -m venv .venv
# Windows: .\.venv\Scripts\Activate.ps1   |   macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt           # optional: -r requirements-ml.txt for MobileNet
uvicorn app.main:app --reload             # http://localhost:8000
```

**Frontend**
```bash
cd frontend
npm install
npm run dev                               # http://localhost:5173
```

Tests: `python backend/scripts/smoke_test.py` (identity), `e2e_http_test.py` (full API),
`reminders_test.py` (schedule engine).

## Deployment

- **Backend on Render** (Python). Build `pip install -r backend/requirements.txt`; start
  `cd backend && uvicorn app.main:app --host 0.0.0.0 --port $PORT`. Reads `DATABASE_URL`
  (Postgres); `PASHU_STORE_IMAGES=false` keeps only fingerprint vectors (no disk images);
  `PASHU_CORS_ORIGINS` locks CORS to the frontend. The deployed backend uses the lightweight
  classical embedder.
- **Frontend on Vercel** (Vite). Root `frontend/`, build `npm run build`, output `dist`,
  env `VITE_API_URL` set to the backend URL.

## Status and caveats

All five modules are built, deployed, and verified end to end. Still needed for the field,
and these are not software tasks:

- **Vet sign-off** on the triage checklist and reminder dates.
- **Native-speaker review** of the translations (a careful first pass).
- **Real-animal accuracy**: the model is pretrained, not yet fine-tuned on Indian nose
  photos; measure accuracy and wrong-match rate on real animals.

## License

[MIT](./LICENSE) © 2026 Pranav
