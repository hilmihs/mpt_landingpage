# Muhajir Tilawah ML Server

ML server **stateless** untuk Assessment Al-Fatihah. Dipanggil server-to-server
oleh worker Next.js (`app/api/worker/route.ts`) via `POST /predict`.

Pipeline: download audio (signed URL Supabase) → preprocess ffmpeg (16kHz mono) →
inference Mu'alim (`obadx/muaalem-model-v3_2`) → decode ke 4 indikator Lahn Jaliy
dengan posisi kata → return `MLPredictResult`.

**Yang TIDAK dilakukan di sini:** skoring 1-5, AI narrative/feedback, simpan PII.
Itu semua di sisi Next.js (`lib/scoring.ts`, `lib/ai/explain-rapot.ts`).

> Spec sumber: `../docs/ML_SERVER_PROMPT_V2.md` (repo Next.js).

---

## ⚠️ Status implementasi

| Komponen | Status |
|---|---|
| `audio.py`, `schemas.py`, `config.py`, API, auth, health, logging | ✅ Lengkap, deterministik |
| `qps_decoder.py` (Wagner-Fischer + klasifikasi) | ✅ Phase-1 heuristik, unit-tested |
| `alfatihah.py` (word seg + index map) | ✅ Jalan; **skema phoneme heuristik, belum match vocab QPS model** |
| `mualim.py` (load + predict) | ⚠️ **Best-effort, BELUM diverifikasi** dengan model + GPU |

Dua hal **wajib diverifikasi di sesi GPU** sebelum produksi:
1. `mualim.py` — loading transformers + struktur output multi-level CTC
   (`_decode_outputs`). Model card menyebut `Wav2Vec2BertForMultilevelCTC`,
   safetensors (BUKAN TorchScript). Jalankan `scripts/test_inference.py` dulu.
2. `alfatihah.ALFATIHAH_PHONEMES_PER_WORD` — saat ini di-generate transliterator
   heuristik (`text_to_qps_heuristic`). Setelah tahu vocab QPS aktual model,
   ganti supaya match. Tanpa ini, posisi/kategori error tidak akurat.

---

## Quick Start

### Local dev (CPU — dev/test deterministik tanpa GPU)

```bash
cd ml-server
cp .env.example .env       # set API_KEY (openssl rand -hex 32)

pip install -e ".[dev]"

# Unit test yang tidak butuh model (decoder + audio):
pytest tests/test_decoder.py -q
pytest tests/test_audio.py -q      # butuh ffmpeg + ffprobe di PATH

# Pre-download model (~2.4 GB) sebelum inference nyata:
python scripts/download_model.py ./models

uvicorn app.main:app --reload      # http://localhost:8000/docs
```

> Tanpa model ter-load, server jalan **degraded**: `/health` balas `degraded`,
> `/predict` balas `503`. Auth (`401`) tetap bisa dites tanpa model.

### Production (GCP VM + GPU T4, Jakarta)

```bash
chmod +x scripts/gcp_deploy.sh
./scripts/gcp_deploy.sh                                   # Spot VM, asia-southeast2-a

gcloud compute ssh muhajir-ml-server --zone=asia-southeast2-a
# di VM:
git clone <repo> && cd ml-server
cp .env.example .env && nano .env                         # set API_KEY
docker compose up -d --build
docker compose logs -f
```

---

## Endpoints

### `POST /predict`  (auth WAJIB)

Header: `Authorization: Bearer <API_KEY>` → tanpa/salah key = `401`.

Request:
```json
{ "submission_id": "uuid", "audio_url": "https://...supabase.../sign/...", "surah": 1, "ayat_range": "1-7" }
```

Response `200` (`MLPredictResult`):
```json
{
  "errors_harakat": [ {"ayat":2,"kata_idx":3,"expected":"لِلّٰهِ","actual":"لِلّٰهِ","severity":"major","note":"..."} ],
  "errors_huruf": [], "errors_panjang_pendek": [], "errors_syaddah": [],
  "ml_model_version": "muaalem-v3_2", "ml_confidence": 0.85, "ml_raw_output": { }
}
```

