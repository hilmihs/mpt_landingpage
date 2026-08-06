"""
Jalankan mesin atas rekaman yang sudah dinilai Ustadzah, lalu bandingkan.

Ini pengukuran akurasi pertama yang benar-benar berdasar. Instrumen per-segmen
milik pengajar baru dipakai belakangan, jadi pasangan penilaiannya masih sedikit;
sementara spreadsheet Ustadzah memuat ratusan rekaman yang sudah dihitung jumlah
lahn jaliy dan khafiy-nya sejak Oktober 2025.

Yang dibandingkan HANYA jumlah temuan — bukan skor 1-10. Ground truth-nya total
per rekaman, bukan per segmen, jadi skor kepala tidak bisa direkonstruksi. Dan
memang tidak perlu: kalau mesin tidak bisa menghitung berapa banyak kesalahan
yang ada, skor apa pun di atasnya tidak ada artinya.

AUDIO TIDAK PERNAH MENETAP. Tiap rekaman diunduh ke memori, diproses, lalu
dilepas. Tidak ada salinan yang ditulis ke disk, ke GCS, atau ke basis data —
yang tersimpan cuma angka. Itu keputusan yang disengaja: rekaman ini milik
peserta, dikumpulkan untuk dinilai pengajar, bukan untuk jadi arsip kita.

RESUMABLE. Hasil ditulis per baris ke JSONL begitu selesai. Menjalankan ulang
dengan berkas keluaran yang sama akan melewati yang sudah beres — VM Spot bisa
dihentikan Google kapan saja, dan kerja setengah jalan tidak boleh hilang.

CARA PAKAI
    python scripts/verify_model.py ground_truth.json    # WAJIB lulus dulu
    python scripts/eval_ground_truth.py ground_truth.json -o hasil.jsonl
    python scripts/eval_ground_truth.py --report hasil.jsonl ground_truth.json
"""
from __future__ import annotations

import argparse
import asyncio
import json
import os
import sys
from collections import Counter

sys.path.insert(0, ".")

# Impor model, konfigurasi, dan torch sengaja TIDAK di tingkat modul. `--report`
# dijalankan di laptop setelah hasilnya disalin balik dari VM — di sana tidak ada
# GPU, tidak ada torch, dan tidak ada API_KEY. Menaruh impor di atas membuat
# perintah laporan gagal hanya karena env yang tidak relevan baginya.

DRIVE_URL = "https://drive.google.com/uc?export=download&id={}"


async def unduh(drive_id: str) -> bytes:
    import httpx

    async with httpx.AsyncClient(follow_redirects=True, timeout=90) as c:
        r = await c.get(DRIVE_URL.format(drive_id))
        r.raise_for_status()
        return r.content


def sudah_selesai(path: str) -> set[str]:
    """id yang sudah punya hasil, supaya lanjutan tidak mengulang."""
    if not os.path.exists(path):
        return set()
    selesai = set()
    with open(path, encoding="utf8") as f:
        for baris in f:
            baris = baris.strip()
            if not baris:
                continue
            try:
                selesai.add(json.loads(baris)["drive_id"])
            except Exception:  # noqa: BLE001
                continue  # baris rusak akibat proses terputus — dihitung belum selesai
    return selesai


async def jalankan(args) -> None:
    from app.config import settings
    from app.ml.audio import load_and_preprocess
    from app.ml.mualim import MualimEngine
    from app.ml.qps_decoder import decode_to_errors

    rows = json.load(open(args.ground_truth, encoding="utf8"))
    if args.limit:
        rows = rows[: args.limit]

    lewati = sudah_selesai(args.out)
    sisa = [r for r in rows if r["drive_id"] not in lewati]
    print(f"{len(rows)} rekaman · {len(lewati)} sudah selesai · {len(sisa)} dikerjakan")
    if not sisa:
        return

    print("Memuat model…", flush=True)
    engine = MualimEngine(model_id=settings.mualim_model_id)
    await engine.load()
    if engine.model is None:
        sys.exit("GAGAL: model tidak termuat.")

    gagal = 0
    with open(args.out, "a", encoding="utf8") as out:
        for i, r in enumerate(sisa, 1):
            baris = {"drive_id": r["drive_id"], "gt_jaliy": r["jaliy"], "gt_khafiy": r["khafiy"]}
            try:
                audio, durasi = await load_and_preprocess(
                    await unduh(r["drive_id"]), target_sr=settings.target_sample_rate
                )
                pred = await engine.predict(audio)
                errors = decode_to_errors(
                    predicted_phonemes=pred["phonemes"],
                    predicted_sifa=pred.get("sifa"),
                    predicted_timestamps=pred.get("timestamps"),
                )
                semua = [e for v in errors.values() for e in v]
                baris |= {
                    "ai_jaliy": sum(1 for e in semua if e.severity == "major"),
                    "ai_khafiy": sum(1 for e in semua if e.severity == "minor"),
                    "per_kategori": {k: len(v) for k, v in errors.items()},
                    "durasi": round(durasi, 1),
                    "confidence": pred.get("confidence"),
                    "jumlah_fonem": len(pred.get("phonemes") or []),
                }
            except Exception as e:  # noqa: BLE001
                gagal += 1
                baris["error"] = f"{type(e).__name__}: {e}"

            out.write(json.dumps(baris, ensure_ascii=False) + "\n")
            out.flush()  # VM Spot bisa mati mendadak; jangan tahan di buffer
            if i % 10 == 0 or i == len(sisa):
                print(f"  {i}/{len(sisa)} · gagal {gagal}", flush=True)

    print(f"Selesai. Hasil di {args.out}")


