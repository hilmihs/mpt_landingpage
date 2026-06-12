# CLAUDE CODE PROMPT v3 — Muhajir Project Tilawah

## Project Context

Ini adalah codebase **Assessment Al-Fatihah + Funnel HITS** untuk Muhajir Project Tilawah, lembaga pendampingan tilawah Al-Quran di Indonesia. Peserta merekam bacaan Al-Fatihah, dianalisis AI untuk deteksi 4 indikator Lahn Jaliy (Harakat, Huruf, Panjang Pendek, Syaddah), mendapat rapot skor 1-5, lalu masuk funnel bertahap: booking assessment dengan pengajar → Tahsin Al-Fatihah (cohort) → program HITS berjenjang.

**Catatan penting:** Ini bukan sekedar Whisper transcription. Sistem WAJIB deteksi 4 indikator Lahn Jaliy. AI engine target adalah **Mu'alim Open Source** dari researcher obadx (model `muaalem-model-v3_2`), self-host di GPU server. **Saat ini ML masih MOCK** (`lib/mock-ml.ts`) — integrasi real ML adalah pekerjaan tersisa terbesar (lihat "Pekerjaan Tersisa").

## Status Implementasi

Sudah selesai (jangan rencanakan ulang dari nol — kode sudah ada):

- ✅ **Phase 1–3 (V1):** landing, consent, record, form, loading, rapot, API submit/status/rapot, worker dengan mock ML, cleanup audio 7 hari, rate limiting
- ✅ **V2:** funnel gates, booking assessment (slot picker, gender-matched, auto-assign pengajar), portal pengajar, admin console, cohort manager, attendance, AI narrative rapot
- ✅ **V2 lanjutan:** integrasi **Google Meet** (menggantikan Zoom — lihat migration 0005), seed scripts
- ✅ **V3:** dashboard peserta `/peserta/[slug]`, halaman progress Tahsin + comparison report, HITS enrollment flow
- ✅ **V4 (demo journey):** 3 jalur masuk dari landing, HITS berjenjang 4 tingkat, pengajuan halaqah organisasi, DemoNavigator

Belum selesai:

- ⏳ **Real ML server** (Python/FastAPI di GPU server) + integrasi ke worker
- ⏳ Refinement, copy review Ustadzah, load testing, launch

## Architecture Overview

```
[Browser]                  [Vercel]                         [GPU Server — BELUM ADA]
   |                          |                                    |
Frontend Next.js  ------->  API Routes Next.js        ------->  ML Inference Python
+ Recording               + Queue (Upstash Redis REST)       + Mu'alim v3_2 TorchScript
+ UI Rapot/Funnel         + Supabase Postgres+Storage+Auth   + FastAPI worker
                          + Anthropic API (AI narrative rapot, lib/ai)
                          + Google Calendar/Meet API (lib/google-meet)
```

Cron Vercel (`vercel.json`, daily karena limit Hobby plan):
- `/api/worker` 03:00 — drain queue (dev: trigger manual `curl -X POST /api/worker -H "x-worker-secret: $WORKER_SECRET"`)
- `/api/cleanup` 02:00 — hapus audio >7 hari
- `/api/meet/reconcile` 04:00 — attendance dari Google Meet

## Tech Stack (aktual)

```yaml
Frontend/Backend (satu proyek Next.js):
  framework: Next.js 16.2.6 (App Router) + React 19.2   # spec lama bilang 15.x; aktual 16
  language: TypeScript strict mode
  styling: Tailwind v4 + shadcn/ui (radix-ui) + Framer Motion + sonner
  state: Zustand (lib/store.ts)
  validation: Zod v4 (lib/validation.ts)
  audio: MediaRecorder API + Web Audio AnalyserNode (hooks/useAudioRecorder.ts)
  database: Supabase Postgres (+ Auth untuk admin/pengajar, + Storage untuk audio)
  queue: Upstash Redis REST (lib/queue.ts, lib/redis.ts)
  ai_narrative: "@anthropic-ai/sdk (lib/ai/anthropic.ts + explain-rapot.ts)"
  meet: googleapis + google-auth-library (lib/google-meet/)
  id_generator: nanoid(12)

ML Server (proyek Python terpisah, BELUM dibuat):
  framework: FastAPI, PyTorch + Mu'alim v3_2 TorchScript, librosa + ffmpeg

Tooling:
  package_manager: pnpm
  seed: pnpm seed:dev / pnpm seed:reset (scripts/seed-dev.ts, via tsx)
  deployment: Vercel (frontend+backend), Biznet Gio Cloud T4 (rencana ML)
```

