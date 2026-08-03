/**
 * Klien untuk API penilaian pengajar di assesment-alfatihah.muhajirproject.com.
 *
 * Kontraknya dipetakan langsung dari bundel JS aplikasi peserta di
 * assessment-alfatihah-user.netlify.app pada 3 Agustus 2026, lalu diverifikasi
 * dengan memanggil endpoint aslinya. Ringkasan temuan ada di
 * docs/INTEGRASI_PENILAIAN_PENGAJAR.md.
 *
 * Sifat API ini (per pemetaan tersebut):
 *   - READ-ONLY. Hanya GET/HEAD; POST dijawab 405. Penilaian TIDAK bisa dibuat
 *     lewat API, harus lewat panel Filament oleh pengajar.
 *   - Tanpa autentikasi, dan `access-control-allow-origin: *`.
 *   - Skala skor 1-10 (Mumtaz/Jayyid/Dhoif), BEDA dari skor 1-5 rapot AI kita.
 *     Jangan pernah dibandingkan langsung — lihat components/rapot/AssessmentScaleNote.tsx.
 */

const BASE =
  process.env.MPT_ASSESSMENT_API_BASE ??
  "https://assesment-alfatihah.muhajirproject.com/api";

const TIMEOUT_MS = 15_000;

/** Satu indikator penilaian. `score` berskala 1-10. */
export interface MptIndicator {
  score: number;
  label: string;
}

/** Bentuk respons GET /recitation-evaluations/by-kode-unik/{kode}. */
export interface MptEvaluation {
  uuid: string;
  createdAt: string;
  kegiatan: string | null;
  divisi: string | null;
  namaLengkap: string | null;
  asalHalaqah: string | null;
  harakat: MptIndicator | null;
  panjangPendek: MptIndicator | null;
  tasydid: MptIndicator | null;
  hukumTajwid: MptIndicator | null;
  ketepatanHuruf: MptIndicator | null;
  /** Indikator terlemah — dipakai sistem mereka sebagai skor keseluruhan. */
  minScore: MptIndicator | null;
  pemeriksa: string | null;
  assessmentHistory: unknown[];
}

/** Satu baris dari GET /recitation-evaluations (daftar). */
export interface MptEvaluationSummary {
  uuid: string;
  kode_unik: string;
  kegiatan: string | null;
  pemeriksa: string | null;
  asal_halaqah: string | null;
  created_at: string;
  score: number | null;
  is_dummy: boolean;
}

async function getJson<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${BASE}${path}`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
    if (!res.ok) return null;
    // Kode yang tidak ada dijawab halaman error HTML, bukan JSON 404.
    const ct = res.headers.get("content-type") ?? "";
    if (!ct.includes("application/json")) return null;
    return (await res.json()) as T;
  } catch (err) {
    console.error("[mpt-assessment] gagal:", (err as Error).message);
    return null;
  }
}

/**
 * Ambil satu penilaian berdasarkan kode unik.
 * Mengembalikan null kalau kode tidak ada atau API sedang bermasalah.
 */
export function fetchEvaluationByKode(kode: string): Promise<MptEvaluation | null> {
  return getJson<MptEvaluation>(
    `/recitation-evaluations/by-kode-unik/${encodeURIComponent(kode)}`,
  );
}

/**
 * Ambil halaman daftar penilaian, terbaru lebih dulu.
 *
 * Dipakai untuk mencocokkan penilaian yang baru dibuat pengajar dengan
 * submission kita: setelah pengajar submit di Filament, kita cari baris dengan
 * `pemeriksa` yang sama dan `created_at` setelah waktu kita menugaskan dia.
 */
export async function fetchRecentEvaluations(
  page = 1,
): Promise<MptEvaluationSummary[]> {
  const data = await getJson<{ data?: MptEvaluationSummary[] }>(
    `/recitation-evaluations?page=${page}`,
  );
  return data?.data ?? [];
}

/**
 * Cari penilaian yang kemungkinan besar milik submission tertentu.
 *
 * Pencocokan pakai nama pemeriksa + jendela waktu, karena API tidak menyediakan
 * cara menautkan langsung ke submission kita (tidak ada POST, tidak ada field
 * bebas yang bisa kita titipi id). Hasilnya PERLU dikonfirmasi pengajar sebelum
 * disimpan — jangan dianggap pasti.
 */
export async function findEvaluationForTeacher(
  pemeriksa: string,
  assignedAt: Date,
): Promise<MptEvaluationSummary | null> {
  const rows = await fetchRecentEvaluations(1);
  const target = pemeriksa.trim().toLowerCase();

  const candidates = rows.filter(
    (r) =>
      !r.is_dummy &&
      (r.pemeriksa ?? "").trim().toLowerCase() === target &&
      new Date(r.created_at).getTime() >= assignedAt.getTime(),
  );

  candidates.sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
  return candidates[0] ?? null;
}

/** Semua indikator dalam bentuk daftar siap-render, melewati yang kosong. */
export function indicatorList(
  e: MptEvaluation,
): { key: string; label: string; score: number; mutu: string }[] {
  const map: [string, string, MptIndicator | null][] = [
    ["harakat", "Harakat", e.harakat],
    ["panjang_pendek", "Panjang Pendek", e.panjangPendek],
    ["tasydid", "Tasydid", e.tasydid],
    ["hukum_tajwid", "Hukum Tajwid", e.hukumTajwid],
    ["ketepatan_huruf", "Ketepatan Huruf", e.ketepatanHuruf],
  ];
  return map
    .filter((m): m is [string, string, MptIndicator] => m[2] != null)
    .map(([key, label, ind]) => ({
      key,
      label,
      score: ind.score,
      mutu: ind.label,
    }));
}
