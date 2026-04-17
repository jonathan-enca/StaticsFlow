/**
 * generate-skeletons.mjs
 *
 * Generates all skeleton JSON files for the StaticsFlow skeleton library.
 * Based on the type × layout distribution from 4,079 BDD templates (threshold ≥ 10).
 *
 * analysisJson audit result: 0/100 sampled records have backgroundType or productPlacement.
 * Fallback: cluster on type × layout only.
 * Exception: `lifestyle` ad type inferred as lifestyle background (needs Gemini).
 *
 * Run: node scripts/generate-skeletons.mjs
 */

import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";

const OUT_DIR = "lib/skeletons";
mkdirSync(OUT_DIR, { recursive: true });

// ─── Helpers ──────────────────────────────────────────────────────────────────

function typographySpec(role, sizeRatio, weightBold, letterSpacing, lineHeight, maxLines, uppercase = false) {
  const spec = { role, sizeRatio, weightBold, letterSpacing, lineHeight, maxLines };
  if (uppercase) spec.uppercase = true;
  return spec;
}

function shadowEffect(blur = 0.04, opacity = 0.18, offsetX = 0, offsetY = 0.025) {
  return { dropShadow: true, shadowBlur: blur, shadowOpacity: opacity, shadowOffsetX: offsetX, shadowOffsetY: offsetY };
}

function simpleBackground() {
  return {
    type: "gradient",
    gradientStops: [
      { color: "brand_secondary", position: 0 },
      { color: "white", position: 1 },
    ],
    gradientDirection: "radial",
    textureName: "grain_light",
    textureOpacity: 0.04,
  };
}

function lifestyleBackground(hint) {
  return {
    type: "lifestyle",
    geminiPromptHint: hint,
  };
}

function defaultSpacing(safeMargin = 0.04, verticalGap = 0.025) {
  return { safeMargin, verticalGap };
}

function defaultPremium(grainOverlay = true, grainOpacity = 0.04) {
  return {
    grainOverlay,
    grainOpacity,
    globalCornerRadius: 0,
    decorativeElement: "none",
    backgroundBleedProduct: false,
  };
}

function write(skeleton) {
  const path = join(OUT_DIR, `${skeleton.id}.json`);
  writeFileSync(path, JSON.stringify(skeleton, null, 2));
  console.log(`✅  ${skeleton.id}.json`);
}

// ─── Skeletons ────────────────────────────────────────────────────────────────

// 01 — product_hero × other (2669 — unclassified; treat as flexible centered)
write({
  id: "product_hero_other_simple",
  name: "Product Hero — Flexible/Other (1:1)",
  adType: "product_hero",
  layout: "other",
  nativeFormat: "1080x1080",
  aspectRatio: "1:1",
  backgroundType: "simple",
  background: simpleBackground(),
  zones: {
    eyebrow: {
      x: 0.10, y: 0.05, width: 0.80, height: 0.06, align: "center",
      typography: typographySpec("eyebrow", 0.018, false, 0.12, 1.2, 1, true),
    },
    headline: {
      x: 0.08, y: 0.12, width: 0.84, height: 0.14, align: "center",
      typography: typographySpec("headline", 0.050, true, -0.02, 1.1, 2),
    },
    product: {
      x: 0.10, y: 0.27, width: 0.80, height: 0.50,
      effect: shadowEffect(),
    },
    cta: {
      x: 0.28, y: 0.80, width: 0.44, height: 0.09, align: "center",
      typography: typographySpec("cta", 0.024, true, 0.08, 1.0, 1, true),
      badgeStyle: "pill",
    },
    logo: { x: 0.04, y: 0.93, width: 0.12, height: 0.05, anchor: "bottom-left" },
  },
  spacing: defaultSpacing(),
  premiumStyling: defaultPremium(),
  matchCriteria: { type: "product_hero", layout: "other", backgroundCategory: "simple" },
});

// 02 — product_hero × centered (417)
write({
  id: "product_hero_centered_simple",
  name: "Product Hero — Centered, Sharp background (1:1)",
  adType: "product_hero",
  layout: "centered",
  nativeFormat: "1080x1080",
  aspectRatio: "1:1",
  backgroundType: "simple",
  background: simpleBackground(),
  zones: {
    eyebrow: {
      x: 0.10, y: 0.06, width: 0.80, height: 0.06, align: "center",
      typography: typographySpec("eyebrow", 0.020, false, 0.12, 1.2, 1, true),
    },
    headline: {
      x: 0.08, y: 0.13, width: 0.84, height: 0.14, align: "center",
      typography: typographySpec("headline", 0.052, true, -0.02, 1.1, 2),
    },
    product: {
      x: 0.12, y: 0.28, width: 0.76, height: 0.48,
      effect: shadowEffect(0.04, 0.18),
    },
    cta: {
      x: 0.28, y: 0.78, width: 0.44, height: 0.09, align: "center",
      typography: typographySpec("cta", 0.026, true, 0.08, 1.0, 1, true),
      badgeStyle: "pill",
    },
    logo: { x: 0.04, y: 0.93, width: 0.12, height: 0.05, anchor: "bottom-left" },
  },
  spacing: defaultSpacing(),
  premiumStyling: defaultPremium(),
  matchCriteria: { type: "product_hero", layout: "centered", backgroundCategory: "simple" },
});

