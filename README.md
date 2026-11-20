# PashuPehchan (पशु पहचान)

> Naak se pehchan, awaaz se khata — identity by nose, record by voice.

PashuPehchan gives every untagged animal an identity from a nose photo and keeps
its health record by voice. Vaccinations are not missed, sick animals reach a vet
sooner, and co-ops and insurers can trust the record.

This repository is the **product**, built in vertical slices:

| Module | Status |
| --- | --- |
| 1. Nose-photo identity (enrol + re-identify within household) | in progress |
| 2. Voice logging (speech → saved event, confirm-back) | planned |
| 3. Reminders (rules from the NDDB schedule) | planned |
| 4. Triage + vet routing (green / amber / red) | planned |
| 5. Record + co-op dashboard | planned |

## Structure

```
backend/     FastAPI + SQLAlchemy. Data model + identity matching API.
frontend/    Vite + React PWA. Phone-first, large buttons, Hindi-first.
```

## Run the backend

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload
```

The API serves on http://localhost:8000 (docs at `/docs`).

### Enable the real identity model (optional)

By default the API runs on a dependency-free classical embedder. To use the
MobileNetV3 backbone instead:

```powershell
pip install -r requirements-ml.txt --index-url https://download.pytorch.org/whl/cpu
```

Restart the server; `GET /health` then reports `mobilenetv3-large-in1k`.
Animals enrolled under the classical fallback must be re-enrolled after switching.

## Run the frontend

```powershell
cd frontend
npm install
npm run dev
```

## Design notes

- **Identity is an embedding, not a classifier.** The model turns any nose photo
  into a fingerprint vector, so a new animal is enrolled without retraining.
  We start from a pretrained CNN backbone and keep the fine-tuning path open for
  field photos (see `backend/app/identity/embedder.py`).
- **Match within the household.** A family has 3–10 animals, so identification is
  a 1-of-few problem, not 1-of-thousands.
- **Quality gate first.** Blurred or dark photos are rejected on capture.
- **Offline-first intent.** Identity and logging are designed to work without a
  network; sync happens when online.
