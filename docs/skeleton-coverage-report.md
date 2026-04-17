## Coverage Report — Skeleton Library v1

> Generated: 2026-04-17
> Source: 4,079 templates in `Template` table
> Threshold applied: cells ≥ 10 (see methodology note below)

---

### analysisJson Field Audit

**Sampling method:** 100 most-recent records inspected.

| Field | Present in sample | Notes |
|---|---|---|
| `backgroundType` | 0/100 | Field absent — Claude analysis not yet run on BDD |
| `productPlacement` | 0/100 | Field absent — Claude analysis not yet run on BDD |

**Fallback applied:** Clustering uses `type × layout` only (as specified in PM spec §7).
Background category for `lifestyle` ad type inferred as `lifestyle` (structurally requires Gemini); all other types assigned `simple`.

---

### Pattern Distribution (from 4,079 BDD creatives)

| Pattern ID | Ad Type | Layout | Count | % of BDD | Background | Status |
|---|---|---|---|---|---|---|
| `product_hero_other_simple` | product_hero | other | 2669 | 65.4% | simple | ✅ Skeleton generated |
| `product_hero_centered_simple` | product_hero | centered | 417 | 10.2% | simple | ✅ Skeleton generated |
| `product_hero_split_simple` | product_hero | split | 138 | 3.4% | simple | ✅ Skeleton generated |
| `lifestyle_centered_lifestyle` | lifestyle | centered | 75 | 1.8% | lifestyle | ✅ Skeleton generated |
| `product_hero_grid_simple` | product_hero | grid | 66 | 1.6% | simple | ✅ Skeleton generated |
| `lifestyle_overlay_lifestyle` | lifestyle | overlay | 65 | 1.6% | lifestyle | ✅ Skeleton generated |
| `product_hero_overlay_simple` | product_hero | overlay | 53 | 1.3% | simple | ✅ Skeleton generated |
| `ugc_screenshot_centered_simple` | ugc_screenshot | centered | 48 | 1.2% | simple | ✅ Skeleton generated |
| `promo_centered_simple` | promo | centered | 47 | 1.2% | simple | ✅ Skeleton generated |
| `testimonial_centered_simple` | testimonial | centered | 45 | 1.1% | simple | ✅ Skeleton generated |
| `comparatif_split_simple` | comparatif | split | 44 | 1.1% | simple | ✅ Skeleton generated |
| `press_mention_centered_simple` | press_mention | centered | 42 | 1.0% | simple | ✅ Skeleton generated |
| `testimonial_overlay_simple` | testimonial | overlay | 40 | 1.0% | simple | ✅ Skeleton generated |
| `before_after_split_simple` | before_after | split | 30 | 0.7% | simple | ✅ Skeleton generated |
| `lifestyle_split_lifestyle` | lifestyle | split | 28 | 0.7% | lifestyle | ✅ Skeleton generated |
| `listicle_centered_simple` | listicle | centered | 23 | 0.6% | simple | ✅ Skeleton generated |
| `press_mention_split_simple` | press_mention | split | 22 | 0.5% | simple | ✅ Skeleton generated |
| `promo_overlay_simple` | promo | overlay | 21 | 0.5% | simple | ✅ Skeleton generated |
| `promo_split_simple` | promo | split | 21 | 0.5% | simple | ✅ Skeleton generated |
| `ugc_screenshot_overlay_simple` | ugc_screenshot | overlay | 20 | 0.5% | simple | ✅ Skeleton generated |
| `testimonial_split_simple` | testimonial | split | 20 | 0.5% | simple | ✅ Skeleton generated |
| `listicle_split_simple` | listicle | split | 19 | 0.5% | simple | ✅ Skeleton generated |
| `lifestyle_grid_lifestyle` | lifestyle | grid | 16 | 0.4% | lifestyle | ✅ Skeleton generated |
| `ugc_screenshot_split_simple` | ugc_screenshot | split | 14 | 0.3% | simple | ✅ Skeleton generated |
| `data_stats_split_simple` | data_stats | split | 13 | 0.3% | simple | ✅ Skeleton generated |
| `data_stats_centered_simple` | data_stats | centered | 12 | 0.3% | simple | ✅ Skeleton generated |
| `listicle_grid_simple` | listicle | grid | 12 | 0.3% | simple | ✅ Skeleton generated |
| `ugc_screenshot_grid_simple` | ugc_screenshot | grid | 11 | 0.3% | simple | ✅ Skeleton generated |

**Total patterns: 28** (within the 20–30 target).

---

### Methodology Note — Threshold Selection

Raw distinct `type × layout` cells: 39 total, 34 with count ≥ 5.
Per PM spec §3, Step 4: > 30 patterns → apply stricter threshold (count ≥ 10).
Result: 28 patterns at threshold ≥ 10. ✅

**Merged cells (count < 10, below threshold):**

