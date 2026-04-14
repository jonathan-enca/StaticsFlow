-- AlterTable
ALTER TABLE "Inspiration" ADD COLUMN     "productId" TEXT;

-- CreateIndex
CREATE INDEX "Inspiration_productId_idx" ON "Inspiration"("productId");

-- AddForeignKey
ALTER TABLE "Inspiration" ADD CONSTRAINT "Inspiration_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
