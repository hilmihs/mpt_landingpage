"""
Inferensi batch — dijalankan DI VM GPU, lalu VM dimatikan.

Membaca rekaman yang menunggu, menjalankan model, menulis temuan MENTAH ke
ai_inference_raw. Tidak menghitung skor: proyeksi ke instrumen pengajar
dikerjakan sisi Next.js yang sudah punya logikanya (lihat
docs/BATCH_INFERENSI.md).

AUDIO TIDAK PERNAH MENETAP. Tiap rekaman diunduh ke berkas sementara, diproses,
lalu dihapus pada iterasi yang sama.

TAHAN PUTUS. VM Spot bisa dihentikan Google kapan saja. Tiap rekaman ditulis
begitu selesai dan `ai_status` ikut dimutakhirkan, jadi putaran berikutnya
melanjutkan, bukan mengulang.

CARA PAKAI
    DATABASE_URL=postgres://... GCS_BUCKET=... python scripts/batch_infer.py
    python scripts/batch_infer.py --limit 5     # coba sedikit dulu
"""
from __future__ import annotations

import argparse
import asyncio
import json
import os
import subprocess
import sys
import tempfile

sys.path.insert(0, ".")


def _wajib(nama: str) -> str:
    nilai = os.environ.get(nama)
    if not nilai:
        sys.exit(f"{nama} belum diset")
    return nilai


async def unduh_audio(bucket: str, path: str) -> bytes:
    """Ambil audio dari GCS memakai kredensial bawaan VM."""
    from google.cloud import storage  # impor lokal: hanya perlu di VM

    def _ambil() -> bytes:
        klien = storage.Client()
        return klien.bucket(bucket).blob(path).download_as_bytes()

    return await asyncio.to_thread(_ambil)


def ke_pcm(raw: bytes) -> "object":
    """WebM/Opus/apa pun → float32 mono 16 kHz lewat ffmpeg."""
    import numpy as np

    tmp = None
    try:
        with tempfile.NamedTemporaryFile(suffix=".bin", delete=False) as f:
            f.write(raw)
            tmp = f.name
        keluaran = subprocess.run(
            ["ffmpeg", "-v", "quiet", "-i", tmp, "-f", "f32le", "-ac", "1", "-ar", "16000", "-"],
            capture_output=True,
            check=True,
        ).stdout
        return np.frombuffer(keluaran, dtype="float32")
    finally:
        if tmp and os.path.exists(tmp):
            os.unlink(tmp)  # audio tidak menetap


async def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--limit", type=int, default=0, help="hanya N rekaman pertama")
    args = ap.parse_args()

    import psycopg
    from app.config import settings
    from app.ml.mualim import MualimEngine
    from app.ml.qps_decoder import decode_to_errors

    dsn = _wajib("DATABASE_URL")
    bucket = _wajib("GCS_BUCKET")

    with psycopg.connect(dsn) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT s.id, s.audio_path
                FROM submissions s
                LEFT JOIN ai_inference_raw r ON r.submission_id = s.id
                WHERE s.ai_status = 'pending'
                  AND s.audio_path IS NOT NULL
                  AND r.submission_id IS NULL
                ORDER BY s.created_at
                """
            )
            antrean = cur.fetchall()

    if args.limit:
        antrean = antrean[: args.limit]
    print(f"{len(antrean)} rekaman menunggu", flush=True)
    if not antrean:
        return

    print("Memuat model…", flush=True)
    engine = MualimEngine()
    await engine.load()
    if engine.model is None:
        sys.exit("GAGAL: model tidak termuat")

    berhasil = gagal = 0
    for i, (submission_id, audio_path) in enumerate(antrean, 1):
        try:
            audio = ke_pcm(await unduh_audio(bucket, audio_path))
            if len(audio) < 16000:
                raise ValueError("audio kurang dari 1 detik")

            pred = await engine.predict(audio)
            errors = decode_to_errors(
                predicted_phonemes=pred["phonemes"],
                predicted_sifa=pred.get("sifa"),
                predicted_timestamps=pred.get("timestamps"),
            )
            temuan = [e.model_dump() for v in errors.values() for e in v]

            with psycopg.connect(dsn) as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        """
                        INSERT INTO ai_inference_raw
                          (submission_id, findings, ml_model_version, ml_confidence, ml_raw_output)
                        VALUES (%s, %s, %s, %s, %s)
                        ON CONFLICT (submission_id) DO UPDATE SET
                          findings = EXCLUDED.findings,
                          ml_model_version = EXCLUDED.ml_model_version,
                          ml_confidence = EXCLUDED.ml_confidence,
                          ml_raw_output = EXCLUDED.ml_raw_output,
                          diproses_at = NULL
                        """,
                        (
                            submission_id,
                            json.dumps(temuan, ensure_ascii=False),
                            "muaalem-v3_2",
                            float(pred.get("confidence") or 0.0),
                            json.dumps(
                                {
                                    "phoneme_count": len(pred.get("phonemes") or []),
                                    "sifa_available": pred.get("sifa") is not None,
                                },
                                ensure_ascii=False,
                            ),
                        ),
                    )
                conn.commit()
            berhasil += 1
        except Exception as e:  # noqa: BLE001
            gagal += 1
            print(f"  gagal {submission_id}: {type(e).__name__}: {e}", flush=True)
            # Ditandai supaya tidak dicoba terus setiap putaran. Admin bisa
            # mengembalikannya ke 'pending' kalau sebabnya sudah dibereskan.
            with psycopg.connect(dsn) as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        "UPDATE submissions SET ai_status='failed', ai_error_message=%s WHERE id=%s",
                        (f"{type(e).__name__}: {e}"[:500], submission_id),
                    )
                conn.commit()

        if i % 5 == 0 or i == len(antrean):
            print(f"  {i}/{len(antrean)} · berhasil {berhasil} · gagal {gagal}", flush=True)

    print(f"SELESAI · berhasil {berhasil} · gagal {gagal}")


if __name__ == "__main__":
    asyncio.run(main())
