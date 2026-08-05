# Deploy ke Google Cloud

Region **`asia-southeast2` (Jakarta)** untuk semuanya — data residency UU PDP terkunci di `CLAUDE.md`.

---

## 0. Yang harus disiapkan lebih dulu

| Hal | Kenapa | Status |
|---|---|---|
| **Aktivasi akun penuh GCP** | Akun free trial tidak bisa pakai GPU, dan Cloud SQL layak-produksi butuh billing aktif. Kredit yang ada tetap terpakai. | ⬜ |
| **gcloud CLI** | Belum terinstal di laptop. Alternatif: pakai **Cloud Shell** di browser (ikon `>_` kanan atas console) yang sudah lengkap dan terautentikasi. | ⬜ |
| **Kredensial kirimi.id** | `KIRIMI_USER_CODE`, `KIRIMI_DEVICE_ID`, `KIRIMI_SECRET` + perangkat sudah scan QR. | ⬜ |

---

## 1. Kredensial yang harus diisi

Yang bertanda **[WAJIB]** membuat aplikasi gagal jalan kalau kosong.

### Dibuat sendiri — tinggal generate

```bash
openssl rand -hex 32   # AUTH_SECRET             [WAJIB]
openssl rand -hex 32   # STORAGE_SIGNING_SECRET
openssl rand -hex 32   # WORKER_SECRET           [WAJIB]
openssl rand -hex 32   # CLEANUP_SECRET          [WAJIB]
```

### Dari GCP

| Variabel | Asal |
|---|---|
| `DATABASE_URL` **[WAJIB]** | Cloud SQL — lihat langkah 2 |
| `GCS_BUCKET` **[WAJIB di prod]** | Nama bucket — lihat langkah 3 |

### Dari pihak ketiga

| Variabel | Asal | Akibat kalau kosong |
|---|---|---|
| `KIRIMI_USER_CODE` / `KIRIMI_DEVICE_ID` / `KIRIMI_SECRET` | dashboard kirimi.id | Notifikasi WA hanya masuk log. Alur tetap jalan, tapi **pengajar tidak tahu ada rekaman masuk** |
| `SUPERADMIN_WA` | nomor kamu | Rekaman tanpa pengajar cocok jadi tidak tertugaskan sama sekali |
| `UPSTASH_REDIS_REST_URL` / `_TOKEN` | Upstash | Antrian ML mati; worker jatuh ke pemindaian submission pending |
| `ML_SERVER_URL` / `ML_SERVER_API_KEY` | server GPU sendiri | Pakai `mockMLPredict`. **Tidak menghalangi demo** — nilai yang dilihat peserta datang dari pengajar |
| `GOOGLE_SERVICE_ACCOUNT_KEY` | Workspace Admin Console | Pembuatan Google Meet mati |

`NEXT_PUBLIC_SITE_URL` **[WAJIB]** harus alamat produksi sebenarnya. Ini dipakai membangun tautan di pesan WhatsApp — salah isi berarti pengajar dan peserta menerima tautan yang tidak bisa dibuka.

---

## 2. Cloud SQL

```bash
gcloud sql instances create mpt-pg \
  --database-version=POSTGRES_17 \
  --tier=db-g1-small \
  --region=asia-southeast2 \
  --storage-auto-increase

gcloud sql databases create mpt --instance=mpt-pg
gcloud sql users create mpt --instance=mpt-pg --password='GANTI_INI'
```

Jalankan migrasi dari mesin yang bisa menjangkau instance (Cloud Shell + Cloud SQL Proxy):

```bash
DATABASE_URL='postgres://mpt:PASS@127.0.0.1:5432/mpt' pnpm db:migrate
```

Migrasi **tidak** dijalankan saat container start — Cloud Run bisa menaikkan banyak instance sekaligus dan migrasi paralel akan saling menimpa.

---

## 3. Cloud Storage + retensi 7 hari

```bash
gcloud storage buckets create gs://mpt-audio --location=asia-southeast2 --uniform-bucket-level-access

cat > lifecycle.json <<'JSON'
{"rule":[{"action":{"type":"Delete"},"condition":{"age":7}}]}
JSON
gcloud storage buckets update gs://mpt-audio --lifecycle-file=lifecycle.json
```

