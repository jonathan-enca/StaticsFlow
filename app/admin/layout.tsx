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
    <div className="min-h-screen bg-gray-50">
      {/* Admin navbar */}
      <nav className="bg-black text-white px-6 py-3 flex items-center gap-6 text-sm">
        <Link href="/admin/bdd" className="font-bold text-white">
          StaticsFlow Admin
        </Link>
        <span className="text-gray-500">|</span>
        <Link
          href="/admin/bdd"
          className="text-gray-300 hover:text-white transition-colors"
        >
          BDD Manager
        </Link>
        <span className="ml-auto">
          <Link
            href="/dashboard"
            className="text-gray-400 hover:text-white transition-colors"
          >
            ← Back to app
          </Link>
        </span>
      </nav>
      {children}
    </div>
  );
}
