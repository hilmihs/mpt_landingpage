"""POST /predict — dipanggil worker Next.js (server-to-server)."""
import logging
import time

from fastapi import APIRouter, Depends, HTTPException, Request

from app.config import settings
from app.ml.audio import download_audio, load_and_preprocess
from app.ml.qps_decoder import decode_to_errors
from app.schemas import MLPredictResult, PredictRequest
from app.utils.logging import redact_url

log = logging.getLogger(__name__)
router = APIRouter()

MODEL_VERSION = "muaalem-v3_2"


def verify_api_key(request: Request):
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer ") or auth[7:] != settings.api_key:
        raise HTTPException(401, "Invalid API key")


@router.post("/predict", response_model=MLPredictResult)
async def predict(
    body: PredictRequest,
    request: Request,
    _: None = Depends(verify_api_key),
):
    start = time.time()

    mualim = getattr(request.app.state, "mualim", None)
    if mualim is None or mualim.model is None:
        raise HTTPException(503, "Model not loaded")

    # 1. Download + preprocess (jangan log signed URL lengkap — mengandung token)
    log.info(f"Predict start: submission={body.submission_id} src={redact_url(body.audio_url)}")
    try:
        audio_bytes = await download_audio(body.audio_url)
        audio_tensor, duration = await load_and_preprocess(
            audio_bytes, target_sr=settings.target_sample_rate,
        )
    except ValueError as e:
        raise HTTPException(400, f"Invalid audio: {e}")

    # 2. Inference
    try:
        prediction = await mualim.predict(audio_tensor)
    except Exception:
        log.exception(f"Inference failed for submission {body.submission_id}")
        raise HTTPException(500, "ML inference error")

    # 3. Decode ke ErrorItem per kategori
    errors = decode_to_errors(
        predicted_phonemes=prediction["phonemes"],
        predicted_sifa=prediction.get("sifa"),
        predicted_timestamps=prediction.get("timestamps"),
    )

    elapsed = time.time() - start
    total = sum(len(v) for v in errors.values())
    log.info(
        f"Predict done: submission={body.submission_id} "
        f"errors={total} audio={duration:.1f}s elapsed={elapsed:.2f}s"
    )

    return MLPredictResult(
        **errors,
        ml_model_version=MODEL_VERSION,
        ml_confidence=float(prediction.get("confidence", 0.0)),
        ml_raw_output={
            "phoneme_count": len(prediction["phonemes"]),
            "processing_time_sec": round(elapsed, 2),
        },
    )
