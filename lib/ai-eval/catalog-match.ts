import { EVALUATION_OPTIONS } from "@/lib/teacher-eval/catalog";
import type { SegmentKey } from "@/lib/teacher-eval/types";
import type { AiCategory } from "@/lib/ai-eval/types";
import type { ErrorItem } from "@/types";

/**
 * Cocokkan temuan mesin ke opsi katalog yang BERNAMA.
 *
 * Tujuannya pra-isi formulir pengajar. Formulir itu berisi 110 kalimat tetap;
 * usulan mesin baru berguna kalau ia menunjuk kalimat yang memang ada di sana,
 * bukan kalimat karangan sendiri yang harus dibaca pengajar sebagai hal baru.
 *
 * Ternyata jauh lebih terjangkau daripada dugaan awal. Diukur pada 148 rekaman
 * ber-ground-truth: 65% substitusi mesin sudah bisa dinamai hanya dengan peta
 * berisi belasan pasangan huruf. Sebabnya, kesalahan pembaca Indonesia
 * menumpuk di sedikit huruf yang itu-itu saja — ص، ض، ط، ع، ق، ح — dan katalog
 * memang menamai justru huruf-huruf itu pada kata-kata tertentu.
 *
 * KENAPA MERUJUK INDEKS, BUKAN TEKS
 * Kalimat katalog memuat ZWJ (`ه‍`), spasi ganda, dan apostrof melengkung yang
 * sengaja dipertahankan apa adanya karena kalimat itulah identitas temuan yang
 * tersimpan. Mencocokkan teks berarti bergantung pada detail yang mudah
 * berubah tanpa disadari. Merujuk (segmen, indeks) lebih stabil, dan `bukti`
 * menjaga rujukan itu tetap menunjuk opsi yang benar — diperiksa oleh tes.
 */

export interface AturanCocok {
  segment: SegmentKey;
  /** Indeks di EVALUATION_OPTIONS[segment].jaliy */
  index: number;
  /** Potongan teks yang HARUS ada di opsi itu — penjaga kalau katalog bergeser. */
  bukti: string;
  /** Batasi ke kata tertentu (kata_idx). Kosong = berlaku di seluruh segmen. */
  kata?: readonly number[];
  /** Huruf target yang salah dibaca. */
  dari?: string;
  /** Huruf yang terdengar. Kosong = apa pun. */
  ke?: readonly string[];
  /** Batasi ke kategori temuan tertentu. */
  kategori?: AiCategory;
}

/**
 * Urutan penting: aturan yang lebih spesifik harus di atas. Pencocokan berhenti
 * pada yang pertama cocok.
 *
 * Ayat 7 dipecah dua segmen di kata_idx 4 (lihat segments.ts), jadi `kata`
 * memakai indeks kata ASLI dalam ayat 7 — bukan indeks relatif per segmen.
 */
