# Muhajir Project Tilawah — V2 Architecture

**Versi:** 2.0 (Revisi Funnel Bertahap)
**Tanggal:** Mei 2026
**Status:** Draft untuk presentasi ke Ustadz Ilham (2 Juni 2026)
**Sumber:** Notulen Rapat HITS Juni 2026 — Bagian 3.3 Revisi Flow

---

## 1. Latar Belakang

Versi 1 (sudah deployed) memiliki funnel langsung: `Assessment → Rapot → Linktree HITS`. Konversi terbatas karena tidak ada step filter keseriusan. Estimasi dari rapat: dari ±1.000 orang yang mencoba assessment, hanya ±100 yang benar-benar serius untuk HITS.

V2 menerapkan **step-by-step funnel** dengan tiga gate keseriusan, sesuai usulan Mas Agil di rapat HITS Juni 2026.

## 2. Funnel Baru (User Journey)

```
                  ┌───────────────────┐
                  │  Landing / Hero   │
                  └─────────┬─────────┘
                            ▼
                  ┌───────────────────┐
                  │  Consent Privacy  │
                  └─────────┬─────────┘
                            ▼
                  ┌───────────────────┐
                  │ Record Al-Fatihah │
                  └─────────┬─────────┘
                            ▼
                  ┌───────────────────┐
                  │  Form (WA, dll)   │
                  └─────────┬─────────┘
                            ▼
                  ┌───────────────────┐
                  │  ML Processing    │
                  └─────────┬─────────┘
                            ▼
                  ┌───────────────────┐
                  │ RAPOT (skor 1-5)  │  ← + AI Narrative
                  │ + Penjelasan AI   │
                  └─────────┬─────────┘
                            ▼
                  ┌───────────────────────────────┐
                  │  GATE 1: Filter Keseriusan    │
                  │ "Tertarik laporan lebih       │
                  │  dalam dari pengajar?"        │
                  └────┬──────────────────────┬───┘
                       │ Tidak                │ Ya
                       ▼                      ▼
                ┌────────────┐    ┌──────────────────────┐
                │  Linktree  │    │ Booking Assessment   │
                │ (terimakas)│    │ (Calendly-style)     │
                └────────────┘    └──────────┬───────────┘
                                             ▼
                                  ┌──────────────────────┐
                                  │ Konfirmasi WA + Zoom │
                                  └──────────┬───────────┘
                                             ▼
                                  ┌──────────────────────┐
                                  │ Meeting Assessment   │
                                  │ (12 peserta/60 min)  │
                                  │ Auto-attendance Zoom │
                                  └──────────┬───────────┘
                                             ▼
                                  ┌──────────────────────┐
                                  │ Pengajar input notes │
                                  │ (AI summarize → next)│
                                  └──────────┬───────────┘
                                             ▼
                                  ┌──────────────────────┐
                                  │ GATE 2: Tahsin       │
                                  │ Al-Fatihah?          │
                                  └────┬─────────────┬───┘
                                       │ Tidak       │ Ya
                                       ▼             ▼
                                ┌──────────┐  ┌────────────────────┐
                                │ Nurture  │  │ Tahsin Cohort      │
                                │  Flow    │  │ 4 sesi × 90 min    │
                                └──────────┘  │ (2x/minggu × 2 mg) │
                                              └──────────┬─────────┘
                                                         ▼
                                              ┌────────────────────┐
                                              │ GATE 3: Selesai    │
                                              │ Tahsin → HITS      │
                                              └──────────┬─────────┘
                                                         ▼
                                              ┌────────────────────┐
                                              │  Linktree HITS     │
                                              │  (qualified lead)  │
                                              └────────────────────┘
```

## 3. Konstrain Bisnis (Locked)

| Item | Nilai | Sumber |
|---|---|---|
| Durasi sesi Assessment | 60 menit | Permintaan user V2 |
| Kapasitas per slot Assessment | 12 peserta | Permintaan user V2 |
| Durasi sesi Tahsin Al-Fatihah | 90 menit | Permintaan user V2 |
| Total sesi Tahsin Al-Fatihah | 4 sesi (2x/minggu × 2 minggu) | Permintaan user V2 |
| Kapasitas per cohort Tahsin | 12 peserta | Permintaan user V2 |
| Gender matching booking | Strict (ikhwan-ikhwan, akhwat-akhwat) | Permintaan user V2 |
| Teacher assignment | User pilih slot, sistem auto-assign pengajar | Permintaan user V2 |
| Setelah lulus Tahsin | Tawarkan HITS via Linktree | Permintaan user V2 |

## 4. Arsitektur Sistem

