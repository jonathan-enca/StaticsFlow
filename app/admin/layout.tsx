// Admin layout — only accessible to users with isAdmin=true
// All child routes are protected by requireAdmin()

import { requireAdmin } from "@/lib/admin";
import Link from "next/link";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Redirects to /login or /dashboard if not admin
  await requireAdmin();

  return (
    <div className="min-h-screen" style={{ background: "var(--sf-bg-primary)" }}>
      {/* Admin navbar */}
      <nav
        style={{
          background: "var(--sf-bg-secondary)",
          borderBottom: "1px solid var(--sf-border)",
          color: "var(--sf-text-primary)",
        }}
        className="px-6 py-3 flex items-center gap-6 text-sm"
      >
        <Link
          href="/admin/bdd"
          style={{ color: "var(--sf-text-primary)" }}
          className="font-bold"
        >
          StaticsFlow Admin
        </Link>
        <span style={{ color: "var(--sf-border)" }}>|</span>
        <Link
          href="/admin/bdd"
          style={{ color: "var(--sf-text-secondary)" }}
          className="hover:opacity-80 transition-opacity"
        >
          BDD Manager
        </Link>
        <span className="ml-auto">
          <Link
            href="/dashboard"
            style={{ color: "var(--sf-text-muted)" }}
            className="hover:opacity-80 transition-opacity"
          >
            ← Back to app
          </Link>
        </span>
      </nav>
      {children}
    </div>
  );
}
