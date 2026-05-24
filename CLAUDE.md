# CLAUDE CODE PROMPT v2 — Muhajir Project Tilawah

## Project Context

Anda akan membangun **Assessment Al-Fatihah** untuk Muhajir Project Tilawah, sebuah lembaga pendampingan tilawah Al-Quran di Indonesia. Platform web ini memungkinkan peserta merekam bacaan Al-Fatihah, dianalisis oleh AI untuk deteksi 4 indikator Lahn Jaliy (Harakat, Huruf, Panjang Pendek, Syaddah), dan mendapat rapot dengan skor 1-5 serta rekomendasi mendaftar Program Tahsin Al-Fatihah.

**Catatan penting:** Ini bukan sekedar Whisper transcription. Sistem ini WAJIB deteksi 4 indikator Lahn Jaliy. AI engine yang dipakai adalah **Mu'alim Open Source** dari researcher obadx (model `muaalem-model-v3_2`), dideploy self-host di GPU server.

## Architecture Overview

Sistem ini ada 3 layer terpisah yang bisa di-develop paralel:

```
[Browser]                    [Vercel]                    [GPU Server]
   |                            |                              |
Frontend Next.js  --------->  API Routes Next.js   --------->  ML Inference Python
+ Recording               + Job Queue (BullMQ)         + Mu'alim v3_2 TorchScript
+ UI Rapot                + Supabase Storage           + FastAPI worker
                          + Postgres DB
                          + Redis Upstash
```

**Phase 1-3:** Build frontend + backend + DB lengkap dengan mock ML response, supaya bisa progress paralel sambil ML engineer Anda setup model di GPU server.

**Phase 4-7:** Integrasi ke real ML server, testing, refinement, launch.

## Tech Stack (LOCKED)

```yaml
Frontend:
  framework: Next.js 15.x (App Router)
  language: TypeScript strict mode
  styling: Tailwind v4
  ui: shadcn/ui
  animation: Framer Motion
  audio_recording: MediaRecorder API
  audio_viz: Web Audio AnalyserNode
  state: Zustand atau React Context

Backend:
  framework: Next.js API Routes (sama proyek)
  database: Supabase Postgres
  storage: Supabase Storage
  queue: BullMQ + Upstash Redis
  id_generator: nanoid(12)

ML Server (separate Python project):
  framework: FastAPI
  ml: PyTorch + Mu'alim v3_2 TorchScript
  worker: BullMQ Python client atau custom Redis worker
  audio: librosa + ffmpeg

Deployment:
  frontend_backend: Vercel
  ml_server: Biznet Gio Cloud T4 16GB (rekomendasi)

Development Tools:
  package_manager: pnpm
  linting: ESLint + Prettier
  testing: Vitest + Playwright (optional)
```

## Database Schema

```sql
-- Peserta submission
CREATE TABLE submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT now(),

  -- Form data
  nama TEXT NOT NULL,
  jenis_kelamin TEXT NOT NULL CHECK (jenis_kelamin IN ('ikhwan', 'akhwat')),
  nomor_wa TEXT NOT NULL,

  -- Audio
  audio_path TEXT NOT NULL,
  audio_duration_sec NUMERIC,

  -- Processing status
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  error_message TEXT,
  processed_at TIMESTAMPTZ,

  -- Reference ke rapot
  rapot_slug TEXT UNIQUE,

  CONSTRAINT valid_wa CHECK (nomor_wa ~ '^(\+62|0|62)[0-9]{8,13}$')
);

-- Hasil rapot
CREATE TABLE rapot (
  slug TEXT PRIMARY KEY,
  submission_id UUID NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),

  -- Skor utama 1-5
  skor INT NOT NULL CHECK (skor BETWEEN 1 AND 5),
  status_label TEXT NOT NULL,

  -- Errors per 4 indikator (JSONB)
  errors_harakat JSONB DEFAULT '[]'::jsonb,
  errors_huruf JSONB DEFAULT '[]'::jsonb,
  errors_panjang_pendek JSONB DEFAULT '[]'::jsonb,
  errors_syaddah JSONB DEFAULT '[]'::jsonb,

  -- Aggregate stats
  total_errors_major INT NOT NULL DEFAULT 0,
  total_errors_minor INT NOT NULL DEFAULT 0,
  weighted_score NUMERIC,

  -- ML metadata
  ml_model_version TEXT,
  ml_confidence NUMERIC,
  ml_raw_output JSONB
);

CREATE INDEX idx_submissions_status ON submissions(status) WHERE status != 'completed';
CREATE INDEX idx_submissions_created ON submissions(created_at DESC);
CREATE INDEX idx_rapot_submission ON rapot(submission_id);
```