export const ATURAN: readonly AturanCocok[] = [
  // ── ayat 1 ────────────────────────────────────────────────────────────────
  { segment: "ayat_1", index: 1, bukti: "lafadz الله", kata: [1], dari: "ه", ke: ["ح", "خ"] },
  { segment: "ayat_1", index: 2, bukti: "الرحمن الرحيم", kata: [2, 3], dari: "ح", ke: ["ه", "خ"] },
  { segment: "ayat_1", index: 3, bukti: "tanpa getar", kata: [2, 3], dari: "ر", ke: ["خ", "و"] },
  { segment: "ayat_1", index: 4, bukti: "Membaca س", dari: "س", ke: ["ش", "ص"] },
  { segment: "ayat_1", index: 0, bukti: "Membaca ب", dari: "ب", ke: ["م"] },
  { segment: "ayat_1", index: 5, bukti: "Salah tasydid", kategori: "tasydid" },
  { segment: "ayat_1", index: 6, bukti: "salah membaca harakat", kategori: "harakat" },
  { segment: "ayat_1", index: 7, bukti: "Salah mad", kategori: "panjang_pendek" },

  // ── ayat 2 ────────────────────────────────────────────────────────────────
  { segment: "ayat_2", index: 0, bukti: "kata الحمد", kata: [0], dari: "ح", ke: ["ه", "خ"] },
  { segment: "ayat_2", index: 1, bukti: "lafadz الله", kata: [1], dari: "ه", ke: ["ح", "خ"] },
  { segment: "ayat_2", index: 4, bukti: "kata العالمين", kata: [3], dari: "ع", ke: ["ء"] },
  { segment: "ayat_2", index: 3, bukti: "Membaca ب", dari: "ب", ke: ["م"] },
  { segment: "ayat_2", index: 2, bukti: "kata ربِّ", kata: [2], kategori: "tasydid" },
  { segment: "ayat_2", index: 5, bukti: "salah membaca harakat", kategori: "harakat" },
  { segment: "ayat_2", index: 6, bukti: "Salah mad", kategori: "panjang_pendek" },

  // ── ayat 3 ────────────────────────────────────────────────────────────────
  { segment: "ayat_3", index: 0, bukti: "الرحمن الرحيم", dari: "ح", ke: ["ه", "خ"] },
  { segment: "ayat_3", index: 1, bukti: "tanpa getar", dari: "ر", ke: ["خ", "و"] },
  { segment: "ayat_3", index: 2, bukti: "Kurang tasydid", kategori: "tasydid" },
  { segment: "ayat_3", index: 3, bukti: "salah membaca harakat", kategori: "harakat" },
  { segment: "ayat_3", index: 4, bukti: "Salah mad", kategori: "panjang_pendek" },

  // ── ayat 4 ────────────────────────────────────────────────────────────────
  { segment: "ayat_4", index: 0, bukti: "Membaca ك", dari: "ك", ke: ["ق"] },
  { segment: "ayat_4", index: 2, bukti: "Membaca د", dari: "د", ke: ["ت"] },
  { segment: "ayat_4", index: 3, bukti: "kata الدين", kata: [2], kategori: "tasydid" },
  { segment: "ayat_4", index: 4, bukti: "salah membaca harakat", kategori: "harakat" },

  // ── ayat 5 ────────────────────────────────────────────────────────────────
  { segment: "ayat_5", index: 4, bukti: "kata نستعين", kata: [3], dari: "ع", ke: ["ء"] },
  { segment: "ayat_5", index: 0, bukti: "kata إيّاكَ", kata: [0, 2], kategori: "tasydid" },
  { segment: "ayat_5", index: 2, bukti: "kata نعبد", kata: [1], kategori: "panjang_pendek" },
  { segment: "ayat_5", index: 3, bukti: "Kurang mad", kata: [0, 2], kategori: "panjang_pendek" },
  { segment: "ayat_5", index: 5, bukti: "salah membaca harakat", kategori: "harakat" },

  // ── ayat 6 ────────────────────────────────────────────────────────────────
  { segment: "ayat_6", index: 0, bukti: "kata اهدنا", kata: [0], dari: "ه", ke: ["ح", "خ"] },
  { segment: "ayat_6", index: 1, bukti: "kata الصراط", kata: [1], dari: "ص", ke: ["س", "ش"] },
  { segment: "ayat_6", index: 3, bukti: "kata المستقيم", kata: [2], dari: "ق", ke: ["ك"] },
  { segment: "ayat_6", index: 2, bukti: "kata الصراط", kata: [1], kategori: "tasydid" },

  // ── ayat 7, bagian pertama (kata 0-3) ─────────────────────────────────────
  { segment: "ayat_7", index: 6, bukti: "Izhar menjadi Idgham", kata: [2], dari: "ن", ke: ["م"] },
  { segment: "ayat_7", index: 0, bukti: "kata صراط", kata: [0], dari: "ص", ke: ["س", "ش", "ز"] },
  { segment: "ayat_7", index: 1, bukti: "kata الذين", kata: [1], dari: "ذ", ke: ["ز", "د"] },
  { segment: "ayat_7", index: 4, bukti: "kata أنعمت", kata: [2], dari: "ع", ke: ["ء"] },
  { segment: "ayat_7", index: 5, bukti: "Membaca أ menjadi ع", kata: [2], dari: "ء", ke: ["ع"] },
  { segment: "ayat_7", index: 8, bukti: "kata عليهم", kata: [3], dari: "ع", ke: ["ء"] },
  { segment: "ayat_7", index: 2, bukti: "huruf ذ pada kata الذين", kata: [1], kategori: "tasydid" },
  { segment: "ayat_7", index: 3, bukti: "huruf ن pada kata الذين", kata: [1], kategori: "panjang_pendek" },
  { segment: "ayat_7", index: 7, bukti: "huruf ت pada kata أنعمت", kata: [2], kategori: "panjang_pendek" },

  // ── ayat 7, bagian kedua (kata 4-8) ───────────────────────────────────────
  { segment: "ayat_7_part_2", index: 0, bukti: "kata غير", kata: [4], dari: "غ", ke: ["خ"] },
  { segment: "ayat_7_part_2", index: 2, bukti: "kata المغضوب", kata: [5], dari: "ض", ke: ["د"] },
  { segment: "ayat_7_part_2", index: 3, bukti: "kata عليهم", kata: [6], dari: "ع", ke: ["ء"] },
  { segment: "ayat_7_part_2", index: 4, bukti: "kata عليهم", kata: [6], dari: "ه", ke: ["ح", "خ"] },
  { segment: "ayat_7_part_2", index: 6, bukti: "huruf ض pada kata", kata: [8], dari: "ض", kategori: "tasydid" },
  { segment: "ayat_7_part_2", index: 7, bukti: "huruf ل pada kata", kata: [8], dari: "ل", kategori: "tasydid" },
  { segment: "ayat_7_part_2", index: 8, bukti: "6 harakat", kata: [8], kategori: "panjang_pendek" },
  { segment: "ayat_7_part_2", index: 1, bukti: "kata غير", kata: [4], kategori: "panjang_pendek" },
] as const;

/** Kalimat katalog yang dirujuk satu aturan. */
export function kalimatKatalog(a: AturanCocok): string {
  return EVALUATION_OPTIONS[a.segment].jaliy[a.index] ?? "";
}

/**
 * Cari opsi katalog untuk satu temuan. `null` kalau tidak ada yang cocok —
 * pemanggil harus tetap melaporkan temuannya, jangan dibuang.
 */
export function cocokkanKeKatalog(
  segment: SegmentKey,
  kategori: AiCategory,
  item: ErrorItem,
): string | null {
  for (const a of ATURAN) {
    if (a.segment !== segment) continue;
    if (a.kategori && a.kategori !== kategori) continue;
    if (a.kata && !a.kata.includes(item.kata_idx)) continue;
    if (a.dari && a.dari !== item.expected_char) continue;
    if (a.ke && (!item.actual_char || !a.ke.includes(item.actual_char))) continue;
    const kalimat = kalimatKatalog(a);
    if (kalimat) return kalimat;
  }
  return null;
}
