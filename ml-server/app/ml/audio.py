"""
Download audio dari signed URL Supabase + preprocess via ffmpeg.

Support: .webm (utama — browser MediaRecorder), .ogg, .opus, .m4a, .wav, .mp3.
ffmpeg subprocess = format-agnostic decoding.
Temp file SELALU dihapus (no audio retention di ML server).
"""
import logging
import subprocess
import tempfile
from pathlib import Path

import httpx
import numpy as np
import torch

from app.config import settings

log = logging.getLogger(__name__)


async def download_audio(audio_url: str) -> bytes:
    """Download dari signed URL. Raises ValueError kalau gagal/kebesaran/kosong."""
    async with httpx.AsyncClient(timeout=settings.download_timeout_sec) as client:
        resp = await client.get(audio_url)
        if resp.status_code != 200:
            raise ValueError(f"Audio download failed: HTTP {resp.status_code}")
        data = resp.content
    if len(data) > settings.max_audio_bytes:
        raise ValueError(f"Audio too large: {len(data)} bytes (max {settings.max_audio_bytes})")
    if len(data) == 0:
        raise ValueError("Empty audio download")
    return data


async def load_and_preprocess(
    audio_bytes: bytes,
    target_sr: int = 16000,
) -> tuple[torch.Tensor, float]:
    """
    Audio bytes → tensor float32 mono @ target_sr.
    Returns: (audio_tensor, duration_sec)
    Raises: ValueError kalau invalid / di luar batas durasi.
    """
    with tempfile.NamedTemporaryFile(suffix=".audio", delete=False) as f:
        f.write(audio_bytes)
        temp_path = Path(f.name)

    try:
        duration = _get_duration(temp_path)
        if duration < settings.min_audio_duration_sec:
            raise ValueError(
                f"Audio too short: {duration:.1f}s (min {settings.min_audio_duration_sec}s)"
            )
        if duration > settings.max_audio_duration_sec:
            raise ValueError(
                f"Audio too long: {duration:.1f}s (max {settings.max_audio_duration_sec}s)"
            )

        cmd = [
            "ffmpeg", "-i", str(temp_path),
            "-f", "s16le", "-ac", "1", "-ar", str(target_sr),
            "-loglevel", "error", "-",
        ]
        result = subprocess.run(cmd, capture_output=True, timeout=60)
        if result.returncode != 0:
            raise ValueError(f"ffmpeg decode failed: {result.stderr.decode()[:200]}")

        audio_np = np.frombuffer(result.stdout, dtype=np.int16).astype(np.float32) / 32768.0
        if len(audio_np) == 0:
            raise ValueError("Empty audio after decode")

        return torch.from_numpy(audio_np), duration
    finally:
        temp_path.unlink(missing_ok=True)


def _get_duration(path: Path) -> float:
    cmd = [
        "ffprobe", "-v", "error",
        "-show_entries", "format=duration",
        "-of", "default=noprint_wrappers=1:nokey=1",
        str(path),
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=15)
    if result.returncode != 0:
        raise ValueError(f"ffprobe failed: {result.stderr[:120]}")
    return float(result.stdout.strip())