```
                                    ┌─────────────────────────┐
                                    │       Vercel Edge       │
                                    │                         │
[Peserta Browser]──────HTTPS────────▶│  Next.js App Router    │
                                    │  + API Routes           │
[Pengajar Browser]─────HTTPS────────▶│  + Webhook Receivers   │
[Admin Browser]────────HTTPS────────▶│                         │
                                    └────┬────────────┬───────┘
                                         │            │
                          ┌──────────────┘            └──────────────┐
                          ▼                                          ▼
                  ┌───────────────┐                          ┌───────────────┐
                  │   Supabase    │                          │ Upstash Redis │
                  │               │                          │   (BullMQ)    │
                  │ • Postgres    │                          └───────┬───────┘
                  │ • Storage     │                                  │
                  │ • Auth        │                                  ▼
                  │   (admin+pgjr)│                          ┌───────────────┐
                  │ • RLS         │                          │  GPU Server   │
                  └───────────────┘                          │ (Biznet Gio)  │
                          ▲                                  │  Mu'alim v3.2 │
                          │                                  └───────────────┘
                          │
                  ┌───────┴───────┐                          ┌───────────────┐
                  │ Zoom Webhook  │◀─────HTTPS───────────────│  Zoom Cloud   │
                  └───────────────┘                          │   (Pro acct)  │
                                                             └───────────────┘
                  ┌───────────────┐                          ┌───────────────┐
                  │  AI Provider  │◀─────HTTPS───────────────│  DeepSeek V4  │
                  │   Endpoint    │                          │  Pro / Claude │
                  └───────────────┘                          └───────────────┘
```

## 5. Database Schema (Tambahan V2)

### 5.1 Tabel Baru

| Tabel | Fungsi |
|---|---|
| `teachers` | Data pengajar — link ke Supabase Auth (phone+password) |
| `teacher_availability` | Window ketersediaan rutin per pengajar (e.g., setiap Selasa 19:30-21:30) |
| `slots` | Slot konkret (instance tanggal+jam) untuk Assessment 1-on-many |
| `bookings` | Booking peserta ke slot Assessment |
| `cohorts` | Cohort Tahsin Al-Fatihah (4 sesi sebagai unit) |
| `cohort_sessions` | 4 sesi spesifik per cohort |
| `cohort_enrollments` | Peserta yang terdaftar di cohort |
| `attendance` | Record kehadiran (sumber: zoom_webhook / manual / ai_match) |
| `analytics_events` | Funnel events untuk admin dashboard |
| `admins` | Mapping Supabase Auth user → role admin |
| `interest_responses` | Jawaban gate "Tertarik laporan lebih dalam?" — analytics + drop-off |

### 5.2 Update Tabel Existing

- `submissions`: tambah kolom `email` (opsional, untuk Zoom match), `whatsapp_verified`, `ai_narrative_generated_at`
- `rapot`: tambah kolom `ai_narrative` (text) dan `ai_narrative_model` (text)

## 6. Sistem Auth (3 Role)

| Role | URL | Method | Visibilitas |
|---|---|---|---|
| **Peserta** | `/` `/assessment/*` `/rapot/*` `/booking/*` | Anonymous + slug-based access | Public |
| **Pengajar** | `/portal-mpt-x7/*` | Supabase Auth (phone + password) | **Tersembunyi** — tidak ada link dari halaman publik, robots.txt block, noindex meta |
| **Admin** | `/admin/*` | Supabase Auth (email magic link) | **Tersembunyi** — robots.txt block, IP allowlist optional |

### 6.1 RLS Policies (Ringkasan)

```sql
-- Pengajar baca data dirinya sendiri
CREATE POLICY teacher_self ON teachers
  FOR SELECT USING (auth_user_id = auth.uid());

-- Pengajar baca bookings di slotnya saja
CREATE POLICY teacher_own_bookings ON bookings
  FOR SELECT USING (
    slot_id IN (SELECT id FROM slots WHERE teacher_id IN
      (SELECT id FROM teachers WHERE auth_user_id = auth.uid()))
  );

-- Admin baca semua
CREATE POLICY admin_all ON [any_table]
  FOR ALL USING (
    auth.uid() IN (SELECT auth_user_id FROM admins)
  );
```

## 7. Admin Dashboard

### 7.1 Halaman

```
/admin
├── /overview        — 7 KPI cards utama (lihat 7.2)
├── /pengajar        — CRUD pengajar (undang via WA, activate)
├── /jadwal          — Lihat semua slot, override capacity, batalkan
├── /cohort          — Create/manage Tahsin cohort
├── /peserta         — List submissions + journey timeline tiap peserta
├── /attendance      — Live attendance + anomali yang butuh review manual
└── /analytics       — Funnel chart, conversion rate per gate
```

