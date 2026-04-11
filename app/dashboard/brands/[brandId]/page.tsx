// Brand DNA enrichment page — server component
// Route: /dashboard/brands/[brandId]
// Loads the brand from DB, then renders the enrichment client.

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect, notFound } from "next/navigation";
import BrandDnaClient from "./BrandDnaClient";
import type { ExtractedBrandDNA } from "@/lib/brand-dna-extractor";

interface PageProps {
  params: Promise<{ brandId: string }>;
}

export default async function BrandDnaPage({ params }: PageProps) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { brandId } = await params;

  const brand = await prisma.brand.findFirst({
    where: { id: brandId, userId: session.user.id },
  });

  if (!brand) notFound();

  const dna = (brand.brandDnaJson ?? {}) as unknown as ExtractedBrandDNA;

  // Ensure required arrays exist (backward compat with Phase 1 records)
  const safeDna: ExtractedBrandDNA = {
    name: dna.name ?? brand.name,
    url: dna.url ?? brand.url,
    colors: dna.colors ?? { primary: "#000000", secondary: "#ffffff", accent: "#000000" },
    fonts: dna.fonts ?? [],
    logoUrl: dna.logoUrl ?? null,
    productImages: dna.productImages ?? [],
    lifestyleImages: dna.lifestyleImages ?? [],
    toneOfVoice: dna.toneOfVoice ?? "",
    language: dna.language ?? "en",
    keyBenefits: dna.keyBenefits ?? [],
    personas: dna.personas ?? [],
    brandVoice: dna.brandVoice ?? "",
    forbiddenWords: dna.forbiddenWords ?? [],
    productCategory: dna.productCategory ?? "other",
    // Enrichment fields
    reviewsUrl: dna.reviewsUrl,
    customerVocabulary: dna.customerVocabulary,
    requiredWording: dna.requiredWording ?? [],
    customAssets: dna.customAssets ?? [],
    brandBrief: dna.brandBrief ?? "",
    structuredPersonas: dna.structuredPersonas ?? [],
    communicationAngles: dna.communicationAngles,
  };

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Navbar */}
      <nav className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-black flex items-center justify-center">
            <span className="text-white font-bold text-sm">S</span>
          </div>
          <span className="text-lg font-bold text-gray-900">StaticsFlow</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-500">{session.user?.email}</span>
          <form action="/api/auth/signout" method="post">
            <button
              type="submit"
              className="text-sm text-gray-600 hover:text-gray-900 font-medium"
            >
              Sign out
            </button>
          </form>
        </div>
      </nav>

      <BrandDnaClient
        brandId={brand.id}
        initialDna={safeDna}
        brandName={brand.name}
      />
    </main>
  );
}
