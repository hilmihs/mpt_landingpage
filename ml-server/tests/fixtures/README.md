# Test fixtures

`test_audio.py` generate WAV sintetis on-the-fly (tidak perlu file commit).

Untuk smoke test inference nyata (`scripts/test_inference.py`), siapkan audio
bacaan Al-Fatihah sendiri (jangan commit ke repo — bisa mengandung suara peserta):

- Format: `.webm` (utama), atau `.ogg/.opus/.m4a/.wav/.mp3`
- Durasi: 5–320 detik
- Contoh: rekam bacaan Al-Fatihah via browser/HP, simpan di sini sebagai
  `sample.webm` (sudah di-ignore via `.gitignore`).

```bash
python scripts/test_inference.py tests/fixtures/sample.webm
```
