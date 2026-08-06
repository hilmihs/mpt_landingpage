import { sql } from "@/lib/db";
import {
  INDICATOR_KEYS,
  SEGMENT_KEYS,
  type IndicatorKey,
  type SegmentKey,
} from "@/lib/teacher-eval/types";

/**
 * Bahan keputusan Januari: seberapa dekat penilaian mesin dengan penilaian
 * pengajar.
 *
 * Pertanyaan ini baru bisa dijawab sejak keduanya memakai instrumen yang sama
 * (lihat db/migrations/0010_ai_evaluation.sql). Sebelum itu yang bisa dihitung
 * hanyalah korelasi antara dua skala berbeda, yang tidak berarti apa-apa.
 *
 * Semua angka di sini dihitung dari pasangan rekaman yang punya KEDUA
 * penilaian. Rekaman yang cuma dinilai salah satu pihak tidak dihitung — bukan
 * dianggap nol.
 */

export interface PasanganNilai {
  submission_id: string;
  nama: string;
  jenis_kelamin: "ikhwan" | "akhwat";
  ai_score: number;
  guru_score: number;
  ai_model: string | null;
  ai_score_ayat: unknown;
  guru_score_ayat: unknown;
  ai_total_khafiy: number;
  ai_raw: unknown;
  ai_indikator: Record<IndicatorKey, number | null>;
  guru_indikator: Record<IndicatorKey, number | null>;
}

interface BarisMentah {
  submission_id: string;
  nama: string;
  jenis_kelamin: "ikhwan" | "akhwat";
  ai_score: number;
  guru_score: number;
  ai_model: string | null;
  ai_score_ayat: unknown;
  guru_score_ayat: unknown;
  ai_total_khafiy: number;
  ai_raw: unknown;
  ai_harakat: number | null;
  ai_ketepatan_huruf: number | null;
  ai_panjang_pendek: number | null;
  ai_tasydid: number | null;
  ai_hukum_tajwid: number | null;
  guru_harakat: number | null;
  guru_ketepatan_huruf: number | null;
  guru_panjang_pendek: number | null;
  guru_tasydid: number | null;
  guru_hukum_tajwid: number | null;
}

/**
 * Ambil semua rekaman yang punya nilai mesin DAN nilai pengajar.
 *
 * Baris mock sengaja disingkirkan di SQL, bukan di UI. Angka mock adalah
 * bilangan acak; kalau ikut terhitung, seluruh statistik di halaman ini
 * menggambarkan mutu generator acak, bukan mutu model.
 */
export async function fetchPasangan(): Promise<PasanganNilai[]> {
  const rows = await sql<BarisMentah[]>`
    SELECT
      s.id   AS submission_id,
      s.nama,
      s.jenis_kelamin,
      ai.score_min   AS ai_score,
      e.score_min    AS guru_score,
      ai.ml_model_version AS ai_model,
      ai.score_ayat  AS ai_score_ayat,
      e.score_ayat   AS guru_score_ayat,
      ai.total_khafiy AS ai_total_khafiy,
      ai.ml_raw_output AS ai_raw,
      ai.score_harakat         AS ai_harakat,
      ai.score_ketepatan_huruf AS ai_ketepatan_huruf,
      ai.score_panjang_pendek  AS ai_panjang_pendek,
      ai.score_tasydid         AS ai_tasydid,
      ai.score_hukum_tajwid    AS ai_hukum_tajwid,
      e.score_harakat          AS guru_harakat,
      e.score_ketepatan_huruf  AS guru_ketepatan_huruf,
      e.score_panjang_pendek   AS guru_panjang_pendek,
      e.score_tasydid          AS guru_tasydid,
      e.score_hukum_tajwid     AS guru_hukum_tajwid
    FROM submissions s
    JOIN ai_evaluations ai ON ai.submission_id = s.id
    JOIN teacher_evaluations e ON e.submission_id = s.id
    WHERE ai.ml_model_version NOT LIKE 'mock%'
    ORDER BY ai.created_at DESC
  `;

  return rows.map((r) => ({
    submission_id: r.submission_id,
    nama: r.nama,
    jenis_kelamin: r.jenis_kelamin,
    ai_score: r.ai_score,
    guru_score: r.guru_score,
    ai_model: r.ai_model,
    ai_score_ayat: r.ai_score_ayat,
    guru_score_ayat: r.guru_score_ayat,
    ai_total_khafiy: r.ai_total_khafiy,
    ai_raw: r.ai_raw,
    ai_indikator: {
      harakat: r.ai_harakat,
      ketepatanHuruf: r.ai_ketepatan_huruf,
      panjangPendek: r.ai_panjang_pendek,
      tasydid: r.ai_tasydid,
      hukumTajwid: r.ai_hukum_tajwid,
    },
    guru_indikator: {
      harakat: r.guru_harakat,
      ketepatanHuruf: r.guru_ketepatan_huruf,
      panjangPendek: r.guru_panjang_pendek,
      tasydid: r.guru_tasydid,
      hukumTajwid: r.guru_hukum_tajwid,
    },
  }));
}

