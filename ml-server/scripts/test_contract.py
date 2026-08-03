"""
Contract test: POST /predict ke server lokal, validate response shape PERSIS
sesuai MLPredictResult yang worker Next.js harapkan.

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
