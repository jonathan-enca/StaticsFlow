// BDD template matching — finds the best inspiration templates for a generation request
// SPECS.md §4.1 step 3: Template Matching (STA-58)

import { prisma } from "@/lib/prisma";
import type { AdFormat, CreativeAngle } from "@/types/index";
import type { ExtractedBrandDNA } from "@/lib/brand-dna-extractor";
import type { Template } from "@prisma/client";

// Maps CreativeAngle → BDD hookType field values
const ANGLE_TO_HOOK_TYPE: Record<CreativeAngle, string> = {
  pain: "pain",
  curiosity: "curiosite",
  social_proof: "social_proof",
  fomo: "fomo",
  benefit: "benefice_direct",
  authority: "autorite",
  urgency: "urgence",
};

/**
 * Finds the best matching BDD templates for a given generation request.
 *
 * Matching priority (SPECS.md §4.1 step 3):
 * 1. hookType matches the requested angle
 * 2. category matches the brand's productCategory
 * 3. language matches the brand's language (default: fr)
 * 4. Falls back to any category if no category match
 * 5. Returns top N by recency (most recently uploaded = freshest inspiration)
 */
export async function findMatchingTemplates(
  brandDna: ExtractedBrandDNA,
  angle: CreativeAngle,
  _format: AdFormat,
  limit = 5
): Promise<Template[]> {
  const hookType = ANGLE_TO_HOOK_TYPE[angle];
  const category = (brandDna.productCategory ?? "").toLowerCase();
  const language = brandDna.language ?? "fr";

  // Try: exact hookType + category + language
  const primary = await prisma.template.findMany({
    where: {
      hookType,
      category,
      language,
      analyzedAt: { not: null }, // Only fully analyzed templates
    },
    orderBy: { uploadedAt: "desc" },
    take: limit,
  });

  if (primary.length >= limit) return primary;

  // Try: exact hookType + category (any language)
  const byCategory = await prisma.template.findMany({
    where: {
      hookType,
      category,
      analyzedAt: { not: null },
    },
    orderBy: { uploadedAt: "desc" },
    take: limit,
  });

  if (byCategory.length >= limit) return byCategory;

  // Fallback: hookType only (any category/language)
  const byHook = await prisma.template.findMany({
    where: {
      hookType,
      analyzedAt: { not: null },
    },
    orderBy: { uploadedAt: "desc" },
    take: limit,
  });

  if (byHook.length > 0) return byHook.slice(0, limit);

  // Last resort: anything analyzed
  return prisma.template.findMany({
    where: { analyzedAt: { not: null } },
    orderBy: { uploadedAt: "desc" },
    take: limit,
  });
}
