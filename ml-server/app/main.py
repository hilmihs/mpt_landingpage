"""
Entry point FastAPI. Load Mu'alim di startup via lifespan.

Catatan: tidak ada CORS middleware — endpoint dipanggil server-to-server oleh
worker Next.js, bukan dari browser.
"""
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.api import health, predict
from app.ml.mualim import MualimEngine
from app.utils.logging import setup_logging

log = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    setup_logging()
    app.state.mualim = MualimEngine()
    try:
        await app.state.mualim.load()
    except Exception:
        # Jangan crash startup kalau model gagal load — /health akan report degraded,
        # dan /predict akan balas 503. Memudahkan test auth/health tanpa GPU/model.
        log.exception("Mu'alim load gagal saat startup — server jalan dalam mode degraded")
    yield
    await app.state.mualim.cleanup()


app = FastAPI(
    title="Muhajir Tilawah ML Server",
    version="2.0.0",
    lifespan=lifespan,
)

app.include_router(health.router, tags=["health"])
app.include_router(predict.router, tags=["inference"])
