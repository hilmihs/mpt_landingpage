# Claude Code Prompt v2: ML Server Deployment — Muhajir Project Tilawah

> **Cara pakai:** Copy seluruh isi file ini, paste ke Claude Code di folder project ML server (terpisah dari repo Next.js). Claude Code akan eksekusi step-by-step.
>
> **Changelog v2 (dari review codebase):**
> - Response contract diganti ke `MLPredictResult` + `ErrorItem[]` (per-error detail dengan posisi ayat + kata), bukan counts — frontend rapot butuh highlight kata per ayat
> - Request flow diganti: worker Next.js kirim JSON `{submission_id, audio_url}` (signed URL Supabase), bukan multipart upload dari frontend
> - Modul feedback (DeepSeek) DIHAPUS dari ML server — AI narrative sudah ada di sisi Next.js (`lib/ai/explain-rapot.ts`)
> - Scoring DIHAPUS dari ML server — Next.js worker yang compute skor via `lib/scoring.ts` (single source of truth)
> - Region GCP dikoreksi: `asia-southeast2` = Jakarta (bukan asia-southeast1, itu Singapore)
> - Audio limits disamakan dengan submit route: max 320 detik, max 25 MB
> - API key auth jadi WAJIB

---

## Konteks Project

Saya sedang build **Assessment Al-Fatihah**, web app AI untuk lembaga tahsin Al-Quran "Muhajir Project Tilawah" (Indonesia). Frontend + backend Next.js sudah deployed di Vercel dengan **mock ML** (`lib/mock-ml.ts`). Sekarang saya butuh build dan deploy **ML server** real yang dipanggil oleh worker Next.js.

**Arsitektur target (mengikuti flow yang sudah ada):**

```
Peserta rekam audio
    ↓
Next.js frontend → POST /api/submit → audio disimpan ke Supabase Storage
    ↓
Worker Next.js (app/api/worker/route.ts):
  1. Generate signed URL Supabase (valid 10 menit)
  2. POST /predict ke ML server: { submission_id, audio_url }
  3. Terima MLPredictResult (errors per 4 indikator)
  4. Compute skor 1-5 via lib/scoring.ts (di Next.js, BUKAN di ML server)
  5. Generate AI narrative via lib/ai/explain-rapot.ts (di Next.js, BUKAN di ML server)
  6. Insert ke tabel rapot
    ↓
ML Server (Google Cloud VM + GPU T4, yang akan kita build):
  1. Auth check (Bearer API key, WAJIB)
  2. Download audio dari signed URL
  3. Validate & preprocess audio (ffmpeg → 16kHz mono)
  4. Run Mu'alim model (pre-trained, no fine-tuning)
  5. Decode output → 4 indikator Lahn Jaliy dengan posisi ayat + kata
  6. Return JSON MLPredictResult
```

**Yang TIDAK dilakukan ML server:** scoring (1-5), AI feedback/narrative, simpan PII (nama/gender peserta). ML server stateless, fokus inference saja.

## Infrastructure

- **Cloud**: Google Cloud Platform, credit $300 (budget ketat)
- **VM**: n1-standard-4 + NVIDIA T4
- **Region**: `asia-southeast2` (**Jakarta** — wajib, data residency Indonesia / UU PDP). Catatan: `asia-southeast1` itu Singapore, jangan tertukar.
  - Sebelum deploy: cek T4 availability di zone `asia-southeast2-a/b/c` (`gcloud compute accelerator-types list --filter="zone:asia-southeast2"`) dan request GPU quota kalau masih 0 (default project baru sering 0)
- **Cost**: VM T4 24/7 ≈ $0.55/jam → credit habis ~22 hari. Pakai **Spot VM** + stop saat tidak dipakai.

## Tech Stack ML Server

