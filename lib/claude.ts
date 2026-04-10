// Claude API client (Anthropic SDK)
// Used for: Brand DNA extraction, creative briefing, QA loop
// Model: claude-sonnet-4-6 (BYOK — user provides key in production)

import Anthropic from "@anthropic-ai/sdk";

/**
 * Create an Anthropic client.
 * In production, the API key comes from the authenticated user's BYOK settings.
 * During development, falls back to the ANTHROPIC_API_KEY env var.
 */
export function createClaudeClient(apiKey?: string): Anthropic {
  const key = apiKey ?? process.env.ANTHROPIC_API_KEY;
  if (!key) {
    throw new Error(
      "Anthropic API key is required. Set ANTHROPIC_API_KEY or provide a user API key."
    );
  }
  return new Anthropic({ apiKey: key });
}

// Default model for all Claude calls (Claude Sonnet for balance of quality/cost)
export const CLAUDE_MODEL = "claude-sonnet-4-6";

// Opus for QA review where quality is paramount
export const CLAUDE_QA_MODEL = "claude-opus-4-6";
