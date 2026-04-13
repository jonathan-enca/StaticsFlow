// Lightweight HTTP scraper for Brand DNA extraction
// Uses fetch (built-in) + cheerio (HTML parsing) — runs on Vercel serverless
// Replaced Puppeteer which requires Chromium and cannot run on Vercel
// Scrapes: homepage + up to 2 inner pages (about, product, shop)
// Enhanced (STA-63): og:image, srcset, background-image, icons, Trustpilot

import * as cheerio from "cheerio";

export interface TrustpilotData {
  businessUnitId?: string;
  score?: number; // e.g. 4.5
  reviewCount?: number;
  stars?: number; // 1–5
  verbatims: string[]; // extracted review snippets
}

export interface ScrapedPage {
  url: string;
  title: string;
  description: string;
  bodyText: string;
  images: string[]; // absolute URLs
  icons: string[]; // favicon / icon asset URLs
  colors: string[]; // extracted from inline styles / CSS
  fonts: string[]; // font-family values found
  logoUrl: string | null;
  trustpilot: TrustpilotData | null;
  links: string[]; // internal links to discover more pages
  backgroundColors: string[]; // dominant background-color values (hex), sorted by frequency/weight
}

export interface ScrapeResult {
  baseUrl: string;
  pages: ScrapedPage[];
  scrapedAt: string;
}

const PRIORITY_PATHS = ["/", "/about", "/about-us", "/products", "/shop", "/collection"];

const FETCH_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.5",
};

/**
 * Scrape a website URL and return structured content for Brand DNA analysis.
 * Visits the homepage and up to 2 inner pages that may contain brand information.
 */
export async function scrapeWebsite(url: string): Promise<ScrapeResult> {
  const baseUrl = url.startsWith("http") ? url : `https://${url}`;
  const origin = new URL(baseUrl).origin;

  const pages: ScrapedPage[] = [];

  const homepage = await scrapePage(baseUrl, origin);
  pages.push(homepage);

  const innerLinks = homepage.links
    .filter((link) => {
      try {
        const path = new URL(link).pathname.toLowerCase();
        return PRIORITY_PATHS.some((p) => path === p || path.startsWith(p + "/"));
      } catch {
        return false;
      }
    })
    .filter((link) => link !== baseUrl && link !== origin && link !== origin + "/")
    .slice(0, 2);

  for (const link of innerLinks) {
    try {
      const page = await scrapePage(link, origin);
      pages.push(page);
    } catch {
      // Non-fatal — skip pages that fail to load
    }
  }

  return { baseUrl: origin, pages, scrapedAt: new Date().toISOString() };
}

// ── Trustpilot helpers ──────────────────────────────────────────────────────

/**
 * Detect Trustpilot TrustBox widget embedded in the page HTML.
 */
function extractEmbeddedTrustpilot($: cheerio.CheerioAPI): TrustpilotData | null {
  const widget = $('[class*="trustpilot-widget"], [data-businessunit-id]').first();
  if (!widget.length) return null;

  const businessUnitId = widget.attr("data-businessunit-id") ?? undefined;
  const stars = widget.attr("data-stars");
  const reviewCount = widget.attr("data-review-count");
  const score = widget.attr("data-score") ?? widget.attr("data-trust-score");

  if (!businessUnitId && !stars && !score) return null;

  return {
    businessUnitId,
    score: score ? parseFloat(score) : undefined,
    reviewCount: reviewCount ? parseInt(reviewCount, 10) : undefined,
    stars: stars ? parseFloat(stars) : undefined,
    verbatims: [],
  };
}

/**
 * Fetch Trustpilot aggregate data + recent review snippets for a domain.
 * Uses Trustpilot's consumer-facing read API (no auth required for public data).
 */
