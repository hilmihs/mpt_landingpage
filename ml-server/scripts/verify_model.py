"""
FASE 0 — buktikan apa yang sebenarnya dikeluarkan model.

INI GERBANG. Jangan jalankan eval_ground_truth.py sebelum skrip ini lulus.

Alasannya ada di alfatihah.py:9-18: `ALFATIHAH_PHONEMES_PER_WORD` dihasilkan oleh
transliterator Arab→token buatan sendiri, BUKAN vocab QPS resmi Mu'alim. Selama
itu belum dicocokkan, setiap alignment membandingkan dua abjad yang berbeda —
dan hasilnya bukan sekadar kurang akurat, melainkan tidak berarti apa-apa.
Angka yang keluar akan tetap terlihat seperti penilaian, dan itulah bahayanya.

Yang dilakukan skrip ini:
  1. Muat model, cetak vocab aslinya.
  2. Jalankan beberapa rekaman sungguhan, cetak fonem mentah yang dikeluarkan.
  3. Bandingkan himpunan token model dengan himpunan token target kita.
  4. Nyatakan LULUS / GAGAL berdasarkan tumpang tindihnya.

Keluarannya disimpan mentah supaya bisa dipakai membetulkan skema token tanpa
harus menyalakan GPU lagi.

CARA PAKAI
    python scripts/verify_model.py ground_truth.json --sample 3 -o fase0.json
"""
from __future__ import annotations

import argparse
import asyncio
import json
import sys
from collections import Counter

sys.path.insert(0, ".")

from app.config import settings  # noqa: E402
from app.ml import alfatihah as af  # noqa: E402
from app.ml.audio import load_and_preprocess  # noqa: E402
from app.ml.mualim import MualimEngine  # noqa: E402

DRIVE_URL = "https://drive.google.com/uc?export=download&id={}"

# Ambang tumpang tindih. Di bawah ini, skema token kita dan milik model bicara
# hal yang berbeda dan tidak ada gunanya melanjutkan.
AMBANG_LULUS = 0.6


async def unduh(drive_id: str) -> bytes:
    import httpx

    async with httpx.AsyncClient(follow_redirects=True, timeout=60) as c:
        r = await c.get(DRIVE_URL.format(drive_id))
        r.raise_for_status()
        return r.content


def dump_vocab(engine: MualimEngine) -> list[str]:
    """Vocab asli model. Letaknya berbeda-beda antar versi transformers."""
    proc = getattr(engine, "processor", None)
    for obj in (proc, getattr(proc, "tokenizer", None)):
        if obj is None:
            continue
        getter = getattr(obj, "get_vocab", None)
        if callable(getter):
            try:
                return sorted(getter().keys())
            except Exception:  # noqa: BLE001
                pass
    return []


async def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("ground_truth", help="ground_truth.json dari extract_ground_truth.py")
    ap.add_argument("--sample", type=int, default=3, help="berapa rekaman diuji")
    ap.add_argument("-o", "--out", default="fase0.json")
    args = ap.parse_args()

    rows = json.load(open(args.ground_truth, encoding="utf8"))
    # Pilih yang paling bersih menurut Ustadzah: kalau bacaan tanpa lahn jaliy
    # pun tidak cocok dengan target, yang salah pasti skema kita, bukan bacaannya.
    bersih = sorted(rows, key=lambda r: (r["jaliy"], r["khafiy"]))[: args.sample]

    print("Memuat model…", flush=True)
    engine = MualimEngine(model_id=settings.mualim_model_id)
    await engine.load()
    if engine.model is None:
        sys.exit("GAGAL: model tidak termuat. Cek log di atas.")

    vocab = dump_vocab(engine)
    print(f"\n=== VOCAB MODEL ({len(vocab)} token) ===")
    print(vocab if len(vocab) <= 200 else vocab[:200] + ["…"])

    target, _ = af.build_target_sequence()
    token_kita = set(target)
    print(f"\n=== TOKEN TARGET KITA ({len(token_kita)} unik, {len(target)} panjang) ===")
    print(sorted(token_kita))

    hasil = []
    fonem_semua: Counter[str] = Counter()
    for r in bersih:
        print(f"\n--- {r['drive_id']} (jaliy={r['jaliy']} khafiy={r['khafiy']}) ---", flush=True)
        try:
            audio, durasi = await load_and_preprocess(
                await unduh(r["drive_id"]), target_sr=settings.target_sample_rate
            )
            pred = await engine.predict(audio)
        except Exception as e:  # noqa: BLE001
            print(f"  gagal: {e}")
            hasil.append({"drive_id": r["drive_id"], "error": str(e)})
            continue

        fonem = pred.get("phonemes") or []
        fonem_semua.update(fonem)
        print(f"  durasi {durasi:.1f}s · {len(fonem)} fonem · confidence {pred.get('confidence')}")
        print(f"  mentah: {fonem[:60]}")
        hasil.append(
            {
                "drive_id": r["drive_id"],
                "durasi": durasi,
                "phonemes": fonem,
                "sifa": pred.get("sifa"),
                "confidence": pred.get("confidence"),
            }
        )

    token_model = set(fonem_semua)
    irisan = token_model & token_kita
    rasio = len(irisan) / len(token_model) if token_model else 0.0

    print("\n" + "=" * 60)
    print(f"token dikeluarkan model : {len(token_model)}")
    print(f"token dikenali target   : {len(irisan)}")
    print(f"tumpang tindih          : {rasio:.1%}")
    print(f"HANYA di model          : {sorted(token_model - token_kita)[:40]}")
    print(f"HANYA di target kita    : {sorted(token_kita - token_model)[:40]}")

    lulus = rasio >= AMBANG_LULUS
    print("\n" + ("LULUS — skema token sepadan, boleh lanjut inferensi penuh."
                  if lulus else
                  f"GAGAL — tumpang tindih {rasio:.1%} < {AMBANG_LULUS:.0%}.\n"
                  "Skema token di alfatihah.py harus ditulis ulang memakai vocab di atas\n"
                  "SEBELUM angka apa pun dari model ini layak dipercaya."))
    print("=" * 60)

    with open(args.out, "w", encoding="utf8") as f:
        json.dump(
            {
                "lulus": lulus,
                "rasio_tumpang_tindih": rasio,
                "vocab_model": vocab,
                "token_target_kita": sorted(token_kita),
                "frekuensi_fonem": fonem_semua.most_common(),
                "sampel": hasil,
            },
            f,
            ensure_ascii=False,
            indent=1,
        )
    print(f"\nDetail lengkap: {args.out}")
    sys.exit(0 if lulus else 2)


if __name__ == "__main__":
    asyncio.run(main())