def laporan(path_hasil: str) -> None:
    baris = []
    with open(path_hasil, encoding="utf8") as f:
        for l in f:
            l = l.strip()
            if l:
                try:
                    baris.append(json.loads(l))
                except Exception:  # noqa: BLE001
                    pass

    ok = [b for b in baris if "ai_jaliy" in b]
    err = [b for b in baris if "error" in b]
    print(f"total {len(baris)} · berhasil {len(ok)} · gagal {len(err)}")
    if err:
        for tipe, n in Counter(b["error"].split(":")[0] for b in err).most_common(5):
            print(f"  {tipe}: {n}")
    if not ok:
        print("Tidak ada hasil untuk dilaporkan.")
        return

    def ringkas(nama: str, kunci_ai: str, kunci_gt: str) -> None:
        selisih = [b[kunci_ai] - b[kunci_gt] for b in ok]
        n = len(selisih)
        mae = sum(abs(d) for d in selisih) / n
        bias = sum(selisih) / n
        persis = sum(1 for d in selisih if d == 0) / n
        dekat = sum(1 for d in selisih if abs(d) <= 2) / n
        gt = [b[kunci_gt] for b in ok]
        ai = [b[kunci_ai] for b in ok]
        print(f"\n=== {nama} ===")
        print(f"  rata-rata Ustadzah {sum(gt)/n:.2f} · mesin {sum(ai)/n:.2f}")
        print(f"  selisih rata-rata (bias) : {bias:+.2f}  "
              f"({'mesin melihat LEBIH banyak' if bias > 0 else 'mesin melihat LEBIH sedikit'})")
        print(f"  jarak rata-rata (MAE)    : {mae:.2f}")
        print(f"  sama persis              : {persis:.1%}")
        print(f"  selisih <= 2             : {dekat:.1%}")
        print(f"  korelasi Pearson         : {pearson(gt, ai):.3f}")

    ringkas("LAHN JALIY", "ai_jaliy", "gt_jaliy")
    ringkas("LAHN KHAFIY", "ai_khafiy", "gt_khafiy")

    if all(b["ai_khafiy"] == 0 for b in ok):
        print("\n⚠️  Seluruh khafiy mesin nol — head sifa belum jalan. Angka khafiy di")
        print("   atas mengukur ketiadaan fitur, bukan ketidakakuratan model.")

    print("\n=== temuan per kategori (rata-rata per rekaman) ===")
    kat: Counter[str] = Counter()
    for b in ok:
        for k, v in (b.get("per_kategori") or {}).items():
            kat[k] += v
    for k, v in kat.most_common():
        print(f"  {k:<26} {v/len(ok):.2f}")


def pearson(a: list[float], b: list[float]) -> float:
    n = len(a)
    if n < 2:
        return 0.0
    ma, mb = sum(a) / n, sum(b) / n
    num = sum((x - ma) * (y - mb) for x, y in zip(a, b))
    da = sum((x - ma) ** 2 for x in a) ** 0.5
    db = sum((y - mb) ** 2 for y in b) ** 0.5
    return num / (da * db) if da and db else 0.0


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("ground_truth")
    ap.add_argument("-o", "--out", default="hasil.jsonl")
    ap.add_argument("--limit", type=int, default=0, help="hanya N rekaman pertama")
    ap.add_argument("--report", metavar="HASIL.JSONL", help="cetak laporan, jangan jalankan model")
    args = ap.parse_args()

    if args.report:
        laporan(args.report)
        return
    asyncio.run(jalankan(args))


if __name__ == "__main__":
    main()
