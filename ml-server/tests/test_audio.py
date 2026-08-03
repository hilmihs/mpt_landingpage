"""
Tests audio preprocessing. Butuh ffmpeg + ffprobe di PATH.
Generate fixture wav on the fly (tanpa file commit).
"""
import math
import struct
import tempfile
import wave
from pathlib import Path

import pytest

from app.ml.audio import load_and_preprocess


def _make_wav(seconds: float, sr: int = 16000) -> bytes:
    n = int(seconds * sr)
    buf = tempfile.NamedTemporaryFile(suffix=".wav", delete=False)
    path = Path(buf.name)
    buf.close()
    try:
        with wave.open(str(path), "wb") as w:
            w.setnchannels(1)
            w.setsampwidth(2)
            w.setframerate(sr)
            frames = b"".join(
                struct.pack("<h", int(0.3 * 32767 * math.sin(2 * math.pi * 220 * i / sr)))
                for i in range(n)
            )
            w.writeframes(frames)
        return path.read_bytes()
    finally:
        path.unlink(missing_ok=True)


@pytest.mark.asyncio
async def test_preprocess_valid_audio():
    data = _make_wav(6.0)
    tensor, duration = await load_and_preprocess(data, target_sr=16000)
    assert 5.5 < duration < 6.5
    assert tensor.ndim == 1
    assert len(tensor) > 0


@pytest.mark.asyncio
async def test_preprocess_too_short_raises():
    data = _make_wav(2.0)
    with pytest.raises(ValueError, match="too short"):
        await load_and_preprocess(data)


@pytest.mark.asyncio
async def test_preprocess_too_long_raises():
    # > 320s; buat singkat tapi mock durasi tidak feasible tanpa file besar,
    # jadi pakai 321s wav kecil (silence) — sr rendah biar ukuran kecil.
    data = _make_wav(321.0, sr=8000)
    with pytest.raises(ValueError, match="too long"):
        await load_and_preprocess(data)


@pytest.mark.asyncio
async def test_preprocess_invalid_bytes_raises():
    with pytest.raises(ValueError):
        await load_and_preprocess(b"not-audio-at-all")


@pytest.mark.asyncio
async def test_no_temp_audio_leftover(tmp_path, monkeypatch):
    # temp file dibuat di sistem tempdir; pastikan tidak ada *.audio tersisa
    import app.ml.audio as audio_mod

    monkeypatch.setattr(audio_mod.tempfile, "tempdir", str(tmp_path), raising=False)
    data = _make_wav(6.0)
    await load_and_preprocess(data)
    leftovers = list(Path(tmp_path).glob("*.audio"))
    assert leftovers == []
