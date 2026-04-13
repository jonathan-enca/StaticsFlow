// Cloudflare R2 helper (S3-compatible API)
// Used to store generated ad creatives and inspiration templates

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID!;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID!;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY!;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME ?? "staticsflow-creatives";

// R2 endpoint follows the pattern: https://<accountId>.r2.cloudflarestorage.com
const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

/**
 * Upload a buffer or base64-encoded image to R2.
 * Returns the public URL of the uploaded object.
 */
export async function uploadToR2(
  key: string,
  body: Buffer | Uint8Array,
  contentType: string = "image/png"
): Promise<string> {
  await r2.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
      Body: body,
      ContentType: contentType,
    })
  );

  // Return public URL (requires the bucket to have public access enabled)
  const publicBase = process.env.R2_PUBLIC_URL ?? "";
  return `${publicBase}/${key}`;
}

/**
 * Generate a presigned URL for direct browser download (60-minute expiry).
 */
export async function getPresignedUrl(key: string): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
  });
  return getSignedUrl(r2, command, { expiresIn: 3600 });
}

/**
 * Delete an object from R2 (used when a creative is rejected/deleted).
 */
export async function deleteFromR2(key: string): Promise<void> {
  await r2.send(
    new DeleteObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
    })
  );
}

/**
 * Generate a storage key for a creative image.
 * Format: creatives/<userId>/<brandId>/<creativeId>.png
 */
export function creativeKey(
  userId: string,
  brandId: string,
  creativeId: string
): string {
  return `creatives/${userId}/${brandId}/${creativeId}.png`;
}

/**
 * Generate a storage key for an inspiration template.
 * Format: templates/<templateId>.jpg
 */
export function templateKey(templateId: string): string {
  return `templates/${templateId}.jpg`;
}

/**
 * Generate a storage key for a custom brand asset (packshot, studio, UGC…).
 * Format: brands/<userId>/<brandId>/assets/<assetId>.<ext>
 */
export function brandAssetKey(
  userId: string,
  brandId: string,
  assetId: string,
  ext: string
): string {
  return `brands/${userId}/${brandId}/assets/${assetId}.${ext}`;
}

/**
 * Generate a storage key for a brand logo.
 * Format: brands/<userId>/<brandId>/logo.<ext>
 */
export function brandLogoKey(userId: string, brandId: string, ext: string): string {
  return `brands/${userId}/${brandId}/logo.${ext}`;
}

/**
 * Generate a storage key for a product asset (images, icons, moodboard).
 * Format: brands/<userId>/<brandId>/products/<productId>/<category>/<assetId>.<ext>
 */
export function productAssetKey(
  userId: string,
  brandId: string,
  productId: string,
  category: "images" | "icons" | "moodboard",
  assetId: string,
  ext: string
): string {
  return `brands/${userId}/${brandId}/products/${productId}/${category}/${assetId}.${ext}`;
}

/**
 * Generate a storage key for a brand inspiration image.
 * Format: brands/<userId>/<brandId>/inspirations/<inspirationId>.<ext>
 */
export function inspirationKey(
  userId: string,
  brandId: string,
  inspirationId: string,
  ext: string
): string {
  return `brands/${userId}/${brandId}/inspirations/${inspirationId}.${ext}`;
}

/**
 * Generate a storage key for a brand inspiration thumbnail.
 * Format: brands/<userId>/<brandId>/inspirations/<inspirationId>_thumb.jpg
 */
export function inspirationThumbKey(
  userId: string,
  brandId: string,
  inspirationId: string
): string {
  return `brands/${userId}/${brandId}/inspirations/${inspirationId}_thumb.jpg`;
}