// 03 — product_hero × split (138)
write({
  id: "product_hero_split_simple",
  name: "Product Hero — Split Layout (1:1)",
  adType: "product_hero",
  layout: "split",
  nativeFormat: "1080x1080",
  aspectRatio: "1:1",
  backgroundType: "simple",
  background: {
    type: "gradient",
    gradientStops: [
      { color: "brand_primary", position: 0 },
      { color: "brand_secondary", position: 1 },
    ],
    gradientDirection: "linear_lr",
    textureName: "grain_light",
    textureOpacity: 0.03,
  },
  zones: {
    product: {
      x: 0.02, y: 0.08, width: 0.48, height: 0.84,
      effect: shadowEffect(0.03, 0.15),
    },
    eyebrow: {
      x: 0.54, y: 0.10, width: 0.42, height: 0.06, align: "left",
      typography: typographySpec("eyebrow", 0.018, false, 0.10, 1.2, 1, true),
    },
    headline: {
      x: 0.54, y: 0.18, width: 0.42, height: 0.22, align: "left",
      typography: typographySpec("headline", 0.048, true, -0.02, 1.1, 3),
    },
    subheadline: {
      x: 0.54, y: 0.42, width: 0.42, height: 0.12, align: "left",
      typography: typographySpec("subheadline", 0.028, false, 0, 1.4, 3),
    },
    cta: {
      x: 0.54, y: 0.57, width: 0.38, height: 0.09, align: "center",
      typography: typographySpec("cta", 0.024, true, 0.06, 1.0, 1, true),
      badgeStyle: "pill",
    },
    logo: { x: 0.54, y: 0.93, width: 0.12, height: 0.05, anchor: "bottom-left" },
  },
  spacing: defaultSpacing(0.04, 0.02),
  premiumStyling: defaultPremium(),
  matchCriteria: { type: "product_hero", layout: "split", backgroundCategory: "simple" },
});

// 04 — lifestyle × centered (75) — lifestyle bg → Gemini
write({
  id: "lifestyle_centered_lifestyle",
  name: "Lifestyle — Centered with Lifestyle Background (1:1)",
  adType: "lifestyle",
  layout: "centered",
  nativeFormat: "1080x1080",
  aspectRatio: "1:1",
  backgroundType: "lifestyle",
  background: lifestyleBackground("clean aspirational lifestyle scene, natural light, soft bokeh, uncluttered"),
  zones: {
    headline: {
      x: 0.08, y: 0.08, width: 0.84, height: 0.16, align: "center",
      typography: typographySpec("headline", 0.054, true, -0.02, 1.1, 2),
    },
    subheadline: {
      x: 0.12, y: 0.26, width: 0.76, height: 0.10, align: "center",
      typography: typographySpec("subheadline", 0.030, false, 0, 1.4, 2),
    },
    product: {
      x: 0.20, y: 0.38, width: 0.60, height: 0.40,
      effect: shadowEffect(0.05, 0.20),
    },
    cta: {
      x: 0.30, y: 0.82, width: 0.40, height: 0.09, align: "center",
      typography: typographySpec("cta", 0.026, true, 0.08, 1.0, 1, true),
      badgeStyle: "pill",
    },
    logo: { x: 0.04, y: 0.04, width: 0.12, height: 0.05, anchor: "top-left" },
  },
  spacing: defaultSpacing(0.05, 0.03),
  premiumStyling: {
    grainOverlay: false,
    grainOpacity: 0,
    globalCornerRadius: 0,
    decorativeElement: "none",
    backgroundBleedProduct: false,
  },
  matchCriteria: { type: "lifestyle", layout: "centered", backgroundCategory: "lifestyle" },
});

// 05 — product_hero × grid (66)
write({
  id: "product_hero_grid_simple",
  name: "Product Hero — Grid Layout (1:1)",
  adType: "product_hero",
  layout: "grid",
  nativeFormat: "1080x1080",
  aspectRatio: "1:1",
  backgroundType: "simple",
  background: simpleBackground(),
  zones: {
    headline: {
      x: 0.06, y: 0.05, width: 0.88, height: 0.12, align: "center",
      typography: typographySpec("headline", 0.046, true, -0.01, 1.1, 2),
    },
    // 2×2 grid of products
    product: {
      x: 0.06, y: 0.20, width: 0.42, height: 0.42,
      effect: shadowEffect(0.02, 0.12),
    },
    badge: {
      x: 0.54, y: 0.20, width: 0.40, height: 0.42,
      badgeType: "bestseller",
    },
    subheadline: {
      x: 0.06, y: 0.64, width: 0.88, height: 0.10, align: "center",
      typography: typographySpec("subheadline", 0.026, false, 0, 1.4, 2),
    },
    cta: {
      x: 0.28, y: 0.77, width: 0.44, height: 0.09, align: "center",
      typography: typographySpec("cta", 0.026, true, 0.08, 1.0, 1, true),
      badgeStyle: "pill",
    },
    logo: { x: 0.04, y: 0.93, width: 0.12, height: 0.05, anchor: "bottom-left" },
  },
  spacing: defaultSpacing(),
  premiumStyling: defaultPremium(),
  matchCriteria: { type: "product_hero", layout: "grid", backgroundCategory: "simple" },
});

// 06 — lifestyle × overlay (65) — lifestyle bg → Gemini
write({
  id: "lifestyle_overlay_lifestyle",
  name: "Lifestyle — Overlay Text on Lifestyle Background (1:1)",
  adType: "lifestyle",
  layout: "overlay",
  nativeFormat: "1080x1080",
  aspectRatio: "1:1",
  backgroundType: "lifestyle",
  background: lifestyleBackground("immersive lifestyle environment, warm natural tones, shallow depth of field"),
  zones: {
    eyebrow: {
      x: 0.08, y: 0.06, width: 0.84, height: 0.06, align: "center",
      typography: typographySpec("eyebrow", 0.018, false, 0.14, 1.2, 1, true),
    },
    headline: {
      x: 0.06, y: 0.62, width: 0.88, height: 0.16, align: "center",
      typography: typographySpec("headline", 0.052, true, -0.02, 1.1, 2),
    },
    subheadline: {
      x: 0.10, y: 0.79, width: 0.80, height: 0.08, align: "center",
      typography: typographySpec("subheadline", 0.026, false, 0, 1.3, 2),
    },
    cta: {
      x: 0.30, y: 0.89, width: 0.40, height: 0.08, align: "center",
      typography: typographySpec("cta", 0.024, true, 0.08, 1.0, 1, true),
      badgeStyle: "pill",
    },
    logo: { x: 0.04, y: 0.04, width: 0.12, height: 0.05, anchor: "top-left" },
  },
  spacing: defaultSpacing(0.05, 0.02),
  premiumStyling: {
    grainOverlay: false,
    grainOpacity: 0,
    globalCornerRadius: 0,
    decorativeElement: "none",
    backgroundBleedProduct: false,
  },
  matchCriteria: { type: "lifestyle", layout: "overlay", backgroundCategory: "lifestyle" },
});

