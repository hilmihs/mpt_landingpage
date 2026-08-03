# Migrasi Supabase → Google Cloud

**Status:** rencana, belum dieksekusi
**Dibuat:** 3 Agustus 2026
**Alasan:** akun Supabase sudah tidak bisa dipakai lagi.

---

## 1. Keputusan yang sudah dikunci

| Aspek | Sebelum | Sesudah |
|---|---|---|
| Database | Supabase Postgres | Cloud SQL for PostgreSQL, `asia-southeast2` (Jakarta) |
| Database (dev) | Supabase remote | Postgres lokal via Docker Compose |
| Storage audio | Supabase Storage | Cloud Storage bucket, `asia-southeast2` |
| Auth pengajar/admin | Supabase Auth | Auth.js self-host + tabel Postgres |
| Hosting Next.js | Vercel | Cloud Run, `asia-southeast2` |
| Retensi audio | cron `/api/cleanup` 7 hari | GCS lifecycle rule 7 hari, **tanpa kecuali** |
| Queue | Upstash Redis REST | tetap Upstash (belum diubah) |
| ML server | GCE VM + T4 Spot | tetap (belum jalan, terblokir kuota GPU) |

Konsekuensi terhadap `CLAUDE.md`: blok `Tech Stack (LOCKED)` dan `deployment` sudah tidak akurat. Diperbarui di Fase 7.

---

## 2. Kenapa pindah ini juga memperbaiki dua bug keamanan

Audit tanggal 3 Agustus 2026 menemukan dua masalah yang **hilang dengan sendirinya** lewat migrasi ini — bukan ditambal, tapi tidak lagi mungkin terjadi.

### 2.1 Kebocoran PII lewat PostgREST — hilang by design

`submissions`, `rapot`, dan `hits_recordings` tidak punya RLS maupun policy (`0002_booking_v2.sql` mengaktifkan RLS di 12 tabel lain tapi melewatkan ketiganya). Supabase mengekspos setiap tabel schema `public` lewat PostgREST, dan `NEXT_PUBLIC_SUPABASE_ANON_KEY` dikirim ke setiap browser. Siapa pun yang mengambil key itu bisa menarik nama + nomor WA + `audio_path` seluruh peserta.

Cloud SQL tidak punya REST API. Satu-satunya jalan masuk adalah koneksi Postgres dari Cloud Run lewat private IP. Tidak ada kredensial publik yang beredar di browser. Kelas kerentanan ini lenyap.

### 2.2 Rekaman HITS tidak pernah terhapus — hilang lewat lifecycle rule

`app/api/cleanup/route.ts` hanya menyapu `submissions.audio_path`. Rekaman HITS diupload ke `hits-recordings/{slug}/{ts}.webm` dan dicatat di `hits_recordings.audio_path` — kolom itu tidak pernah disentuh, jadi audionya tersimpan selamanya.

GCS lifecycle rule bekerja di level bucket, bukan level tabel. Semua objek berumur >7 hari terhapus otomatis oleh Google, apa pun tabel yang merujuknya. Tidak ada lagi tabel yang bisa "kelewat". Route `/api/cleanup` dihapus seluruhnya di Fase 3.

**Catatan operasional:** pengajar punya jendela 7 hari untuk mengklasifikasi rekaman HITS. Lewat dari itu audio hilang dan peserta harus merekam ulang. Ini konsekuensi yang diterima dari keputusan "7 hari tanpa kecuali". Portal pengajar perlu menampilkan sisa waktu — dicatat sebagai item di Fase 5.

---

## 3. Skala pekerjaan

- **64 file** mengimpor `supabase`.
- **12 titik** memanggil `sb.auth.*`.
- **4 titik** menyentuh Storage.
- **2 RPC** (`create_booking`, `enroll_in_cohort`) — ini fungsi Postgres asli, tinggal dipanggil lewat SQL biasa.
- **5 policy** bergantung `auth.uid()` — dibuang, bukan diterjemahkan (lihat 4.2).
- `postgres` (postgres.js) **sudah ada di `package.json:46` tapi belum dipakai sama sekali**. Client-nya sudah siap.

---

## 4. Dua penyederhanaan penting

### 4.1 RPC tetap dipakai

`create_booking` dan `enroll_in_cohort` sudah ditulis sebagai fungsi PL/pgSQL di `0003` dan `0004`. Keduanya jalan apa adanya di Postgres polos. `sb.rpc("create_booking", {...})` cukup jadi `sql\`SELECT create_booking(${...})\``. Logika transaksionalnya tidak perlu disentuh — ini justru bagian yang paling aman dari seluruh migrasi.

### 4.2 RLS dibuang, otorisasi pindah ke application layer

Semua akses DB nanti lewat satu koneksi service dari Cloud Run. Tidak ada koneksi per-user. Dalam model itu RLS tidak menegakkan apa pun — `current_setting('app.user_id')` cuma menambah lapisan yang harus dijaga konsisten tanpa memberi jaminan tambahan.

