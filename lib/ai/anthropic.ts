import Anthropic from "@anthropic-ai/sdk";

const apiKey = process.env.ANTHROPIC_API_KEY;

let _client: Anthropic | null = null;

export function anthropic(): Anthropic | null {
  if (!apiKey) return null;
  if (!_client) {
    _client = new Anthropic({ apiKey });
  }
  return _client;
}

export const AI_MODEL_NARRATIVE = "claude-haiku-4-5";

export function isAIEnabled(): boolean {
  return Boolean(apiKey);
}
