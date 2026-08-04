import {
  INDICATOR_LABEL,
  SEGMENT_KEYS,
  type IndicatorKey,
  type SegmentKey,
} from "@/lib/teacher-eval/types";

export { SEGMENT_KEYS, INDICATOR_LABEL };
export type { SegmentKey, IndicatorKey };

/**
 * Katalog kesalahan bacaan Al-Fatihah — 110 pilihan, 53 jaliy dan 57 khafiy.
 *
 * Disalin apa adanya dari instrumen yang sudah dipakai para pengajar
 * (Lzadhito/assessment-alfatihah, app/modules/form_per_ayat/constants.ts).
 * Kalimatnya SENGAJA tidak dirapikan — spasi ganda dan apostrof melengkung
 * dipertahankan, karena kalimat inilah yang tersimpan di kolom `ayat` sebagai
 * identitas temuan. Merapikan satu spasi berarti temuan lama tidak lagi cocok
 * dengan pilihan baru.
 *
 * Indikator ditempel di ujung kalimat sebagai "[Kategori]". Bentuk itu warisan
 * dari sistem lama yang tidak pernah membacanya; di sini parseOption()
 * mengurainya sehingga lima skor indikator bisa dihitung.
 */

export interface SegmentOptions {
  jaliy: readonly string[];
  khafiy: readonly string[];
}

