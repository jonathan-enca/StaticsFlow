// Puppeteer scraper for Brand DNA extraction
// Scrapes: homepage + up to 2 inner pages (about, product)
// Returns raw content for Claude to analyze
// NOTE: Must run on Railway (Node.js) — not Vercel Edge

import puppeteer from "puppeteer";

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

/**
 * Scrape a website URL and return structured content for Brand DNA analysis.
 * Visits the homepage and up to 2 inner pages that may contain brand information.
 */
export async function scrapeWebsite(url: string): Promise<ScrapeResult> {
  // Normalize URL
  const baseUrl = url.startsWith("http") ? url : `https://${url}`;
  const origin = new URL(baseUrl).origin;

  const browser = await puppeteer.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
    ],
  });

  const pages: ScrapedPage[] = [];

  try {
    // Always scrape homepage first
    const homepage = await scrapePage(browser, baseUrl, origin);
    pages.push(homepage);

    // Find 1-2 inner pages worth scraping
    const innerLinks = homepage.links
      .filter((link) => {
        const path = new URL(link).pathname.toLowerCase();
        return PRIORITY_PATHS.some((p) => path === p || path.startsWith(p));
      })
      .slice(0, 2);

    for (const link of innerLinks) {
      try {
        const page = await scrapePage(browser, link, origin);
        pages.push(page);
      } catch {
        // Non-fatal — skip pages that fail to load
      }
    }
  } finally {
    await browser.close();
  }

  return { baseUrl: origin, pages, scrapedAt: new Date().toISOString() };
}

async function scrapePage(
  browser: Awaited<ReturnType<typeof puppeteer.launch>>,
  url: string,
  origin: string
): Promise<ScrapedPage> {
  const page = await browser.newPage();

  // Realistic viewport and user-agent to avoid bot detection
  await page.setViewport({ width: 1440, height: 900 });
  await page.setUserAgent(
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
  );

  await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });

  const result = await page.evaluate((pageOrigin: string) => {
    // ── Body text (trimmed, max 3000 chars) ──────────────────
    const bodyText = (document.body?.innerText ?? "").slice(0, 3000);

    // ── Meta description ──────────────────────────────────────
    const description =
      document
        .querySelector('meta[name="description"]')
        ?.getAttribute("content") ?? "";

    // ── Images ───────────────────────────────────────────────
    const images: string[] = [];
    document.querySelectorAll("img").forEach((img) => {
      const src = img.src;
      if (src && src.startsWith("http") && !src.includes("placeholder")) {
        images.push(src);
      }
    });

    // ── Logo detection ────────────────────────────────────────
    const logoEl = document.querySelector(
      'img[alt*="logo" i], img[class*="logo" i], a[class*="logo" i] img, header img, .header img, nav img'
    ) as HTMLImageElement | null;
    const logoUrl = logoEl?.src ?? null;

    // ── Colors from inline styles and computed styles ─────────
    const colorSet = new Set<string>();
    const hexPattern = /#([0-9a-f]{3,6})\b/gi;
    const rgbPattern = /rgb\(\s*(\d+),\s*(\d+),\s*(\d+)\s*\)/g;

    // Check CSS custom properties on :root
    const rootStyles = getComputedStyle(document.documentElement);
    const cssText = Array.from(document.styleSheets)
      .flatMap((sheet) => {
        try {
          return Array.from(sheet.cssRules).map((r) => r.cssText);
        } catch {
          return [];
        }
      })
      .join(" ")
      .slice(0, 50000);

    let match;
    while ((match = hexPattern.exec(cssText)) !== null) {
      colorSet.add("#" + match[1].toLowerCase());
    }
    // Also check inline styles of key elements
    [
      "button",
      "a",
      ".btn",
      ".button",
      "header",
      "nav",
      ".hero",
      ".banner",
    ].forEach((sel) => {
      document.querySelectorAll(sel).forEach((el) => {
        const s = getComputedStyle(el as Element);
        [s.backgroundColor, s.color, s.borderColor].forEach((c) => {
          const m = c.match(rgbPattern);
          if (m) colorSet.add(c);
        });
      });
    });
    void rootStyles; // satisfy TS

    // ── Fonts ─────────────────────────────────────────────────
    const fontSet = new Set<string>();
    document.querySelectorAll("*").forEach((el) => {
      const ff = getComputedStyle(el as Element).fontFamily;
      if (ff) {
        ff.split(",").forEach((f) => {
          const clean = f.trim().replace(/['"]/g, "");
          if (clean && !["sans-serif", "serif", "monospace", "inherit", "initial"].includes(clean)) {
            fontSet.add(clean);
          }
        });
      }
    });

    // ── Internal links ────────────────────────────────────────
    const links: string[] = [];
    document.querySelectorAll("a[href]").forEach((a) => {
      const href = (a as HTMLAnchorElement).href;
      if (href.startsWith(pageOrigin) && href !== pageOrigin + "/") {
        links.push(href);
      }
    });

    return {
      title: document.title,
      description,
      bodyText,
      images: [...new Set(images)].slice(0, 20),
      colors: [...colorSet].slice(0, 30),
      fonts: [...fontSet].slice(0, 10),
      logoUrl,
      links: [...new Set(links)].slice(0, 20),
    };
  }, origin);

  await page.close();

  return { url, ...result };
}
