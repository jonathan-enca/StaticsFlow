// Lightweight HTTP scraper for Brand DNA extraction
// Uses fetch (built-in) + cheerio (HTML parsing) — runs on Vercel serverless
// Replaced Puppeteer which requires Chromium and cannot run on Vercel
// Scrapes: homepage + up to 2 inner pages (about, product, shop)

import * as cheerio from "cheerio";

export interface ScrapedPage {
  url: string;
  title: string;
  description: string;
  bodyText: string;
  images: string[]; // absolute URLs
  colors: string[]; // extracted from inline styles / CSS
  fonts: string[]; // font-family values found
  logoUrl: string | null;
  links: string[]; // internal links to discover more pages
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
  // Normalize URL
  const baseUrl = url.startsWith("http") ? url : `https://${url}`;
  const origin = new URL(baseUrl).origin;

  const pages: ScrapedPage[] = [];

  // Always scrape homepage first
  const homepage = await scrapePage(baseUrl, origin);
  pages.push(homepage);

  // Find 1-2 inner pages worth scraping
  const innerLinks = homepage.links
    .filter((link) => {
      try {
        const path = new URL(link).pathname.toLowerCase();
        return PRIORITY_PATHS.some((p) => path === p || path.startsWith(p + "/") || path === p);
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

  // ── Body text (trimmed, max 3000 chars) ──────────────────
  // Remove scripts, styles, nav, footer for cleaner text
  $("script, style, noscript, nav, footer, [aria-hidden]").remove();
  const bodyText = $("body").text().replace(/\s+/g, " ").trim().slice(0, 3000);

  // ── Images ───────────────────────────────────────────────
  const imageSet = new Set<string>();
  $("img").each((_, el) => {
    const src =
      $(el).attr("src") ||
      $(el).attr("data-src") ||
      $(el).attr("data-lazy-src") ||
      $(el).attr("data-srcset")?.split(",")[0]?.trim().split(" ")[0];
    if (src) {
      try {
        const abs = src.startsWith("http") ? src : new URL(src, origin).href;
        if (!abs.includes("placeholder") && !abs.includes("blank.gif")) {
          imageSet.add(abs);
        }
      } catch {
        // skip malformed URLs
      }
    }
  });

  // ── Logo detection ────────────────────────────────────────
  let logoUrl: string | null = null;
  const logoEl = $(
    'img[alt*="logo" i], img[class*="logo" i], a[class*="logo" i] img, header img, .header img, nav img'
  ).first();
  if (logoEl.length) {
    const src = logoEl.attr("src") || logoEl.attr("data-src");
    if (src) {
      try {
        logoUrl = src.startsWith("http") ? src : new URL(src, origin).href;
      } catch {
        // ignore
      }
    }
  }

  // ── Colors from inline styles and <style> tags ──────────
  const colorSet = new Set<string>();
  const hexPattern = /#([0-9a-fA-F]{3,6})\b/g;
  const rgbPattern = /rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+[^)]*\)/g;

  // Extract from <style> blocks
  $("style").each((_, el) => {
    const cssText = $(el).text().slice(0, 50000);
    let match;
    while ((match = hexPattern.exec(cssText)) !== null) {
      colorSet.add("#" + match[1].toLowerCase());
    }
    hexPattern.lastIndex = 0;
    while ((match = rgbPattern.exec(cssText)) !== null) {
      colorSet.add(match[0]);
    }
    rgbPattern.lastIndex = 0;
  });

  // Extract from inline style attributes
  $("[style]").each((_, el) => {
    const style = $(el).attr("style") || "";
    let match;
    while ((match = hexPattern.exec(style)) !== null) {
      colorSet.add("#" + match[1].toLowerCase());
    }
    hexPattern.lastIndex = 0;
    while ((match = rgbPattern.exec(style)) !== null) {
      colorSet.add(match[0]);
    }
    rgbPattern.lastIndex = 0;
  });

  // ── Fonts from inline styles and <style> tags ─────────────
  const fontSet = new Set<string>();
  const fontPattern = /font-family\s*:\s*([^;}"']+)/gi;

  const allCssText =
    $("style")
      .map((_, el) => $(el).text())
      .get()
      .join(" ") +
    " " +
    $("[style]")
      .map((_, el) => $(el).attr("style") || "")
      .get()
      .join(" ");

  let fontMatch;
  while ((fontMatch = fontPattern.exec(allCssText)) !== null) {
    fontMatch[1]
      .split(",")
      .map((f) => f.trim().replace(/['"]/g, ""))
      .filter(
        (f) =>
          f &&
          !["sans-serif", "serif", "monospace", "inherit", "initial", "unset"].includes(
            f.toLowerCase()
          )
      )
      .forEach((f) => fontSet.add(f));
  }

  // ── Internal links ────────────────────────────────────────
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

  return {
    url,
    title,
    description,
    bodyText,
    images: [...imageSet].slice(0, 20),
    colors: [...colorSet].slice(0, 30),
    fonts: [...fontSet].slice(0, 10),
    logoUrl,
    links: [...linkSet].slice(0, 20),
  };
}
