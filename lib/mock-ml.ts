import type {
  ErrorItem,
  MLPredictInput,
  MLPredictResult,
  Severity,
} from "@/types";
import { AL_FATIHAH } from "@/lib/arabic";

/**
 * Penilaian mesin palsu untuk pengembangan.
 *
 * ⚠️ JANGAN DIPAKAI DI PRODUKSI. Angka yang keluar dari sini adalah bilangan
 * acak berbasis submission_id — bentuknya identik dengan penilaian sungguhan
 * dan tersimpan di tabel yang sama. Satu-satunya pembeda adalah
 * `ml_model_version` berawalan "mock-". Kalau baris seperti ini ikut terbaca
 * saat membandingkan mesin dengan pengajar, kesimpulannya diambil dari
 * bilangan acak. `app/api/worker/route.ts` menolak menjalankannya di produksi.
 */

/**
 * Deterministic seeded PRNG (mulberry32). Same submission_id → same scenario.
 */
function hashStringToSeed(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number) {
  let s = seed;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Scenario = "lancar" | "cukup" | "banyak_salah" | "pemula";

function pickScenario(rand: () => number): Scenario {
  const r = rand();
  if (r < 0.4) return "lancar";
  if (r < 0.7) return "cukup";
  if (r < 0.9) return "banyak_salah";
  return "pemula";
}

type Rentang = [number, number];

const SCENARIO_RANGE: Record<
  Scenario,
  {
    harakat: Rentang;
    ketepatan_huruf: Rentang;
    panjang_pendek: Rentang;
    tasydid: Rentang;
    hukum_tajwid: Rentang;
  }
> = {
  lancar: {
    harakat: [0, 0],
    ketepatan_huruf: [0, 0],
    panjang_pendek: [0, 1],
    tasydid: [0, 0],
    hukum_tajwid: [0, 0],
  },
  cukup: {
    harakat: [0, 2],
    ketepatan_huruf: [0, 1],
    panjang_pendek: [1, 2],
    tasydid: [0, 1],
    hukum_tajwid: [0, 1],
  },
  banyak_salah: {
    harakat: [1, 3],
    ketepatan_huruf: [1, 2],
    panjang_pendek: [2, 3],
    tasydid: [1, 2],
    hukum_tajwid: [0, 2],
  },
  pemula: {
    harakat: [3, 5],
    ketepatan_huruf: [2, 4],
    panjang_pendek: [3, 5],
    tasydid: [2, 3],
    hukum_tajwid: [1, 3],
  },
};

function randInt(rand: () => number, [min, max]: [number, number]): number {
  return min + Math.floor(rand() * (max - min + 1));
}

function randSeverity(rand: () => number): Severity {
  return rand() < 0.6 ? "major" : "minor";
}

function generateErrors(
  rand: () => number,
  count: number,
  category: string,
): ErrorItem[] {
  const result: ErrorItem[] = [];
  for (let i = 0; i < count; i++) {
    const ayat = randInt(rand, [1, 7]);
    const ayatData = AL_FATIHAH.find((a) => a.number === ayat)!;
    const kata_idx = randInt(rand, [0, ayatData.words.length - 1]);
    const expected = ayatData.words[kata_idx] ?? "";
    result.push({
      ayat,
      kata_idx,
      expected,
      actual: expected, // mock: tidak benar-benar mutate kata, hanya untuk demo struktur
      severity: randSeverity(rand),
      note: `Mock indikator ${category}`,
    });
  }
  return result;
}

export function mockMLPredict(
  input: MLPredictInput,
  opts?: { seed?: string },
): MLPredictResult {
  const seedSource = opts?.seed ?? input.submission_id;
  const seed = hashStringToSeed(seedSource);
  const rand = mulberry32(seed);
  const scenario = pickScenario(rand);
  const range = SCENARIO_RANGE[scenario];

  const errors_ketepatan_huruf = generateErrors(
    rand,
    randInt(rand, range.ketepatan_huruf),
    "ketepatan_huruf",
  );
  const errors_tasydid = generateErrors(rand, randInt(rand, range.tasydid), "tasydid");

  return {
    errors_harakat: generateErrors(rand, randInt(rand, range.harakat), "harakat"),
    errors_ketepatan_huruf,
    errors_panjang_pendek: generateErrors(
      rand,
      randInt(rand, range.panjang_pendek),
      "panjang_pendek",
    ),
    errors_tasydid,
    errors_hukum_tajwid: generateErrors(
      rand,
      randInt(rand, range.hukum_tajwid),
      "hukum_tajwid",
    ),
    // Cermin nama lama, sama seperti yang dikirim ML server sungguhan.
    errors_huruf: errors_ketepatan_huruf,
    errors_syaddah: errors_tasydid,
    ml_model_version: opts?.seed ? "mock-bypass" : "mock-v1",
    ml_confidence: 0.85,
    // Mock tidak punya head sifa juga — supaya bentuknya sama dengan produksi.
    ml_raw_output: { scenario, seed, sifa_available: false },
  };
}