Error: `400` audio invalid/<5s/>320s/>25MB/download gagal · `401` API key salah ·
`500` inference error · `503` model belum loaded.

### `GET /health`  (tanpa auth)
`{ "status": "ok"|"degraded", "mualim_loaded": bool }`

---

## Testing berurutan

```bash
# 1. Smoke test load + inference (butuh model + GPU/CPU)
python scripts/test_inference.py tests/fixtures/sample.webm

# 2. Run server + contract test (response harus match MLPredictResult)
uvicorn app.main:app &
python scripts/test_contract.py http://localhost:8000 <api_key> <audio_url>

# 3. Auth: request tanpa Bearer → 401
curl -X POST http://localhost:8000/predict -d '{}' -H "Content-Type: application/json"

# 4. End-to-end: set ML_SERVER_URL di Vercel preview, submit assessment,
#    cek rapot render dengan highlight kata yang salah.
```

---

## Cost strategy (GCP $300 free credit)

VM T4 + n1-standard-4 ≈ **$0.55/jam** → kredit habis ~22 hari kalau 24/7.

- **Spot VM** (default `gcp_deploy.sh`): sampai 75% lebih murah, bisa di-stop random.
- **Stop saat idle** (paling hemat): `gcloud compute instances stop muhajir-ml-server --zone=asia-southeast2-a`
- Persistent disk untuk model cache → tidak re-download 2.4 GB tiap restart.
- **Budget alert GCP** di $50 / $100 / $200 / $250.

```bash
# Stop / start:
gcloud compute instances stop  muhajir-ml-server --zone=asia-southeast2-a
gcloud compute instances start muhajir-ml-server --zone=asia-southeast2-a
```

⚠️ **Selalu stop VM setelah testing.**

---

## Security

- Region `asia-southeast2` (**Jakarta**) — data residency Indonesia (UU PDP).
  `asia-southeast1` = Singapore, jangan tertukar.
- Jangan expose port `8000` plain HTTP ke publik. Pakai reverse proxy (caddy/nginx)
  + TLS, atau firewall rule allow Vercel saja.
- `API_KEY` wajib; sama persis dengan `ML_SERVER_API_KEY` di Vercel.
- Audio temp file **selalu dihapus** setelah inference (no retention di ML server;
  retention 7 hari diurus Supabase di sisi Next.js).
- Logging: tidak ada audio bytes / signed URL lengkap (URL mengandung token,
  di-redact via `utils/logging.redact_url`).

---

## Follow-up: perubahan sisi Next.js (sesi terpisah, BUKAN di folder ini)

Sumber: `docs/ML_SERVER_PROMPT_V2.md` §"Perubahan Sisi Next.js".

1. **`lib/ml-client.ts`** — `mlPredict()` HTTP client (signature sama dengan
   `mockMLPredict`), POST `${ML_SERVER_URL}/predict` + Bearer `ML_SERVER_API_KEY`,
   `AbortSignal.timeout(120_000)`.
2. **`app/api/worker/route.ts`** (~line 42) — conditional:
   `process.env.ML_SERVER_URL ? await mlPredict(...) : mockMLPredict(...)`
   (mock tetap untuk dev lokal tanpa GPU).
3. **`lib/ai/explain-rapot.ts`** — swap Anthropic → DeepSeek (OpenAI-compatible,
   `baseURL https://api.deepseek.com`, env `DEEPSEEK_API_KEY`). **Verifikasi model
   id di api-docs.deepseek.com** (`deepseek-chat` known-good). Pertahankan fallback
   `ai_narrative = null` kalau gagal.
4. **Env Vercel**: isi `ML_SERVER_URL`, `ML_SERVER_API_KEY`, tambah `DEEPSEEK_API_KEY`.

---

## Definition of Done

Lihat `docs/ML_SERVER_PROMPT_V2.md` §"Definition of Done" (kontrak lengkap).