### 7.2 KPI Cards (Sesuai Permintaan)

| # | Metric | Source | Catatan |
|---|---|---|---|
| 1 | Page viewers | Vercel Analytics | Total unique visitors |
| 2 | Assessment dengan sistem | `submissions WHERE status='completed'` | Yang menyelesaikan ML |
| 3 | Daftar assessment dengan guru | `bookings WHERE kind='assessment'` | Lewat gate 1 |
| 4 | Hadir assessment dengan guru | `attendance WHERE booking.kind='assessment' AND status='attended'` | Auto via Zoom |
| 5 | Daftar tahsin al-fatihah | `cohort_enrollments` | Lewat gate 2 |
| 6 | Hadir tahsin al-fatihah | `attendance` linked to cohort_sessions | ≥3 dari 4 sesi = "hadir" |
| 7 | (Bonus) HITS click-through | `analytics_events WHERE event='hits_clicked'` | Final funnel |

### 7.3 Funnel Visualization (Best Practice)

Sankey atau bar chart bertingkat:
```
Page Views (1000)
   └─▶ Assessment Started (600, 60%)
        └─▶ Assessment Completed (450, 75%)
             └─▶ Gate 1 Yes (150, 33%)
                  └─▶ Booking Created (120, 80%)
                       └─▶ Attended Assessment (90, 75%)
                            └─▶ Gate 2 Yes (60, 67%)
                                 └─▶ Tahsin Enrolled (55, 92%)
                                      └─▶ Tahsin Completed (40, 73%)
                                           └─▶ HITS Clicked (35, 88%)
```

## 8. Teacher Portal (`/portal-mpt-x7`)

### 8.1 Halaman

```
/portal-mpt-x7
├── /login              — Form WA + password (Supabase Auth)
├── /dashboard          — Overview: jadwal hari ini, booking masuk
├── /availability       — Set kapan saya bisa mengajar (rutin per minggu)
├── /bookings           — List booking assessment di slot saya
├── /cohorts            — List cohort Tahsin saya
├── /attendance         — Mark/edit attendance (fallback manual)
└── /profil             — Edit nama, bio, foto, email Zoom
```

### 8.2 Best Practices Yang Diterapkan

| Praktik | Implementasi |
|---|---|
| **Hidden from public** | Tidak ada link dari `/` atau `/rapot`. Path obscure `/portal-mpt-x7`. |
| **Robots block** | `robots.txt` Disallow `/portal-mpt-x7/`. `<meta name="robots" content="noindex,nofollow">` di layout. |
| **Auth wajib di setiap halaman** | Layout `portal-mpt-x7/layout.tsx` redirect ke `/login` kalau tidak auth. |
| **Phone + password via Supabase Auth** | Supabase support `signInWithPassword({ phone, password })`. Phone formatted ke +62. |
| **Rate limit login** | Upstash Ratelimit 5 attempts / 15 menit per IP. |
| **Audit log** | Setiap perubahan availability/attendance dicatat di `audit_logs`. |
| **Session timeout** | 7 hari (default Supabase). Re-auth untuk action sensitif. |
| **No password reset by self** | Reset password lewat admin (security: cegah social engineering ke WA). |

## 9. Zoom Webhook & Attendance Tracking

### 9.1 Cara Kerja End-to-End

```
1. Admin/Pengajar create slot di portal
   ↓
2. Sistem otomatis create Zoom meeting via Zoom API
   (pakai 1-2 Pro account sebagai host pool, rotate per slot)
   ↓
3. Save zoom_meeting_id + zoom_join_url ke slots.row
   ↓
4. Pengajar & peserta dapat link Zoom (WA broadcast otomatis)
   ↓
5. Saat sesi berlangsung, Zoom kirim event:
   • meeting.started
   • meeting.participant_joined  (per peserta)
   • meeting.participant_left
   • meeting.ended
   ↓
6. Endpoint /api/webhooks/zoom:
   a. Verify HMAC signature dengan secret token Zoom
   b. Lookup meeting_id → slot
   c. Match participant.email → bookings.submission.email
      • Exact match → INSERT attendance (source='zoom_webhook')
      • No match → trigger AI fuzzy match by displayName
        - AI confidence ≥0.8 → INSERT (source='ai_match', need_review=true)
        - AI confidence <0.8 → log untuk review pengajar
   ↓
7. Pengajar buka /portal-mpt-x7/attendance:
   - Lihat list peserta + status hadir
   - Override manual kalau salah (source='manual')
   ↓
8. Admin dashboard auto-refresh KPI
```