Otorisasi ditegakkan di `lib/auth/admin.ts` dan `lib/auth/teacher.ts` yang sudah ada dan sudah dipanggil di setiap layout terproteksi.

⚠️ **Ini menggeser tanggung jawab keamanan ke kode aplikasi.** Setiap route handler baru yang menyentuh data pengajar/admin **wajib** memanggil `getCurrentTeacher()` / `getCurrentAdmin()` di awal. Tidak ada lagi jaring pengaman di level database. Fase 6 menambahkan tes yang memverifikasi ini.

---

## 5. Fase

Tiap fase harus hijau sebelum lanjut. Tiap fase punya commit sendiri agar bisa di-`revert` satuan.

### Fase 1 — Fondasi lokal ✅ SELESAI (3 Agustus 2026)
**Tujuan:** Postgres jalan di laptop, aplikasi belum menyentuhnya.

- `docker-compose.yml` di root: Postgres 17. **Host pakai port 5433**, bukan 5432 — port itu sudah dipakai container Postgres project lain (`mabni-pg`) di mesin yang sama.
- `lib/db.ts` — koneksi postgres.js, singleton dengan cache `globalThis` supaya HMR dev tidak menumpuk pool.
- `supabase/migrations/` → `db/migrations/`. **Penomoran `0001`–`0007` dipertahankan** (rencana awal menyebut ganti jadi `001`, tapi mempertahankan nama asli membuat riwayat `git mv` tetap utuh dan mengurangi kebingungan).
- Blok RLS + policy dibuang dari `0002` (bekas baris 467–600) ke `db/migrations/_removed_rls.sql.bak`. Runner mengabaikan `.bak`.
- `GRANT … TO anon, authenticated, service_role` dibuang dari `0003`/`0004` — role itu milik Supabase, tidak ada di Postgres polos.
- `0007_auth_users.sql` baru: tabel `auth_users` + FK dari `teachers` (ON DELETE SET NULL) dan `admins` (ON DELETE CASCADE). Nama kolom `auth_user_id` **tidak diubah**.
- Runner migrasi `db/migrate.ts` + `pnpm db:migrate` / `pnpm db:status`. Tiap file jalan dalam satu transaksi bersama pencatatannya, dan checksum SHA-256 menolak migrasi lama yang disunting.
- `postgres` dipindah dari `devDependencies` ke `dependencies` — dipakai runtime oleh `lib/db.ts`, bukan cuma skrip.

**Bug yang ketahuan saat verifikasi:** `0005_zoom_to_meet.sql` memakai `CREATE OR REPLACE VIEW` untuk `v_slots_availability` sambil menggeser urutan kolom dan menambah `meet_conference_id`. Postgres hanya mengizinkan penambahan kolom di ujung, jadi migrasi ini **tidak pernah bisa jalan bersih — termasuk dulu di Supabase**. Diperbaiki jadi `DROP VIEW IF EXISTS` lebih dulu. Ini juga petunjuk bahwa skema Supabase lama memang sudah menyimpang dari isi repo, yang memperkuat keputusan mulai bersih.

**Hasil verifikasi:** 7 migrasi tembus di Postgres 17.10 kosong; 16 tabel aplikasi + 2 view; `rowsecurity` = 0 tabel, `pg_policies` = 0 baris; FK + CHECK `auth_users` diuji tolak/terima; migrasi idempoten saat dijalankan ulang; penjaga checksum terbukti menolak file yang disunting; `tsc --noEmit` dan `pnpm build` keduanya exit 0.

**Rollback:** `docker rm -f mpt-postgres`; belum ada kode aplikasi yang berubah.

### Fase 2 — Lapisan query
**Tujuan:** semua baca/tulis DB lewat postgres.js. Auth dan storage **belum** disentuh.

- Ganti `supabaseService()` di 64 file secara bertahap, dikelompokkan per domain:
  1. `submissions` + `rapot` (`/api/submit`, `/api/worker`, `/api/rapot/*`) — paling terisolasi, kerjakan duluan
  2. booking + slots
  3. cohort + tahsin
  4. attendance + analytics
  5. portal pengajar
  6. admin
- 2 RPC → `SELECT create_booking(...)` / `SELECT enroll_in_cohort(...)`.

**Verifikasi:** `pnpm build` hijau + alur assessment jalan end-to-end di lokal dengan `mockMLPredict`.
**Rollback:** per kelompok, tiap kelompok satu commit.

### Fase 3 — Storage
**Tujuan:** audio pindah ke GCS.

- `lib/storage.ts` — upload + V4 signed URL, menggantikan `sb.storage.*`.
- Ganti 4 titik pemakaian. Sekalian benahi bucket yang di-hardcode di `app/api/hits/upload-recording/route.ts:82` dan `app/portal-mpt-x7/(authed)/recordings/page.tsx:50`.
- **Hapus `app/api/cleanup/route.ts` + `CLEANUP_SECRET` + cron-nya.**
- Lifecycle rule di bucket: `age: 7 days` → `Delete`.

