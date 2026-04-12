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

// Gemini model for image generation (requires responseModalities: ["IMAGE", "TEXT"])
// Updated from "gemini-2.0-flash-preview-image-generation" which was removed from v1beta.
// Use the experimental image generation model available on v1beta.
export const GEMINI_IMAGE_MODEL = "gemini-2.0-flash-exp-image-generation";
