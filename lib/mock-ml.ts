import type {
  ErrorItem,
  MLPredictInput,
  MLPredictResult,
  Severity,
} from "@/types";
import { AL_FATIHAH } from "@/lib/arabic";

/**
 * Deterministic seeded PRNG (mulberry32). Same submission_id → same scenario.
 * Replace dengan real ML call (mlClient.predict) di Phase 4.
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

const SCENARIO_RANGE: Record<
  Scenario,
  { harakat: [number, number]; huruf: [number, number]; pp: [number, number]; syaddah: [number, number] }
> = {
  lancar: { harakat: [0, 0], huruf: [0, 0], pp: [0, 1], syaddah: [0, 0] },
  cukup: { harakat: [0, 2], huruf: [0, 1], pp: [1, 2], syaddah: [0, 1] },
  banyak_salah: {
    harakat: [1, 3],
    huruf: [1, 2],
    pp: [2, 3],
    syaddah: [1, 2],
  },
  pemula: { harakat: [3, 5], huruf: [2, 4], pp: [3, 5], syaddah: [2, 3] },
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

  return {
    errors_harakat: generateErrors(rand, randInt(rand, range.harakat), "harakat"),
    errors_huruf: generateErrors(rand, randInt(rand, range.huruf), "huruf"),
    errors_panjang_pendek: generateErrors(
      rand,
      randInt(rand, range.pp),
      "panjang_pendek",
    ),
    errors_syaddah: generateErrors(rand, randInt(rand, range.syaddah), "syaddah"),
    ml_model_version: opts?.seed ? "mock-bypass" : "mock-v1",
    ml_confidence: 0.85,
    ml_raw_output: { scenario, seed },
  };
}
