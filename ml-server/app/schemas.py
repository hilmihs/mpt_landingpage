"""
Pydantic schemas — HARUS mirror types/index.ts di repo Next.js.
Jangan ubah field names; frontend deployed sudah bergantung pada shape ini.

Kontrak (LOCKED):
- ErrorItem: per kesalahan, dengan posisi (ayat, kata_idx) untuk highlight kata di mushaf.
- MLPredictResult: 4 array error + metadata. Key HARUS errors_panjang_pendek (bukan errors_mad).
ML server TIDAK compute skor dan TIDAK generate AI narrative (itu di Next.js).
"""
from typing import Any, Literal

from pydantic import BaseModel, Field


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