## API Contracts

### POST /api/submit

```typescript
// Request: FormData with audio + nama + jenis_kelamin + nomor_wa
// Response 200: { submission_id: string, estimated_wait_seconds: number }
// Response 400: { error: 'validation_failed', details: [...] }
```

### GET /api/rapot/[slug]/status

```typescript
// Response 200 (processing): { status: 'pending' | 'processing', progress?: number }
// Response 200 (done): { status: 'completed', rapot_url: string }
// Response 200 (failed): { status: 'failed', error_message: string }
```

### GET /api/rapot/[slug]

```typescript
// Response 200: full rapot data dengan errors per kategori + recommendation
```

### ML Server: POST /predict

```typescript
// Request: { submission_id, audio_url, surah: 1, ayat_range: '1-7' }
// Response: { result: { errors_*, total_*, weighted_score, confidence, model_version } }
```

## Scoring Logic

```typescript
// File: lib/scoring.ts

const SEVERITY_WEIGHT = {
  major: 1,    // Lahn Jaliy
  minor: 0.5,  // Lahn Khafiy
};

const SCORE_THRESHOLDS = [
  { min: 0, max: 0, skor: 5, label: 'Bacaan Sempurna' },
  { min: 0.5, max: 2, skor: 4, label: 'Bacaan Sangat Baik' },
  { min: 2.5, max: 5, skor: 3, label: 'Bacaan Cukup Baik' },
  { min: 5.5, max: 10, skor: 2, label: 'Bacaan Perlu Penguatan' },
  { min: 10.5, max: Infinity, skor: 1, label: 'Bacaan Perlu Penguatan Dasar' },
];

// IMPORTANT: Semua skor 1-5 recommendation = Tahsin Al-Fatihah (single funnel)
```

## Mock ML Response untuk Development

Selama Phase 1-3, gunakan mock supaya developer bisa progress tanpa nunggu ML engineer:

```typescript
// File: lib/mock-ml.ts
// Replace dengan real ML call di Phase 4

export function mockMLPredict(input): MLPredictResult {
  // Deterministic random based on submission_id
  // Return scenario: lancar (40%), cukup (30%), banyak salah (20%), pemula (10%)
}
```

## Implementation Phases

### Phase 1: Foundation (Hari 1-3)
- Init Next.js 15 + TypeScript strict
- Setup Tailwind v4 + shadcn/ui
- Setup Supabase + Upstash Redis
- Run migration: tabel submissions + rapot
- Setup Vercel deployment

### Phase 2: Frontend Core (Hari 4-10)
- Landing page dengan hero + CTA
- Consent screen privacy notice
- Recording page dengan MediaRecorder + audio visualizer
- Form page (nama + jenis kelamin + nomor WA)
- Loading screen dengan polling
- Rapot page dengan 4 section indikator + CTA Tahsin
- Mobile responsive (target 70% traffic dari HP)

### Phase 3: Backend API + Mock ML (Hari 11-15)
- POST /api/submit
- GET /api/rapot/[slug]/status
- GET /api/rapot/[slug]
- Worker dengan mockMLPredict
- Auto-delete audio > 7 hari
- Rate limiting per IP

### Phase 4: ML Server Setup (Hari 16-25) - Parallel
ML Engineer Anda kerja paralel di Python project terpisah:
- Setup Python 3.11 + Poetry
- Download model obadx/muaalem-v3_2-torchscript-v1
- Build inference pipeline (audio preprocessing, segmentasi, forward pass, decode QPS, mapping 4 indikator)
- FastAPI endpoint POST /predict
- Redis worker
- Dockerize + deploy ke Biznet Gio Cloud T4
- Test dengan 20 sample audio
- Benchmark akurasi vs ground truth Ustadzah