## Database

**Sumber kebenaran: `supabase/migrations/` — jangan duplikasi schema dari dokumen, baca migration-nya.**

- `0001_init.sql` — `submissions` + `rapot` (skor 1-5, errors per 4 indikator JSONB, constraint WA Indonesia)
- `0002_booking_v2.sql` — `teachers`, `teacher_availability`, `slots`, `bookings`, `cohorts`, `cohort_sessions`, `cohort_enrollments`, `attendance`, `interest_responses`, `analytics_events`, `admins`, `audit_logs`, view `v_funnel_metrics` + `v_slots_availability`
- `0003_tahsin_enroll_rpc.sql` — RPC enrollment Tahsin (atomic, kapasitas-aware)
- `0004_booking_rpc.sql` — RPC booking slot
- `0005_zoom_to_meet.sql` — rename kolom Zoom → Google Meet: `slots.meet_calendar_event_id/meet_join_url/meet_host_email/meet_conference_id`, `attendance.meet_participant_*`, `teachers.email_meet`

**PENTING:** enum `attendance_source` tetap berisi nilai `zoom_webhook` untuk backward compatibility — artinya "auto-detect via platform meeting", JANGAN di-rename.

## API Contracts (inti, tidak berubah)

```typescript
// POST /api/submit         — FormData audio+nama+jenis_kelamin+nomor_wa
//   200: { submission_id, estimated_wait_seconds } | 400: { error: 'validation_failed', details }
// GET /api/rapot/[slug]/status — { status: 'pending'|'processing' } | { status:'completed', rapot_url } | { status:'failed', error_message }
// GET /api/rapot/[slug]    — full rapot + errors per kategori + recommendation
// ML Server POST /predict (kontrak untuk Phase ML):
//   Request: { submission_id, audio_url, surah: 1, ayat_range: '1-7' }
//   Response: { result: { errors_*, total_*, weighted_score, confidence, model_version } }
//   Schema TypeScript: MLPredictResult di types/index.ts
```

Route group lain yang sudah ada: `api/booking/{create,slots}`, `api/tahsin/{cohorts,enroll}`, `api/interest`, `api/gate-impression`, `api/analytics/track`, `api/hits/click`, `api/admin/**` (pengajar/cohort/slots CRUD), `api/portal/**` (attendance/availability/profile), `api/meet/reconcile`, `api/zoom/webhook` (legacy), `api/dev/skip-session`, `api/bypass/[slug]`.

## Scoring Logic (`lib/scoring.ts` — LOCKED)

```typescript
const SEVERITY_WEIGHT = { major: 1, minor: 0.5 };  // major=Lahn Jaliy, minor=Lahn Khafiy
// Threshold weighted_score → skor 1-5:
// 0 → 5 'Bacaan Sempurna' | 0.5–2 → 4 'Sangat Baik' | 2.5–5 → 3 'Cukup Baik'
// 5.5–10 → 2 'Perlu Penguatan' | >10 → 1 'Perlu Penguatan Dasar'
// Semua skor 1-5 → rekomendasi Tahsin Al-Fatihah (single funnel di rapot)
```

## Funnel & Fitur (V2–V4)

**3 jalur masuk dari landing page (`app/page.tsx`):**
1. **Assessment AI** → consent → record → form → rapot (`app/assessment/**`, `app/rapot/[slug]`)
2. **Daftar HITS langsung** → form + tes penempatan 6 soal tajwid → tier assignment (`app/daftar-hits/**`)
3. **Pengajuan halaqah organisasi** → form + konfirmasi (`app/pengajuan/**`)

