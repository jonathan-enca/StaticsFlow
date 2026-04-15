// Gemini API client (@google/genai SDK)
// THE ONLY image generation model used in StaticsFlow — no alternatives (SPECS.md §1.5)
// BYOK: user provides their own key in production

import { GoogleGenAI } from "@google/genai";
import type { ImageQuality } from "@/types/index";

/**
 * Create a Gemini client using the @google/genai SDK (replaces deprecated
 * @google/generative-ai which was locked to the removed v1beta endpoint).
 *
 * In production, apiKey comes from the user's BYOK settings.
 * During development, falls back to GEMINI_API_KEY env var.
 */
export function createGeminiClient(apiKey?: string): GoogleGenAI {
  const key = apiKey ?? process.env.GEMINI_API_KEY;
  if (!key) {
    throw new Error(
      "Gemini API key is required. Set GEMINI_API_KEY or provide a user API key."
    );
  }
  return new GoogleGenAI({ apiKey: key });
}

/**
 * Gemini image generation model tiers.
 *
 * flash → gemini-3.1-flash-image-preview  Fast, cost-effective. Good for bulk / drafts.
 * pro   → gemini-3-pro-image-preview       Highest quality available via Gemini native.
 *
 * Both require responseModalities: [Modality.IMAGE, Modality.TEXT] in the request config.
 */
export const GEMINI_IMAGE_MODEL_FLASH = "gemini-3.1-flash-image-preview";
export const GEMINI_IMAGE_MODEL_PRO   = "gemini-3-pro-image-preview";

/** Default model (flash) kept for backward compatibility. */
export const GEMINI_IMAGE_MODEL = GEMINI_IMAGE_MODEL_FLASH;

/** Select the Gemini image model string from a quality tier. */
export function getGeminiImageModel(quality: ImageQuality = "flash"): string {
  return quality === "pro" ? GEMINI_IMAGE_MODEL_PRO : GEMINI_IMAGE_MODEL_FLASH;
}