- Python 3.11
- FastAPI + Uvicorn
- PyTorch (load Mu'alim model)
- huggingface_hub (download model)
- ffmpeg subprocess (audio decode, format-agnostic)
- httpx (download audio dari signed URL)
- Docker + docker compose

## Model Spesifikasi

- **Model**: `obadx/muaalem-model-v3_2` (Hugging Face Hub)
- **License**: MIT, free for commercial use
- **Size**: 0.6B parameters, ~2.4 GB download
- **Format**: TorchScript ready
- **Output**: Phoneme predictions + sifa attributes
- **Paper**: arxiv.org/abs/2509.00094

**Penting:** Output Mu'alim low-level (phoneme + sifa). Perlu decoder yang map ke **4 indikator Lahn Jaliy** DENGAN POSISI KATA:
1. Kesalahan Harakat (vokal)
2. Kesalahan Huruf (makhraj)
3. Kesalahan Panjang Pendek (mad)
4. Kesalahan Syaddah (tasydid)

Decoder ini komponen riset. Implementasi awal pakai heuristik, lalu iterasi setelah validation.

---

## 🔒 API Contract (LOCKED — harus match frontend yang sudah deployed)

Kontrak ini mirror `types/index.ts` di repo Next.js. Worker Next.js akan reject response yang tidak sesuai.

### Request: `POST /predict`

```json
{
  "submission_id": "uuid-string",
  "audio_url": "https://xxx.supabase.co/storage/v1/object/sign/audio-submissions/...",
  "surah": 1,
  "ayat_range": "1-7"
}
```

- `audio_url` = signed URL Supabase, valid 10 menit. ML server HARUS langsung download (httpx), jangan antri lama.
- Header WAJIB: `Authorization: Bearer <ML_SERVER_API_KEY>`. Tanpa/salah key → 401. API key TIDAK optional.

### Response 200: `MLPredictResult`

```json
{
  "errors_harakat":        [ /* ErrorItem[] */ ],
  "errors_huruf":          [ /* ErrorItem[] */ ],
  "errors_panjang_pendek": [ /* ErrorItem[] */ ],
  "errors_syaddah":        [ /* ErrorItem[] */ ],
  "ml_model_version": "muaalem-v3_2",
  "ml_confidence": 0.85,
  "ml_raw_output": { /* optional, untuk debug */ }
}
```

### ErrorItem (per kesalahan, BUKAN counts)

```json
{
  "ayat": 2,
  "kata_idx": 3,
  "expected": "لِلّٰهِ",
  "actual": "لِلَهِ",
  "severity": "major",
  "note": "Mad thabi'i tidak dibaca panjang"
}
```

- `ayat`: 1-7 (Al-Fatihah)
- `kata_idx`: index kata dalam ayat, 0-based — frontend pakai ini untuk highlight kata di mushaf
- `expected` / `actual`: teks Arab kata target vs yang terdeteksi
- `severity`: `"major"` (Lahn Jaliy) atau `"minor"` (Lahn Khafiy)
- `note`: optional, penjelasan singkat Bahasa Indonesia
- Kategori key HARUS `errors_panjang_pendek` (bukan `errors_mad`)

### Error responses

- `400`: audio invalid / terlalu pendek (<5s) / terlalu panjang (>320s) / download gagal
- `401`: API key salah
- `500`: inference error

### Audio constraints

- Max duration: **320 detik** (sama dengan validasi submit route Next.js)
- Max size: **25 MB**
- Format yang harus disupport: `.webm` (utama — browser MediaRecorder), plus `.ogg`, `.opus`, `.m4a`, `.wav`, `.mp3` (pakai ffmpeg, format-agnostic)
- Target: 16kHz mono float32
- Audio TIDAK disimpan setelah inference selesai (hapus temp file, no retention di ML server)

---

## ✅ Tugas Anda (Claude Code)

Build folder `ml-server/` dengan struktur:

```
ml-server/
├── README.md
├── Dockerfile
├── docker-compose.yml
├── pyproject.toml
├── .env.example
├── .gitignore
├── .dockerignore
│
├── app/
│   ├── __init__.py
│   ├── main.py                  # FastAPI entry point
│   ├── config.py                # Pydantic BaseSettings
│   ├── schemas.py               # Pydantic mirror MLPredictResult + ErrorItem
│   │
│   ├── ml/
│   │   ├── __init__.py
│   │   ├── mualim.py            # Load Mu'alim + inference
│   │   ├── audio.py             # Download dari signed URL + ffmpeg preprocess
│   │   ├── qps_decoder.py       # Mu'alim output → ErrorItem[] per 4 indikator
│   │   └── alfatihah.py         # Reference Al-Fatihah: teks Uthmani + word segmentation + QPS
│   │
│   ├── api/
│   │   ├── __init__.py
│   │   ├── predict.py           # POST /predict
│   │   └── health.py            # GET /health
│   │
│   └── utils/
│       ├── __init__.py
│       └── logging.py
│
├── scripts/
│   ├── download_model.py        # Pre-download Mu'alim dari HF Hub
│   ├── test_inference.py        # CLI smoke test dengan audio file lokal
│   ├── test_contract.py         # Validate response shape vs MLPredictResult
│   └── gcp_deploy.sh            # Deploy ke GCP VM Jakarta
│
└── tests/
    ├── __init__.py
    ├── test_audio.py
    ├── test_decoder.py
    └── fixtures/
        └── README.md
```

---

## 📋 Spec Detail per File

### 1. `app/schemas.py` — Contract Schemas

```python
"""
Pydantic schemas — HARUS mirror types/index.ts di repo Next.js.
Jangan ubah field names; frontend deployed sudah bergantung pada shape ini.
"""
from pydantic import BaseModel, Field
from typing import Literal, Any


class ErrorItem(BaseModel):
    ayat: int = Field(..., ge=1, le=7)
    kata_idx: int = Field(..., ge=0)
    expected: str
    actual: str
    severity: Literal["major", "minor"]
    note: str | None = None


class PredictRequest(BaseModel):
    submission_id: str
    audio_url: str
    surah: int = 1
    ayat_range: str = "1-7"


class MLPredictResult(BaseModel):
    errors_harakat: list[ErrorItem] = []
    errors_huruf: list[ErrorItem] = []
    errors_panjang_pendek: list[ErrorItem] = []
    errors_syaddah: list[ErrorItem] = []
    ml_model_version: str
    ml_confidence: float = Field(..., ge=0.0, le=1.0)
    ml_raw_output: Any | None = None
```

### 2. `app/config.py` — Settings

```python
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field
from typing import Literal


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Model
    mualim_model_id: str = "obadx/muaalem-model-v3_2"
    mualim_cache_dir: str = "/data/models"
    device: Literal["cuda", "cpu", "auto"] = "auto"

    # Auth — WAJIB, no default
    api_key: str = Field(..., description="Shared secret; worker Next.js kirim sebagai Bearer token")

    # Audio
    max_audio_duration_sec: int = 320   # match validasi submit route Next.js
    min_audio_duration_sec: int = 5
    max_audio_bytes: int = 25 * 1024 * 1024  # 25 MB, match submit route
    target_sample_rate: int = 16000
    download_timeout_sec: int = 30


settings = Settings()
```

Catatan: tidak perlu CORS middleware — endpoint dipanggil server-to-server oleh worker Next.js, bukan dari browser.

### 3. `app/main.py` — Entry Point

```python
"""
Entry point FastAPI. Load Mu'alim di startup via lifespan.
"""
from contextlib import asynccontextmanager
from fastapi import FastAPI

from app.ml.mualim import MualimEngine
from app.api import predict, health
from app.utils.logging import setup_logging


@asynccontextmanager
async def lifespan(app: FastAPI):
    setup_logging()
    app.state.mualim = MualimEngine()
    await app.state.mualim.load()
    yield
    await app.state.mualim.cleanup()


app = FastAPI(
    title="Muhajir Tilawah ML Server",
    version="2.0.0",
    lifespan=lifespan,
)

app.include_router(health.router, tags=["health"])
app.include_router(predict.router, tags=["inference"])
```

### 4. `app/ml/audio.py` — Download + Preprocess

```python
"""
Download audio dari signed URL Supabase + preprocess via ffmpeg.

Support: .webm (utama), .ogg, .opus, .m4a, .wav, .mp3.
ffmpeg subprocess = format-agnostic decoding.
Temp file SELALU dihapus (no audio retention di ML server).
"""
import logging
import subprocess
import tempfile
from pathlib import Path

import httpx
import numpy as np
import torch

from app.config import settings

log = logging.getLogger(__name__)


async def download_audio(audio_url: str) -> bytes:
    """Download dari signed URL. Raises ValueError kalau gagal/kebesaran."""
    async with httpx.AsyncClient(timeout=settings.download_timeout_sec) as client:
        resp = await client.get(audio_url)
        if resp.status_code != 200:
            raise ValueError(f"Audio download failed: HTTP {resp.status_code}")
        data = resp.content
    if len(data) > settings.max_audio_bytes:
        raise ValueError(f"Audio too large: {len(data)} bytes (max {settings.max_audio_bytes})")
    if len(data) == 0:
        raise ValueError("Empty audio download")
    return data


async def load_and_preprocess(
    audio_bytes: bytes,
    target_sr: int = 16000,
) -> tuple[torch.Tensor, float]:
    """
    Audio bytes → tensor float32 mono @ target_sr.
    Returns: (audio_tensor, duration_sec)
    Raises: ValueError kalau invalid / di luar batas durasi
    """
    with tempfile.NamedTemporaryFile(suffix=".audio", delete=False) as f:
        f.write(audio_bytes)
        temp_path = Path(f.name)

    try:
        duration = _get_duration(temp_path)
        if duration < settings.min_audio_duration_sec:
            raise ValueError(f"Audio too short: {duration:.1f}s (min {settings.min_audio_duration_sec}s)")
        if duration > settings.max_audio_duration_sec:
            raise ValueError(f"Audio too long: {duration:.1f}s (max {settings.max_audio_duration_sec}s)")

        cmd = [
            "ffmpeg", "-i", str(temp_path),
            "-f", "s16le", "-ac", "1", "-ar", str(target_sr),
            "-loglevel", "error", "-",
        ]
        result = subprocess.run(cmd, capture_output=True, timeout=60)
        if result.returncode != 0:
            raise ValueError(f"ffmpeg decode failed: {result.stderr.decode()[:200]}")

        audio_np = np.frombuffer(result.stdout, dtype=np.int16).astype(np.float32) / 32768.0
        if len(audio_np) == 0:
            raise ValueError("Empty audio after decode")

        return torch.from_numpy(audio_np), duration
    finally:
        temp_path.unlink(missing_ok=True)


def _get_duration(path: Path) -> float:
    cmd = [
        "ffprobe", "-v", "error",
        "-show_entries", "format=duration",
        "-of", "default=noprint_wrappers=1:nokey=1",
        str(path),
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=15)
    if result.returncode != 0:
        raise ValueError(f"ffprobe failed: {result.stderr[:120]}")
    return float(result.stdout.strip())
```

### 5. `app/ml/mualim.py` — Mu'alim Engine

```python
"""
Mu'alim model loader & inference.

Pre-trained dari Hugging Face: obadx/muaalem-model-v3_2 (~2.4 GB, TorchScript ready).

CATATAN untuk Claude Code — INVESTIGASI DULU sebelum implement:
1. Cek file structure repo dengan huggingface_hub.list_repo_files()
   sebelum hardcode path. Repo mungkin punya custom loading code di README HF.
2. Inference architecture: multi-level CTC. Output bisa berupa:
   - Logits tensor (perlu CTC decode manual), atau
   - Sudah decoded phoneme sequence
   Tergantung implementasi repo. Investigate dulu.
3. Fallback loading strategy berurutan:
   - torch.jit.load (TorchScript)
   - transformers.AutoModel.from_pretrained
   - Manual instantiation dengan model class dari repo
"""
import logging
import torch
from huggingface_hub import snapshot_download

from app.config import settings

log = logging.getLogger(__name__)


class MualimEngine:
    def __init__(self, model_id: str | None = None):
        self.model_id = model_id or settings.mualim_model_id
        self.model = None
        self.device = None

    async def load(self):
        log.info(f"Loading Mualim model: {self.model_id}")
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        log.info(f"Using device: {self.device}")

        model_path = snapshot_download(
            repo_id=self.model_id,
            cache_dir=settings.mualim_cache_dir,
        )
        log.info(f"Model files at: {model_path}")

        # TODO Claude Code: investigate model_path structure dulu.
        # List files, temukan main model file (.pt / .ts / .bin / .safetensors),
        # tentukan loading method, print verbose untuk debugging.
        raise NotImplementedError(
            "TODO: Investigate struktur repo Mu'alim lalu implement loading. "
            "Smoke test via scripts/test_inference.py dulu sebelum wire ke API."
        )

    async def predict(self, audio: torch.Tensor) -> dict:
        """
        Args:
            audio: 1D float32 tensor @ 16000 Hz

        Returns dict:
            - phonemes: list[str] — predicted phoneme sequence
            - timestamps: list[tuple[float, float]] | None — start/end per phoneme
              (PENTING: kalau tersedia dari CTC alignment, simpan — dibutuhkan
              qps_decoder untuk map error ke posisi kata)
            - sifa: list[dict] — sifa attributes per phoneme
            - confidence: float
        """
        raise NotImplementedError("TODO: implement setelah load() jalan")

    async def cleanup(self):
        if self.model is not None:
            del self.model
            self.model = None
            if torch.cuda.is_available():
                torch.cuda.empty_cache()
```

### 6. `app/ml/alfatihah.py` — Reference + Word Segmentation

```python
"""
Reference Al-Fatihah: teks Uthmani per ayat, segmentasi per kata,
dan QPS phoneme sequence per kata.

KENAPA PER KATA: kontrak ErrorItem butuh (ayat, kata_idx) supaya frontend
bisa highlight kata yang salah di mushaf. Decoder harus tahu phoneme span
mana milik kata mana.
"""

ALFATIHAH_TEXT_UTHMANI: dict[int, str] = {
    1: "بِسْمِ اللّٰهِ الرَّحْمٰنِ الرَّحِيْمِ",
    2: "اَلْحَمْدُ لِلّٰهِ رَبِّ الْعَالَمِيْنَ",
    3: "اَلرَّحْمٰنِ الرَّحِيْمِ",
    4: "مٰلِكِ يَوْمِ الدِّيْنِۗ",
    5: "اِيَّاكَ نَعْبُدُ وَاِيَّاكَ نَسْتَعِيْنُۗ",
    6: "اِهْدِنَا الصِّرَاطَ الْمُسْتَقِيْمَۙ",
    7: "صِرَاطَ الَّذِيْنَ اَنْعَمْتَ عَلَيْهِمْ غَيْرِ الْمَغْضُوْبِ عَلَيْهِمْ وَلَا الضَّاۤلِّيْنَ",
}

# Kata per ayat — split by whitespace dari teks Uthmani.
# kata_idx 0-based, HARUS konsisten dengan word splitting di frontend
# (frontend split teks yang sama by whitespace).
ALFATIHAH_WORDS: dict[int, list[str]] = {
    ayat: text.split() for ayat, text in ALFATIHAH_TEXT_UTHMANI.items()
}

# TODO Claude Code: target phonemes per kata.
# Struktur: {ayat: [(kata_idx, [phoneme, ...]), ...]}
# Cek dulu apakah repo Mu'alim punya utility text→QPS (text_to_qps atau sejenis).
# Kalau tidak ada: manual annotation per kata (39 kata total, feasible)
# atau generate dari transliteration lalu validasi manual.
ALFATIHAH_PHONEMES_PER_WORD: dict[int, list[tuple[int, list[str]]]] = {}
```

### 7. `app/ml/qps_decoder.py` — Decoder ke ErrorItem[]

```python
"""
Decode output Mu'alim → ErrorItem[] per 4 indikator.

⚠️ KOMPONEN RISET — paling sulit di project ini. ⚠️

Requirement KRITIS yang beda dari sekadar hitung mismatch:
setiap error HARUS punya posisi (ayat, kata_idx). Artinya alignment
harus word-aware, bukan cuma global edit distance atas seluruh
phoneme sequence.

Approach Phase 1 (MVP):
1. Concat target phonemes seluruh Al-Fatihah, dengan index map:
   posisi_phoneme → (ayat, kata_idx). Sumber: ALFATIHAH_PHONEMES_PER_WORD.
2. Align predicted vs target via Wagner-Fischer (edit distance + backtrace).
3. Setiap mismatch op (substitute/insert/delete) di-lookup ke index map
   → dapat (ayat, kata_idx) dari posisi target terdekat.
4. Classify kategori per mismatch:
   - vowel substitution → harakat
   - consonant substitution / deletion → huruf
   - durasi vokal (a vs aa) → panjang_pendek
   - gemination mismatch → syaddah
5. Severity MVP: substitution & deletion = major, insertion = minor.
   (Refine pakai sifa attributes post-MVP.)
6. expected/actual diisi teks Arab kata dari ALFATIHAH_WORDS
   (actual = best-effort; boleh sama dengan expected + note penjelasan
   kalau rekonstruksi teks dari phoneme tidak feasible di MVP).

Phase 2 (post-MVP): pakai sifa attributes untuk deteksi granular,
severity classifier, tuning dengan ground truth Ustadzah.
"""
import logging

from app.schemas import ErrorItem

log = logging.getLogger(__name__)


def decode_to_errors(
    predicted_phonemes: list[str],
    predicted_sifa: list[dict] | None = None,
) -> dict[str, list[ErrorItem]]:
    """
    Returns dict dengan keys PERSIS seperti kontrak:
    errors_harakat, errors_huruf, errors_panjang_pendek, errors_syaddah
    """
    # TODO Claude Code: implement sesuai approach Phase 1 di docstring.
    raise NotImplementedError("TODO: Wagner-Fischer alignment + word index map + classification")


def _align_sequences(pred: list[str], target: list[str]) -> list[tuple]:
    """Wagner-Fischer dengan backtrace. Returns [(op, pred_idx, target_idx), ...]"""
    raise NotImplementedError


def _classify_category(op: str, pred_ph: str | None, target_ph: str | None) -> str:
    """Returns: 'harakat' | 'huruf' | 'panjang_pendek' | 'syaddah'"""
    # Butuh phoneme classification table: vowels pendek/panjang, consonants, gemination marker
    raise NotImplementedError
```

### 8. `app/api/predict.py` — Main Endpoint

```python
"""POST /predict — dipanggil worker Next.js (server-to-server)."""
import logging
import time

from fastapi import APIRouter, Depends, HTTPException, Request

from app.config import settings
from app.schemas import MLPredictResult, PredictRequest
from app.ml.audio import download_audio, load_and_preprocess
from app.ml.qps_decoder import decode_to_errors

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

    # 1. Download + preprocess
    try:
        audio_bytes = await download_audio(body.audio_url)
        audio_tensor, duration = await load_and_preprocess(
            audio_bytes, target_sr=settings.target_sample_rate,
        )
    except ValueError as e:
        raise HTTPException(400, f"Invalid audio: {e}")

    # 2. Inference
    mualim = request.app.state.mualim
    try:
        prediction = await mualim.predict(audio_tensor)
    except Exception:
        log.exception(f"Inference failed for submission {body.submission_id}")
        raise HTTPException(500, "ML inference error")

    # 3. Decode ke ErrorItem per kategori
    errors = decode_to_errors(
        predicted_phonemes=prediction["phonemes"],
        predicted_sifa=prediction.get("sifa"),
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
        ml_confidence=prediction.get("confidence", 0.0),
        ml_raw_output={
            "phoneme_count": len(prediction["phonemes"]),
            "processing_time_sec": round(elapsed, 2),
        },
    )
```

### 9. `app/api/health.py`

```python
from fastapi import APIRouter, Request

router = APIRouter()


@router.get("/health")
async def health(request: Request):
    mualim_loaded = (
        hasattr(request.app.state, "mualim")
        and request.app.state.mualim.model is not None
    )
    return {
        "status": "ok" if mualim_loaded else "degraded",
        "mualim_loaded": mualim_loaded,
    }
```

Health endpoint TANPA auth (untuk healthcheck Docker/monitoring), tapi jangan bocorkan info sensitif.

### 10. `pyproject.toml`

```toml
[project]
name = "muhajir-tilawah-ml"
version = "2.0.0"
requires-python = ">=3.11"
dependencies = [
    "fastapi>=0.110",
    "uvicorn[standard]>=0.27",
    "pydantic>=2.6",
    "pydantic-settings>=2.2",
    "torch>=2.2",
    "torchaudio>=2.2",
    "transformers>=4.40",
    "huggingface-hub>=0.22",
    "numpy>=1.26",
    "httpx>=0.27",
    "python-dotenv>=1.0",
]

[project.optional-dependencies]
dev = ["pytest", "pytest-asyncio", "ruff", "mypy"]

[build-system]
requires = ["setuptools>=68"]
build-backend = "setuptools.build_meta"

[tool.setuptools.packages.find]
include = ["app*"]
```

(Tidak ada `openai` / `python-multipart` — tidak dipakai lagi di v2.)

### 11. `Dockerfile`

```dockerfile
FROM nvidia/cuda:12.1.0-runtime-ubuntu22.04

RUN apt-get update && apt-get install -y \
    python3.11 python3.11-venv python3-pip \
    ffmpeg curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy source SEBELUM install — pip install . butuh package dir
COPY pyproject.toml ./
COPY app/ ./app/

RUN pip install --no-cache-dir .

RUN mkdir -p /data/models
ENV MUALIM_CACHE_DIR=/data/models

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
```

### 12. `docker-compose.yml`

```yaml
services:
  ml-server:
    build: .
    image: muhajir-tilawah-ml:latest
    ports:
      - "8000:8000"
    env_file: .env
    volumes:
      - model-cache:/data/models
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: 1
              capabilities: [gpu]
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 30s
      timeout: 10s
      retries: 3

volumes:
  model-cache:
```

### 13. `.env.example`

```bash
# Auth — WAJIB. Generate: openssl rand -hex 32
# Nilai yang sama dipasang sebagai ML_SERVER_API_KEY di Vercel (repo Next.js).
API_KEY=

# Model cache (default OK)
MUALIM_CACHE_DIR=/data/models
DEVICE=auto
```

### 14. `scripts/download_model.py`

```python
"""Pre-download Mu'alim. Run sekali sebelum first deployment."""
import sys
from pathlib import Path

from huggingface_hub import snapshot_download

if __name__ == "__main__":
    cache_dir = sys.argv[1] if len(sys.argv) > 1 else "/data/models"
    print(f"Downloading Mu'alim ke: {cache_dir}")
    path = snapshot_download(repo_id="obadx/muaalem-model-v3_2", cache_dir=cache_dir)
    print(f"Downloaded ke: {path}")
    for f in sorted(Path(path).rglob("*")):
        if f.is_file():
            print(f"  {f.relative_to(path)} — {f.stat().st_size / 1e6:.1f} MB")
```

### 15. `scripts/test_inference.py`

```python
"""
CLI smoke test inference dengan audio file lokal (tanpa API, tanpa signed URL).

Usage: python scripts/test_inference.py path/to/audio.webm
"""
import asyncio
import sys
from pathlib import Path

from app.ml.mualim import MualimEngine
from app.ml.audio import load_and_preprocess
from app.ml.qps_decoder import decode_to_errors


async def main():
    if len(sys.argv) < 2:
        print("Usage: python scripts/test_inference.py <audio_file>")
        sys.exit(1)

    audio_path = Path(sys.argv[1])
    if not audio_path.exists():
        print(f"File tidak ditemukan: {audio_path}")
        sys.exit(1)

    print("Loading Mu'alim...")
    engine = MualimEngine()
    await engine.load()

    print(f"Loading audio: {audio_path}")
    audio_tensor, duration = await load_and_preprocess(audio_path.read_bytes())
    print(f"Audio: {duration:.1f}s, {len(audio_tensor)} samples")

    print("Running inference...")
    result = await engine.predict(audio_tensor)
    print(f"\nPhonemes (first 50): {result['phonemes'][:50]}")
    print(f"Confidence: {result.get('confidence', 'N/A')}")

    print("\nDecoding ke 4 indikator...")
    errors = decode_to_errors(result["phonemes"], result.get("sifa"))
    for category, items in errors.items():
        print(f"\n{category}: {len(items)} error(s)")
        for e in items[:5]:
            print(f"  ayat {e.ayat} kata {e.kata_idx}: {e.severity} — {e.note or ''}")

    await engine.cleanup()


if __name__ == "__main__":
    asyncio.run(main())
```

### 16. `scripts/test_contract.py`

```python
"""
Contract test: POST /predict ke server lokal, validate response shape
PERSIS sesuai MLPredictResult yang worker Next.js harapkan.

Usage:
    # Jalankan server dulu, lalu:
    python scripts/test_contract.py http://localhost:8000 <api_key> <signed_or_local_url>
"""
import sys

import httpx

REQUIRED_KEYS = {
    "errors_harakat", "errors_huruf", "errors_panjang_pendek", "errors_syaddah",
    "ml_model_version", "ml_confidence",
}
ERROR_ITEM_KEYS = {"ayat", "kata_idx", "expected", "actual", "severity"}


def main():
    base, api_key, audio_url = sys.argv[1], sys.argv[2], sys.argv[3]
    resp = httpx.post(
        f"{base}/predict",
        json={"submission_id": "contract-test", "audio_url": audio_url, "surah": 1, "ayat_range": "1-7"},
        headers={"Authorization": f"Bearer {api_key}"},
        timeout=120,
    )
    print(f"HTTP {resp.status_code}")
    resp.raise_for_status()
    data = resp.json()

    missing = REQUIRED_KEYS - set(data.keys())
    assert not missing, f"Missing keys: {missing}"

    for cat in ("errors_harakat", "errors_huruf", "errors_panjang_pendek", "errors_syaddah"):
        assert isinstance(data[cat], list), f"{cat} bukan list"
        for item in data[cat]:
            item_missing = ERROR_ITEM_KEYS - set(item.keys())
            assert not item_missing, f"{cat} item missing: {item_missing}"
            assert 1 <= item["ayat"] <= 7
            assert item["kata_idx"] >= 0
            assert item["severity"] in ("major", "minor")

    assert 0.0 <= data["ml_confidence"] <= 1.0
    print("✅ Contract OK — response match MLPredictResult")


if __name__ == "__main__":
    main()
```

### 17. `scripts/gcp_deploy.sh`

```bash
#!/bin/bash
# Deploy ML server ke GCP VM + GPU T4 di JAKARTA (asia-southeast2).
#
# Prerequisites:
# - gcloud CLI installed & authenticated
# - GPU quota di asia-southeast2 sudah di-request (default project baru = 0!)
#   Cek: gcloud compute regions describe asia-southeast2 --format="table(quotas)"
# - Cek T4 availability: gcloud compute accelerator-types list --filter="zone:asia-southeast2"
#
# Cost-saving: Spot VM (sampai 75% lebih murah, bisa di-stop kapan saja)
# + persistent disk untuk model cache (tidak re-download 2.4 GB tiap restart).

set -e

PROJECT_ID="${GCP_PROJECT_ID:-muhajir-tilawah}"
ZONE="${GCP_ZONE:-asia-southeast2-a}"   # JAKARTA — data residency Indonesia (UU PDP)
INSTANCE_NAME="muhajir-ml-server"
MACHINE_TYPE="n1-standard-4"
GPU_TYPE="nvidia-tesla-t4"
BOOT_DISK_SIZE="100GB"

echo "Deploying ML server ke GCP Jakarta..."
echo "  Project: $PROJECT_ID"
echo "  Zone: $ZONE"
echo "  Machine: $MACHINE_TYPE + 1x $GPU_TYPE (Spot)"
echo

if gcloud compute instances describe "$INSTANCE_NAME" --zone="$ZONE" --project="$PROJECT_ID" &>/dev/null; then
    echo "Instance sudah ada. Start dengan:"
    echo "  gcloud compute instances start $INSTANCE_NAME --zone=$ZONE"
    exit 0
fi

gcloud compute instances create "$INSTANCE_NAME" \
    --project="$PROJECT_ID" \
    --zone="$ZONE" \
    --machine-type="$MACHINE_TYPE" \
    --accelerator="type=$GPU_TYPE,count=1" \
    --image-family="pytorch-latest-gpu" \
    --image-project="deeplearning-platform-release" \
    --boot-disk-size="$BOOT_DISK_SIZE" \
    --boot-disk-type="pd-balanced" \
    --maintenance-policy="TERMINATE" \
    --provisioning-model="SPOT" \
    --instance-termination-action="STOP" \
    --metadata="install-nvidia-driver=True" \
    --tags="ml-server"

echo
echo "Instance created. Langkah berikutnya:"
echo "  1. SSH:  gcloud compute ssh $INSTANCE_NAME --zone=$ZONE --project=$PROJECT_ID"
echo "  2. git clone <repo> && cd ml-server"
echo "  3. cp .env.example .env && nano .env   # set API_KEY"
echo "  4. docker compose up -d --build"
echo "  5. Firewall: allow HTTPS dari Vercel saja kalau bisa, atau pakai"
echo "     reverse proxy (caddy/nginx) dengan TLS. JANGAN expose port 8000 plain HTTP publik."
echo
echo "⚠️  Setelah testing, STOP VM: gcloud compute instances stop $INSTANCE_NAME --zone=$ZONE"
```

---

## 🔌 Perubahan Sisi Next.js (dikerjakan di repo Next.js, BUKAN di ml-server/)

Setelah ML server jalan, ada 2 perubahan di repo Next.js. Jangan kerjakan di project ml-server — ini catatan untuk session terpisah di repo Next.js.

### A. `lib/ml-client.ts` — real ML client

Buat HTTP client yang implement signature sama dengan `mockMLPredict`:

```typescript
// lib/ml-client.ts
import type { MLPredictInput, MLPredictResult } from "@/types";

export async function mlPredict(input: MLPredictInput): Promise<MLPredictResult> {
  const res = await fetch(`${process.env.ML_SERVER_URL}/predict`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.ML_SERVER_API_KEY}`,
    },
    body: JSON.stringify(input),
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok) throw new Error(`ML server error: ${res.status}`);
  return res.json();
}
```

Di `app/api/worker/route.ts` (sekitar line 42), ganti pemanggilan `mockMLPredict(...)` dengan conditional:

```typescript
const result = process.env.ML_SERVER_URL
  ? await mlPredict({ submission_id: job.submission_id, audio_url: signed?.signedUrl ?? "" })
  : mockMLPredict({ submission_id: job.submission_id, audio_url: "" });