export const EVALUATION_OPTIONS: Record<SegmentKey, SegmentOptions> = {
  ayat_1: {
    jaliy: [
      "Membaca ب menjadi م [Ketepatan Huruf]",
      "Membaca ه‍ menjadi ح atau خ pada lafadz الله [Ketepatan Huruf]",
      "Membaca ح menjadi ه‍ atau خ pada kata الرحمن الرحيم [Ketepatan Huruf]",
      "Membaca ر menjadi خ/و/tanpa getar pada kata الرحمن الرحيم  [Ketepatan Huruf]",
      "Membaca س menjadi ش/ص [Ketepatan Huruf]",
      "Salah tasydid  الله.. الرحمن..  الرحيم [Tasydid]",
      "Terjadi salah membaca harakat [Harakat]",
      "Salah mad (kurang dari 2 harakat) [Panjang Pendek]",
    ],
    khafiy: [
      "Membaca س sukun dengan dipantulkan (qolqolah) pada kata بسم [Ketepatan Huruf]",
      "Kurang tebal ر pada kata الرحمن الرحيم  [Ketepatan Huruf]",
      "Kurang menyempurnakan Harakat [Harakat]",
      "Artikulasi huruf kurang tegas [Ketepatan Huruf]",
      "Harakat kasrah dibaca seperti ‘e’ [Harakat]",
      // Sumbernya menandai ini [Harakat]; diperbaiki jadi [Panjang Pendek] karena
      // kalimat yang persis sama bertag [Panjang Pendek] di enam segmen lainnya.
      "Kadar mad thabi’i lebih dari 2 harakat [Panjang Pendek]",
      "Kurangnya tempo bacaan huruf sukun pada huruf س dan ح [Ketepatan Huruf]",
    ],
  },
  ayat_2: {
    jaliy: [
      "Membaca ح menjadi ه‍ atau خ pada kata الحمد [Ketepatan Huruf]",
      "Membaca ه‍ menjadi ح atau خ pada lafadz الله [Ketepatan Huruf]",
      "Kurang tasydid pada kata ربِّ [Tasydid]",
      "Membaca ب menjadi م [Ketepatan Huruf]",
      "Membaca ع menjadi أ atau ‘nga’ pada kata العالمين [Ketepatan Huruf]",
      "Terjadi salah membaca harakat  [Harakat]",
      "Salah mad (kurang dari 2 harakat) [Panjang Pendek]",
    ],
    khafiy: [
      "Memantulkan pelafalan huruf ل pada الحمد [Ketepatan Huruf]",
      "Membaca ر dengan tipis pada kata رب [Ketepatan Huruf]",
      "Kurangnya tempo bacaan huruf sukun pada huruf ل dan م [Ketepatan Huruf]",
      "Harakat kasrah dibaca seperti ‘e’ [Harakat]",
      "Kadar mad thabi’i lebih dari 2 harakat [Panjang Pendek]",
      "Kurang menyempurnakan Harakat  [Harakat]",
      "Artikulasi huruf kurang tegas [Ketepatan Huruf]",
    ],
  },
  ayat_3: {
    jaliy: [
      "Membaca ح menjadi ه‍ atau خ pada kata الرحمن الرحيم [Ketepatan Huruf]",
      "Membaca ر menjadi خ/و/tanpa getar pada kata الرحمن الرحيم [Ketepatan Huruf]",
      "Kurang tasydid pada kata  الرحمن..  الرحيم [Tasydid]",
      "Terjadi salah membaca harakat [Harakat]",
      "Salah mad (kurang dari 2 harakat) [Panjang Pendek]",
    ],
    khafiy: [
      "Kurang tebal ر pada kata الرحمن الرحيم [Ketepatan Huruf]",
      "Kurang menyempurnakan Harakat [Harakat]",
      "Artikulasi huruf kurang tegas [Ketepatan Huruf]",
      "Harakat kasrah dibaca seperti ‘e’ [Harakat]",
      "Kadar mad thabi’i lebih dari 2 harakat [Panjang Pendek]",
      "Kurangnya tempo bacaan huruf sukun pada huruf ح pada الرحمن [Ketepatan Huruf]",
    ],
  },
  ayat_4: {
    jaliy: [
      "Membaca ك menjadi ق [Ketepatan Huruf]",
      "Membaca و menjadi o pada kata يوم menjadi yowmi [Ketepatan Huruf]",
      "Membaca د menjadi ت [Ketepatan Huruf]",
      "Kurang tasydid pada kata الدين [Tasydid]",
      "Terjadi salah membaca harakat [Harakat]",
    ],
    khafiy: [
      "Membaca د dengan mengeluarkan nafas (sifat hams) pada kata يوم الدين [Ketepatan Huruf]",
      "Harakat kasrah dibaca seperti ‘e’ [Harakat]",
      "Kurang menyempurnakan Harakat [Harakat]",
      "Artikulasi huruf kurang tegas[Ketepatan Huruf]",
      "Kadar mad thabi’i lebih dari 2 harakat [Panjang Pendek]",
    ],
  },
  ayat_5: {
    jaliy: [
      "Kurang tasydid pada kata إيّاكَ [Tasydid]",
      "Menambah mad/panjang di huruf ك pada kata إياك [Panjang Pendek]",
      "Menambah mad/panjang di huruf د pada kata نعبد [Panjang Pendek]",
      "Kurang mad/panjang pada kata إياك [Panjang Pendek]",
      "Membaca ع menjadi ء atau ‘ngi’ pada kata نستعين [Ketepatan Huruf]",
      "Terjadi salah membaca harakat [Harakat]",
    ],
    khafiy: [
      "Kurangnya tempo bacaan huruf sukun pada huruf ع pada kata نعبد [Ketepatan Huruf]",
      "Kurangnya tempo bacaan huruf sukun pada huruf س pada kata نستعين [Ketepatan Huruf]",
      "Harakat kasrah dibaca seperti ‘e’ [Harakat]",
      "Kurang menyempurnakan Harakat [Harakat]",
      "Artikulasi huruf kurang tegas [Ketepatan Huruf]",
      "Kadar mad thabi’i lebih dari 2 harakat [Panjang Pendek]",
    ],
  },
  ayat_6: {
    jaliy: [
      "Membaca ه menjadi ح atau خ pada kata اهدنا [Ketepatan Huruf]",
      "Membaca ص menjadi س atau ش pada kata الصراط [Ketepatan Huruf]",
      "Kurang tasydid pada kata الصراط [Tasydid]",
      "Membaca ق menjadi ك pada kata المستقيم [Ketepatan Huruf]",
    ],
    khafiy: [
      "Harakat kasrah dibaca seperti ‘e’ [Harakat]",
      "Kurangnya tempo bacaan huruf sukun pada huruf ه pada kata اهدنا [Ketepatan Huruf]",
      "Huruf ر yang kurang tebal pada kata الصراط [Ketepatan Huruf]",
      "Membaca huruf ط dengan mengeluarkan nafas (sifat hams) pada kata الصراط [Ketepatan Huruf]",
      "Kurangnya tempo bacaan huruf sukun pada huruf س pada kata المستقيم [Ketepatan Huruf]",
      "Kurang menyempurnakan Harakat [Harakat]",
      "Artikulasi huruf kurang tegas[Ketepatan Huruf]",
      // Sumbernya menandai ini [Ketepatan] — kategori yang tidak ada. Diperbaiki
      // jadi [Panjang Pendek], sesuai kalimat kembarnya di segmen lain.
      "Kadar mad thabi’i lebih dari 2 harakat [Panjang Pendek]",
    ],
  },
  ayat_7: {
    jaliy: [
      "Membaca ص menjadi س ,ش atau ز pada kata صراط [Ketepatan Huruf]",
      "Membaca ذ menjadi ز atau د pada kata الذين [Ketepatan Huruf]",
      "Kurang tasydid di huruf ذ pada kata الذين [Tasydid]",
      "Menambah mad/panjang huruf ن pada kata الذين [Panjang Pendek]",
      "Membaca ع menjadi أ pada kata أنعمت [Ketepatan Huruf]",
      "Membaca أ menjadi ع pada kata أنعمت [Ketepatan Huruf]",
      "Membaca ن menjadi م atau Izhar menjadi Idgham pada kata أنعمت [Tajwid]",
      "Menambah mad pada huruf ت pada kata أنعمت [Panjang Pendek]",
      "Membaca ع menjadi أ atau nga pada kata عليهم [Ketepatan Huruf]",
    ],
    khafiy: [
      "Huruf ر yang kurang tebal pada kata صراط [Ketepatan Huruf]",
      "Membaca huruf ط dengan mengeluarkan nafas (sifat hams) pada kata الصراط [Ketepatan Huruf]",
      "Memantulkan huruf ل pada kata صراط الذين [Ketepatan Huruf]",
      "Kurangnya tempo bacaan huruf sukun pada huruf ن dan م pada kata أنعمت [Ketepatan Huruf]",
      "Kelebihan tempo bacaan huruf sukun pada huruf ن pada م pada kata أنعمت [Ketepatan Huruf]",
      "Memanjang ya sukun lebih dari kadarnya pada kata عليهم [Ketepatan Huruf]",
      "Harakat kasrah dibaca seperti ‘e’ [Harakat]",
      "Kurang menyempurnakan Harakat  [Harakat]",
      "Artikulasi huruf kurang tegas [Ketepatan Huruf]",
      "Kadar mad thabi’i lebih dari 2 harakat [Panjang Pendek]",
    ],
  },
  ayat_7_part_2: {
    jaliy: [
      "Membaca huruf غ menjadi خ pada kata غير [Ketepatan Huruf]",
      "Menambah mad pada kata غير [Panjang Pendek]",
      "Membaca huruf ض menjadi د pada kata المغضوب [Ketepatan Huruf]",
      "Membaca huruf ع menjadi أ atau ‘Nga’ pada kata عليهم [Ketepatan Huruf]",
      "Membaca huruf ه menjadi ح atau خ pada kata عليهم [Ketepatan Huruf]",
      "Masuknya huruf م kepada huruf و (Idgham) pada kata عليهم ولا  [Ketepatan Huruf]",
      "Hilangnya tasydid di huruf ض pada kata ولا الضالين [Tasydid]",
      "Hilang tasydid di huruf ل pada kata ولا الضالين  [Tasydid]",
      "Kurangnya mad dari 6 harakat pada kata الضالين [Panjang Pendek]",
    ],
    khafiy: [
      "Kurangnya tempo bacaan huruf sukun pada huruf ل pada kata غير المغضوب [Ketepatan Huruf]",
      "Memantulkan pelafalan huruf غ pada kata المغضوب [Ketepatan Huruf]",
      "Memanjang ya sukun lebih dari kadarnya pada kata غير atau عليهم [Ketepatan Huruf]",
      "Lebihnya tempo bacaan huruf sukun pada huruf م pada kata عليهم [Ketepatan Huruf]",
      "Harakat kasrah dibaca seperti ‘e’ [Harakat]",
      "Kurang menyempurnakan Harakat [Harakat]",
      "Artikulasi huruf kurang tegas [Ketepatan Huruf]",
      "Kadar mad thabi’i lebih dari 2 harakat [Panjang Pendek]",
    ],
  },
};

/** Teks tag → kunci indikator. Dicocokkan longgar karena penulisannya tidak seragam. */
const TAG_TO_INDICATOR: Record<string, IndicatorKey> = {
  harakat: "harakat",
  "ketepatan huruf": "ketepatanHuruf",
  "panjang pendek": "panjangPendek",
  tasydid: "tasydid",
  tajwid: "hukumTajwid",
  "hukum tajwid": "hukumTajwid",
};

const TAG_PATTERN = /\s*\[([^\]]+)\]\s*$/;

/**
 * Pisahkan tag kategori dari kalimatnya.
 *
 * Pengajar membaca kalimat yang bersih, tag dirender terpisah sebagai chip —
 * dan indikatornya dipakai untuk menghitung lima skor aspek.
 */
export function parseOption(label: string): {
  text: string;
  indicator: IndicatorKey | null;
} {
  const match = label.match(TAG_PATTERN);
  if (!match) return { text: label.trim().replace(/\s+/g, " "), indicator: null };

  const tag = match[1]!.trim().toLowerCase().replace(/\s+/g, " ");
  return {
    text: label.slice(0, match.index).trim().replace(/\s+/g, " "),
    indicator: TAG_TO_INDICATOR[tag] ?? null,
  };
}