// 07 — product_hero × overlay (53)
write({
  id: "product_hero_overlay_simple",
  name: "Product Hero — Overlay Layout (1:1)",
  adType: "product_hero",
  layout: "overlay",
  nativeFormat: "1080x1080",
  aspectRatio: "1:1",
  backgroundType: "simple",
  background: {
    type: "gradient",
    gradientStops: [
      { color: "brand_primary", position: 0 },
      { color: "black", position: 1 },
    ],
    gradientDirection: "linear_tb",
  },
  zones: {
    product: {
      x: 0.08, y: 0.04, width: 0.84, height: 0.72,
      effect: shadowEffect(0.05, 0.25),
    },
    headline: {
      x: 0.06, y: 0.68, width: 0.88, height: 0.14, align: "center",
      typography: typographySpec("headline", 0.050, true, -0.02, 1.1, 2),
    },
    cta: {
      x: 0.28, y: 0.84, width: 0.44, height: 0.09, align: "center",
      typography: typographySpec("cta", 0.026, true, 0.08, 1.0, 1, true),
      badgeStyle: "pill",
    },
    logo: { x: 0.04, y: 0.04, width: 0.12, height: 0.05, anchor: "top-left" },
  },
  spacing: defaultSpacing(0.04, 0.02),
  premiumStyling: defaultPremium(true, 0.05),
  matchCriteria: { type: "product_hero", layout: "overlay", backgroundCategory: "simple" },
});

// 08 — ugc_screenshot × centered (48)
write({
  id: "ugc_screenshot_centered_simple",
  name: "UGC Screenshot — Centered (1:1)",
  adType: "ugc_screenshot",
  layout: "centered",
  nativeFormat: "1080x1080",
  aspectRatio: "1:1",
  backgroundType: "simple",
  background: {
    type: "solid",
    color: "white",
    textureName: "grain_light",
    textureOpacity: 0.03,
  },
  zones: {
    eyebrow: {
      x: 0.10, y: 0.05, width: 0.80, height: 0.06, align: "center",
      typography: typographySpec("eyebrow", 0.018, false, 0.10, 1.2, 1, true),
    },
    screenshotFrame: {
      x: 0.08, y: 0.12, width: 0.84, height: 0.62,
      frameStyle: "phone",
    },
    subheadline: {
      x: 0.08, y: 0.76, width: 0.84, height: 0.10, align: "center",
      typography: typographySpec("subheadline", 0.026, false, 0, 1.4, 2),
    },
    cta: {
      x: 0.28, y: 0.88, width: 0.44, height: 0.08, align: "center",
      typography: typographySpec("cta", 0.024, true, 0.08, 1.0, 1, true),
      badgeStyle: "pill",
    },
    logo: { x: 0.04, y: 0.93, width: 0.12, height: 0.05, anchor: "bottom-left" },
  },
  spacing: defaultSpacing(0.04, 0.02),
  premiumStyling: defaultPremium(false),
  matchCriteria: { type: "ugc_screenshot", layout: "centered", backgroundCategory: "simple" },
});

// 09 — promo × centered (47)
write({
  id: "promo_centered_simple",
  name: "Promo — Centered (1:1)",
  adType: "promo",
  layout: "centered",
  nativeFormat: "1080x1080",
  aspectRatio: "1:1",
  backgroundType: "simple",
  background: {
    type: "gradient",
    gradientStops: [
      { color: "brand_primary", position: 0 },
      { color: "brand_accent", position: 1 },
    ],
    gradientDirection: "diagonal",
    textureName: "grain_light",
    textureOpacity: 0.04,
  },
  zones: {
    badge: {
      x: 0.30, y: 0.06, width: 0.40, height: 0.10,
      badgeType: "discount",
    },
    headline: {
      x: 0.06, y: 0.18, width: 0.88, height: 0.18, align: "center",
      typography: typographySpec("headline", 0.060, true, -0.02, 1.05, 2),
    },
    product: {
      x: 0.15, y: 0.38, width: 0.70, height: 0.40,
      effect: shadowEffect(0.04, 0.20),
    },
    cta: {
      x: 0.25, y: 0.81, width: 0.50, height: 0.10, align: "center",
      typography: typographySpec("cta", 0.030, true, 0.08, 1.0, 1, true),
      badgeStyle: "box",
    },
    logo: { x: 0.04, y: 0.93, width: 0.12, height: 0.05, anchor: "bottom-left" },
  },
  spacing: defaultSpacing(0.04, 0.02),
  premiumStyling: defaultPremium(),
  matchCriteria: { type: "promo", layout: "centered", backgroundCategory: "simple" },
});

// 10 — testimonial × centered (45)
write({
  id: "testimonial_centered_simple",
  name: "Testimonial — Centered (1:1)",
  adType: "testimonial",
  layout: "centered",
  nativeFormat: "1080x1080",
  aspectRatio: "1:1",
  backgroundType: "simple",
  background: {
    type: "solid",
    color: "brand_primary",
    textureName: "grain_light",
    textureOpacity: 0.04,
  },
  zones: {
    avatar: { x: 0.40, y: 0.06, width: 0.20, height: 0.14 },
    rating: { x: 0.30, y: 0.21, width: 0.40, height: 0.06 },
    quoteText: {
      x: 0.08, y: 0.29, width: 0.84, height: 0.30, align: "center",
      typography: typographySpec("body", 0.032, false, 0, 1.5, 6),
      quoteStyle: "large_quote",
    },
    divider: { x: 0.35, y: 0.61, width: 0.30, height: 0.02, style: "line" },
    subheadline: {
      x: 0.10, y: 0.65, width: 0.80, height: 0.08, align: "center",
      typography: typographySpec("subheadline", 0.024, true, 0.02, 1.3, 2),
    },
    product: {
      x: 0.38, y: 0.75, width: 0.24, height: 0.16,
      effect: shadowEffect(0.02, 0.12),
    },
    cta: {
      x: 0.28, y: 0.88, width: 0.44, height: 0.08, align: "center",
      typography: typographySpec("cta", 0.024, true, 0.08, 1.0, 1, true),
      badgeStyle: "pill",
    },
    logo: { x: 0.04, y: 0.04, width: 0.12, height: 0.05, anchor: "top-left" },
  },
  spacing: defaultSpacing(0.04, 0.025),
  premiumStyling: defaultPremium(),
  matchCriteria: { type: "testimonial", layout: "centered", backgroundCategory: "simple" },
});