### Phase 5: Integration (Hari 26-30)
- Replace mockMLPredict dengan real call
- Setup secure communication (API key + HTTPS)
- Error handling + retry logic
- End-to-end testing
- Load testing 50 concurrent

### Phase 6: Refinement (Hari 31-35)
- UX polish dan micro-interactions
- Copy review oleh Ustadzah
- Edge case handling
- Performance optimization
- SEO dan analytics

### Phase 7: Launch (Hari 36-40)
- Soft launch 50 peserta internal
- Collect feedback + bug fixes
- Compare AI output vs Ustadzah judgement
- Public launch via Linktree
- Monitor first week

## Key Constraints (LOCKED)

```yaml
audio_format: WebM/Opus
audio_max_duration: 5 menit
audio_retention: 7 hari (auto-delete)
slug_length: 12 karakter (nanoid)
form_required: nama, jenis_kelamin, nomor_wa
nomor_wa_format: Indonesia (+62, 0, atau 62)
scoring_scale: 1-5 (BUKAN 1-10)
severity_weights: major=1, minor=0.5
recommendation_target: Tahsin Al-Fatihah (single funnel untuk SEMUA skor)
linktree_url: linktr.ee/muhajirprojecttilawah
share_method: Share via WA + Copy Link
report_flow: redirect setelah AI selesai
ml_engine: Mu'alim Open Source obadx/muaalem-model-v3_2
ml_deployment: self-host GPU server
data_residency: Indonesia (UU PDP)
```

## File Structure

```
muhajir-tilawah/
├── app/
│   ├── (marketing)/page.tsx
│   ├── assessment/
│   │   ├── consent/page.tsx
│   │   ├── record/page.tsx
│   │   ├── form/page.tsx
│   │   └── loading/[id]/page.tsx
│   ├── rapot/[slug]/page.tsx
│   ├── api/
│   │   ├── submit/route.ts
│   │   ├── rapot/[slug]/route.ts
│   │   ├── rapot/[slug]/status/route.ts
│   │   ├── worker/route.ts
│   │   └── cleanup/route.ts
│   └── layout.tsx
├── components/
│   ├── ui/ (shadcn)
│   ├── recording/
│   ├── rapot/
│   └── shared/
├── lib/
│   ├── supabase.ts
│   ├── redis.ts
│   ├── arabic.ts
│   ├── scoring.ts
│   ├── mock-ml.ts (Phase 1-3)
│   ├── ml-client.ts (Phase 4+)
│   └── utils.ts
├── hooks/
└── types/
```

## Anti-Patterns to Avoid

- JANGAN pakai Whisper sebagai engine utama (tidak detect 4 indikator)
- JANGAN hardcode API key di code (gunakan env vars)
- JANGAN simpan audio peserta lebih dari 7 hari
- JANGAN kirim audio peserta ke third-party
- JANGAN expose Supabase service_role key ke client
- JANGAN process ML inference di Next.js (butuh GPU)
- JANGAN polling lebih cepat dari setiap 2 detik
- JANGAN buat scoring linear 0-100 (gunakan 1-5)
- JANGAN beda CTA per skor (semua ke Tahsin Al-Fatihah)
- JANGAN skip mobile testing

## Success Criteria

- Peserta bisa record + submit dalam 3 menit
- ML processing kurang dari 30 detik untuk audio 60 detik
- Rapot rendering kurang dari 1 detik setelah ML completed
- Mobile UX smooth tanpa lag
- Akurasi AI agreement rate di atas 70% dengan Ustadzah
- Uptime di atas 99% untuk frontend
- Audio peserta benar-benar terhapus dalam 7 hari
- Lighthouse score di atas 90

## Final Notes

Proyek ini bukan sekedar webapp biasa. Ini tools untuk membantu umat Muslim memperbaiki bacaan Al-Quran. Setiap detail UX, copy, dan akurasi AI matter.

Bismillah, semoga Allah berkahi project ini.
