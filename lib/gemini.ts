// Gemini API client (Google Generative AI)
// THE ONLY image generation model used in StaticsFlow — no alternatives (SPECS.md §1.5)
// BYOK: user provides their own key in production

import { GoogleGenerativeAI } from "@google/generative-ai";

/**
 * Create a Gemini client.
 * In production, apiKey comes from the user's BYOK settings.
 * During development, falls back to GEMINI_API_KEY env var.
 */
export function createGeminiClient(apiKey?: string): GoogleGenerativeAI {
  const key = apiKey ?? process.env.GEMINI_API_KEY;
  if (!key) {
    throw new Error(
      "Gemini API key is required. Set GEMINI_API_KEY or provide a user API key."
    );
  }
  return new GoogleGenerativeAI(key);
}

import type { ImageQuality } from "@/types/index";

/**
 * Gemini image generation model tiers.
 *
 * flash → gemini-2.0-flash-preview-image-generation  Fast, cost-effective. Good for bulk / drafts.
 * pro   → gemini-2.0-flash-preview-image-generation  Highest quality available via Gemini native.
 *         (A distinct higher-quality model will be wired in when Google releases one.)
 *
 * Both require responseModalities: ["IMAGE", "TEXT"] at model instantiation.
 */
export const GEMINI_IMAGE_MODEL_FLASH = "gemini-2.0-flash-preview-image-generation";
export const GEMINI_IMAGE_MODEL_PRO   = "gemini-2.0-flash-preview-image-generation";

/** Default model (flash) kept for backward compatibility. */
export const GEMINI_IMAGE_MODEL = GEMINI_IMAGE_MODEL_FLASH;

/** Select the Gemini image model string from a quality tier. */
export function getGeminiImageModel(quality: ImageQuality = "flash"): string {
  return quality === "pro" ? GEMINI_IMAGE_MODEL_PRO : GEMINI_IMAGE_MODEL_FLASH;
}
