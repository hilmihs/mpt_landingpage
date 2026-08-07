"""
Jalankan decoder terkini atas dataset ber-ground-truth Ustadzah.

BEDANYA DENGAN eval_ground_truth.py: skrip itu memanggil ML server lewat HTTP.
Yang ini memuat model langsung, memakai decode_to_errors apa adanya, dan
MENYIMPAN SEMUA KELUARAN MENTAH.

Menyimpan mentahnya itu intinya. Sekali dijalankan, seluruh penyetelan metrik
berikutnya — ambang, pengelompokan, pemetaan sifat, pencocokan katalog — bisa
dikerjakan di laptop tanpa menyalakan GPU lagi. Putaran sebelumnya hanya
menyimpan satu angka jarak, dan setiap pertanyaan baru menuntut GPU dinyalakan
ulang.

Yang disimpan per rekaman:
  pred          untai fonem hasil model
  sifa          sepuluh level sifat (inilah bahan lahn khafiy)
  findings      ErrorItem dari decoder, sudah berposisi kata
  gt_jaliy/khafiy  penilaian Ustadzah

CARA PAKAI
    python scripts/eval_dataset.py ground_truth.json -o hasil_dataset.jsonl
    python scripts/eval_dataset.py ground_truth.json --limit 5   # coba dulu
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

DRIVE_URL = "https://drive.google.com/uc?export=download&id={}"


def sudah_selesai(path: str) -> set[str]:
    """id yang sudah punya hasil — VM Spot bisa mati kapan saja."""
    if not os.path.exists(path):
        return set()
    selesai: set[str] = set()
    with open(path, encoding="utf8") as f:
        for baris in f:
            baris = baris.strip()
            if not baris:
                continue
            try:
                selesai.add(json.loads(baris)["drive_id"])
            except Exception:  # noqa: BLE001
                continue  # baris rusak akibat proses terputus
    return selesai


async def unduh(drive_id: str) -> bytes:
    import httpx

    async with httpx.AsyncClient(follow_redirects=True, timeout=90) as c:
        r = await c.get(DRIVE_URL.format(drive_id))
        r.raise_for_status()
        return r.content


def ke_pcm(raw: bytes):
    import numpy as np

    tmp = None
    try:
        with tempfile.NamedTemporaryFile(suffix=".bin", delete=False) as f:
            f.write(raw)
            tmp = f.name
        hasil = subprocess.run(
            ["ffmpeg", "-v", "error", "-i", tmp, "-f", "f32le", "-ac", "1", "-ar", "16000", "-"],
            capture_output=True,
        )
        if hasil.returncode != 0:
            pesan = (hasil.stderr or b"").decode("utf8", "replace").strip().splitlines()
            raise ValueError(f"ffmpeg gagal: {pesan[-1] if pesan else 'tanpa keterangan'}")
        return np.frombuffer(hasil.stdout, dtype="float32")
    finally:
        if tmp and os.path.exists(tmp):
            os.unlink(tmp)  # audio tidak pernah menetap


async def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("ground_truth")
    ap.add_argument("-o", "--out", default="hasil_dataset.jsonl")
    ap.add_argument("--limit", type=int, default=0)
    args = ap.parse_args()

    from app.ml.mualim import MualimEngine
    from app.ml.qps_decoder import decode_to_errors

    rows = json.load(open(args.ground_truth, encoding="utf8"))
    if args.limit:
        rows = rows[: args.limit]
    lewati = sudah_selesai(args.out)
    sisa = [r for r in rows if r["drive_id"] not in lewati]
    print(f"{len(rows)} rekaman · {len(lewati)} selesai · {len(sisa)} dikerjakan", flush=True)
    if not sisa:
        return

    print("Memuat model…", flush=True)
    engine = MualimEngine()
    await engine.load()
    if engine.model is None:
        sys.exit("GAGAL: model tidak termuat")

    gagal = 0
    with open(args.out, "a", encoding="utf8") as out:
        for i, r in enumerate(sisa, 1):
            baris = {
                "drive_id": r["drive_id"],
                "gt_jaliy": r["jaliy"],
                "gt_khafiy": r["khafiy"],
                "gender": r.get("gender"),
            }
            try:
                audio = ke_pcm(await unduh(r["drive_id"]))
                pred = await engine.predict(audio)
                fonem = "".join(pred["phonemes"])
                errors = decode_to_errors(
                    predicted_phonemes=pred["phonemes"],
                    predicted_sifa=pred.get("sifa"),
                    predicted_timestamps=pred.get("timestamps"),
                )
                baris |= {
                    "durasi": round(len(audio) / 16000, 1),
                    "confidence": pred.get("confidence"),
                    "pred": fonem,
                    "sifa": pred.get("sifa"),
                    "findings": [e.model_dump() for v in errors.values() for e in v],
                }
            except Exception as e:  # noqa: BLE001
                gagal += 1
                baris["error"] = f"{type(e).__name__}: {e}"

            out.write(json.dumps(baris, ensure_ascii=False) + "\n")
            out.flush()  # VM Spot bisa mati mendadak
            if i % 25 == 0 or i == len(sisa):
                print(f"  {i}/{len(sisa)} · gagal {gagal}", flush=True)

    print(f"SELESAI · gagal {gagal}")


if __name__ == "__main__":
    asyncio.run(main())
