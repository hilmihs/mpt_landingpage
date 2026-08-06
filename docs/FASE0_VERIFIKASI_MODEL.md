# Fase 0 — Verifikasi Model Mu'alim v3_2

**Dijalankan 6–7 Agustus 2026** di GCE Spot T4, `asia-southeast2-a`, project
`pendidikan-muhajir`. VM dimatikan setelah selesai.

Dokumen ini mencatat apa yang **terbukti**, bukan apa yang diperkirakan. Semua
pernyataan di bawah berasal dari pengamatan langsung terhadap model.

---

## 1. Ringkasan: tiga asumsi lama terbukti salah

| Asumsi lama | Kenyataan |
|---|---|
| Vocab model = token latin (`a i u aa b t th H kh` + sufiks `ː`) | Vocab = **huruf Arab** ء ب ت … ي ا + harakat َ ُ ِ + mad ۦ ۥ ۪ |
| Model dimuat lewat `AutoModel(trust_remote_code=True)` | **Gagal** — repo tidak membawa kode arsitekturnya |
| Head *sifa* belum tersedia, khafiy tidak terdeteksi | **Tersedia sejak awal** — 10 level sifat lengkap |

Tumpang tindih antara skema token lama dan vocab asli: **nol**. Selama ini
alignment membandingkan dua abjad berbeda, sehingga setiap angka yang keluar
darinya tidak bermakna — bukan sekadar kurang akurat.

---

## 2. Struktur model

`obadx/muaalem-model-v3_2` adalah **multi-level CTC dengan 11 kepala**:

| Level | Vocab | Isi |
|---|---|---|
| `phonemes` | 43 | huruf Arab + harakat + tanda mad |
| `hams_or_jahr` | 3 | همس / جهر |
| `shidda_or_rakhawa` | 4 | شديد / بين الشدة والرخاوة / رخو |
| `tafkheem_or_taqeeq` | 4 | مفخم / مرقق / أدنى المفخم |
| `itbaq` | 3 | منفتح / مطبق |
| `istitala` | 3 | مستطيل / لا إستطالة |
| `safeer` | 3 | صفير / لا صفير |
| `qalqla` | 3 | مقلقل / لا قلقلة |
| `ghonna` | 3 | مغن / لا غنة |
| `tafashie` | 3 | متفشي / لا تفشي |
| `tikraar` | 3 | مكرر / لا تكرار |

**Sepuluh level sifat itu adalah kosakata lahn khafiy.** Bandingkan dengan
katalog pengajar (`lib/teacher-eval/catalog.ts`):

| Opsi katalog | Level model |
|---|---|
| "Membaca د dengan mengeluarkan nafas (sifat hams)" | `hams_or_jahr` |
| "Membaca س sukun dengan dipantulkan (qolqolah)" | `qalqla` |
| "Kurang tebal ر pada kata الرحمن" | `tafkheem_or_taqeeq` |
| "Kurangnya tempo bacaan huruf sukun" (ghunnah) | `ghonna` |

Pemetaannya langsung, bukan perkiraan.

---

## 3. Cara memuat model

`AutoModel.from_pretrained(..., trust_remote_code=True)` **tidak akan pernah
berhasil** untuk repo ini:

```
model_type    = multi_level_ctc
architectures = ['Wav2Vec2BertForMultilevelCTC']
auto_map      = None          ← repo tidak membawa kode arsitekturnya
```

`trust_remote_code` hanya berguna kalau repo menyertakan modul Python-nya.
Di sini tidak ada, jadi tidak ada versi transformers mana pun yang menolongnya.

**Yang dipakai: TorchScript** — `obadx/muaalem-v3_2-torchscript-v1`, berisi
`model_fp16.pt` / `fp32` / `bf16` + `processor/`. TorchScript membawa grafnya
sendiri sehingga tidak butuh kelas Python apa pun.

