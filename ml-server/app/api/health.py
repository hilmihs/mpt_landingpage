"""GET /health — tanpa auth (untuk healthcheck Docker/monitoring). Jangan bocorkan info sensitif."""
from fastapi import APIRouter, Request

router = APIRouter()


@router.get("/health")
async def health(request: Request):
    mualim = getattr(request.app.state, "mualim", None)
    mualim_loaded = mualim is not None and mualim.model is not None
    return {
        "status": "ok" if mualim_loaded else "degraded",
        "mualim_loaded": mualim_loaded,
    }
