# Hasil Pembanding Mesin vs Penilaian Ustadzah

**Dijalankan 6–7 Agustus 2026.** 762 rekaman Al-Fatihah yang sudah dinilai
Ustadzah sejak Oktober 2025, dievaluasi ulang oleh Mu'alim v3_2 di GPU T4.

Prasyarat teknisnya ada di [`FASE0_VERIFIKASI_MODEL.md`](FASE0_VERIFIKASI_MODEL.md).

---

## Hasil

```
762 rekaman diproses · 762 berhasil · 0 gagal
```

| | Ustadzah | Mesin |
|---|---|---|
| Satuan | jumlah lahn jaliy | jarak edit karakter |
| Median | 7 | 28 |
| Rata-rata | 8,12 | 33,28 |
| Maksimum | 47 | 171 |

**Korelasi**

| Ukuran | Nilai |
|---|---|
| Spearman (peringkat) — jaliy vs jarak | **0,625** |
| Pearson — jaliy vs jarak | 0,486 |
| Pearson — (jaliy+khafiy) vs jarak | 0,441 |
| Pearson — durasi vs jarak | −0,478 |

**Median jarak mesin per kelompok penilaian Ustadzah**

| Lahn jaliy (Ustadzah) | n | Median jarak mesin |
|---|---|---|
| 0 | 73 | 8,0 |
| 1–2 | 98 | 14,0 |
| 3–5 | 164 | 22,0 |
| 6–10 | 197 | 30,0 |
| 11–15 | 114 | 36,5 |
| 16–47 | 116 | 47,5 |

Progresinya **monotonik tanpa kecuali**. Mesin dan Ustadzah mengurutkan peserta
dengan cara yang sebagian besar sama.

---

## Cara membaca angka ini

**Yang boleh disimpulkan:** mesin membedakan bacaan bersih dari bacaan bermasalah
dengan andal. Rekaman yang Ustadzah beri 0 lahn jaliy bermedian 8, yang diberi
≥10 bermedian 42 — terpisah lebih dari lima kali lipat.

**Yang belum boleh disimpulkan:** bahwa mesin bisa menggantikan penilaian
Ustadzah. Spearman 0,625 berarti urutannya mirip, bukan sama. Untuk keputusan
per-peserta, itu belum cukup.

**Satuannya belum sepadan.** Mesin melaporkan jarak edit karakter; Ustadzah
menghitung kesalahan diskret. Satu huruf yang salah dibaca bisa memunculkan
beberapa selisih karakter sekaligus (hurufnya, lalu harakatnya). Karena itu
Pearson (0,486) lebih rendah daripada Spearman (0,625): hubungannya monotonik
tapi tidak linear.

**Korelasi durasi negatif (−0,478) itu kabar baik.** Kalau positif dan besar,
yang terukur cuma panjang rekaman. Yang terjadi sebaliknya — bacaan lebih lambat
justru berjarak lebih kecil, konsisten dengan bacaan yang lebih hati-hati.

---

## Batas yang diketahui

### 1. Ada lantai derau sekitar 8 — separuhnya sudah terjelaskan

Rekaman yang dinilai sempurna pun bermedian jarak 8. Itu bukan kesalahan
pembaca. Dugaannya: **panjang mad**. Target disusun dengan mad 4 harakat
(`MADD_LEN` di `app/ml/alfatihah.py`), sedangkan pembaca bervariasi 2/4/5
harakat — perbedaan gaya yang sah, tapi terhitung sebagai selisih karakter.

**Dugaan itu diuji dan benar.** Pada 148 rekaman yang prediksi mentahnya
disimpan, pengulangan karakter mad diratakan (`ۦۦۦۦ` → `ۦ`) di kedua sisi
sebelum jarak dihitung:

| | Pearson | Spearman | Median | Median rekaman bersih |
|---|---|---|---|---|
| Apa adanya | 0,466 | 0,583 | 22,5 | 8,0 |
| Mad dinormalkan | 0,466 | **0,628** | 13,0 | **4,0** |

Lantai deraunya **turun separuh** dan korelasi peringkat naik. Pearson tidak
bergerak, yang masuk akal: normalisasi ini memperbaiki derau, bukan membuat
satuannya jadi sepadan.

