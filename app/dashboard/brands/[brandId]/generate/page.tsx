// Creative generation page — server component wrapper
// Route: /dashboard/brands/[brandId]/generate

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect, notFound } from "next/navigation";
import GenerateClient from "./GenerateClient";

interface PageProps {
  params: Promise<{ brandId: string }>;
}

export default async function GeneratePage({ params }: PageProps) {
  let session;
  try {
    session = await auth();
  } catch {
    redirect("/login");
  }
  if (!session?.user?.id) redirect("/login");

  const { brandId } = await params;

  const brand = await prisma.brand.findFirst({
    where: { id: brandId, userId: session.user.id },
    include: {
      creatives: {
        orderBy: { createdAt: "desc" },
        take: 20,
      },
    },
  });

  if (!brand) notFound();

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

      <GenerateClient
        brandId={brand.id}
        brandName={brand.name}
        existingCreatives={brand.creatives.map((c) => ({
          id: c.id,
          imageUrl: c.imageUrl,
          status: c.status,
          score: c.score,
          format: c.format,
          angle: c.angle,
          createdAt: c.createdAt.toISOString(),
        }))}
      />
    </main>
  );
}
