// Protected dashboard — only accessible when authenticated
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  const session = await auth();
  if (!session) redirect("/login");

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

      {/* Content */}
      <div className="max-w-5xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Dashboard</h1>
        <p className="text-gray-500 mb-10">
          Welcome back, {session.user?.name ?? session.user?.email}
        </p>

        {/* Empty state — will be populated in Phase 2 */}
        <div className="rounded-2xl border-2 border-dashed border-gray-200 p-16 text-center">
          <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">✨</span>
          </div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">
            No creatives yet
          </h2>
          <p className="text-gray-500 text-sm mb-6">
            Start by extracting your Brand DNA from your website URL.
          </p>
          <a
            href="/onboarding"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-black text-white text-sm font-semibold rounded-lg hover:bg-gray-800 transition-colors"
          >
            Extract Brand DNA →
          </a>
        </div>
      </div>
    </main>
  );
}