export interface Kecocokan {
  /** Jumlah pasangan yang punya kedua angka. */
  n: number;
  /** Persentase yang angkanya sama persis. */
  persisPersen: number;
  /** Persentase yang selisihnya paling banyak 2 (satu tingkat band). */
  dalamDuaPersen: number;
  /** Rata-rata selisih BERTANDA — positif berarti mesin memberi nilai lebih tinggi. */
  biasRata: number;
  /** Rata-rata besar selisih, tanpa memandang arah. */
  selisihRata: number;
}

export function hitungKecocokan(
  pasangan: { mesin: number | null; guru: number | null }[],
): Kecocokan {
  const valid = pasangan.filter(
    (p): p is { mesin: number; guru: number } => p.mesin != null && p.guru != null,
  );
  const n = valid.length;
  if (n === 0) {
    return { n: 0, persisPersen: 0, dalamDuaPersen: 0, biasRata: 0, selisihRata: 0 };
  }

  let persis = 0;
  let dalamDua = 0;
  let jumlahSelisih = 0;
  let jumlahAbsolut = 0;

  for (const { mesin, guru } of valid) {
    const d = mesin - guru;
    if (d === 0) persis++;
    if (Math.abs(d) <= 2) dalamDua++;
    jumlahSelisih += d;
    jumlahAbsolut += Math.abs(d);
  }

  return {
    n,
    persisPersen: (persis / n) * 100,
    dalamDuaPersen: (dalamDua / n) * 100,
    biasRata: jumlahSelisih / n,
    selisihRata: jumlahAbsolut / n,
  };
}

/** Baca objek skor per segmen dari kolom JSONB, abaikan bentuk yang tak dikenal. */
function bacaSegmen(v: unknown): Partial<Record<SegmentKey, number>> {
  if (!v || typeof v !== "object") return {};
  const src = v as Record<string, unknown>;
  const out: Partial<Record<SegmentKey, number>> = {};
  for (const k of SEGMENT_KEYS) {
    const n = src[k];
    if (typeof n === "number" && Number.isFinite(n)) out[k] = n;
  }
  return out;
}

export interface RingkasanPembanding {
  total: number;
  kepala: Kecocokan;
  perIndikator: { key: IndicatorKey; cocok: Kecocokan }[];
  perSegmen: { key: SegmentKey; cocok: Kecocokan }[];
  /** Sebaran selisih skor kepala, dari -9 sampai +9. */
  sebaran: { selisih: number; jumlah: number }[];
  /**
   * True kalau ADA pasangan yang head sifa-nya sudah jalan. Selama false,
   * seluruh angka khafiy mesin nol dan biasnya positif secara artifisial.
   */
  sifaJalan: boolean;
  model: string[];
}

export function ringkas(pasangan: PasanganNilai[]): RingkasanPembanding {
  const kepala = hitungKecocokan(
    pasangan.map((p) => ({ mesin: p.ai_score, guru: p.guru_score })),
  );

  const perIndikator = INDICATOR_KEYS.map((key) => ({
    key,
    cocok: hitungKecocokan(
      pasangan.map((p) => ({
        mesin: p.ai_indikator[key],
        guru: p.guru_indikator[key],
      })),
    ),
  }));

  const perSegmen = SEGMENT_KEYS.map((key) => ({
    key,
    cocok: hitungKecocokan(
      pasangan.map((p) => ({
        mesin: bacaSegmen(p.ai_score_ayat)[key] ?? null,
        guru: bacaSegmen(p.guru_score_ayat)[key] ?? null,
      })),
    ),
  }));

  const hitungSelisih = new Map<number, number>();
  for (const p of pasangan) {
    const d = p.ai_score - p.guru_score;
    hitungSelisih.set(d, (hitungSelisih.get(d) ?? 0) + 1);
  }
  const sebaran = [...hitungSelisih.entries()]
    .map(([selisih, jumlah]) => ({ selisih, jumlah }))
    .sort((a, b) => a.selisih - b.selisih);

  const sifaJalan = pasangan.some((p) => {
    const raw = (p.ai_raw ?? {}) as Record<string, unknown>;
    return raw.sifa_available === true;
  });

  const model = [...new Set(pasangan.map((p) => p.ai_model).filter(Boolean))] as string[];

  return {
    total: pasangan.length,
    kepala,
    perIndikator,
    perSegmen,
    sebaran,
    sifaJalan,
    model,
  };
}
