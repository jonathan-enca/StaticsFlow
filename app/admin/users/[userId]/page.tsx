// /admin/users/[userId] — Admin view of a user's brands and activity.
// Server component. Auth enforced by parent /admin/layout.tsx.

import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";

interface PageProps {
  params: Promise<{ userId: string }>;
}

function fmtDate(d: Date | string) {
  return new Date(d).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

const PLAN_COLORS: Record<string, string> = {
  STARTER: "bg-gray-100 text-gray-700",
  PRO: "bg-blue-100 text-blue-700",
  AGENCY: "bg-violet-100 text-violet-700",
};

export default async function AdminUserPage({ params }: PageProps) {
  await requireAdmin();

  const { userId } = await params;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      image: true,
      plan: true,
      isAdmin: true,
      createdAt: true,
      stripeCustomerId: true,
      _count: { select: { brands: true, sessions: true } },
    },
  });

  if (!user) notFound();

  const brands = await prisma.brand.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    include: {
      _count: {
        select: { products: true, creatives: true, inspirations: true },
      },
    },
  });

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      {/* Breadcrumb */}
      <nav className="text-xs mb-6" style={{ color: "var(--sf-text-muted)" }}>
        <Link href="/admin/accounts" className="hover:opacity-80">
          ← Accounts
        </Link>
        <span className="mx-2">/</span>
        <span style={{ color: "var(--sf-text-primary)" }}>
          {user.name ?? user.email}
        </span>
      </nav>

      {/* User header */}
      <div
        className="rounded-xl p-6 mb-6 flex items-start gap-4"
        style={{
          background: "var(--sf-bg-secondary)",
          border: "1px solid var(--sf-border)",
        }}
      >
        {user.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={user.image}
            alt=""
            className="w-14 h-14 rounded-full object-cover flex-shrink-0"
          />
        ) : (
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center flex-shrink-0 text-xl font-bold"
            style={{
              background: "var(--sf-bg-elevated)",
              color: "var(--sf-text-secondary)",
            }}
          >
            {(user.name ?? user.email)[0].toUpperCase()}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1
              className="text-xl font-bold"
              style={{ color: "var(--sf-text-primary)" }}
            >
              {user.name ?? "—"}
            </h1>
            <span
              className={`text-xs px-2 py-0.5 rounded-full font-medium ${PLAN_COLORS[user.plan]}`}
            >
              {user.plan}
            </span>
            {user.isAdmin && (
              <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-indigo-100 text-indigo-700">
                Admin
              </span>
            )}
          </div>
          <div className="text-sm mt-1" style={{ color: "var(--sf-text-secondary)" }}>
            {user.email}
          </div>
          <div className="text-xs mt-2" style={{ color: "var(--sf-text-muted)" }}>
            Joined {fmtDate(user.createdAt)} · {user._count.brands} brand{user._count.brands !== 1 ? "s" : ""} · {user._count.sessions} active session{user._count.sessions !== 1 ? "s" : ""}
          </div>
        </div>
      </div>

      {/* Brands list */}
      <h2
        className="text-base font-semibold mb-3"
        style={{ color: "var(--sf-text-primary)" }}
      >
        Brands ({brands.length})
      </h2>

      {brands.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--sf-text-muted)" }}>
          No brands yet.
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {brands.map((brand) => (
            <Link
              key={brand.id}
              href={`/admin/users/${userId}/brands/${brand.id}`}
              className="block rounded-xl p-5 transition-opacity hover:opacity-80"
              style={{
                background: "var(--sf-bg-secondary)",
                border: "1px solid var(--sf-border)",
              }}
            >
              <div
                className="font-semibold text-sm"
                style={{ color: "var(--sf-text-primary)" }}
              >
                {brand.name}
              </div>
              <div
                className="text-xs mt-0.5 truncate"
                style={{ color: "var(--sf-text-muted)" }}
              >
                {brand.url}
              </div>
              <div
                className="flex gap-4 mt-3 text-xs"
                style={{ color: "var(--sf-text-secondary)" }}
              >
                <span>{brand._count.creatives} creative{brand._count.creatives !== 1 ? "s" : ""}</span>
                <span>{brand._count.products} product{brand._count.products !== 1 ? "s" : ""}</span>
                <span>{brand._count.inspirations} inspiration{brand._count.inspirations !== 1 ? "s" : ""}</span>
              </div>
              <div
                className="text-xs mt-2"
                style={{ color: "var(--sf-text-muted)" }}
              >
                Updated {fmtDate(brand.updatedAt)}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
