"""
Structured logging setup.

Aturan privasi (UU PDP + spec):
- JANGAN log isi audio (bytes).
- JANGAN log signed URL lengkap — URL mengandung token. Pakai redact_url().
- JANGAN log PII peserta (nama/gender) — ML server memang tidak menerimanya.
"""
import logging
import sys
from urllib.parse import urlsplit, urlunsplit

_CONFIGURED = False


def setup_logging(level: int = logging.INFO) -> None:
    global _CONFIGURED
    if _CONFIGURED:
        return
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(
        logging.Formatter(
            fmt="%(asctime)s %(levelname)s %(name)s | %(message)s",
            datefmt="%Y-%m-%dT%H:%M:%S",
        )
    )
    root = logging.getLogger()
    root.setLevel(level)
    root.handlers.clear()
    root.addHandler(handler)
    _CONFIGURED = True


def redact_url(url: str) -> str:
    """Buang query string (token signed URL) — sisakan host + path untuk debugging."""
    try:
        parts = urlsplit(url)
        return urlunsplit((parts.scheme, parts.netloc, parts.path, "", ""))
    except Exception:
        return "<unparseable-url>"
