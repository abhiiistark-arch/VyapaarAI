from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api.v1.router import api_router
from app.core.config import get_settings
from app.db.base import Base
from app.db.session import SessionLocal, engine
from app.models import *  # noqa: F401,F403

settings = get_settings()
MEDIA_ROOT = Path(__file__).resolve().parent.parent / "media"
MEDIA_ROOT.mkdir(parents=True, exist_ok=True)
(MEDIA_ROOT / "generated").mkdir(parents=True, exist_ok=True)


@asynccontextmanager
async def lifespan(_: FastAPI):
    Base.metadata.create_all(bind=engine)
    if settings.demo_mode:
        from app.services.demo.enrich import enrich_demo_profile
        from app.services.demo.seed import seed_demo_workspace

        db = SessionLocal()
        try:
            seed_demo_workspace(db)
            enrich_demo_profile(db)
        finally:
            db.close()
    yield


app = FastAPI(title=settings.app_name, version="0.2.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api/v1")
app.mount("/media", StaticFiles(directory=str(MEDIA_ROOT)), name="media")


@app.get("/health")
def health():
    return {
        "status": "ok",
        "app": settings.app_name,
        "env": settings.app_env,
        "demo_mode": settings.demo_mode,
        "google_live_enabled": settings.google_live_enabled,
        "gemini_configured": bool(settings.gemini_api_key),
    }
