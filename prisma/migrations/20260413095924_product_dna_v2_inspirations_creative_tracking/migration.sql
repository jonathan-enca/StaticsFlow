-- AlterTable
ALTER TABLE "Creative" ADD COLUMN     "generationMode" TEXT,
ADD COLUMN     "inspirationId" TEXT,
ADD COLUMN     "productId" TEXT;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "avoidForThisProduct" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "benefits" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "claims" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "currency" TEXT,
ADD COLUMN     "extractedAt" TIMESTAMP(3),
ADD COLUMN     "extractionStatus" TEXT NOT NULL DEFAULT 'pending',
ADD COLUMN     "icons" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "ingredients" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "isDefault" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lifestyleImages" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "packagingImages" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "price" TEXT,
ADD COLUMN     "productSpecificCTAs" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "productSpecificHooks" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "reviewsSummary" TEXT,
ADD COLUMN     "reviewsVerbatim" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "sourceUrl" TEXT,
ADD COLUMN     "specsJson" JSONB,
ADD COLUMN     "tagline" TEXT,
ADD COLUMN     "ugcImages" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "Inspiration" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "thumbnailUrl" TEXT,
    "imageHash" TEXT,
    "analysisJson" JSONB NOT NULL DEFAULT '{}',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "analyzedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Inspiration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Inspiration_brandId_idx" ON "Inspiration"("brandId");

-- AddForeignKey
ALTER TABLE "Creative" ADD CONSTRAINT "Creative_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Creative" ADD CONSTRAINT "Creative_inspirationId_fkey" FOREIGN KEY ("inspirationId") REFERENCES "Inspiration"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inspiration" ADD CONSTRAINT "Inspiration_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;
