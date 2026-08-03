# Integrasi penilaian pengajar — hasil pemetaan

**Dipetakan:** 3 Agustus 2026, malam
**Cara:** membaca header HTTP, membongkar bundel JS aplikasi peserta, dan memanggil endpoint aslinya.

Dokumen ini mencatat apa yang **benar-benar terverifikasi**, bukan asumsi. Rancangan alurnya berubah cukup jauh dari rencana awal karena dua temuan di bawah.

---

## 1. Dua sistem eksternal, sifatnya berbeda

| Sistem | Alamat | Untuk | Bisa di-iframe? |
|---|---|---|---|
| Panel Filament | `assesment-alfatihah.muhajirproject.com` | pengajar **mengisi** penilaian | ❌ **TIDAK** |
| Aplikasi peserta | `assessment-alfatihah-user.netlify.app` | peserta **melihat** rapot | ✅ ya |

### Panel Filament tidak bisa di-embed

```
x-frame-options: SAMEORIGIN
set-cookie: assessment-tilawah-session=…; samesite=lax
```

Dibuktikan dengan memuatnya di dalam iframe sungguhan:

> `Refused to display 'https://assesment-alfatihah.muhajirproject.com/' in a frame because it set 'X-Frame-Options' to 'sameorigin'.`

Dua penghalang independen: header menolak render, dan `samesite=lax` membuat cookie login tidak ikut terkirim di konteks iframe lintas-situs. Memperbaiki salah satunya saja tidak cukup.

**Kalau tetap ingin di-embed**, perubahannya ada di server mereka:
1. Ganti `X-Frame-Options` dengan `Content-Security-Policy: frame-ancestors https://domain-kita`
2. Set `SESSION_SAME_SITE=none` di `.env` Laravel (wajib berpasangan dengan `SESSION_SECURE_COOKIE=true`)

Perlu ditanyakan ke Mas Iqbal. Sampai itu terjadi, form penilaian **dibuka di tab baru**.

### Aplikasi peserta bisa di-embed, dan bisa di-deep-link

Tidak ada `X-Frame-Options` maupun CSP sama sekali.