```

Mock tetap dipertahankan untuk dev lokal tanpa GPU. Env vars `ML_SERVER_URL` + `ML_SERVER_API_KEY` sudah ada di `.env.example` — tinggal isi di Vercel.

### B. `lib/ai/explain-rapot.ts` — swap Claude → DeepSeek

Narrative generation TETAP di Next.js (bukan di ML server), tapi ganti provider:

- Ganti Anthropic SDK dengan OpenAI-compatible client, `baseURL: "https://api.deepseek.com"`, env `DEEPSEEK_API_KEY`
- System prompt + format output existing dipertahankan (max 160 kata, Bahasa Indonesia, sebut 2 error teratas, ajakan tahsin)
- `ai_narrative_model` diisi model id DeepSeek yang dipakai
- ⚠️ **Verifikasi model id aktual** di https://api-docs.deepseek.com saat implement. Jangan hardcode `deepseek-v4-flash` tanpa cek — `deepseek-chat` adalah id yang known-good. Pricing juga cek ulang di docs.
- Pertahankan graceful fallback existing: kalau API key kosong / call gagal, `ai_narrative` = null (rapot tetap jalan tanpa narrative)

---

## ⚠️ Catatan Penting untuk Claude Code

### 1. Mu'alim Loading = Komponen Investigasi

`MualimEngine.load()` dan `predict()` sengaja `NotImplementedError`. Sebelum implement:

```bash
# Step 1: download
python scripts/download_model.py ./models