| Cell | Count | Merged into |
|---|---|---|
| press_mention × overlay | 9 | `press_mention_centered_simple` |
| promo × grid | 7 | `promo_centered_simple` |
| listicle × overlay | 7 | `listicle_centered_simple` |
| comparatif × grid | 6 | `comparatif_split_simple` |
| press_mention × grid | 5 | `press_mention_centered_simple` |
| data_stats × overlay | 5 | `data_stats_centered_simple` |
| testimonial × grid | 3 | `testimonial_centered_simple` |
| before_after × grid | 2 | `before_after_split_simple` |
| comparatif × centered | 2 | `comparatif_split_simple` |
| ugc_screenshot × other | 1 | `ugc_screenshot_centered_simple` |
| before_after × centered | 1 | `before_after_split_simple` |

---

### Ad Type Coverage Summary

| Ad Type | Total in BDD | Skeletons | Coverage |
|---|---|---|---|
| product_hero | 3,402 | 5 | ✅ Good (all major layouts covered) |
| lifestyle | 184 | 4 | ✅ Good |
| ugc_screenshot | 142 | 4 | ✅ Good |
| promo | 96 | 3 | ✅ Good |
| testimonial | 108 | 3 | ✅ Good |
| comparatif | 52 | 1 | ⚠️ Thin (split only; centered/grid merged) |
| press_mention | 78 | 2 | ✅ Good |
| before_after | 33 | 1 | ⚠️ Thin (<3 distinct layouts; grid/centered merged) |
| listicle | 61 | 3 | ✅ Good |
| data_stats | 30 | 2 | ✅ Good |

---

### Background Category Summary

| Background Category | Skeletons | Notes |
|---|---|---|
| `simple` (Sharp-only) | 24 | No Gemini dependency |
| `lifestyle` (Gemini required) | 4 | All `lifestyle` ad type skeletons |

**Gemini-dependent skeletons:** `lifestyle_centered_lifestyle`, `lifestyle_overlay_lifestyle`, `lifestyle_split_lifestyle`, `lifestyle_grid_lifestyle`

---

### Skeleton Files Generated

- `lib/skeletons/product_hero_other_simple.json`
- `lib/skeletons/product_hero_centered_simple.json`
- `lib/skeletons/product_hero_split_simple.json`
- `lib/skeletons/lifestyle_centered_lifestyle.json`
- `lib/skeletons/product_hero_grid_simple.json`
- `lib/skeletons/lifestyle_overlay_lifestyle.json`
- `lib/skeletons/product_hero_overlay_simple.json`
- `lib/skeletons/ugc_screenshot_centered_simple.json`
- `lib/skeletons/promo_centered_simple.json`
- `lib/skeletons/testimonial_centered_simple.json`
- `lib/skeletons/comparatif_split_simple.json`
- `lib/skeletons/press_mention_centered_simple.json`
- `lib/skeletons/testimonial_overlay_simple.json`
- `lib/skeletons/before_after_split_simple.json`
- `lib/skeletons/lifestyle_split_lifestyle.json`
- `lib/skeletons/listicle_centered_simple.json`
- `lib/skeletons/press_mention_split_simple.json`
- `lib/skeletons/promo_overlay_simple.json`
- `lib/skeletons/promo_split_simple.json`
- `lib/skeletons/ugc_screenshot_overlay_simple.json`
- `lib/skeletons/testimonial_split_simple.json`
- `lib/skeletons/listicle_split_simple.json`
- `lib/skeletons/lifestyle_grid_lifestyle.json`
- `lib/skeletons/ugc_screenshot_split_simple.json`
- `lib/skeletons/data_stats_split_simple.json`
- `lib/skeletons/data_stats_centered_simple.json`
- `lib/skeletons/listicle_grid_simple.json`
- `lib/skeletons/ugc_screenshot_grid_simple.json`

---

### Open Issues

- [ ] **`before_after` has only 1 skeleton** — 33 examples, split only. Verify BDD quality before Phase A. No before_after × overlay skeleton (1 example, too few).
- [ ] **`comparatif` has only 1 skeleton** — 52 examples but all non-split layouts merged. Consider manual creation of a `comparatif_grid_simple` if Board wants it.
- [ ] **`product_hero × other` is 65.4% of the BDD** — indicates most templates were uploaded without proper layout classification. Recommend running a BDD re-classification batch (Claude analysis pass) to populate `analysisJson.layout` and `analysisJson.backgroundType`. This would enable background-based splitting on the dominant pattern.
- [ ] **4 skeletons have `backgroundType: lifestyle`** — these require Gemini integration in Phase A. Gated on Gemini background step implementation in STA-147.
- [ ] **No `_lifestyle` split for non-lifestyle types** — since `analysisJson.backgroundType` is absent, we cannot identify lifestyle-background product_hero ads. After BDD re-analysis, `product_hero_centered_lifestyle`, `product_hero_overlay_lifestyle` etc. should be added (see PM spec Table §4 as reference).