Halaman depannya memang cuma satu field **"Kode Unik"** (`id="nomorUrut"`) — bukan nama dan nomor WA seperti dugaan awal. **Tapi itu tidak jadi masalah**, karena sumbernya ([Lzadhito/assessment-alfatihah-user](https://github.com/Lzadhito/assessment-alfatihah-user), `app/routes.ts`) hanya punya dua rute:

```ts
index("routes/landing_per_ayat.tsx"),
route("/results/:id", "routes/results_per_ayat/[id].tsx"),
```

Jadi rapot bisa dibuka **langsung**:

```
https://assessment-alfatihah-user.netlify.app/results/{kode_unik}
```

Diverifikasi: `/results/1`, `/results/3`, `/results/25` semuanya menjawab HTTP 200 tanpa `X-Frame-Options`.

**Peserta tidak perlu mengetik kode sama sekali.** Kita kirim link berisi kodenya, atau kita embed URL itu langsung di halaman rapot kita. Ini persis maksud "sudah dikondisikan".

`UNIQUE_CODE_LENGTH = 6` di `app/constants.ts` — kode unik yang baru sepanjang 6 karakter, walau kode lama berupa angka urut dan UUID juga masih dilayani.

---

## 2. Ada REST API publik — ini mengubah segalanya

Ditemukan di dalam bundel JS aplikasi peserta:

```
GET  https://assesment-alfatihah.muhajirproject.com/api/recitation-evaluations
GET  https://assesment-alfatihah.muhajirproject.com/api/recitation-evaluations/by-kode-unik/{kode}
```

Sifatnya:
- **Read-only.** `POST` dijawab `405 Method Not Allowed` — penilaian tidak bisa dibuat lewat API.
- **Tanpa autentikasi.**
- `access-control-allow-origin: *`

Bentuk respons `by-kode-unik/{kode}`:

```json
{
  "uuid": "019de646-…", "createdAt": "2026-05-02T01:20:52.000000Z",
  "kegiatan": "Tahsin Manasik Haji", "namaLengkap": null, "asalHalaqah": "Akhwat",
  "harakat":        { "score": 8,  "label": "Jayyid" },
  "panjangPendek":  { "score": 6,  "label": "Dhoif"  },
  "tasydid":        { "score": 6,  "label": "Dhoif"  },
  "hukumTajwid":    { "score": 10, "label": "Mumtaz" },
  "ketepatanHuruf": { "score": 5,  "label": "Dhoif"  },
  "minScore":       { "score": 5,  "label": "Dhoif"  },
  "pemeriksa": "Ustadzah Ruqayyah", "assessmentHistory": []
}
```

**Akibatnya kita tidak perlu iframe untuk rapot peserta.** Kita tarik nilainya lewat API, simpan di database kita, lalu render sendiri dengan desain kita. Ini sekaligus memenuhi permintaan *"website kita merekam nilai dia berapa"* — mustahil dipenuhi kalau cuma nge-iframe, karena isi iframe lintas-situs tidak bisa dibaca kode kita.

Kliennya: `lib/mpt-assessment.ts`. Penyimpanannya: tabel `teacher_evaluations` di `db/migrations/0008_*.sql`.

⚠️ **Skala skor berbeda.** Sistem ini memakai **1-10** (Mumtaz/Jayyid/Dhoif), rapot AI kita memakai **1-5**. Keduanya tidak boleh disandingkan seolah setara — itulah gunanya `components/rapot/AssessmentScaleNote.tsx`.

---

### Peta lengkap endpoint (diprobe 4 Agustus 2026)

| Endpoint | Metode diizinkan |
|---|---|
| `/api/recitation-evaluations` | `GET, HEAD` |
| `/api/recitation-evaluations/{uuid}` | `GET, HEAD` |
| `/api/recitation-evaluations/by-kode-unik/{kode}` | `GET, HEAD` |
| `/api/recitation-evaluations/{uuid}/participant` | **`PATCH`** |

**Tidak ada endpoint untuk MEMBUAT penilaian.** `POST` ke koleksi dijawab `405 Method Not Allowed` (diverifikasi dua kali). Satu-satunya jalur tulis, `PATCH .../participant`, hanya menempelkan `nama_lengkap` / `nomor_wa` / `pernah_hits` / `divisi` ke penilaian yang **sudah ada** — itulah yang dipakai `DataDiriForm` di aplikasi peserta.

Konsekuensinya: **penilaian hanya bisa lahir dari panel Filament.** Membangun formulir sendiri lalu menembak API mereka tidak mungkin sampai mereka menambahkan endpoint `POST`.

`GET /{uuid}` mengembalikan bentuk yang jauh lebih kaya daripada `by-kode-unik`: ada `participant` dan peta `ayat` (`ayat_1` … `ayat_7_part_2`), masing-masing berisi array `jaliy` dan `khafiy`.

---

## 2b. Kalau nanti formulir mau dibangun sendiri, bahannya sudah lengkap

**Keputusan 4 Agustus 2026: ditunda.** Pengajar tetap memakai formulir Filament di tab baru lalu menempel kode unik. Bagian ini dicatat supaya risetnya tidak perlu diulang.

Sumbernya di repo [Lzadhito/assessment-alfatihah-user](https://github.com/Lzadhito/assessment-alfatihah-user):

- `app/modules/form_per_ayat/constants.ts` → `EVALUATION_OPTIONS`
- `app/modules/form_per_ayat/schema.ts` → bentuk payload
- `app/lib/scoring.ts` → `calculateScore(jaliy, khafiy)`

Jumlah kategorinya **110** — inilah "sudah ada 100" yang Mas Agil sebut di rapat:

| Segmen | Jaliy | Khafiy |
|---|---|---|
| Ayat 1 | 8 | 7 |
| Ayat 2 | 7 | 7 |
| Ayat 3 | 5 | 6 |
| Ayat 4 | 5 | 5 |
| Ayat 5 | 6 | 6 |
| Ayat 6 | 4 | 8 |
| Ayat 7 | 9 | 10 |
| Ayat 7 part 2 | 9 | 8 |
| **Total** | **53** | **57** |

Strukturnya **per-ayat**, persis seperti permintaan Mas Agil: *"di setiap ayat ada pilihan jalan apa jali sama khofinya setiap ayat"*. Tiap pilihan sudah ditandai indikatornya di ujung kalimat — misal `"Membaca ق menjadi ك pada kata المستقيم [Ketepatan Huruf]"` — sehingga lima skor indikator bisa diturunkan otomatis dari centangan, tanpa pengajar memilih kategori dua kali. Ini yang membuat target 5 menit realistis.

Rumus skornya:

```ts
calculateScore(jaliy, khafiy):
  jaliy  > 5  -> 1
  jaliy >= 1  -> 2
  khafiy >= 5 -> 3
  khafiy >= 1 -> 4
  else        -> 5
```

Kalau formulir native jadi dibangun, pakai rumus ini apa adanya supaya hasilnya tetap sebanding dengan 4.304 penilaian lama mereka — itu syarat review Agustus–Desember jadi bermakna.

---

## 3. 🔴 Masalah keamanan di sistem mereka — perlu dilaporkan

Ini **bukan** di kode kita, tapi menyangkut data peserta kita, jadi harus disampaikan ke Mas Iqbal / pengelola sistem itu.

Endpoint daftar terbuka untuk siapa saja tanpa login:

```
GET /api/recitation-evaluations   →  { "total": 4304, … }
```

**4.304 catatan penilaian terekspos publik.** Tiap baris memuat `kode_unik`, nama `pemeriksa`, `kegiatan`, dan skor.

Lebih buruk lagi, **kode uniknya berurutan dan bisa ditebak**. Bukan cuma UUID — angka biasa juga diterima:

| kode | pemeriksa | kegiatan |
|---|---|---|
| 1 | Ustadzah Ruqayyah | Tahsin Manasik Haji |
| 2 | Ustadzah Wildatun Uyun | Tahsin Manasik Haji |
| 3 | Atalika | Tahsin Al-Fatihah - LAZ |
| 7 | Ustadzah Talida Jihan Nabila | Halaqah Tahsin Manasik Haji 1447 H |
| 25 | Stliem Putri Dwi | Al Fatihah Mei 2026 |

Artinya siapa pun bisa menghitung `1, 2, 3, …` dan membaca seluruh hasil penilaian semua peserta. Ditambah CORS `*`, situs mana pun bisa melakukannya langsung dari browser pengunjung.

Rekomendasi ke pengelola sistem itu: tutup endpoint daftar (butuh autentikasi), dan ganti kode unik jadi UUID acak yang tidak berurutan. Selama belum diperbaiki, anggap semua data di sana bersifat publik.

---

## 4. Alur yang dipakai, hasil penyesuaian

```
Peserta rekam di aplikasi kita
      │
      ├─► audio disimpan (GCS di produksi, disk lokal saat dev)
      ├─► WA konfirmasi ke peserta ("sedang diperiksa, mohon tunggu")
      └─► WA ke pengajar via kirimi.id — rotasi, gender ketat
                │
                ▼
      Pengajar buka halaman KITA (setelah login)
        · pemutar rekaman di atas
        · data peserta
        · tombol "Buka Form Penilaian" → panel Filament di TAB BARU
          (bukan iframe — lihat bagian 1)
                │
                ▼
      Pengajar menilai di Filament, dapat kode unik
                │
                ▼
      Kode unik masuk ke sistem kita
        · dicocokkan otomatis lewat API (pemeriksa + jendela waktu), ATAU
        · ditempel manual oleh pengajar (jalur pasti)
                │
                ▼
      Kita tarik nilainya lewat API → simpan ke teacher_evaluations
                │
                ▼
      WA ke peserta berisi link rapot di aplikasi KITA
                │
                ▼
      Peserta lihat rapot (dirender sendiri, bukan iframe)
        └─► CTA lanjut daftar Tahsin Al-Fatihah

  Paralel & tidak terlihat peserta:
      AI kita menilai rekaman yang sama, hasilnya disimpan
      sebagai bahan pembanding Agustus–Desember.
```

### Kenapa kode unik tidak bisa tertaut otomatis dengan pasti

API tidak punya `POST`, dan tidak ada field bebas di form Filament yang bisa kita titipi ID submission kita. Jadi tidak ada cara menautkan secara tegas. Yang bisa dilakukan:

- **Pencocokan otomatis** (`findEvaluationForTeacher` di `lib/mpt-assessment.ts`): cari penilaian terbaru dengan `pemeriksa` sama dan `created_at` setelah waktu penugasan. Tebakan berdasar, **bukan kepastian** — kalau satu pengajar menilai beberapa peserta beruntun, bisa tertukar.
- **Tempel manual**: pengajar menyalin kode unik ke halaman kita. Pasti benar, biayanya satu langkah tambahan.

Rancangan sekarang memakai keduanya: sistem menebak, pengajar mengonfirmasi. Ini menjaga target Mas Agil (5 menit per report) sambil tidak mempertaruhkan ketertukaran data.

---

## 4b. Daftar kategori kesalahan sudah ada — di repo, bukan di spreadsheet

Di rapat Mas Agil menekankan penilaian harus **klik-klik tanpa kolom teks bebas**, dan menyebut ada ~100 kategori dari Ustadz Syukur yang sedang dicek Ustadz Syukri.

Ternyata daftar itu **sudah hidup sebagai kode** di `app/constants.ts` repo aplikasi peserta: `SECTIONS` berisi lima kategori, masing-masing dengan pilihan siap-klik dan bobotnya.

| Kategori | Konstanta |
|---|---|
| Harokat | `EVAL_HAROKAT` |
| Ketepatan Huruf | `EVAL_KETEPATAN_HURUF` |
| Panjang-Pendek | `EVAL_PANJANG_PENDEK` |
| Tasydid | `EVAL_TASYDID` |
| Hukum Tajwid | `EVAL_HUKUM_TAJWID` |

Tiap pilihan sudah diberi bobot `jaliy`, `khafiy`, atau `flat-1-khafiy` — jadi pengajar cukup memilih kalimat kesalahannya, bobotnya ikut otomatis. Contoh: *"Huruf qaf (ق) pada kata al-mustaqiim belum tepat (masih terdengar seperti huruf kaf ك)"* → `jaliy`.

Rumus skornya (`app/lib/scoring.ts`):

```ts
calculateScore(jaliy, khafiy):
  jaliy  > 5  -> 1
  jaliy >= 1  -> 2
  khafiy >= 5 -> 3
  khafiy >= 1 -> 4
  else        -> 5
```

Artinya **satu saja kesalahan lahn jaliy langsung menjatuhkan skor kategori itu ke 2**. Ini penting dipahami sebelum membandingkan dengan skor AI kita, yang memakai bobot major=1 / minor=0.5 lalu diambang — model penilaiannya berbeda, bukan cuma skalanya.

Kalau nanti form penilaian mau dibangun native di aplikasi kita (supaya tidak perlu pindah tab), `app/constants.ts` itulah sumber datanya — tidak perlu menunggu daftar baru.

---

## 4c. Permintaan untuk Mas Iqbal — tinggal disalin

**Status 4 Agustus 2026: ini jalur yang dipilih.** Formulir native ditahan sampai jawaban Mas Iqbal keluar.

Kenapa ini penting, bukan sekadar kosmetik: pengajar harus bisa **mendengar rekaman sambil mengisi formulir**. Kalau formulirnya di tab lain, dia bolak-balik untuk mengulang bacaan, dan target "5 menit per laporan" dari Mas Agil tidak akan tercapai. Iframe membuat pemutar dan formulir ada di satu layar.

### Permintaan 1 — izinkan halaman di-embed (2 baris)

Sekarang: `x-frame-options: SAMEORIGIN` + cookie sesi `samesite=lax`. Keduanya harus diubah; salah satu saja tidak cukup.

**(a) Ganti header.** Kemungkinan besar dipasang di nginx:

```nginx
# HAPUS baris ini
# add_header X-Frame-Options SAMEORIGIN;

# GANTI dengan (isi domain aplikasi kami):
add_header Content-Security-Policy "frame-ancestors 'self' https://DOMAIN-KAMI";
```

Kalau ternyata dari middleware Laravel, cari `X-Frame-Options` di `app/Http/Middleware`.

**(b) Cookie sesi.** Di `.env` aplikasi Laravel:

```env
SESSION_SAME_SITE=none
SESSION_SECURE_COOKIE=true
```

`SameSite=None` **wajib** berpasangan dengan `Secure=true` — browser menolak kombinasi lain. Situsnya sudah HTTPS, jadi aman.

Setelah dua perubahan ini, `frame-ancestors` tetap membatasi siapa yang boleh meng-embed — hanya domain yang disebut. Ini **lebih ketat dan lebih spesifik** daripada `SAMEORIGIN`, bukan pelonggaran buta.

### Permintaan 2 — dua lubang keamanan (lihat bagian 3)

Sekalian dibicarakan karena orangnya sama:

1. `GET /api/recitation-evaluations` terbuka tanpa autentikasi — 4.304 catatan, dan `kode_unik`-nya berurutan sehingga bisa ditebak satu per satu.
2. `PATCH /api/recitation-evaluations/{uuid}/participant` **juga tanpa autentikasi** — siapa pun bisa menimpa nama dan nomor WhatsApp peserta mana pun, dan `uuid`-nya didapat gratis dari endpoint nomor 1.

Yang kedua lebih mendesak: itu tulis, bukan sekadar baca.

### Permintaan 3 — opsional, kalau memungkinkan

Endpoint `POST /api/recitation-evaluations` untuk membuat penilaian. Saat ini tidak ada (`405`), sehingga penilaian hanya bisa lahir dari panel Filament. Kalau endpoint ini ada, formulir bisa dibangun di aplikasi kami dengan data tetap terpusat di sistem mereka.

---

## 5. Yang masih perlu diputuskan

1. **Header iframe** — tanya Mas Iqbal (bagian 1). Kalau bisa diubah, form penilaian bisa masuk ke halaman kita tanpa pindah tab.
2. **Kredensial kirimi.id** — `KIRIMI_USER_CODE`, `KIRIMI_DEVICE_ID`, `KIRIMI_SECRET`, plus perangkat yang sudah dipasangkan. Tanpa ini notifikasi WA cuma masuk log.
3. **Nama pengajar harus persis sama** antara tabel `teachers` kita dan field `pemeriksa` di Filament, kalau mau pencocokan otomatis jalan.
4. **Lapor temuan keamanan** di bagian 3.