### 9.2 Biaya

| Item | Estimasi |
|---|---|
| Zoom Pro 1 host (cukup untuk 90-menit Tahsin) | $14.99/bulan ≈ Rp 240k |
| Zoom Pro 2 host (rotation, kalau parallel sessions) | $30/bulan ≈ Rp 480k |
| AI fuzzy match fallback (DeepSeek) | ±Rp 50/event, asumsi 5% events = negligible |
| **Total** | **±Rp 240-480k/bulan** untuk attendance otomatis |

### 9.3 Fallback Strategy

Kalau Zoom webhook gagal (rare, ±2% kasus):
1. AI fuzzy match by display name dengan confidence threshold
2. Pengajar manual override di portal (UI 1-click "Tandai hadir")
3. Audit log mencatat siapa yang override + kapan

## 10. AI Integration (Phase 1)

### 10.1 Penjelasan Rapot Personalized

**Trigger:** Setelah worker selesai generate rapot, panggil endpoint AI.

**Input ke AI:**
```json
{
  "skor": 4,
  "status_label": "Bacaan Sangat Baik",
  "total_errors_major": 2,
  "total_errors_minor": 3,
  "errors_harakat": [...],
  "errors_huruf": [...],
  "errors_panjang_pendek": [...],
  "errors_syaddah": [...]
}
```

**Output AI** (disimpan ke `rapot.ai_narrative`):
```text
Masya Allah, bacaan Anda secara keseluruhan sudah sangat baik (skor 4/5).
Ada 2 catatan utama:
1. Harakat di ayat 3 kata "الْعَالَمِينَ" — pelajari kembali pelafalan fathah panjang.
2. Syaddah pada ayat 5 — pastikan ada penekanan saat huruf bertasydid.

Tips latihan: ulangi mengikuti murottal Syaikh Mishary 10x sehari selama
seminggu, fokus pada dua titik di atas. Kalau ingin pendampingan lebih
dalam, silakan booking sesi dengan pengajar di langkah berikutnya.
```

**Constraints:**
- Bahasa Indonesia + sebut terminologi Arab dengan ejaan Arabic Unicode
- Tidak boleh judgemental ("salah", "buruk") — gunakan "catatan", "perlu perhatian"
- Max 200 kata
- Akhiri dengan nudge ke booking (subtle, not pushy)

**Cost:** ±Rp 150/rapot. Asumsi 1.000 rapot/bulan = Rp 150k/bulan.

### 10.2 AI Fuzzy Match untuk Attendance (Fallback)

**Trigger:** Zoom webhook menerima `participant_joined` event, email participant tidak match dengan booking manapun di slot itu.

**Input ke AI:**
```json
{
  "participant_display_name": "Ahmad Budi",
  "candidate_bookings": [
    { "id": "abc", "submission_nama": "Ahmad Budiman", "nomor_wa": "08123..." },
    { "id": "def", "submission_nama": "Budi Santoso", "nomor_wa": "08234..." }
  ]
}
```

**Output AI:**
```json
{
  "match_id": "abc",
  "confidence": 0.87,
  "reasoning": "Display name 'Ahmad Budi' adalah substring partial dari 'Ahmad Budiman'"
}
```

**Threshold:** Confidence ≥ 0.8 → auto-record dengan flag `need_review`. <0.8 → log untuk manual.

**Cost:** ±Rp 50/anomali. Asumsi 5% events = negligible.

### 10.3 Provider Pilihan

| Provider | Pros | Cons |
|---|---|---|
| **DeepSeek V4 Pro** | Murah, support bahasa Indonesia bagus | Belum sematang OpenAI/Anthropic |
| **Claude Haiku 4.5** | Stabil, kualitas tinggi | Sedikit lebih mahal |
| **OpenAI GPT-4o mini** | Familiar | Data residency US |

**Rekomendasi:** Start dengan DeepSeek (murah), fallback ke Claude kalau quality kurang.

## 11. Analytics & Tracking

### 11.1 Vercel Analytics (Page Views)
- Built-in di Vercel deployment, gratis 2.5k events/bulan
- Track: pageviews, unique visitors, top referrers
- **Tidak track funnel events** — itu kita handle sendiri

### 11.2 Custom Funnel Events (DB)

Tabel `analytics_events`:

```sql
CREATE TABLE analytics_events (
  id BIGSERIAL PRIMARY KEY,
  occurred_at TIMESTAMPTZ DEFAULT now(),
  event_name TEXT NOT NULL,
  submission_id UUID REFERENCES submissions(id),
  session_id TEXT,
  metadata JSONB DEFAULT '{}'::jsonb
);
```