Aturan ini yang memenuhi `audio_retention: 7 hari`. Karena berlaku per objek di level bucket, ia juga menutup bug lama di mana rekaman HITS tidak pernah terhapus — cron `/api/cleanup` hanya menyapu audio yang dirujuk `submissions.audio_path`.

Beri service account Cloud Run akses:

```bash
gcloud storage buckets add-iam-policy-binding gs://mpt-audio \
  --member=serviceAccount:SA_EMAIL --role=roles/storage.objectAdmin
```

---

## 4. Secret Manager

```bash
for k in DATABASE_URL AUTH_SECRET WORKER_SECRET CLEANUP_SECRET \
         STORAGE_SIGNING_SECRET KIRIMI_USER_CODE KIRIMI_DEVICE_ID \
         KIRIMI_SECRET; do
  printf '%s' "${!k}" | gcloud secrets create "$k" --data-file=- 2>/dev/null \
    || printf '%s' "${!k}" | gcloud secrets versions add "$k" --data-file=-
done
```

---

## 5. Build + deploy

```bash
gcloud builds submit \
  --tag asia-southeast2-docker.pkg.dev/PROJECT/mpt/web

gcloud run deploy mpt-web \
  --image asia-southeast2-docker.pkg.dev/PROJECT/mpt/web \
  --region asia-southeast2 \
  --add-cloudsql-instances PROJECT:asia-southeast2:mpt-pg \
  --set-env-vars NEXT_PUBLIC_SITE_URL=https://DOMAIN,GCS_BUCKET=mpt-audio \
  --set-secrets DATABASE_URL=DATABASE_URL:latest,AUTH_SECRET=AUTH_SECRET:latest,WORKER_SECRET=WORKER_SECRET:latest,CLEANUP_SECRET=CLEANUP_SECRET:latest,STORAGE_SIGNING_SECRET=STORAGE_SIGNING_SECRET:latest,KIRIMI_USER_CODE=KIRIMI_USER_CODE:latest,KIRIMI_DEVICE_ID=KIRIMI_DEVICE_ID:latest,KIRIMI_SECRET=KIRIMI_SECRET:latest \
  --min-instances 1 \
  --allow-unauthenticated
```

`--min-instances 1` menghindari cold start yang membuka koneksi Postgres baru di tengah demo.

---

## 6. Akun pertama

Belum ada UI pendaftaran admin. Buat akun superadmin langsung:

```sql
INSERT INTO auth_users (email, password_hash) VALUES ('hilmisobandi@gmail.com', '<bcrypt>');
INSERT INTO admins (auth_user_id, nama, email, role, is_active)
SELECT id, 'Hilmi Sobandi', 'hilmisobandi@gmail.com', 'super', true
FROM auth_users WHERE email = 'hilmisobandi@gmail.com';
```

Hash-nya:

```bash
node -e "console.log(require('bcryptjs').hashSync(process.argv[1], 12))" 'PASSWORD_KAMU'
```

Pengajar setelah itu dibuat lewat `/admin/pengajar`, yang sudah menulis ke `auth_users` dengan format nomor yang benar.

---

## 7. Domain — putuskan bersama dulu, jangan sendiri

Dari rapat 3 Agustus: **domain landing page harus berasal dari Raihan.** Setelah diklik boleh berpindah ke domain Mas Agil, **tapi harus dilaporkan lebih dulu.** Ini keputusan hubungan antar-orang, bukan keputusan teknis — jangan diambil sepihak saat deploy.

---

## 8. Uji setelah deploy

1. `/` terbuka
2. Rekam + submit → baris `submissions` bertambah, audio muncul di bucket
3. WA masuk ke `SUPERADMIN_WA`
4. Buka tautan di pesan itu → login pengajar → rekaman bisa diputar
5. Tempel kode unik → baris `teacher_evaluations` bertambah, WA ke peserta terkirim
6. Buka `/rapot/<slug>` sebagai peserta → nilai pengajar tampil, **skor AI tidak muncul di mana pun**
7. Cek bucket punya lifecycle rule: `gcloud storage buckets describe gs://mpt-audio --format='value(lifecycle)'`