# Step 2: inspect structure
ls -laR ./models/models--obadx--muaalem-model-v3_2/

# Step 3: coba load multiple strategy (torch.jit.load → AutoModel → manual)
# Step 4: baca model card https://huggingface.co/obadx/muaalem-model-v3_2
# Step 5: implement load() dulu, smoke test, baru predict()
```

### 2. QPS Decoder = Komponen Riset, dan Word-Level Positioning itu WAJIB

Bagian tersulit. Kontrak `ErrorItem` butuh `(ayat, kata_idx)` per error — global edit distance saja TIDAK cukup. Harus build index map posisi phoneme → kata (lihat docstring `qps_decoder.py`). Kalau di MVP rekonstruksi `actual` (teks Arab dari phoneme) tidak feasible, isi `actual` = `expected` + jelaskan kesalahan di `note` — frontend tetap bisa render.

`kata_idx` HARUS konsisten dengan word splitting frontend: split teks Uthmani by whitespace, 0-based.

### 3. Al-Fatihah Reference Phonemes

`ALFATIHAH_PHONEMES_PER_WORD` masih kosong. Cek dulu apakah repo Mu'alim punya text→QPS utility. Kalau tidak: manual annotation 39 kata (feasible) atau generate + validasi manual.

### 4. Testing Berurutan

```bash
# 1. Smoke test loading + inference
python scripts/test_inference.py path/to/test_audio.webm