**Verifikasi:** upload dari halaman rekam masuk ke GCS; signed URL bisa diputar; lifecycle rule terlihat di `gcloud storage buckets describe`.
**Rollback:** satu commit; bucket dibiarkan, tidak ada data produksi.

### Fase 4 — Auth ⚠️ paling berisiko
**Tujuan:** Auth.js menggantikan Supabase Auth.

- Tabel `auth_users`: `id UUID PK`, `email`, `phone`, `password_hash`, `created_at`. `teachers.auth_user_id` dan `admins.auth_user_id` jadi FK ke sini — **kolomnya tidak berubah nama**, jadi 64 file di Fase 2 tidak perlu disentuh ulang.
- Auth.js v5: Credentials provider (pengajar, phone + password, hash argon2) + Email provider (admin, magic link).
- Tulis ulang 12 titik `sb.auth.*`:
  - `lib/auth/teacher.ts`, `lib/auth/admin.ts` → `auth()` dari Auth.js
  - `app/portal-mpt-x7/login/actions.ts`, `app/admin/login/actions.ts`
  - `app/api/portal/logout`, `app/api/admin/logout`
  - `app/auth/callback/route.ts` → handler Auth.js
  - `app/api/admin/pengajar/route.ts:87,124` — `auth.admin.createUser` / `deleteUser` jadi INSERT/DELETE biasa
- Pengiriman magic link admin butuh SMTP. **Belum diputuskan** — lihat bagian 7.

**Verifikasi:** login pengajar + admin berhasil; route terproteksi menolak sesi kosong; logout membersihkan cookie.
**Rollback:** commit besar tunggal, di-`revert` utuh.

### Fase 5 — Infrastruktur GCP
- Cloud SQL Postgres 17, `asia-southeast2`, private IP.
- Cloud Run: `output: 'standalone'` di `next.config.ts`, konek Cloud SQL lewat VPC connector.
- Secret Manager untuk `DATABASE_URL`, `AUTH_SECRET`, `DEEPSEEK_API_KEY`, dll.
- Bucket GCS + lifecycle rule + service account.
- Portal pengajar menampilkan sisa umur rekaman HITS (lihat catatan 2.2).

**Verifikasi:** deploy preview jalan; alur assessment end-to-end di Cloud Run.

### Fase 6 — Pengetatan
- Tes yang memastikan setiap route `/api/portal/*` dan `/api/admin/*` menolak request tanpa sesi (menggantikan jaring pengaman RLS — lihat 4.2).
- Copot `@supabase/ssr` + `@supabase/supabase-js`; hapus `lib/supabase.ts`, `lib/supabase-server.ts`.
- Perbarui `.env.example`.

**Verifikasi:** `grep -rn supabase app lib components` kosong.

### Fase 7 — Dokumentasi
- `CLAUDE.md`: perbarui blok `Tech Stack (LOCKED)`, `deployment`, `Anti-Patterns`, `File Structure`.
- `docs/ARCHITECTURE_V2.md`: perbarui strategi auth 3-role.

---

## 6. Risiko

| Risiko | Dampak | Mitigasi |
|---|---|---|
| Fase 4 (auth) meleset | Pengajar/admin tidak bisa masuk | Fase terpisah, satu commit, `revert` utuh |
| Otorisasi kelewat di route baru (4.2) | Kebocoran data pengajar/admin | Tes Fase 6 + catatan wajib di `CLAUDE.md` |
| Cloud Run cold start + koneksi Postgres | Latensi request pertama | `min-instances=1`; postgres.js pooling |
| Rekaman HITS keburu terhapus | Peserta harus rekam ulang | Indikator sisa waktu di portal (Fase 5) |
| Kredit trial habis | Layanan mati | Cloud SQL kecil dulu; pantau billing |

---

## 7. Belum diputuskan

1. **SMTP magic link admin.** Butuh penyedia email (Resend / SendGrid / SMTP Workspace). Memblokir Fase 4.
2. ~~**Migrasi data lama.**~~ **Diputuskan 3 Agustus 2026: mulai bersih.** Tidak ada data yang diselamatkan dari Supabase `ojfjhfhmdylvyreqxdmv`. Tidak ada Fase 4.5.
3. **Ukuran Cloud SQL.** `db-f1-micro` cukup untuk awal; naikkan kalau perlu.
4. **Upstash Redis.** Cloud Run mendukung koneksi TCP panjang, jadi BullMQ asli sebenarnya jadi memungkinkan (alasan penolakan di `lib/queue.ts:5-9` adalah keterbatasan serverless Vercel, yang sudah tidak berlaku). Bukan prasyarat — dicatat sebagai penyederhanaan opsional nanti.
5. **`scripts/seed-dev.ts` masih memakai Supabase.** Belum disentuh; ikut ditulis ulang di Fase 2 bersama query lainnya.
