from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .config import get_settings
from .db import init_db
from .identity.embedder import get_embedder
from .routers import animals, coop, events, households, identify, reminders


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(title="PashuPehchan API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=get_settings().cors_origin_list,  # set PASHU_CORS_ORIGINS to the frontend URL in prod
    allow_methods=["*"],
    allow_headers=["*"],
)

settings = get_settings()
app.mount("/media", StaticFiles(directory=str(settings.media_path)), name="media")

app.include_router(households.router)
app.include_router(animals.router)
app.include_router(identify.router)
app.include_router(events.router)
app.include_router(reminders.router)
app.include_router(coop.router)


@app.get("/health", tags=["meta"])
def health() -> dict:
    return {"status": "ok", "embedder": get_embedder().name}