async function fetchTrustpilotApi(domain: string): Promise<TrustpilotData | null> {
  try {
    const searchUrl =
      `https://www.trustpilot.com/api/categoriespages/business-units/find?hostname=${encodeURIComponent(domain)}`;
    const res = await fetch(searchUrl, {
      headers: { ...FETCH_HEADERS, Accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: Record<string, any> = await res.json();
    const businessUnitId: string | undefined = data?.id ?? data?.businessUnitId;
    const score: number | undefined =
      typeof data?.score?.trustScore === "number" ? data.score.trustScore : undefined;
    const reviewCount: number | undefined =
      typeof data?.numberOfReviews?.total === "number" ? data.numberOfReviews.total : undefined;

    const verbatims: string[] = [];
    if (businessUnitId) {
      try {
        const reviewsRes = await fetch(
          `https://www.trustpilot.com/api/categoriespages/business-units/${businessUnitId}/reviews?perPage=5&orderBy=recency`,
          {
            headers: { ...FETCH_HEADERS, Accept: "application/json" },
            signal: AbortSignal.timeout(8000),
          }
        );
        if (reviewsRes.ok) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const reviewData: Record<string, any> = await reviewsRes.json();
          const reviews: unknown[] = reviewData?.reviews ?? reviewData?.data ?? [];
          for (const r of reviews.slice(0, 5)) {
            const rec = r as Record<string, unknown>;
            const text = (rec?.text ?? rec?.content ?? (rec?.attributes as Record<string, unknown>)?.text) as string | undefined;
            if (text && typeof text === "string") {
              verbatims.push(text.trim().slice(0, 300));
            }
          }
        }
      } catch {
        // non-fatal — reviews are optional
      }
    }

    if (!businessUnitId && score === undefined && reviewCount === undefined) return null;
    return { businessUnitId, score, reviewCount, verbatims };
  } catch {
    return null;
  }
}

// ── Background color extraction ─────────────────────────────────────────────

/**
 * Convert a raw CSS color value to a 6-digit lowercase hex string.
 * Returns null for transparent, gradients, url(), or unknown formats.
 */
function cssColorToHex(value: string): string | null {
  value = value.trim().split("!")[0].trim(); // strip !important
  if (!value || value === "transparent" || value === "inherit" || value === "initial" || value === "currentcolor" || value.includes("url(") || value.includes("gradient(")) return null;

  const NAMED: Record<string, string> = {
    white: "#ffffff", black: "#000000", red: "#ff0000", blue: "#0000ff",
    green: "#008000", gray: "#808080", grey: "#808080",
    ivory: "#fffff0", snow: "#fffafa", beige: "#f5f5dc",
    ghostwhite: "#f8f8ff", aliceblue: "#f0f8ff", lavender: "#e6e6fa",
    linen: "#faf0e6", seashell: "#fff5ee", mintcream: "#f5fffa",
    "light gray": "#d3d3d3", "light grey": "#d3d3d3", lightgray: "#d3d3d3",
    lightgrey: "#d3d3d3", whitesmoke: "#f5f5f5", floralwhite: "#fffaf0",
  };
  const named = NAMED[value.toLowerCase()];
  if (named) return named;

  const shortHex = value.match(/^#([0-9a-fA-F])([0-9a-fA-F])([0-9a-fA-F])$/);
  if (shortHex) return `#${shortHex[1]}${shortHex[1]}${shortHex[2]}${shortHex[2]}${shortHex[3]}${shortHex[3]}`.toLowerCase();

  const fullHex = value.match(/^#([0-9a-fA-F]{6})/);
  if (fullHex) return `#${fullHex[1]}`.toLowerCase();

  const rgbMatch = value.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (rgbMatch) {
    const r = parseInt(rgbMatch[1]).toString(16).padStart(2, "0");
    const g = parseInt(rgbMatch[2]).toString(16).padStart(2, "0");
    const b = parseInt(rgbMatch[3]).toString(16).padStart(2, "0");
    return `#${r}${g}${b}`;
  }
  return null;
}

/**
 * Extract background-color values from the page, weighted by element semantics.
 * Hero sections, body, and main get higher weights than generic divs.
 * Returns up to 5 hex colors sorted by weight descending.
 */
function extractBackgroundColors($: cheerio.CheerioAPI): string[] {
  const colorWeights = new Map<string, number>();

  const addColor = (rawValue: string, weight: number) => {
    const hex = cssColorToHex(rawValue);
    if (hex && hex !== "#000000") {
      colorWeights.set(hex, (colorWeights.get(hex) ?? 0) + weight);
    }
  };

  // From inline styles — weight by element type and class hints
  $("[style]").each((_, el) => {
    const e = $(el);
    const style = e.attr("style") || "";
    const bgMatch = style.match(/background-color\s*:\s*([^;]+)/i);
    if (!bgMatch) return;
    const tagName = ((el as { tagName?: string }).tagName ?? "").toLowerCase();
    const cls = (e.attr("class") || "").toLowerCase();
    const id = (e.attr("id") || "").toLowerCase();
    let weight = 1;
    if (tagName === "body" || tagName === "html") weight = 20;
    else if (tagName === "main") weight = 15;
    else if (["section", "article", "header"].includes(tagName)) weight = 8;
    else if (cls.includes("hero") || cls.includes("banner") || cls.includes("masthead") || id.includes("hero")) weight = 12;
    else if (cls.includes("product") || cls.includes("feature") || cls.includes("showcase")) weight = 7;
    addColor(bgMatch[1].trim(), weight);
  });

  // From <style> blocks — parse flat CSS rules for background-color
  $("style").each((_, el) => {
    const cssText = $(el).text();
    const rulePattern = /([^{}]+)\{([^{}]+)\}/g;
    let ruleMatch;
    while ((ruleMatch = rulePattern.exec(cssText)) !== null) {
      const selector = ruleMatch[1].trim().toLowerCase();
      const declarations = ruleMatch[2];
      const bgMatch = declarations.match(/background-color\s*:\s*([^;!"']+)/i);
      if (!bgMatch) continue;
      let weight = 1;
      if (selector === "body" || selector === "html" || selector === "body, html" || selector === ":root" || selector === "html, body") weight = 20;
      else if (selector === "main" || selector === "#main" || selector === "#app" || selector === "#root") weight = 15;
      else if (/\bsection\b/.test(selector) || /\barticle\b/.test(selector)) weight = 5;
      else if (selector.includes("hero") || selector.includes("banner") || selector.includes("masthead")) weight = 12;
      else if (selector.includes("product") || selector.includes("feature") || selector.includes("showcase")) weight = 6;
      addColor(bgMatch[1].trim(), weight);
    }
  });

  return [...colorWeights.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([color]) => color)
    .slice(0, 5);
}

// ── Main page scraper ───────────────────────────────────────────────────────

async function scrapePage(url: string, origin: string): Promise<ScrapedPage> {
  const res = await fetch(url, {
    headers: FETCH_HEADERS,
    redirect: "follow",
    signal: AbortSignal.timeout(20000),
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status} fetching ${url}`);
  }

  const html = await res.text();
  const $ = cheerio.load(html);

  // ── Title ──────────────────────────────────────────────────
  const title = $("title").first().text().trim() || "";

  // ── Meta description ───────────────────────────────────────
  const description =
    $('meta[name="description"]').attr("content") ||
    $('meta[property="og:description"]').attr("content") ||
    "";

  // ── Body text ─────────────────────────────────────────────
  $("script, style, noscript, nav, footer, [aria-hidden]").remove();
  const bodyText = $("body").text().replace(/\s+/g, " ").trim().slice(0, 3000);

  // ── Helper: make absolute URL ──────────────────────────────
  const toAbs = (src: string): string | null => {
    if (!src || src.startsWith("data:")) return null;
    try {
      return src.startsWith("http") ? src : new URL(src, origin).href;
    } catch {
      return null;
    }
  };

  // ── Helper: best src from an element's attributes ─────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const getBestSrc = (el: any): string | null => {
    const e = $(el);
    const candidates = [
      e.attr("src"),
      e.attr("data-src"),
      e.attr("data-lazy-src"),
      e.attr("data-original"),
      e.attr("data-srcset")?.split(",")[0]?.trim().split(" ")[0],
      e.attr("srcset")?.split(",")[0]?.trim().split(" ")[0],
    ];
    for (const c of candidates) {
      if (c) {
        const abs = toAbs(c);
        if (abs && !abs.includes("placeholder") && !abs.includes("blank.gif")) return abs;
      }
    }
    return null;
  };

  // ── Images ─────────────────────────────────────────────────
  const imageSet = new Set<string>();

  // og:image / twitter:image — highest priority
  const ogImage =
    $('meta[property="og:image"]').attr("content") ||
    $('meta[name="twitter:image"]').attr("content");
  if (ogImage) {
    const abs = toAbs(ogImage);
    if (abs) imageSet.add(abs);
  }

  // All <img> tags (including lazy-loaded variants)
  $("img").each((_, el) => {
    const src = getBestSrc(el);
    if (src) imageSet.add(src);
  });

  // <picture><source srcset="…"> tags
  $("source[srcset]").each((_, el) => {
    const first = ($(el).attr("srcset") || "").split(",")[0]?.trim().split(" ")[0];
    if (first) {
      const abs = toAbs(first);
      if (abs) imageSet.add(abs);
    }
  });

  // CSS background-image in inline styles (product hero images, banners)
  $("[style]").each((_, el) => {
    const style = $(el).attr("style") || "";
    const match = style.match(/url\(['"]?([^'")\s]+)['"]?\)/);
    if (match?.[1]) {
      const abs = toAbs(match[1]);
      if (abs) imageSet.add(abs);
    }
  });

  // ── Logo detection ─────────────────────────────────────────
  let logoUrl: string | null = null;
  const logoEl = $(
    'img[alt*="logo" i], img[class*="logo" i], a[class*="logo" i] img, [id*="logo" i] img, header img, .header img, nav img'
  ).first();
  if (logoEl.length) {
    const src = getBestSrc(logoEl[0]);
    if (src) logoUrl = src;
  }

  // ── Icons ──────────────────────────────────────────────────
  const iconSet = new Set<string>();

  // Favicon / touch icons from <link> tags
  $('link[rel*="icon"], link[rel="apple-touch-icon"], link[rel="shortcut icon"]').each((_, el) => {
    const href = $(el).attr("href");
    if (href) {
      const abs = toAbs(href);
      if (abs) iconSet.add(abs);
    }
  });

  // SVG sprite file references from <use> elements
  $("use").each((_, el) => {
    const href = $(el).attr("href") || $(el).attr("xlink:href") || "";
    const filePart = href.split("#")[0];
    if (filePart) {
      const abs = toAbs(filePart);
      if (abs) iconSet.add(abs);
    }
  });

  // Small images that are clearly icons (size ≤ 64 or class/alt contains "icon")
  $("img").each((_, el) => {
    const w = parseInt($(el).attr("width") || "0", 10);
    const h = parseInt($(el).attr("height") || "0", 10);
    const cls = ($(el).attr("class") || "").toLowerCase();
    const alt = ($(el).attr("alt") || "").toLowerCase();
    if (
      (w > 0 && w <= 64 && h > 0 && h <= 64) ||
      cls.includes("icon") ||
      alt.includes("icon")
    ) {
      const src = getBestSrc(el);
      if (src) iconSet.add(src);
    }
  });

  // ── Trustpilot ─────────────────────────────────────────────
  let trustpilot: TrustpilotData | null = extractEmbeddedTrustpilot($);
  if (!trustpilot) {
    try {
      const hostname = new URL(url).hostname.replace(/^www\./, "");
      trustpilot = await fetchTrustpilotApi(hostname);
    } catch {
      // non-fatal
    }
  }

  // ── Colors ─────────────────────────────────────────────────
  const colorSet = new Set<string>();
  const hexPattern = /#([0-9a-fA-F]{3,6})\b/g;
  const rgbPattern = /rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+[^)]*\)/g;

  $("style").each((_, el) => {
    const cssText = $(el).text().slice(0, 50000);
    let match;
    while ((match = hexPattern.exec(cssText)) !== null) colorSet.add("#" + match[1].toLowerCase());
    hexPattern.lastIndex = 0;
    while ((match = rgbPattern.exec(cssText)) !== null) colorSet.add(match[0]);
    rgbPattern.lastIndex = 0;
  });

  $("[style]").each((_, el) => {
    const style = $(el).attr("style") || "";
    let match;
    while ((match = hexPattern.exec(style)) !== null) colorSet.add("#" + match[1].toLowerCase());
    hexPattern.lastIndex = 0;
    while ((match = rgbPattern.exec(style)) !== null) colorSet.add(match[0]);
    rgbPattern.lastIndex = 0;
  });

  // ── Fonts ───────────────────────────────────────────────────
  const fontSet = new Set<string>();
  const GENERIC_FAMILIES = new Set([
    "sans-serif", "serif", "monospace", "inherit", "initial", "unset",
    "cursive", "fantasy", "system-ui", "ui-sans-serif", "ui-serif",
    "ui-monospace", "ui-rounded",
  ]);

  // 1) Extract font-family declarations from <style> blocks and inline styles
  const fontPattern = /font-family\s*:\s*([^;}"']+)/gi;
  const allCssText =
    $("style").map((_, el) => $(el).text()).get().join(" ") +
    " " +
    $("[style]").map((_, el) => $(el).attr("style") || "").get().join(" ");

  let fontMatch;
  while ((fontMatch = fontPattern.exec(allCssText)) !== null) {
    fontMatch[1]
      .split(",")
      .map((f) => f.trim().replace(/['"]/g, ""))
      .filter((f) => f && !GENERIC_FAMILIES.has(f.toLowerCase()))
      .forEach((f) => fontSet.add(f));
  }

  // 2) Detect Google Fonts / Adobe Typekit loaded via <link href="...fonts.googleapis.com...">
  //    URL looks like: https://fonts.googleapis.com/css2?family=Inter:wght@400;700&family=Playfair+Display
  $('link[href*="fonts.googleapis.com"], link[href*="fonts.adobe.com"], link[href*="use.typekit"]').each((_, el) => {
    const href = $(el).attr("href") ?? "";
    // Extract family= params from Google Fonts URL
    const familyMatches = href.matchAll(/[?&]family=([^&]+)/g);
    for (const m of familyMatches) {
      // Each value may be "Inter:wght@400;700" — take only the name part before ":"
      m[1].split("|").forEach((segment) => {
        const name = decodeURIComponent(segment.split(":")[0]).replace(/\+/g, " ").trim();
        if (name && !GENERIC_FAMILIES.has(name.toLowerCase())) {
          fontSet.add(name);
        }
      });
    }
  });

  // ── Internal links ─────────────────────────────────────────
  const linkSet = new Set<string>();
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href") || "";
    try {
      const abs = href.startsWith("http") ? href : new URL(href, origin).href;
      if (abs.startsWith(origin) && abs !== origin + "/" && abs !== origin) {
        linkSet.add(abs);
      }
    } catch {
      // ignore malformed URLs
    }
  });

  const backgroundColors = extractBackgroundColors($);

  return {
    url,
    title,
    description,
    bodyText,
    images: [...imageSet].slice(0, 50),
    icons: [...iconSet].slice(0, 20),
    colors: [...colorSet].slice(0, 30),
    fonts: [...fontSet].slice(0, 10),
    logoUrl,
    trustpilot,
    links: [...linkSet].slice(0, 20),
    backgroundColors,
  };
}
