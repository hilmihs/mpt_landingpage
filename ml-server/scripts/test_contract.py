"""
Contract test: POST /predict ke server lokal, validate response shape PERSIS
sesuai MLPredictResult yang worker Next.js harapkan.

Usage:
    # Jalankan server dulu, lalu:
    python scripts/test_contract.py http://localhost:8000 <api_key> <signed_or_local_url>
"""
import sys

import httpx

CATEGORY_KEYS = (
    "errors_harakat",
    "errors_ketepatan_huruf",
    "errors_panjang_pendek",
    "errors_tasydid",
    "errors_hukum_tajwid",
)
# Nama lama tetap wajib hadir selama masa transisi — lihat schemas.py.
LEGACY_KEYS = ("errors_huruf", "errors_syaddah")
REQUIRED_KEYS = {*CATEGORY_KEYS, *LEGACY_KEYS, "ml_model_version", "ml_confidence"}
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

    for cat in (*CATEGORY_KEYS, *LEGACY_KEYS):
        assert isinstance(data[cat], list), f"{cat} bukan list"
        for item in data[cat]:
            item_missing = ERROR_ITEM_KEYS - set(item.keys())
            assert not item_missing, f"{cat} item missing: {item_missing}"
            assert 1 <= item["ayat"] <= 7
            assert item["kata_idx"] >= 0
            assert item["severity"] in ("major", "minor")

    assert 0.0 <= data["ml_confidence"] <= 1.0

    raw = data.get("ml_raw_output") or {}
    if raw.get("sifa_available") is False:
        print("⚠️  Head sifa belum jalan — semua temuan jaliy, khafiy selalu 0.")
        print("   Skor mesin akan tampak lebih longgar daripada pengajar.")

    print("✅ Contract OK — response match MLPredictResult (5 indikator)")


if __name__ == "__main__":
    main()
