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

Perbaikan ini belum dipasang di `qps_decoder.py` — ia diuji di luar, pada
prediksi yang tersimpan. Memasangnya adalah pekerjaan kecil dengan hasil
terukur.

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

1. **Pasang normalisasi panjang mad** di `qps_decoder.py`. Sudah diuji di luar
   dan terbukti memangkas lantai derau separuh — tinggal dipindahkan ke kode.
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