Events yang di-track:
| Event Name | Trigger |
|---|---|
| `landing_view` | Page `/` loaded |
| `consent_accepted` | User klik agree |
| `recording_started` | MediaRecorder start |
| `submission_created` | POST /api/submit success |
| `rapot_viewed` | Page `/rapot/[slug]` loaded |
| `gate1_shown` | InterestGate displayed |
| `gate1_yes` | User klik "Ya, tertarik" |
| `gate1_no` | User klik "Tidak" |
| `booking_calendar_viewed` | `/booking/assessment` loaded |
| `booking_created` | POST /api/booking success |
| `attended_assessment` | Zoom webhook attended |
| `tahsin_invited` | After assessment meeting |
| `tahsin_enrolled` | User join cohort |
| `tahsin_completed` | ≥3 dari 4 sesi attended |
| `hits_cta_clicked` | User klik linktree |

## 12. Privasi & Keamanan (UU PDP Compliance)

| Aspek | Implementasi |
|---|---|
| Audio retention | Auto-delete > 7 hari (cron `/api/cleanup`) |
| Data residency | Supabase Singapore region, AI provider TBD pertahankan IDN/SG |
| Consent screen | Sudah ada di Phase 1 V1, update copy untuk meeting + Zoom |
| Right to delete | Endpoint `DELETE /api/submission/[id]` dengan WA OTP verification |
| Encryption at rest | Supabase Postgres native encryption |
| Encryption in transit | HTTPS only, Zoom webhook HMAC-verified |
| Audit logs | Semua admin/pengajar action dicatat |
| No 3rd party tracking | Tidak pakai GA/Facebook Pixel |
| Service role key | Hanya di server, tidak pernah expose ke client |

## 13. Phasing Plan (Implementasi)

| Phase | Output | Estimasi |
|---|---|---|
| **Phase 1A (Hari ini)** | Deck + Migration 0002 + update CLAUDE.md | ✅ Done |
| **Phase 1B (Session berikutnya)** | Funnel revision (InterestGate + booking user-side UI) + AI Penjelasan Rapot integrated | 1-2 hari |
| **Phase 2** | Teacher portal lengkap (auth + availability + bookings list + manual attendance) | 3-4 hari |
| **Phase 3** | Admin dashboard lengkap (KPI cards + analytics chart + CRUD pengajar) | 3 hari |
| **Phase 4** | Zoom webhook integration end-to-end + Zoom meeting auto-create | 2 hari |
| **Phase 5** | Tahsin cohort flow + Gate 2 + Gate 3 + HITS linktree gating | 2 hari |
| **Total** | V2 production-ready | ±2-3 minggu |

## 14. Pertanyaan Terbuka (Untuk Diskusi 2 Juni)

1. **WhatsApp Business API** — siapa yang setup? Pakai akun kantor Mas Agil? (Untuk WA broadcast Zoom link, konfirmasi booking, reminder)
2. **Skema tali kasih pengajar** — sudah masuk discussion. Apakah V2 sistem perlu integrasi kalkulasi otomatis (jumlah sesi × tarif)?
3. **Zoom Pro account** — siapa yang punya akun? Atau create baru atas nama lembaga?
4. **Data 668 rekaman batch HITS** — apakah jadi input untuk improve model ML kita post-3 Juni?
5. **Pengajar 13 tanpa halaqah** — apakah mereka utilize sebagai pengajar Assessment+Tahsin di V2 ini? Bagus untuk kompensasi mereka.

## 15. Risiko & Mitigasi

| Risiko | Probabilitas | Mitigasi |
|---|---|---|
| Pengajar tidak diisi availability → tidak ada slot | Tinggi | Onboarding di portal + reminder WA + 13 pengajar tanpa halaqah jadi pool pertama |
| Zoom webhook gagal di production | Sedang | Fallback AI fuzzy match + manual override |
| AI narrative output kurang berkualitas | Sedang | Prompt review oleh Ustadzah, validation harness |
| Booking peak time conflict (slot penuh) | Tinggi | Capacity limit 12 + waitlist + suggest slot terdekat |
| Peserta no-show meeting | Tinggi | Reminder H-1, H-2 jam via WA bot + email |
| Privacy concern WA broadcast | Sedang | Opt-in eksplisit di consent + opsi unsubscribe |

---

**Diskusi dengan tim sebelum eksekusi Phase 1B:**
- Validasi flow dengan Ustadz Syukri & Ustadz Ilham
- Konfirmasi skema kompensasi pengajar V2
- Approve budget Zoom Pro ±Rp 240-480k/bulan
- Approve budget AI ±Rp 150-200k/bulan