// 11 — comparatif × split (44)
write({
  id: "comparatif_split_simple",
  name: "Comparatif — Split (1:1)",
  adType: "comparatif",
  layout: "split",
  nativeFormat: "1080x1080",
  aspectRatio: "1:1",
  backgroundType: "simple",
  background: {
    type: "solid",
    color: "white",
  },
  zones: {
    headline: {
      x: 0.08, y: 0.04, width: 0.84, height: 0.10, align: "center",
      typography: typographySpec("headline", 0.040, true, -0.01, 1.1, 2),
    },
    // Left side: competitor/before
    beforeImage: {
      x: 0.04, y: 0.16, width: 0.44, height: 0.52,
      label: "Before",
    },
    // Right side: product/after
    afterImage: {
      x: 0.52, y: 0.16, width: 0.44, height: 0.52,
      label: "After",
    },
    divider: { x: 0.48, y: 0.16, width: 0.04, height: 0.52, style: "line" },
    subheadline: {
      x: 0.08, y: 0.70, width: 0.84, height: 0.10, align: "center",
      typography: typographySpec("subheadline", 0.026, false, 0, 1.4, 2),
    },
    cta: {
      x: 0.28, y: 0.83, width: 0.44, height: 0.09, align: "center",
      typography: typographySpec("cta", 0.026, true, 0.08, 1.0, 1, true),
      badgeStyle: "pill",
    },
    logo: { x: 0.04, y: 0.93, width: 0.12, height: 0.05, anchor: "bottom-left" },
  },
  spacing: defaultSpacing(0.04, 0.02),
  premiumStyling: defaultPremium(false),
  matchCriteria: { type: "comparatif", layout: "split", backgroundCategory: "simple" },
});

// 12 — press_mention × centered (42)
write({
  id: "press_mention_centered_simple",
  name: "Press Mention — Centered (1:1)",
  adType: "press_mention",
  layout: "centered",
  nativeFormat: "1080x1080",
  aspectRatio: "1:1",
  backgroundType: "simple",
  background: {
    type: "solid",
    color: "white",
    textureName: "paper",
    textureOpacity: 0.06,
  },
  zones: {
    eyebrow: {
      x: 0.10, y: 0.06, width: 0.80, height: 0.06, align: "center",
      typography: typographySpec("eyebrow", 0.018, false, 0.10, 1.2, 1, true),
    },
    // Press logo / publication name
    subheadline: {
      x: 0.20, y: 0.14, width: 0.60, height: 0.08, align: "center",
      typography: typographySpec("subheadline", 0.028, true, 0.04, 1.2, 1),
    },
    quoteText: {
      x: 0.08, y: 0.24, width: 0.84, height: 0.28, align: "center",
      typography: typographySpec("headline", 0.040, true, -0.01, 1.2, 4),
      quoteStyle: "large_quote",
    },
    product: {
      x: 0.30, y: 0.54, width: 0.40, height: 0.28,
      effect: shadowEffect(0.03, 0.14),
    },
    cta: {
      x: 0.28, y: 0.84, width: 0.44, height: 0.09, align: "center",
      typography: typographySpec("cta", 0.024, true, 0.08, 1.0, 1, true),
      badgeStyle: "pill",
    },
    logo: { x: 0.04, y: 0.93, width: 0.12, height: 0.05, anchor: "bottom-left" },
  },
  spacing: defaultSpacing(0.04, 0.025),
  premiumStyling: defaultPremium(false),
  matchCriteria: { type: "press_mention", layout: "centered", backgroundCategory: "simple" },
});

// 13 — testimonial × overlay (40)
write({
  id: "testimonial_overlay_simple",
  name: "Testimonial — Overlay (1:1)",
  adType: "testimonial",
  layout: "overlay",
  nativeFormat: "1080x1080",
  aspectRatio: "1:1",
  backgroundType: "simple",
  background: {
    type: "gradient",
    gradientStops: [
      { color: "brand_primary", position: 0 },
      { color: "black", position: 1 },
    ],
    gradientDirection: "linear_tb",
    textureName: "grain_light",
    textureOpacity: 0.04,
  },
  zones: {
    product: {
      x: 0.10, y: 0.04, width: 0.80, height: 0.54,
      effect: shadowEffect(0.05, 0.22),
    },
    rating: { x: 0.32, y: 0.58, width: 0.36, height: 0.06 },
    quoteText: {
      x: 0.06, y: 0.65, width: 0.88, height: 0.18, align: "center",
      typography: typographySpec("body", 0.030, false, 0, 1.45, 4),
      quoteStyle: "inline",
    },
    avatar: { x: 0.42, y: 0.85, width: 0.10, height: 0.10 },
    subheadline: {
      x: 0.54, y: 0.87, width: 0.40, height: 0.07, align: "left",
      typography: typographySpec("label", 0.020, true, 0.02, 1.2, 2),
    },
    logo: { x: 0.04, y: 0.04, width: 0.12, height: 0.05, anchor: "top-left" },
  },
  spacing: defaultSpacing(0.04, 0.02),
  premiumStyling: defaultPremium(true, 0.05),
  matchCriteria: { type: "testimonial", layout: "overlay", backgroundCategory: "simple" },
});

