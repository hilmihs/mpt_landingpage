# Prompt Handoff — Claude Web

Copy-paste seluruh isi di bawah ini sebagai pesan pertama Anda di Claude web (atau Claude.ai).
Bila Claude web punya akses GitHub, tinggal kasih link repo dan dia bisa eksplorasi langsung.

---

```
Halo Claude, saya mau melanjutkan diskusi tentang proyek Muhajir Project Tilawah (MPT)
dari sesi Claude Code sebelumnya. Berikut konteks lengkapnya supaya Anda bisa langsung
membantu tanpa harus tanya banyak hal:

═══════════════════════════════════════════════════════════════════════
PROYEK: Muhajir Project Tilawah — Assessment Al-Fatihah
═══════════════════════════════════════════════════════════════════════

MPT adalah platform web untuk membantu peserta merekam bacaan Al-Fatihah,
dianalisis oleh AI untuk mendeteksi 4 indikator Lahn Jaliy (Harakat, Huruf,
Panjang-Pendek, Syaddah), dan menerima rapot dengan skor 1-5 plus rekomendasi
mendaftar Program Tahsin Al-Fatihah.

Repo GitHub: hilmihs/mpt_landingpage
Branch yang sedang dikerjakan: claude/assessment-hits-funnel-flow-OK9xJ
Branch utama: main (BELUM ada PR — branch 13 commits ahead)

Tech stack (LOCKED):
  Frontend     Next.js 15.x App Router + TypeScript strict + Tailwind v4 + shadcn/ui
  Backend      Next.js API Routes
  Database     Supabase Postgres + Storage
  Queue/cache  BullMQ + Upstash Redis
  Auth         Supabase Auth — email magic link (admin), phone+password (pengajar)
  Video        Zoom Server-to-Server OAuth + webhook
  AI           Anthropic Claude (AI narrative untuk rapot)
  ML inference Mu'alim v3_2 self-hosted GPU (Phase 4 — belum integrate, masih mock)
  Deploy       Vercel (frontend+backend) + Biznet T4 GPU (ML server)

═══════════════════════════════════════════════════════════════════════
APA YANG SUDAH SELESAI (V2 Funnel End-to-End)
═══════════════════════════════════════════════════════════════════════

V2 funnel = Rapot → Gate 1 (booking?) → Sesi Assessment → Gate 2 (Tahsin?) →
            Cohort Tahsin 4-sesi → Gate 3 (HITS?) → HITS Linktree

Yang sudah dibangun di branch claude/assessment-hits-funnel-flow-OK9xJ
(13 commit, semuanya pushed ke remote feature branch):

Phase 1A  ✅  Architecture deck (docs/ARCHITECTURE_V2.md + .pptx) + migration
              0001_init.sql + 0002_booking_v2.sql + CLAUDE.md updates
Phase 1B  ✅  Gate 1 (InterestGate component), full booking flow
              (/booking/assessment/[slug]), AI narrative dari Claude API di rapot
Phase 2   ✅  Teacher portal /portal-mpt-x7 + admin console /admin (skeleton
              + auth foundation via @supabase/ssr)
Phase 2B  ✅  Pengajar invite CRUD + slot generator + attendance edit + profile edit
Phase 3   ✅  Zoom auto-create meeting saat slot generated + webhook receiver
              + AI fuzzy match Indonesian honorifics + attendance reconcile
Phase 2C  ✅  Cohort manager (admin + teacher views, 4-session binding,
              capacity guard)
Phase 4   ✅  Gate 2 (Tahsin enrollment di /tahsin/[slug]) + Gate 3 (HITS unlock
              di /hits/[slug]) + smart NextStepsGate component
Review    ✅  xhigh-effort code review (15 findings + honorable mentions),
              SEMUA sudah di-fix dalam 2 batch commit
Seed      ✅  scripts/seed-dev.ts — idempotent dev/staging seed (1 admin + 4
              pengajar dummy), belum dieksekusi karena belum ada target Supabase
Deck      ✅  docs/PROPOSAL_MAJELIS.pptx — proposal 11 slide untuk Ketua Majelis,
              bahasa non-IT, generated via scripts/generate-proposal-deck.py

═══════════════════════════════════════════════════════════════════════
APA YANG BELUM DIKERJAKAN / PENDING
═══════════════════════════════════════════════════════════════════════

1. Migration apply ke Supabase production
   → Migration 0001, 0002, 0003 belum di-apply ke Supabase manapun.
   → Saya (sesi sebelumnya) tidak punya akses ke project MPT Supabase
     yang sesungguhnya — kemungkinan ada di akun Anda yang berbeda.

2. PR ke main
   → Branch claude/assessment-hits-funnel-flow-OK9xJ belum di-PR atau di-merge.
   → 13 commit menunggu.

3. Phase 5+ deferred items (low-priority, untuk skala):
   - Webhook reconcile pakai BullMQ queue (saat ini retry inline dengan
     backoff up to 50s)
   - ML inference real (saat ini lib/mock-ml.ts deterministic)
   - Cohort_session capacity guard di slot level (saat ini hanya cohort level)

4. Smoke test end-to-end (butuh migration + env + seed dulu)

═══════════════════════════════════════════════════════════════════════
KEY FILE / FOLDER UNTUK REFERENSI CEPAT
═══════════════════════════════════════════════════════════════════════

Architecture & docs:
  CLAUDE.md                                Codebase instructions + V2 spec
  docs/ARCHITECTURE_V2.md                  V2 funnel spec lengkap
  docs/ARCHITECTURE_V2.pptx                Deck teknis untuk rapat HITS
  docs/PROPOSAL_MAJELIS.pptx               Deck non-IT untuk Ketua Majelis (baru)
  .env.example                             Semua env vars yang dibutuhkan

Database:
  supabase/migrations/0001_init.sql        Tabel submissions + rapot
  supabase/migrations/0002_booking_v2.sql  Tabel teachers, slots, bookings,
                                           cohorts, attendance, interest_responses
  supabase/migrations/0003_tahsin_enroll_rpc.sql  Postgres function untuk atomic
                                                   enroll (race condition fix)

Eligibility & gating logic (paling penting):
  lib/eligibility.ts                       Single source of truth funnel state
  components/rapot/NextStepsGate.tsx       Smart gate selector di rapot page
  components/rapot/InterestGate.tsx        Gate 1
  app/tahsin/[slug]/page.tsx               Gate 2 — cohort picker
  app/hits/[slug]/page.tsx                 Gate 3 — HITS unlock

Auth & portals:
  lib/auth/admin.ts                        Admin auth helper
  lib/auth/teacher.ts                      Teacher auth helper
  app/portal-mpt-x7/                       Teacher portal (obscure path)
  app/admin/                               Admin console

Zoom integration:
  lib/zoom/client.ts                       S2S OAuth + createMeeting/listParticipants
  lib/zoom/verify.ts                       HMAC signature verify
  lib/zoom/matcher.ts                      AI fuzzy name match
  lib/zoom/reconcile.ts                    Attendance reconcile
  app/api/zoom/webhook/route.ts            Webhook receiver

Seed:
  scripts/seed-dev.ts                      Dev seed via tsx (admin + 4 pengajar)
  scripts/seed-dev.sql                     SQL fallback
  scripts/README.md                        Usage docs

═══════════════════════════════════════════════════════════════════════
RANGKAIAN COMMIT (terbaru di atas)
═══════════════════════════════════════════════════════════════════════

f49ca18  docs: proposal deck untuk Ketua Majelis (11 slide)
b0550e7  fix(v2): code review findings 3,8-15 + honorable mentions
59cfe4c  chore: seed scripts for dev/staging (admin + 4 pengajar dummy)
a8f60de  fix(v2): code review must-fix items
07f92eb  feat(v2): Phase 4 — Gate 2 (Tahsin enrollment) + Gate 3 (HITS unlock)
957b7d7  feat(v2): Phase 2C — cohort manager (admin + teacher)
4f37434  feat(v2): Phase 3 — Zoom integration end-to-end
b5d7582  feat(v2): Phase 2B — pengajar CRUD + slot generator + attendance + profile
53afb83  feat(v2): Phase 2 — teacher portal + admin console
47c9dbb  feat(v2): Phase 1B — InterestGate + booking flow + AI narrative
9fd4fdc  docs: V2 architecture deck PPTX
e40687c  docs+db: V2 funnel architecture deck + booking schema migration
64300f2  Implement Landing Page + Assessment App redesign

═══════════════════════════════════════════════════════════════════════
HAL-HAL YANG SAYA INGIN BAHAS BERIKUTNYA
═══════════════════════════════════════════════════════════════════════

[Saya tulis di sini apa yang mau saya lakukan — pilih salah satu atau tulis bebas]

Opsi A: Lanjut technical work (Phase 5+) — saya butuh bantuan dengan…
Opsi B: Persiapan presentasi proposal ke Majelis — saya butuh tweak deck atau
        bantuan menyiapkan jawaban pertanyaan
Opsi C: Apply migration + seed ke Supabase yang saya sediakan — saya akan share
        env vars / akses
Opsi D: Review materi tertentu — [sebutkan file]
Opsi E: Pertanyaan tentang [sebutkan]

[Tulis pertanyaan / instruksi spesifik Anda di sini]
```

---

## Cara Pakai

1. Buka claude.ai (atau Claude web)
2. Mulai chat baru
3. Paste **seluruh blok di atas** (mulai dari `Halo Claude` sampai `[Tulis pertanyaan...]`)
4. Edit bagian bawah (Opsi A-E) sesuai kebutuhan
5. Submit

Bila Anda pakai akun Claude yang punya GitHub integration, tambahkan:

> "Tolong clone repo `hilmihs/mpt_landingpage` branch `claude/assessment-hits-funnel-flow-OK9xJ` agar Anda bisa lihat source code-nya."

Bila pakai Claude tanpa GitHub access, lampirkan file penting sebagai attachment — minimal:
- `CLAUDE.md`
- `docs/ARCHITECTURE_V2.md`
- File spesifik yang mau didiskusikan