**Sudah dipasang** di `qps_decoder.ratakan_mad()`. Diverifikasi lewat pipeline
sungguhan (`decode_to_errors`) pada 148 prediksi tersimpan: Spearman 0,628,
lantai derau 4,0 — sama persis dengan hasil eksperimen.

Dua pendekatan lain diuji dan **kalah**, jadi jangan diulang:

| Pendekatan | Spearman | Lantai derau |
|---|---|---|
| Batas panjang run maks 2 | 0,616 | 4,0 |
| Cocokkan ke 6 varian panjang mad, ambil terbaik | 0,607 | 8,0 |
| **Ratakan penuh** | **0,628** | **4,0** |

Pencocokan multi-panjang tidak menurunkan lantai derau sama sekali. Artinya
deraunya bukan dari *pilihan* panjang mad yang konsisten sepanjang bacaan,
melainkan dari pemanjangan yang bervariasi di dalam satu rekaman — hal yang
hanya bisa ditangani perataan.

Kekhawatiran bahwa perataan menyembunyikan mad lazim ternyata tidak berdasar:
meratakan ke satu karakter tetap membedakan *ada* dan *tidak ada* mad, yang
hilang hanya derajat panjangnya.

### 2. Lahn khafiy belum benar-benar diukur

Model menyediakan sepuluh level sifat, dan target dari `quran_transcript` juga
membawa sifat. Tetapi labelnya berbeda bahasa — target `jahr`, model `[جهر]` —
dan pemetaannya belum dibakukan. Sampai itu selesai, angka khafiy belum ada.

Ini berbeda dari anggapan sebelumnya bahwa modelnya tidak mampu. Modelnya mampu;
yang belum ada adalah jembatannya.

### 3. Posisi kata belum dipetakan

`ErrorItem.kata_idx` masih 0 untuk semua temuan. `quran_phonetizer` mengembalikan
`mappings` yang bisa dipakai memetakan karakter ke kata, tapi belum dipasang.
Akibatnya penilaian per-segmen — yang dibutuhkan untuk skor 1-10 seperti
instrumen pengajar — belum bisa dihasilkan dari jalur ini.

### 4. Ground truth-nya total, bukan per segmen

Spreadsheet Ustadzah mencatat jumlah lahn per rekaman, bukan per ayat. Jadi
dataset ini bisa memvalidasi *hitungan*, tidak bisa memvalidasi *skor kepala*
1-10 milik instrumen pengajar.

---

## Langkah berikutnya, menurut nilai per usaha

1. ~~Pasang normalisasi panjang mad~~ — **selesai**, lihat §1 di atas.
   Tinjauan `klasifikasi()` juga selesai — hasilnya di §5 di bawah.
2. **Kelompokkan selisih menjadi "kesalahan"** supaya satuannya sama dengan cara
   Ustadzah menghitung. Setelah itu Pearson baru layak dibaca.
3. **Petakan label sifat** target ↔ prediksi → lahn khafiy akhirnya terukur.
4. **Pasang `mappings`** untuk posisi kata → penilaian per segmen → skor 1-10
   yang sebanding dengan pengajar.

Butir 1 dan 2 tidak butuh GPU: prediksi mentah 120 rekaman sudah disimpan
(`hasil2.jsonl`) supaya metriknya bisa disetel ulang tanpa menyalakan VM.

---

## Catatan data dan biaya

- Audio **tidak pernah disalin** ke sistem kita. Tiap rekaman diunduh ke berkas
  sementara, diproses, lalu dihapus pada iterasi yang sama. Yang tersimpan hanya
  angka.
- Berkas ground truth yang dipakai hanya memuat id Drive, dua hitungan, dan jenis
  kelamin — tanpa nama maupun nomor WhatsApp.
- VM: GCE Spot T4 `asia-southeast2-a`, dimatikan setelah run selesai. Biaya
  keseluruhan di bawah $1.

---

## Tinjauan klasifikasi — apa yang sebenarnya ditemukan mesin

Rincian awal memunculkan kecurigaan: `ketepatan_huruf` menyerap 11,6 temuan per
rekaman sementara empat indikator lain di bawah 2. Dugaannya `klasifikasi()`
membuang terlalu banyak ke kategori huruf karena ia cabang terakhir.

**Dugaan itu salah.** Setelah 1.511 substitusi dari 148 rekaman dibongkar,
yang ditemukan mesin adalah kesalahan yang justru dinamai katalog pengajar:

| Substitusi | Frekuensi | Opsi katalog |
|---|---|---|
| ط → ت | 162× | ط pada الصراط |
| ض → د | 138× | "Membaca huruf ض menjadi د pada kata المغضوب" |
| ص → س | 115× | "Membaca ص menjadi س ,ش atau ز pada kata صراط" |
| ع → ء | 113× | "Membaca ع menjadi أ pada kata عليهم" |
| ص → ش | 87× | idem |
| د → ت | 60× | "Membaca د menjadi ت" |
| ح → ه | 54× | "Membaca ح menjadi ه‍ atau خ" |
| ق → ك | 36× | "Membaca ق menjadi ك pada kata المستقيم" |
| ن → م | 31× | "Membaca ن menjadi م … pada kata أنعمت [Tajwid]" |

Posisi paling sering meleset juga persis kata yang disebut katalog: indeks 192
adalah ض pada المغضوب, indeks 134 adalah ص pada الصراط, indeks 148 adalah ق pada
المستقيم.

Dominasi `ketepatan_huruf` sebagian memang nyata: dari 53 opsi jaliy di katalog,
**28 (53%) bertag [Ketepatan Huruf]**. Instrumen pengajar sendiri memang berat
ke sana.

| Indikator | Katalog (jaliy) | Mesin |
|---|---|---|
| Ketepatan Huruf | 53% | 71% |
| Panjang Pendek | 19% | 6% |
| Tasydid | 17% | 8% |
| Harakat | 9% | 12% |
| Hukum Tajwid | 2% | 1% |

### Harga yang dibayar perataan mad

Kekurangan `panjang_pendek` (6% vs 19%) adalah **akibat langsung** perataan mad
di §1: meratakan pengulangan membuang sinyal mad itu sendiri. Korelasi
keseluruhan naik, akurasi per-indikator turun.

Tiga varian ambang selisih panjang run diuji untuk memulihkannya:

| Ambang | Pearson | Spearman | Lantai derau | Temuan mad/rekaman |
|---|---|---|---|---|
| abaikan mad (sekarang) | 0,451 | 0,627 | 4,0 | 0,00 |
| selisih ≥ 4 | 0,454 | 0,627 | 4,0 | 0,07 |
| selisih ≥ 3 | 0,452 | 0,625 | 4,0 | 0,19 |
| selisih ≥ 2 | 0,476 | 0,610 | 6,0 | 3,66 |

Tidak ada yang memulihkan `panjang_pendek` tanpa merusak yang lain, jadi **tidak
ada yang dipasang**. Ambang ≥2 menaikkan Pearson tapi menurunkan Spearman dan
menaikkan lantai derau — 3,66 temuan mad per rekaman hampir pasti variasi gaya,
bukan kesalahan.

Sebabnya: aturan panjang run yang berlaku global tidak bisa membedakan mad yang
panjangnya **tetap** (mad lazim 6 harakat, mad thabi'i 2) dari yang **boleh
bervariasi** (mad jaiz munfasil 2–5). Yang dibutuhkan adalah toleransi per-jenis
mad, dan `quran_phonetizer` mengembalikan `mappings` yang bisa memberi tahu
jenisnya. Itu pekerjaan berikutnya di area ini.

### Kelayakan pra-isi form

Karena temuan mesin ternyata sudah menyerupai opsi katalog, kelayakan skema A
diuji langsung: peta tangan berisi **20 pasangan huruf** dicocokkan ke temuan.

```
1.511 substitusi dari 148 rekaman
  991 (65%) punya nama di katalog
  520 (34%) belum terpetakan — ekor panjang pasangan langka
  6,70 usulan bernama per rekaman
  89%  rekaman dapat minimal satu usulan bernama
```

Sebagai pembanding, median lahn jaliy menurut Ustadzah adalah 7 — jadi jumlah
usulan mesin berada di kisaran yang masuk akal, bukan membanjiri.

Ini membuat **skema A jauh lebih murah daripada perkiraan awal**. Tidak perlu
memetakan 110 opsi satu per satu; sebagian besar bobotnya ada di belasan
pasangan huruf yang berulang.

**Yang belum diketahui: presisi.** Dari 6,7 usulan itu, berapa yang benar-benar
dipertahankan pengajar? Tidak bisa dijawab dengan dataset ini — jawabannya butuh
penilaian native dari portal, yang saat ini baru 2 baris.