// 14 — before_after × split (30)
write({
  id: "before_after_split_simple",
  name: "Before / After — Split (1:1)",
  adType: "before_after",
  layout: "split",
  nativeFormat: "1080x1080",
  aspectRatio: "1:1",
  backgroundType: "simple",
  background: { type: "solid", color: "white" },
  zones: {
    headline: {
      x: 0.08, y: 0.03, width: 0.84, height: 0.10, align: "center",
      typography: typographySpec("headline", 0.040, true, -0.01, 1.1, 2),
    },
    beforeImage: {
      x: 0.02, y: 0.14, width: 0.47, height: 0.58,
      label: "Avant",
    },
    afterImage: {
      x: 0.51, y: 0.14, width: 0.47, height: 0.58,
      label: "Après",
    },
    subheadline: {
      x: 0.08, y: 0.74, width: 0.84, height: 0.10, align: "center",
      typography: typographySpec("subheadline", 0.026, false, 0, 1.4, 2),
    },
    cta: {
      x: 0.28, y: 0.86, width: 0.44, height: 0.09, align: "center",
      typography: typographySpec("cta", 0.026, true, 0.08, 1.0, 1, true),
      badgeStyle: "pill",
    },
    logo: { x: 0.04, y: 0.93, width: 0.12, height: 0.05, anchor: "bottom-left" },
  },
  spacing: defaultSpacing(0.03, 0.02),
  premiumStyling: defaultPremium(false),
  matchCriteria: { type: "before_after", layout: "split", backgroundCategory: "simple" },
});

// 15 — lifestyle × split (28) — Gemini
write({
  id: "lifestyle_split_lifestyle",
  name: "Lifestyle — Split with Lifestyle Background (1:1)",
  adType: "lifestyle",
  layout: "split",
  nativeFormat: "1080x1080",
  aspectRatio: "1:1",
  backgroundType: "lifestyle",
  background: lifestyleBackground("lifestyle scene split composition, one side action one side clean, natural daylight"),
  zones: {
    headline: {
      x: 0.54, y: 0.08, width: 0.42, height: 0.20, align: "left",
      typography: typographySpec("headline", 0.050, true, -0.02, 1.1, 3),
    },
    subheadline: {
      x: 0.54, y: 0.30, width: 0.42, height: 0.14, align: "left",
      typography: typographySpec("subheadline", 0.026, false, 0, 1.4, 3),
    },
    product: {
      x: 0.54, y: 0.46, width: 0.40, height: 0.34,
      effect: shadowEffect(0.03, 0.15),
    },
    cta: {
      x: 0.54, y: 0.84, width: 0.38, height: 0.09, align: "center",
      typography: typographySpec("cta", 0.024, true, 0.06, 1.0, 1, true),
      badgeStyle: "pill",
    },
    logo: { x: 0.04, y: 0.04, width: 0.12, height: 0.05, anchor: "top-left" },
  },
  spacing: defaultSpacing(0.04, 0.025),
  premiumStyling: {
    grainOverlay: false,
    grainOpacity: 0,
    globalCornerRadius: 0,
    decorativeElement: "none",
    backgroundBleedProduct: false,
  },
  matchCriteria: { type: "lifestyle", layout: "split", backgroundCategory: "lifestyle" },
});

// 16 — listicle × centered (23)
write({
  id: "listicle_centered_simple",
  name: "Listicle — Centered (1:1)",
  adType: "listicle",
  layout: "centered",
  nativeFormat: "1080x1080",
  aspectRatio: "1:1",
  backgroundType: "simple",
  background: simpleBackground(),
  zones: {
    headline: {
      x: 0.06, y: 0.05, width: 0.88, height: 0.12, align: "center",
      typography: typographySpec("headline", 0.046, true, -0.01, 1.1, 2),
    },
    listItems: {
      x: 0.08, y: 0.19, width: 0.84, height: 0.56,
      maxItems: 5,
      itemTypography: typographySpec("body", 0.030, false, 0, 1.5, 2),
    },
    cta: {
      x: 0.28, y: 0.80, width: 0.44, height: 0.09, align: "center",
      typography: typographySpec("cta", 0.026, true, 0.08, 1.0, 1, true),
      badgeStyle: "pill",
    },
    logo: { x: 0.04, y: 0.93, width: 0.12, height: 0.05, anchor: "bottom-left" },
  },
  spacing: defaultSpacing(0.04, 0.03),
  premiumStyling: defaultPremium(),
  matchCriteria: { type: "listicle", layout: "centered", backgroundCategory: "simple" },
});

// 17 — press_mention × split (22)
write({
  id: "press_mention_split_simple",
  name: "Press Mention — Split (1:1)",
  adType: "press_mention",
  layout: "split",
  nativeFormat: "1080x1080",
  aspectRatio: "1:1",
  backgroundType: "simple",
  background: { type: "solid", color: "white", textureName: "paper", textureOpacity: 0.05 },
  zones: {
    product: {
      x: 0.02, y: 0.10, width: 0.46, height: 0.80,
      effect: shadowEffect(0.02, 0.12),
    },
    eyebrow: {
      x: 0.52, y: 0.10, width: 0.44, height: 0.06, align: "left",
      typography: typographySpec("eyebrow", 0.016, true, 0.08, 1.2, 1, true),
    },
    quoteText: {
      x: 0.52, y: 0.18, width: 0.44, height: 0.36, align: "left",
      typography: typographySpec("headline", 0.038, true, -0.01, 1.2, 5),
      quoteStyle: "large_quote",
    },
    subheadline: {
      x: 0.52, y: 0.56, width: 0.44, height: 0.10, align: "left",
      typography: typographySpec("subheadline", 0.024, false, 0, 1.4, 2),
    },
    cta: {
      x: 0.52, y: 0.70, width: 0.40, height: 0.09, align: "center",
      typography: typographySpec("cta", 0.024, true, 0.08, 1.0, 1, true),
      badgeStyle: "pill",
    },
    logo: { x: 0.52, y: 0.90, width: 0.12, height: 0.05, anchor: "bottom-left" },
  },
  spacing: defaultSpacing(0.04, 0.02),
  premiumStyling: defaultPremium(false),
  matchCriteria: { type: "press_mention", layout: "split", backgroundCategory: "simple" },
});

