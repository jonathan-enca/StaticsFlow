-- AlterTable
ALTER TABLE "Template" ADD COLUMN     "analyzedAt" TIMESTAMP(3),
ADD COLUMN     "layout" TEXT NOT NULL DEFAULT 'other',
ADD COLUMN     "thumbnailUrl" TEXT,
ADD COLUMN     "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN "hookType" SET DEFAULT 'benefice_direct';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "isAdmin" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "Template_language_idx" ON "Template"("language");
