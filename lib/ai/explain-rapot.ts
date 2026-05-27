import { anthropic, AI_MODEL_NARRATIVE, isAIEnabled } from "./anthropic";
import type { ErrorItem, IndikatorKey } from "@/types";
import { INDIKATOR_LABEL } from "@/lib/scoring";
import { AL_FATIHAH } from "@/lib/arabic";

interface RapotForNarrative {
  skor: number;
  status_label: string;
  total_errors_major: number;
  total_errors_minor: number;
  errors: Record<IndikatorKey, ErrorItem[]>;
}

export interface NarrativeResult {
  narrative: string;
  model: string;
}

const SYSTEM_PROMPT = `Kamu adalah Ustadz/Ustadzah pendamping tilawah Al-Qur'an di Muhajir Project Tilawah.
Tugasmu: menulis penjelasan personal untuk rapot Assessment Al-Fatihah peserta.

ATURAN MUTLAK:
- Bahasa Indonesia santun, akrab, dan memotivasi (tidak menghakimi).
- JANGAN gunakan kata: "salah", "buruk", "jelek". Gunakan: "catatan", "perlu perhatian", "kesempatan perbaikan".
- Sebut potongan ayat Arab di tanda kutip ketika menjelaskan letak catatan, contoh: "الْعَالَمِينَ".
- Mulai dengan apresiasi (1 kalimat) — sebutkan skor.
- Sebutkan maksimal 2 catatan utama (yang paling impactful), jangan list semua.
- Tutup dengan saran latihan konkret + ajakan halus untuk lanjut booking sesi pendampingan.
- Maksimal 160 kata. Format paragraf, BUKAN bullet list. Tanpa heading.
- Jangan tambahkan tanda baca berlebihan, jangan pakai emoji.`;

function summarizeErrors(errors: Record<IndikatorKey, ErrorItem[]>): string {
  const lines: string[] = [];
  (Object.keys(errors) as IndikatorKey[]).forEach((k) => {
    const items = errors[k];
    if (items.length === 0) return;
    lines.push(`${INDIKATOR_LABEL[k]} (${items.length} catatan):`);
    for (const e of items.slice(0, 3)) {
      const ayat = AL_FATIHAH.find((a) => a.number === e.ayat);
      const ayatRef = ayat ? `ayat ${e.ayat}` : `ayat ${e.ayat}`;
      lines.push(
        `  - ${ayatRef}, kata ke-${e.kata_idx + 1}: dibaca "${e.actual}" seharusnya "${e.expected}" [${e.severity}]${e.note ? ` — ${e.note}` : ""}`,
      );
    }
  });
  return lines.join("\n") || "Tidak ada catatan khusus.";
}

export async function generateRapotNarrative(
  data: RapotForNarrative,
): Promise<NarrativeResult | null> {
  if (!isAIEnabled()) return null;
  const client = anthropic();
  if (!client) return null;

  const summary = summarizeErrors(data.errors);

  const userPrompt = `Skor: ${data.skor}/5 (${data.status_label})
Total catatan: ${data.total_errors_major} major, ${data.total_errors_minor} minor.

Rincian catatan dari AI Mu'alim:
${summary}

Tulis penjelasan untuk peserta sesuai aturan di system prompt.`;

  try {
    const response = await client.messages.create({
      model: AI_MODEL_NARRATIVE,
      max_tokens: 600,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") return null;

    return {
      narrative: textBlock.text.trim(),
      model: response.model ?? AI_MODEL_NARRATIVE,
    };
  } catch (err) {
    console.error("[ai.explain-rapot] failed:", (err as Error).message);
    return null;
  }
}