// 18 — promo × overlay (21)
write({
  id: "promo_overlay_simple",
  name: "Promo — Overlay (1:1)",
  adType: "promo",
  layout: "overlay",
  nativeFormat: "1080x1080",
  aspectRatio: "1:1",
  backgroundType: "simple",
  background: {
    type: "gradient",
    gradientStops: [
      { color: "brand_accent", position: 0 },
      { color: "brand_primary", position: 1 },
    ],
    gradientDirection: "diagonal",
    textureName: "grain_light",
    textureOpacity: 0.04,
  },
  zones: {
    product: {
      x: 0.08, y: 0.04, width: 0.84, height: 0.60,
      effect: shadowEffect(0.04, 0.20),
    },
    badge: {
      x: 0.32, y: 0.62, width: 0.36, height: 0.10,
      badgeType: "discount",
    },
    headline: {
      x: 0.06, y: 0.73, width: 0.88, height: 0.12, align: "center",
      typography: typographySpec("headline", 0.048, true, -0.02, 1.05, 2),
    },
    cta: {
      x: 0.28, y: 0.87, width: 0.44, height: 0.09, align: "center",
      typography: typographySpec("cta", 0.028, true, 0.08, 1.0, 1, true),
      badgeStyle: "box",
    },
    logo: { x: 0.04, y: 0.04, width: 0.12, height: 0.05, anchor: "top-left" },
  },
  spacing: defaultSpacing(0.04, 0.02),
  premiumStyling: defaultPremium(),
  matchCriteria: { type: "promo", layout: "overlay", backgroundCategory: "simple" },
});

// 19 — promo × split (21)
write({
  id: "promo_split_simple",
  name: "Promo — Split (1:1)",
  adType: "promo",
  layout: "split",
  nativeFormat: "1080x1080",
  aspectRatio: "1:1",
  backgroundType: "simple",
  background: {
    type: "gradient",
    gradientStops: [
      { color: "brand_primary", position: 0 },
      { color: "brand_accent", position: 1 },
    ],
    gradientDirection: "linear_lr",
  },
  zones: {
    product: {
      x: 0.02, y: 0.08, width: 0.48, height: 0.82,
      effect: shadowEffect(0.03, 0.16),
    },
    badge: {
      x: 0.54, y: 0.08, width: 0.38, height: 0.12,
      badgeType: "discount",
    },
    headline: {
      x: 0.54, y: 0.22, width: 0.42, height: 0.22, align: "left",
      typography: typographySpec("headline", 0.052, true, -0.02, 1.1, 3),
    },
    subheadline: {
      x: 0.54, y: 0.46, width: 0.42, height: 0.14, align: "left",
      typography: typographySpec("subheadline", 0.026, false, 0, 1.4, 3),
    },
    cta: {
      x: 0.54, y: 0.64, width: 0.38, height: 0.10, align: "center",
      typography: typographySpec("cta", 0.028, true, 0.08, 1.0, 1, true),
      badgeStyle: "box",
    },
    logo: { x: 0.54, y: 0.90, width: 0.12, height: 0.05, anchor: "bottom-left" },
  },
  spacing: defaultSpacing(0.04, 0.02),
  premiumStyling: defaultPremium(),
  matchCriteria: { type: "promo", layout: "split", backgroundCategory: "simple" },
});

// 20 — ugc_screenshot × overlay (20)
write({
  id: "ugc_screenshot_overlay_simple",
  name: "UGC Screenshot — Overlay (1:1)",
  adType: "ugc_screenshot",
  layout: "overlay",
  nativeFormat: "1080x1080",
  aspectRatio: "1:1",
  backgroundType: "simple",
  background: {
    type: "gradient",
    gradientStops: [
      { color: "brand_secondary", position: 0 },
      { color: "brand_primary", position: 1 },
    ],
    gradientDirection: "linear_tb",
  },
  zones: {
    screenshotFrame: {
      x: 0.06, y: 0.04, width: 0.88, height: 0.68,
      frameStyle: "phone",
    },
    eyebrow: {
      x: 0.08, y: 0.74, width: 0.84, height: 0.06, align: "center",
      typography: typographySpec("eyebrow", 0.016, false, 0.10, 1.2, 1, true),
    },
    headline: {
      x: 0.06, y: 0.80, width: 0.88, height: 0.10, align: "center",
      typography: typographySpec("headline", 0.038, true, -0.01, 1.1, 2),
    },
    cta: {
      x: 0.28, y: 0.92, width: 0.44, height: 0.06, align: "center",
      typography: typographySpec("cta", 0.022, true, 0.08, 1.0, 1, true),
      badgeStyle: "underline",
    },
    logo: { x: 0.04, y: 0.04, width: 0.12, height: 0.05, anchor: "top-left" },
  },
  spacing: defaultSpacing(0.04, 0.02),
  premiumStyling: defaultPremium(true, 0.04),
  matchCriteria: { type: "ugc_screenshot", layout: "overlay", backgroundCategory: "simple" },
});

// 21 — testimonial × split (20)
write({
  id: "testimonial_split_simple",
  name: "Testimonial — Split (1:1)",
  adType: "testimonial",
  layout: "split",
  nativeFormat: "1080x1080",
  aspectRatio: "1:1",
  backgroundType: "simple",
  background: simpleBackground(),
  zones: {
    avatar: { x: 0.04, y: 0.08, width: 0.40, height: 0.40 },
    product: {
      x: 0.06, y: 0.52, width: 0.36, height: 0.42,
      effect: shadowEffect(0.02, 0.12),
    },
    eyebrow: {
      x: 0.50, y: 0.08, width: 0.46, height: 0.06, align: "left",
      typography: typographySpec("eyebrow", 0.016, false, 0.10, 1.2, 1, true),
    },
    rating: { x: 0.50, y: 0.15, width: 0.36, height: 0.06 },
    quoteText: {
      x: 0.50, y: 0.23, width: 0.46, height: 0.36, align: "left",
      typography: typographySpec("body", 0.030, false, 0, 1.5, 6),
      quoteStyle: "inline",
    },
    subheadline: {
      x: 0.50, y: 0.61, width: 0.46, height: 0.10, align: "left",
      typography: typographySpec("subheadline", 0.022, true, 0.02, 1.3, 2),
    },
    cta: {
      x: 0.50, y: 0.74, width: 0.42, height: 0.09, align: "center",
      typography: typographySpec("cta", 0.024, true, 0.08, 1.0, 1, true),
      badgeStyle: "pill",
    },
    logo: { x: 0.50, y: 0.90, width: 0.12, height: 0.05, anchor: "bottom-left" },
  },
  spacing: defaultSpacing(0.04, 0.02),
  premiumStyling: defaultPremium(),
  matchCriteria: { type: "testimonial", layout: "split", backgroundCategory: "simple" },
});

