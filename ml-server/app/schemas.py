"""
Pydantic schemas — HARUS mirror types/index.ts di repo Next.js.
Jangan ubah field names; frontend deployed sudah bergantung pada shape ini.

Kontrak (LOCKED):
- ErrorItem: per kesalahan, dengan posisi (ayat, kata_idx) untuk highlight kata di mushaf.
- MLPredictResult: 5 array error + metadata. Key HARUS errors_panjang_pendek (bukan errors_mad).
ML server TIDAK compute skor dan TIDAK generate AI narrative (itu di Next.js).

Agustus 2026: indikator naik dari empat ke lima agar sama dengan instrumen
pengajar (lihat qps_decoder.py). Penambahannya ADITIF — `errors_huruf` dan
`errors_syaddah` tetap dikirim sebagai cermin dari nama barunya supaya klien
lama tidak pecah di tengah transisi.
"""
from typing import Any, Literal

from pydantic import BaseModel, Field


class ErrorItem(BaseModel):
    ayat: int = Field(..., ge=1, le=7)
    kata_idx: int = Field(..., ge=0)
    # Teks kata utuh — yang dibaca manusia dan dipakai menyusun kalimat temuan.
    expected: str
    actual: str
    severity: Literal["major", "minor"]
    note: str | None = None

    # Pasangan huruf yang meleset, terpisah dari teks kata. Sisi Next.js
    # memakainya untuk mencocokkan temuan ke opsi katalog bernama; tanpa ini
    # pencocokan harus mengurai `note`, yang rapuh.
    expected_char: str | None = None
    actual_char: str | None = None

    # Indikator asal temuan. Sudah tersirat dari field `errors_*` yang memuatnya,
    # tapi begitu kelimanya digabung jadi satu daftar — seperti di kolom
    # ai_evaluations.findings — informasi itu hilang, dan sebagian aturan
    # pencocokan katalog bergantung padanya.
    kategori: str | None = None


class PredictRequest(BaseModel):
    submission_id: str
    audio_url: str
    surah: int = 1
    ayat_range: str = "1-7"


class MLPredictResult(BaseModel):
    # Lima indikator, nama sama persis dengan instrumen pengajar.
    errors_harakat: list[ErrorItem] = []
    errors_ketepatan_huruf: list[ErrorItem] = []
    errors_panjang_pendek: list[ErrorItem] = []
    errors_tasydid: list[ErrorItem] = []
    errors_hukum_tajwid: list[ErrorItem] = []

    # DEPRECATED — cermin dari dua field di atas, diisi oleh predict.py demi
    # klien lama. Jangan dipakai untuk penilaian baru: keduanya tidak pernah
    # memuat temuan hukum_tajwid, jadi selalu kurang lengkap.
    errors_huruf: list[ErrorItem] = []
    errors_syaddah: list[ErrorItem] = []

    ml_model_version: str
    ml_confidence: float = Field(..., ge=0.0, le=1.0)
    ml_raw_output: Any | None = None