# 2. Run server, contract test
uvicorn app.main:app &
python scripts/test_contract.py http://localhost:8000 <api_key> <audio_url>

# 3. Test auth: request tanpa Bearer harus 401
curl -X POST http://localhost:8000/predict -d '{}' -H "Content-Type: application/json"
# expect: 401

# 4. End-to-end: set ML_SERVER_URL di Vercel preview, submit assessment beneran,
#    cek rapot render dengan highlight kata
```

### 5. Cost & Security Discipline

- **Selalu** stop VM setelah testing: `gcloud compute instances stop muhajir-ml-server --zone=asia-southeast2-a`
- Budget alert GCP di $50 / $100 / $200 / $250
- Jangan expose port 8000 plain HTTP ke publik — pakai reverse proxy + TLS, atau minimal firewall rule
- Jangan log isi audio / signed URL lengkap (URL mengandung token)
- Audio temp file selalu dihapus setelah inference (no retention di ML server; retention 7 hari diurus Supabase di sisi Next.js)

---

## 🎯 Definition of Done

- [ ] Mu'alim model bisa di-load dan run inference di T4
- [ ] `POST /predict` terima `{submission_id, audio_url}`, download dari signed URL, return response valid
- [ ] Response shape lolos `scripts/test_contract.py` (match `MLPredictResult` + `ErrorItem` lengkap dengan `ayat` + `kata_idx`)
- [ ] Request tanpa/salah API key → 401
- [ ] Audio >320s atau >25MB → 400 dengan pesan jelas
- [ ] `scripts/test_inference.py` jalan tanpa error dengan sample .webm
- [ ] Docker build & run sukses di GCP VM Jakarta (`asia-southeast2`)
- [ ] Health endpoint akurat (degraded saat model belum loaded)
- [ ] Temp audio file terhapus setelah tiap request (cek /tmp setelah load test)
- [ ] Logging structured, no PII / no full signed URL di log
- [ ] Cost analysis + langkah stop VM tertulis di README
- [ ] End-to-end: submit assessment dari frontend → rapot render dengan highlight kata yang salah

---

## Urutan Pengerjaan

1. **Scaffold** — folder + file skeleton
2. **`audio.py`** — paling deterministic, mudah di-test (download + ffmpeg)
3. **Investigate Mu'alim** — download, inspect, baca model card
4. **`mualim.py`** — `load()` dulu, smoke test, baru `predict()`
5. **`alfatihah.py`** — word segmentation + phonemes per kata
6. **`qps_decoder.py`** — alignment + index map + classification (paling sulit, sisakan waktu)
7. **Wire API** — predict endpoint + auth + health
8. **Contract test** — `test_contract.py` harus hijau
9. **Docker & deploy** ke Jakarta
10. **Integrasi Next.js** (di repo Next.js): `lib/ml-client.ts` + swap DeepSeek narrative

Bismillah, mari mulai!