// 22 — listicle × split (19)
write({
  id: "listicle_split_simple",
  name: "Listicle — Split (1:1)",
  adType: "listicle",
  layout: "split",
  nativeFormat: "1080x1080",
  aspectRatio: "1:1",
  backgroundType: "simple",
  background: simpleBackground(),
  zones: {
    product: {
      x: 0.02, y: 0.08, width: 0.46, height: 0.84,
      effect: shadowEffect(0.03, 0.15),
    },
    headline: {
      x: 0.52, y: 0.08, width: 0.44, height: 0.14, align: "left",
      typography: typographySpec("headline", 0.044, true, -0.01, 1.1, 2),
    },
    listItems: {
      x: 0.52, y: 0.24, width: 0.44, height: 0.50,
      maxItems: 4,
      itemTypography: typographySpec("body", 0.026, false, 0, 1.4, 2),
    },
    cta: {
      x: 0.52, y: 0.78, width: 0.40, height: 0.09, align: "center",
      typography: typographySpec("cta", 0.024, true, 0.08, 1.0, 1, true),
      badgeStyle: "pill",
    },
    logo: { x: 0.52, y: 0.93, width: 0.12, height: 0.05, anchor: "bottom-left" },
  },
  spacing: defaultSpacing(0.04, 0.025),
  premiumStyling: defaultPremium(),
  matchCriteria: { type: "listicle", layout: "split", backgroundCategory: "simple" },
});

// 23 — lifestyle × grid (16) — Gemini
write({
  id: "lifestyle_grid_lifestyle",
  name: "Lifestyle — Grid with Lifestyle Background (1:1)",
  adType: "lifestyle",
  layout: "grid",
  nativeFormat: "1080x1080",
  aspectRatio: "1:1",
  backgroundType: "lifestyle",
  background: lifestyleBackground("flat lay arrangement, overhead shot, natural materials, clean negative space"),
  zones: {
    headline: {
      x: 0.06, y: 0.06, width: 0.88, height: 0.12, align: "center",
      typography: typographySpec("headline", 0.048, true, -0.01, 1.1, 2),
    },
    subheadline: {
      x: 0.10, y: 0.82, width: 0.80, height: 0.08, align: "center",
      typography: typographySpec("subheadline", 0.026, false, 0, 1.4, 2),
    },
    cta: {
      x: 0.30, y: 0.91, width: 0.40, height: 0.07, align: "center",
      typography: typographySpec("cta", 0.022, true, 0.08, 1.0, 1, true),
      badgeStyle: "underline",
    },
    logo: { x: 0.04, y: 0.04, width: 0.12, height: 0.05, anchor: "top-left" },
  },
  spacing: defaultSpacing(0.05, 0.03),
  premiumStyling: {
    grainOverlay: false,
    grainOpacity: 0,
    globalCornerRadius: 0,
    decorativeElement: "none",
    backgroundBleedProduct: false,
  },
  matchCriteria: { type: "lifestyle", layout: "grid", backgroundCategory: "lifestyle" },
});

// 24 — ugc_screenshot × split (14)
write({
  id: "ugc_screenshot_split_simple",
  name: "UGC Screenshot — Split (1:1)",
  adType: "ugc_screenshot",
  layout: "split",
  nativeFormat: "1080x1080",
  aspectRatio: "1:1",
  backgroundType: "simple",
  background: { type: "solid", color: "white", textureName: "grain_light", textureOpacity: 0.03 },
  zones: {
    screenshotFrame: {
      x: 0.02, y: 0.06, width: 0.48, height: 0.88,
      frameStyle: "phone",
    },
    headline: {
      x: 0.54, y: 0.08, width: 0.42, height: 0.18, align: "left",
      typography: typographySpec("headline", 0.044, true, -0.01, 1.1, 3),
    },
    rating: { x: 0.54, y: 0.28, width: 0.36, height: 0.06 },
    subheadline: {
      x: 0.54, y: 0.36, width: 0.42, height: 0.18, align: "left",
      typography: typographySpec("subheadline", 0.026, false, 0, 1.5, 4),
    },
    cta: {
      x: 0.54, y: 0.58, width: 0.40, height: 0.09, align: "center",
      typography: typographySpec("cta", 0.024, true, 0.08, 1.0, 1, true),
      badgeStyle: "pill",
    },
    logo: { x: 0.54, y: 0.92, width: 0.12, height: 0.05, anchor: "bottom-left" },
  },
  spacing: defaultSpacing(0.04, 0.02),
  premiumStyling: defaultPremium(false),
  matchCriteria: { type: "ugc_screenshot", layout: "split", backgroundCategory: "simple" },
});

// 25 — data_stats × split (13)
write({
  id: "data_stats_split_simple",
  name: "Data Stats — Split (1:1)",
  adType: "data_stats",
  layout: "split",
  nativeFormat: "1080x1080",
  aspectRatio: "1:1",
  backgroundType: "simple",
  background: {
    type: "gradient",
    gradientStops: [
      { color: "brand_primary", position: 0 },
      { color: "brand_secondary", position: 1 },
    ],
    gradientDirection: "linear_tb",
    textureName: "grain_light",
    textureOpacity: 0.04,
  },
  zones: {
    product: {
      x: 0.02, y: 0.08, width: 0.48, height: 0.84,
      effect: shadowEffect(0.03, 0.16),
    },
    eyebrow: {
      x: 0.54, y: 0.06, width: 0.42, height: 0.06, align: "left",
      typography: typographySpec("eyebrow", 0.016, false, 0.12, 1.2, 1, true),
    },
    statNumber: {
      x: 0.54, y: 0.14, width: 0.42, height: 0.18, align: "left",
      typography: typographySpec("headline", 0.070, true, -0.03, 1.0, 1),
    },
    statLabel: {
      x: 0.54, y: 0.33, width: 0.42, height: 0.10, align: "left",
      typography: typographySpec("body", 0.026, false, 0, 1.4, 2),
    },
    divider: { x: 0.54, y: 0.45, width: 0.36, height: 0.015, style: "line" },
    subheadline: {
      x: 0.54, y: 0.48, width: 0.42, height: 0.18, align: "left",
      typography: typographySpec("subheadline", 0.026, false, 0, 1.4, 3),
    },
    cta: {
      x: 0.54, y: 0.70, width: 0.38, height: 0.09, align: "center",
      typography: typographySpec("cta", 0.024, true, 0.08, 1.0, 1, true),
      badgeStyle: "pill",
    },
    logo: { x: 0.54, y: 0.92, width: 0.12, height: 0.05, anchor: "bottom-left" },
  },
  spacing: defaultSpacing(0.04, 0.02),
  premiumStyling: defaultPremium(),
  matchCriteria: { type: "data_stats", layout: "split", backgroundCategory: "simple" },
});

