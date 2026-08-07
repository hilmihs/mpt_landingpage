# Inferensi Batch — GPU nyala seperlunya

GPU T4 Spot yang menyala terus ≈ **$125/bulan**. Volume penilaian sekarang
sekitar belasan rekaman per pekan, dan peserta memang menunggu berhari-hari
(V3: penilai adalah pengajar, bukan mesin). Menyalakan GPU terus-menerus
berarti membayar 24 jam untuk pekerjaan beberapa menit.

Batch: nyalakan, proses yang menumpuk, matikan. Biayanya jadi sekitar
**$0,20 per putaran**.

---

## Kenapa bukan memanggil ML server dari Cloud Run

Rancangan awal (`docs/ML_SERVER_PROMPT_V2.md`) menempatkan FastAPI di GPU dan
worker Next.js memanggilnya lewat HTTP. Itu menuntut:

- port publik dengan TLS, atau VPC connector
- `ML_SERVER_URL` tetap di Cloud Run, padahal alamat VM berubah tiap dinyalakan
- worker harus tahu kapan VM hidup

`CLAUDE.md` sendiri melarang mengekspos port 8000 polos ke publik. Semua itu
ongkos untuk sesuatu yang berjalan beberapa menit sehari.

## Rancangan yang dipakai: papan antara di basis data

```
[VM GPU, hidup beberapa menit]          [Cloud Run, jalan terus]
  baca submissions ai_status='pending'
  unduh audio dari GCS
  jalankan model                 ─┐
  tulis findings mentah           │
        ke ai_inference_raw       │
  MATI                            │
                                  └─►  cron /api/worker
                                         baca ai_inference_raw
                                         proyeksikan ke instrumen pengajar
                                         tulis ai_evaluations
```

Pembagiannya mengikuti bahasa masing-masing:

- **Python di GPU** — audio → temuan. Itu memang pekerjaannya.
- **TypeScript di Cloud Run** — temuan → instrumen pengajar. Logika itu sudah
  ada, sudah diuji (`lib/ai-eval/`), dan memakai `computeEvaluation` milik
  pengajar. Menuliskannya ulang dalam Python berarti dua implementasi yang
  akan menyimpang diam-diam.

Keuntungan lain: tidak ada port terbuka, tidak ada TLS, tidak ada alamat VM
yang harus diketahui Cloud Run. Keduanya cuma bertemu di satu tabel.

---

## Cara menjalankan

```bash
ml-server/scripts/batch_run.sh
```

Skrip itu menyalakan VM, menunggu siap, menjalankan inferensi, lalu
**mematikan VM apa pun yang terjadi** — termasuk kalau inferensinya gagal di
tengah jalan (`trap` pada EXIT).

Lalu proyeksinya, dari mesin mana pun yang bisa menjangkau basis data:

```bash
curl -H "x-worker-secret: $WORKER_SECRET" https://<situs>/api/worker
```

Atau tunggu cron harian yang sudah terpasang di `vercel.json`.

### Pengaman biaya, berlapis

1. `trap ... EXIT` di skrip — VM dimatikan walau skrip dihentikan Ctrl-C.
2. `--max-run-duration` pada VM — batas keras dari GCE, tetap berlaku kalau VM
   hang atau skrip mati tanpa sempat membersihkan.
3. Watchdog nganggur di dalam VM — mati setelah GPU diam sekian menit.

Ketiganya gagal dengan cara berbeda, jadi tidak saling menggantikan.

---

## Yang perlu disiapkan sekali

VM butuh akses ke Cloud SQL dan GCS. Service account bawaan Compute Engine
biasanya sudah punya cakupan yang cukup di project yang sama; kalau tidak,
berikan `roles/cloudsql.client` dan `roles/storage.objectViewer`.

Model diunduh sekali (~2,4 GB) dan menetap di disk VM, jadi putaran berikutnya
tidak mengunduh ulang selama VM tidak dihapus.

---

## Kapan rancangan ini tidak lagi cocok

Kalau kelak mesin harus menilai **saat peserta menunggu** — bukan berhari-hari
— batch tidak cukup dan pemanggilan langsung jadi wajar. Selama penilai
utamanya pengajar dan peserta memang menunggu, tidak ada alasan membayar GPU
menganggur.
