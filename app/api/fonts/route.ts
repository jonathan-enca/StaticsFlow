// GET /api/fonts
// Returns a curated list of common web fonts for the font picker UI.
// No auth required (public static data).
// Dev4 uses this to build the font selector component.

import { NextResponse } from "next/server";

export interface FontEntry {
  name: string;      // Display name, e.g. "Inter"
  family: string;    // CSS font-family value, e.g. "Inter, sans-serif"
  category: "sans-serif" | "serif" | "monospace" | "display" | "handwriting";
  googleFonts: boolean; // True if available on Google Fonts
}

const FONTS: FontEntry[] = [
  // Sans-serif
  { name: "Inter",           family: "Inter, sans-serif",           category: "sans-serif",  googleFonts: true  },
  { name: "Roboto",          family: "Roboto, sans-serif",          category: "sans-serif",  googleFonts: true  },
  { name: "Open Sans",       family: "Open Sans, sans-serif",       category: "sans-serif",  googleFonts: true  },
  { name: "Lato",            family: "Lato, sans-serif",            category: "sans-serif",  googleFonts: true  },
  { name: "Poppins",         family: "Poppins, sans-serif",         category: "sans-serif",  googleFonts: true  },
  { name: "Nunito",          family: "Nunito, sans-serif",          category: "sans-serif",  googleFonts: true  },
  { name: "Montserrat",      family: "Montserrat, sans-serif",      category: "sans-serif",  googleFonts: true  },
  { name: "Raleway",         family: "Raleway, sans-serif",         category: "sans-serif",  googleFonts: true  },
  { name: "Source Sans 3",   family: "Source Sans 3, sans-serif",   category: "sans-serif",  googleFonts: true  },
  { name: "DM Sans",         family: "DM Sans, sans-serif",         category: "sans-serif",  googleFonts: true  },
  { name: "Manrope",         family: "Manrope, sans-serif",         category: "sans-serif",  googleFonts: true  },
  { name: "Plus Jakarta Sans", family: "Plus Jakarta Sans, sans-serif", category: "sans-serif", googleFonts: true },
  { name: "Outfit",          family: "Outfit, sans-serif",          category: "sans-serif",  googleFonts: true  },
  { name: "Figtree",         family: "Figtree, sans-serif",         category: "sans-serif",  googleFonts: true  },
  { name: "Noto Sans",       family: "Noto Sans, sans-serif",       category: "sans-serif",  googleFonts: true  },
  { name: "Helvetica Neue",  family: "Helvetica Neue, Helvetica, sans-serif", category: "sans-serif", googleFonts: false },
  { name: "Arial",           family: "Arial, sans-serif",           category: "sans-serif",  googleFonts: false },
  { name: "SF Pro",          family: "-apple-system, SF Pro Display, sans-serif", category: "sans-serif", googleFonts: false },

  // Serif
  { name: "Playfair Display", family: "Playfair Display, serif",    category: "serif",       googleFonts: true  },
  { name: "Merriweather",    family: "Merriweather, serif",         category: "serif",       googleFonts: true  },
  { name: "Lora",            family: "Lora, serif",                 category: "serif",       googleFonts: true  },
  { name: "EB Garamond",     family: "EB Garamond, serif",          category: "serif",       googleFonts: true  },
  { name: "Cormorant Garamond", family: "Cormorant Garamond, serif", category: "serif",      googleFonts: true  },
  { name: "Libre Baskerville", family: "Libre Baskerville, serif",  category: "serif",       googleFonts: true  },
  { name: "Georgia",         family: "Georgia, serif",              category: "serif",       googleFonts: false },
  { name: "Times New Roman", family: "Times New Roman, serif",      category: "serif",       googleFonts: false },

  // Display / Brand
  { name: "Bebas Neue",      family: "Bebas Neue, sans-serif",      category: "display",     googleFonts: true  },
  { name: "Oswald",          family: "Oswald, sans-serif",          category: "display",     googleFonts: true  },
  { name: "Anton",           family: "Anton, sans-serif",           category: "display",     googleFonts: true  },
  { name: "Barlow Condensed", family: "Barlow Condensed, sans-serif", category: "display",   googleFonts: true  },
  { name: "Exo 2",           family: "Exo 2, sans-serif",           category: "display",     googleFonts: true  },
  { name: "Orbitron",        family: "Orbitron, sans-serif",        category: "display",     googleFonts: true  },
  { name: "Righteous",       family: "Righteous, sans-serif",       category: "display",     googleFonts: true  },
  { name: "Abril Fatface",   family: "Abril Fatface, serif",        category: "display",     googleFonts: true  },

  // Monospace
  { name: "JetBrains Mono",  family: "JetBrains Mono, monospace",   category: "monospace",   googleFonts: true  },
  { name: "Fira Code",       family: "Fira Code, monospace",        category: "monospace",   googleFonts: true  },
  { name: "Source Code Pro", family: "Source Code Pro, monospace",  category: "monospace",   googleFonts: true  },
  { name: "Space Mono",      family: "Space Mono, monospace",       category: "monospace",   googleFonts: true  },

  // Handwriting / Script
  { name: "Pacifico",        family: "Pacifico, cursive",           category: "handwriting", googleFonts: true  },
  { name: "Dancing Script",  family: "Dancing Script, cursive",     category: "handwriting", googleFonts: true  },
  { name: "Great Vibes",     family: "Great Vibes, cursive",        category: "handwriting", googleFonts: true  },
  { name: "Satisfy",         family: "Satisfy, cursive",            category: "handwriting", googleFonts: true  },
  { name: "Caveat",          family: "Caveat, cursive",             category: "handwriting", googleFonts: true  },
];

export async function GET() {
  return NextResponse.json(
    { fonts: FONTS, total: FONTS.length },
    {
      headers: {
        // Cache for 24h — this list changes rarely
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=3600",
      },
    }
  );
}