**Funnel gates setelah rapot:**
```
Rapot → Gate 1 (InterestGate) ──Ya──→ Booking Assessment (/booking/assessment/[slug])
          │ Tidak                       → Meeting 60 menit, 12 peserta, gender-matched
          ▼                           → Gate 2 → Tahsin Al-Fatihah (cohort, 4 sesi × 90 menit)
   Thank-you state                    → Gate 3 → Enrollment HITS IN-APP (bukan Linktree!)
   (TANPA redirect Linktree)
```

- **Gate 3 sudah BUKAN Linktree.** Enrollment HITS terjadi in-app (`app/peserta/[slug]/hits/**`). URL `linktr.ee/muhajirprojecttilawah` hanya tersisa di `api/hits/click/route.ts` (tracked click).
- **HITS berjenjang 4 tingkat** (definisi di `lib/demo-data.ts` → `HITS_TIERS`): HITS Dasar → Lanjutan Awal → Lanjutan Menengah → Lanjutan Expert. Halaman kelas: dashboard progress, daftar sesi, ujian badge, naik tingkat (`app/peserta/[slug]/hits/kelas/**`).
- **Dashboard peserta** `/peserta/[slug]`: riwayat rapot, program aktif, jadwal.
- **Attendance:** Google Meet reconcile (cron) primary → AI fuzzy match fallback (≥0.8 confidence, `lib/google-meet/matcher.ts`) → manual override pengajar.
- Konstrain locked: assessment 60 menit kapasitas 12; Tahsin 90 menit × 4 sesi (2x/minggu × 2 minggu) kapasitas 12; semua gender-matched strict (ikhwan-ikhwan, akhwat-akhwat); user pilih slot → sistem auto-assign pengajar (filter gender); lulus Tahsin = ≥3 dari 4 sesi attended.

**Auth 3 role:**
- Peserta: anonymous + slug-based (tanpa akun)
- Pengajar: Supabase Auth **phone+password**, route obscure `/portal-mpt-x7` (login: nomor WA + password dari admin)
- Admin: Supabase Auth **email magic link**, `/admin`
- `app/robots.ts` disallow: `/portal-mpt-x7/`, `/admin/`, `/booking/confirm/`, `/api/`, `/auth/`

## Konvensi Dev & Demo

- `NEXT_PUBLIC_DEMO_MODE=1` → DemoNavigator floating panel (`components/demo/DemoNavigator.tsx`); demo slug: `DEMO_SLUG = "demo-bilal-09"` di `lib/demo-data.ts`
- `?dev=1` di banyak halaman → tombol skip/bypass alur
- `POST /api/dev/skip-session` → insert attendance sesi cohort berikutnya (untuk demo progress Tahsin)
- `/api/bypass/[slug]` → bypass gate
- `DEV_BYPASS_RATELIMIT=1` → bypass rate limit submit
- Seed: `pnpm seed:dev` (10 peserta di semua tahap funnel + admin + 4 pengajar dummy), `pnpm seed:reset`
- **Semua fitur dev/bypass di atas WAJIB di-guard agar tidak aktif di production.**

## Pekerjaan Tersisa (jangan kerjakan ulang yang sudah ✅)

1. **ML server Python** (proyek terpisah): FastAPI `POST /predict`, Mu'alim v3_2 TorchScript, deploy GPU server, benchmark vs ground truth Ustadzah.
2. **Integrasi:** satu titik swap — `app/api/worker/route.ts` saat ini memanggil `mockMLPredict(...)` tanpa kondisi. Env `ML_SERVER_URL` + `ML_SERVER_API_KEY` sudah disiapkan di `.env.example` tapi belum dibaca worker. Buat `lib/ml-client.ts` yang memenuhi kontrak `MLPredictResult` (`types/index.ts`), dengan retry + error handling.
3. Refinement: copy review, edge cases, load testing 50 concurrent, Lighthouse >90, launch.

## Key Constraints (LOCKED)

```yaml
audio_format: WebM/Opus, max 5 menit, retensi 7 hari (auto-delete)
slug_length: 12 karakter (nanoid)
form_required: nama, jenis_kelamin, nomor_wa (format +62/0/62)
scoring_scale: 1-5 (BUKAN 1-10), severity major=1 minor=0.5
recommendation_rapot: Tahsin Al-Fatihah single funnel untuk SEMUA skor
gate_3: enrollment HITS in-app 4 tingkat (BUKAN redirect Linktree)
meeting_platform: Google Meet (kolom meet_*; lib/zoom = legacy)
ml_engine: Mu'alim obadx/muaalem-model-v3_2, self-host GPU (saat ini mock)
data_residency: Indonesia (UU PDP) — Supabase region Singapore
```

