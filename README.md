# Muhajir Project Tilawah — Assessment Al-Fatihah

Webapp untuk asesmen bacaan Al-Fatihah dengan analisis 4 indikator Lahn Jaliy (Harakat, Huruf, Panjang Pendek, Syaddah) dan rapot 1–5 + rekomendasi Program Tahsin.

**Status:** Phase 1–3 selesai (Foundation + Frontend Core + Backend API dengan **mock ML**). Phase 4+ (real ML server) belum termasuk — swap `lib/mock-ml.ts` dengan HTTP client ke GPU server.

> **Note:** spec di `CLAUDE.md` lock Next.js 15.x; project ini di-init dengan `create-next-app@latest` yang memasang **Next.js 16.2.6** (App Router compatible).

## Setup

### 1. Install dependencies

```bash
pnpm install
```

### 2. Setup Supabase

1. Buat project baru di [supabase.com](https://supabase.com) (region **Singapore** untuk data residency Indonesia per UU PDP).
2. Storage → buat bucket private bernama `audio-submissions`.
3. SQL Editor → jalankan isi `supabase/migrations/0001_init.sql`.
4. Project Settings → API → catat `Project URL`, `anon` key, dan `service_role` key.

### 3. Setup Upstash Redis

1. Buat database di [console.upstash.com](https://console.upstash.com) (region terdekat ID).
2. Catat **REST URL** dan **REST Token**.

### 4. Env vars

```bash
cp .env.example .env.local
# isi nilai-nilainya
openssl rand -hex 32   # untuk WORKER_SECRET
openssl rand -hex 32   # untuk CLEANUP_SECRET
```

### 5. Run

```bash
pnpm dev
# http://localhost:3000
```

Untuk memproses queue secara manual (cron Vercel hanya jalan di prod):

```bash
curl -X POST http://localhost:3000/api/worker \
  -H "x-worker-secret: $WORKER_SECRET"
```

## Smoke test

1. Buka `/` → "Mulai Assessment"
2. Consent → "Saya setuju"
3. Record → izinkan mic → rekam 5–10 detik → Selesai → Lanjut
4. Form → isi nama, jenis kelamin, WA (cth `081234567890`) → Kirim
5. Loading page polling status → trigger worker manual (lihat di atas)
6. Auto-redirect ke `/rapot/{slug}` → tampilkan skor + 4 indikator + CTA Tahsin

## Deployment

- Push ke GitHub
- Import ke Vercel
- Set env vars di Vercel project settings
- `vercel.json` sudah punya 2 cron:
  - `/api/worker` setiap menit (drain queue)
  - `/api/cleanup` setiap hari 02:00 (hapus audio >7 hari)
- Vercel cron auth memakai `Authorization: Bearer <CRON_SECRET>` — set `CRON_SECRET` = nilai `WORKER_SECRET` (untuk worker) dan tambahkan logic auth khusus kalau perlu memisah keduanya.

## Switching ke real ML (Phase 4+)

Satu titik integrasi: `app/api/worker/route.ts` baris yang memanggil `mockMLPredict(...)`. Ganti dengan HTTP call ke Python FastAPI worker di GPU server. Schema `MLPredictResult` di `types/index.ts` adalah kontrak yang harus dipenuhi server.

## Anti-patterns yang sudah di-enforce

- Polling interval ≥ 2 detik (`hooks/useRapotPolling.ts`)
- Scoring 1-5, bukan 0-100 (`lib/scoring.ts`)
- Single CTA Tahsin untuk semua skor (`components/rapot/CTATahsin.tsx`)
- Service role key hanya di server (`lib/supabase.ts` — `supabaseService()` throw kalau dipanggil tanpa env)
- Audio auto-delete 7 hari (`app/api/cleanup/route.ts`)
- Rate limit 5 submit/menit/IP (`lib/redis.ts` + `app/api/submit/route.ts`)

## Tech stack

Next.js 16 (App Router) · TypeScript strict · Tailwind v4 · shadcn/ui (Radix) · Zustand · Zod · Supabase Postgres + Storage · Upstash Redis (REST queue) · Framer Motion · pnpm
