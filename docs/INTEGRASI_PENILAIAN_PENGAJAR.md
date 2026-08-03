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

## 5. Yang masih perlu diputuskan

1. **Header iframe** — tanya Mas Iqbal (bagian 1). Kalau bisa diubah, form penilaian bisa masuk ke halaman kita tanpa pindah tab.
2. **Kredensial kirimi.id** — `KIRIMI_USER_CODE`, `KIRIMI_DEVICE_ID`, `KIRIMI_SECRET`, plus perangkat yang sudah dipasangkan. Tanpa ini notifikasi WA cuma masuk log.
3. **Nama pengajar harus persis sama** antara tabel `teachers` kita dan field `pemeriksa` di Filament, kalau mau pencocokan otomatis jalan.
4. **Lapor temuan keamanan** di bagian 3.
