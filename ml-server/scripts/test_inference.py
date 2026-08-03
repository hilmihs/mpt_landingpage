"""
CLI smoke test inference dengan audio file lokal (tanpa API, tanpa signed URL).

Usage: python scripts/test_inference.py path/to/audio.webm
"""
import asyncio
import sys
from pathlib import Path

from app.ml.audio import load_and_preprocess
from app.ml.mualim import MualimEngine
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
    errors = decode_to_errors(result["phonemes"], result.get("sifa"), result.get("timestamps"))
    for category, items in errors.items():
        print(f"\n{category}: {len(items)} error(s)")
        for e in items[:5]:
            print(f"  ayat {e.ayat} kata {e.kata_idx}: {e.severity} — {e.note or ''}")

    await engine.cleanup()


if __name__ == "__main__":
    asyncio.run(main())