```python
model = torch.jit.load(hf_hub_download(REPO, "model_fp16.pt"), map_location="cuda").eval()
fe = AutoFeatureExtractor.from_pretrained(snapshot_download(REPO, allow_patterns=["processor/*"]) + "/processor")
out = model(feats["input_features"].half().cuda(), feats["attention_mask"].cuda())
out = out[0]        # tuple berisi SATU dict — bukan dict langsung
```

Tanda tangan: `forward(input_features, attention_mask) -> (Dict[str, Tensor],)`
Feature extractor: `SeamlessM4TFeatureExtractor`, 16 kHz, 80 mel bins, stride 2.

### Versi paket

- `transformers` **harus < 5**. Versi 5.x tidak mengenali arsitekturnya.
- `torchaudio` harus sepadan dengan `torch`. Image DLVM
  `pytorch-2-9-cu129-ubuntu-2204-nvidia-580` membawa torchaudio yang ABI-nya
  tidak cocok; transformers mengimpornya dan seluruh proses gagal dengan
  `undefined symbol: torch_library_impl`. Perbaikan: `pip install torchaudio==2.9.1`.

---

## 4. Target fonem: pakai pustaka resmi, jangan bikin sendiri

`pip install quran-transcript` (paket milik penulis model).

```python
moshaf = qt.MoshafAttributes(rewaya="hafs", madd_monfasel_len=4,
                             madd_mottasel_len=4, madd_mottasel_waqf=4, madd_aared_len=4)
out = qt.quran_phonetizer(qt.Aya(1, n).get().uthmani, moshaf, remove_spaces=True)
out.phonemes   # untai karakter, bentuknya sama dengan keluaran model
out.sifat      # daftar unit, tiap unit punya 10 atribut sifat
```

**Bukti kecocokan** — rekaman yang Ustadzah nilai 0 lahn jaliy:

```
target ayat 1 : بِسمِللَااهِررَحمَاانِررَحِۦۦۦۦم
model         : بِسمِللَااهِررَحمَاانِررَحِۦۦۦۦم     ← identik
```

Target Al-Fatihah lengkap: **256 karakter, 126 unit sifat**.

---

## 5. Dua jebakan yang wajib ditangani

### 5a. Pembaca melafalkan isti'adzah dan aamiin

Transkripsi nyata satu rekaman:

```
ءَعُۥۥذُبِللَااهِمِنَششَيطَاانِررَجِۦۦۦۦم   ← isti'adzah, TIDAK ada di target
بِسمِللَااهِ… (Al-Fatihah lengkap) …
ءَاامِۦۦۦۦن                              ← aamiin, TIDAK ada di target
```

Dengan alignment **global**, keduanya terhitung puluhan kesalahan palsu. Solusi:
alignment **semi-global** — celah di awal dan akhir sisi prediksi digratiskan
(`align_semi_global` di `qps_decoder.py`).

### 5b. Panjang mad adalah pilihan qiraah, bukan kesalahan

Target disusun dengan mad 4 harakat (`MADD_LEN` di `alfatihah.py`). Pembaca yang
memakai 2 atau 5 harakat akan menghasilkan banyak selisih karakter yang
**bukan** kesalahan. Ini diduga sumber derau terbesar pada angka saat ini dan
belum ditangani.

---

## 6. Hasil atas 762 rekaman ber-ground-truth

Lihat `docs/HASIL_PEMBANDING_MESIN.md` (ditulis setelah run selesai).

---

## 7. Yang masih terbuka

1. **Normalisasi panjang mad** sebelum menghitung selisih — lihat §5b.
2. **Metrik yang sebanding**. Mesin sekarang melaporkan jarak edit karakter;
   Ustadzah menghitung kesalahan diskret. Perlu pengelompokan selisih menjadi
   "kesalahan" agar satuannya sama.
3. **Pemetaan sifat target ↔ prediksi.** Target memakai label latin (`jahr`),
   model mengeluarkan label Arab (`[جهر]`). Sampai dipetakan, lahn khafiy belum
   benar-benar dihitung.
4. **Posisi kata.** `ErrorItem.kata_idx` masih 0; pemetaan karakter → kata belum
   dibuat, padahal `quran_phonetizer` mengembalikan `mappings` yang bisa dipakai.
