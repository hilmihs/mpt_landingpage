/**
 * DeepSeek config for rapot narrative generation (OpenAI-compatible REST).
 * Replaces the previous Anthropic provider. Called via raw fetch in
 * lib/ai/explain-rapot.ts — no SDK dependency.
 */
const apiKey = process.env.DEEPSEEK_API_KEY;

// Default to deepseek-chat (known-good compat alias). Override via env to point
// at deepseek-v4-flash etc. — the deepseek-chat alias retires 2026-07-24.
export const AI_MODEL_NARRATIVE = process.env.DEEPSEEK_MODEL || "deepseek-chat";

export const DEEPSEEK_BASE_URL =
  process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com/v1";

export function deepseekApiKey(): string | undefined {
  return apiKey;
}

export function isAIEnabled(): boolean {
  return Boolean(apiKey);
}