// 26 — data_stats × centered (12)
write({
  id: "data_stats_centered_simple",
  name: "Data Stats — Centered (1:1)",
  adType: "data_stats",
  layout: "centered",
  nativeFormat: "1080x1080",
  aspectRatio: "1:1",
  backgroundType: "simple",
  background: {
    type: "gradient",
    gradientStops: [
      { color: "brand_primary", position: 0 },
      { color: "brand_secondary", position: 1 },
    ],
    gradientDirection: "radial",
    textureName: "grain_light",
    textureOpacity: 0.04,
  },
  zones: {
    eyebrow: {
      x: 0.10, y: 0.06, width: 0.80, height: 0.06, align: "center",
      typography: typographySpec("eyebrow", 0.018, false, 0.12, 1.2, 1, true),
    },
    statNumber: {
      x: 0.14, y: 0.14, width: 0.72, height: 0.22, align: "center",
      typography: typographySpec("headline", 0.090, true, -0.04, 1.0, 1),
    },
    statLabel: {
      x: 0.14, y: 0.37, width: 0.72, height: 0.10, align: "center",
      typography: typographySpec("body", 0.030, false, 0, 1.4, 2),
    },
    divider: { x: 0.35, y: 0.50, width: 0.30, height: 0.015, style: "dot_row" },
    product: {
      x: 0.30, y: 0.54, width: 0.40, height: 0.26,
      effect: shadowEffect(0.03, 0.14),
    },
    cta: {
      x: 0.28, y: 0.83, width: 0.44, height: 0.09, align: "center",
      typography: typographySpec("cta", 0.026, true, 0.08, 1.0, 1, true),
      badgeStyle: "pill",
    },
    logo: { x: 0.04, y: 0.93, width: 0.12, height: 0.05, anchor: "bottom-left" },
  },
  spacing: defaultSpacing(0.04, 0.025),
  premiumStyling: defaultPremium(),
  matchCriteria: { type: "data_stats", layout: "centered", backgroundCategory: "simple" },
});

// 27 — listicle × grid (12)
write({
  id: "listicle_grid_simple",
  name: "Listicle — Grid (1:1)",
  adType: "listicle",
  layout: "grid",
  nativeFormat: "1080x1080",
  aspectRatio: "1:1",
  backgroundType: "simple",
  background: simpleBackground(),
  zones: {
    headline: {
      x: 0.06, y: 0.04, width: 0.88, height: 0.12, align: "center",
      typography: typographySpec("headline", 0.044, true, -0.01, 1.1, 2),
    },
    listItems: {
      x: 0.06, y: 0.18, width: 0.88, height: 0.62,
      maxItems: 6,
      itemTypography: typographySpec("body", 0.026, false, 0, 1.4, 2),
    },
    cta: {
      x: 0.28, y: 0.83, width: 0.44, height: 0.09, align: "center",
      typography: typographySpec("cta", 0.026, true, 0.08, 1.0, 1, true),
      badgeStyle: "pill",
    },
    logo: { x: 0.04, y: 0.93, width: 0.12, height: 0.05, anchor: "bottom-left" },
  },
  spacing: defaultSpacing(0.04, 0.025),
  premiumStyling: defaultPremium(),
  matchCriteria: { type: "listicle", layout: "grid", backgroundCategory: "simple" },
});

// 28 — ugc_screenshot × grid (11)
write({
  id: "ugc_screenshot_grid_simple",
  name: "UGC Screenshot — Grid (1:1)",
  adType: "ugc_screenshot",
  layout: "grid",
  nativeFormat: "1080x1080",
  aspectRatio: "1:1",
  backgroundType: "simple",
  background: { type: "solid", color: "white", textureName: "grain_light", textureOpacity: 0.03 },
  zones: {
    headline: {
      x: 0.06, y: 0.04, width: 0.88, height: 0.10, align: "center",
      typography: typographySpec("headline", 0.042, true, -0.01, 1.1, 2),
    },
    // 2×2 screenshot grid
    screenshotFrame: {
      x: 0.04, y: 0.16, width: 0.44, height: 0.42,
      frameStyle: "phone",
    },
    // reuse screenshotFrame for secondary screenshot (compositor will index)
    rating: { x: 0.52, y: 0.16, width: 0.44, height: 0.10 },
    quoteText: {
      x: 0.52, y: 0.28, width: 0.44, height: 0.30, align: "left",
      typography: typographySpec("body", 0.026, false, 0, 1.5, 6),
      quoteStyle: "inline",
    },
    subheadline: {
      x: 0.06, y: 0.62, width: 0.88, height: 0.10, align: "center",
      typography: typographySpec("subheadline", 0.026, false, 0, 1.4, 2),
    },
    cta: {
      x: 0.28, y: 0.75, width: 0.44, height: 0.09, align: "center",
      typography: typographySpec("cta", 0.026, true, 0.08, 1.0, 1, true),
      badgeStyle: "pill",
    },
    logo: { x: 0.04, y: 0.93, width: 0.12, height: 0.05, anchor: "bottom-left" },
  },
  spacing: defaultSpacing(0.04, 0.025),
  premiumStyling: defaultPremium(false),
  matchCriteria: { type: "ugc_screenshot", layout: "grid", backgroundCategory: "simple" },
});

console.log("\n✅  All 28 skeleton files generated in lib/skeletons/");
