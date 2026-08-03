"""Pre-download Mu'alim. Run sekali sebelum first deployment."""
import sys
from pathlib import Path

from huggingface_hub import snapshot_download

if __name__ == "__main__":
    cache_dir = sys.argv[1] if len(sys.argv) > 1 else "/data/models"
    print(f"Downloading Mu'alim ke: {cache_dir}")
    path = snapshot_download(repo_id="obadx/muaalem-model-v3_2", cache_dir=cache_dir)
    print(f"Downloaded ke: {path}")
    for f in sorted(Path(path).rglob("*")):
        if f.is_file():
            print(f"  {f.relative_to(path)} — {f.stat().st_size / 1e6:.1f} MB")