## File Structure (aktual, ringkas)

```
app/
├── page.tsx                  # Landing — 3 jalur masuk
├── assessment/{consent,record,form,loading/[id]}/
├── rapot/[slug]/             # Rapot + InterestGate (Gate 1)
├── booking/{assessment/[slug],confirm/[bookingId]}/
├── tahsin/[slug]/            # Gate 2 enrollment
├── peserta/[slug]/           # Dashboard peserta
│   ├── assessment-result/  tahsin/{,report}/
│   └── hits/{,kelas/{,sesi/[n],naik-tingkat}}/
├── daftar-hits/{,penempatan,hasil}/   # Jalur 2
├── pengajuan/{,konfirmasi}/           # Jalur 3
├── hits/[slug]/
├── admin/{login,(authed)/{overview,peserta,pengajar,jadwal,cohort,analytics}}/
├── portal-mpt-x7/{login,(authed)/{dashboard,bookings,availability,attendance,cohorts,profil}}/
├── auth/callback/  robots.ts
└── api/ (lihat "API Contracts")
components/{ui,recording,rapot,booking,tahsin,assessment,admin,portal,demo,shared}/
lib/
├── ai/{anthropic,explain-rapot}.ts    # AI narrative rapot
├── auth/{admin,teacher}.ts  google-meet/{auth,client,matcher,reconcile}.ts
├── zoom/ (legacy)  slots/generate.ts
├── scoring.ts  mock-ml.ts  demo-data.ts  eligibility.ts  validation.ts
├── supabase.ts  supabase-server.ts  redis.ts  queue.ts  analytics.ts
hooks/{useAudioRecorder,useRapotPolling,useScrollAnim}.ts
types/index.ts                # incl. MLPredictResult (kontrak ML)
supabase/migrations/0001–0005
scripts/seed-dev.ts
```

## Anti-Patterns to Avoid

- JANGAN pakai Whisper sebagai engine utama (tidak detect 4 indikator)
- JANGAN hardcode API key (env vars; lihat `.env.example`)
- JANGAN simpan audio peserta >7 hari, JANGAN kirim audio ke third-party
- JANGAN expose Supabase service_role key ke client (`supabaseService()` server-only)
- JANGAN process ML inference di Next.js (butuh GPU)
- JANGAN polling lebih cepat dari 2 detik (`hooks/useRapotPolling.ts`)
- JANGAN scoring linear 0-100 (gunakan 1-5)
- JANGAN beda CTA per skor di rapot (semua ke Tahsin Al-Fatihah)
- JANGAN redirect ke Linktree dari Gate 1/rapot (bypass funnel — sudah diperbaiki di `InterestGate.tsx`)
- JANGAN menulis kode Zoom baru — platform meeting adalah Google Meet (`lib/google-meet/`)
- JANGAN rename nilai enum `attendance_source: zoom_webhook` (backward compat)
- JANGAN skip mobile testing (target 70% traffic HP)

## Success Criteria

- Record + submit < 3 menit; ML < 30 detik untuk audio 60 detik; rapot render < 1 detik
- Akurasi AI agreement rate > 70% dengan Ustadzah
- Audio benar-benar terhapus dalam 7 hari; uptime > 99%; Lighthouse > 90

## Referensi Dokumen

- `docs/ARCHITECTURE_V2.md` — desain V2 awal (historis; deviasi V3/V4 dicatat di prompt ini: Zoom→Meet, Gate 3 in-app, HITS 4 tingkat)
- `README.md` — setup Supabase/Upstash/env, smoke test, deployment

## Final Notes

Proyek ini bukan sekedar webapp biasa. Ini tools untuk membantu umat Muslim memperbaiki bacaan Al-Quran. Setiap detail UX, copy, dan akurasi AI matter.

Bismillah, semoga Allah berkahi project ini.
