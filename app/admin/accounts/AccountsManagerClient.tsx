"use client";

import Link from "next/link";

// Accounts Manager — admin interface for user account management
// Features:
//   1. Searchable, paginated table of all registered accounts
//   2. Per-user plan editor (STARTER / PRO / AGENCY)
//   3. Per-user admin toggle
//   4. User deletion (with confirmation modal)
//   5. Stats strip: total users, plan distribution
//
// Data flow:
//   List:   GET  /api/admin/users?page=&limit=&q=&plan=
//   Update: PATCH /api/admin/users/:userId { plan?, isAdmin? }
//   Delete: DELETE /api/admin/users/:userId

import { useCallback, useEffect, useState } from "react";

// ──────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────

type Plan = "STARTER" | "PRO" | "AGENCY";

interface UserRow {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  plan: Plan;
  isAdmin: boolean;
  stripeCustomerId: string | null;
  createdAt: string;
  updatedAt: string;
  _count: { brands: number; sessions: number };
  brands: { name: string; url: string }[];
}

interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  pages: number;
}

interface UsersResponse {
  users: UserRow[];
  pagination: PaginationMeta;
}

// ──────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────

const PLAN_LABELS: Record<Plan, string> = {
  STARTER: "Starter",
  PRO: "Pro",
  AGENCY: "Agency",
};

const PLAN_COLORS: Record<Plan, string> = {
  STARTER: "bg-gray-100 text-gray-700",
  PRO: "bg-blue-100 text-blue-700",
  AGENCY: "bg-violet-100 text-violet-700",
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// ──────────────────────────────────────────────────────────────
// Delete confirmation modal
// ──────────────────────────────────────────────────────────────

function DeleteModal({
  user,
  onConfirm,
  onCancel,
  loading,
}: {
  user: UserRow;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onCancel} />
      <div
        className="relative z-10 rounded-xl p-6 w-full max-w-md shadow-2xl"
        style={{ background: "var(--sf-bg-secondary)", border: "1px solid var(--sf-border)" }}
      >
        <h3
          className="text-lg font-semibold mb-2"
          style={{ color: "var(--sf-text-primary)" }}
        >
          Delete account?
        </h3>
        <p className="text-sm mb-4" style={{ color: "var(--sf-text-secondary)" }}>
          This will permanently delete{" "}
          <strong style={{ color: "var(--sf-text-primary)" }}>
            {user.email}
          </strong>{" "}
          and all their brands, creatives, and data. This action cannot be undone.
        </p>
        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2 rounded-lg text-sm transition-opacity hover:opacity-80"
            style={{
              background: "var(--sf-bg-elevated)",
              color: "var(--sf-text-secondary)",
              border: "1px solid var(--sf-border)",
            }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-opacity hover:opacity-80 disabled:opacity-50"
            style={{ background: "#ef4444", color: "#fff" }}
          >
            {loading ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// Main component
// ──────────────────────────────────────────────────────────────

export function AccountsManagerClient() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta>({
    total: 0,
    page: 1,
    limit: 25,
    pages: 1,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [planFilter, setPlanFilter] = useState("all");
  const [page, setPage] = useState(1);

  // Inline edit state
  const [editingPlan, setEditingPlan] = useState<Record<string, Plan>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  // Delete state
  const [deleteTarget, setDeleteTarget] = useState<UserRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  // ── Fetch ──
  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: "25",
        q: search,
        plan: planFilter,
      });
      const res = await fetch(`/api/admin/users?${params}`);
      if (!res.ok) throw new Error("Failed to load users");
      const data: UsersResponse = await res.json();
      setUsers(data.users);
      setPagination(data.pagination);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [page, search, planFilter]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // ── Plan update ──
  async function savePlan(userId: string) {
    const plan = editingPlan[userId];
    if (!plan) return;
    setSavingId(userId);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      if (!res.ok) throw new Error("Update failed");
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, plan } : u))
      );
      setEditingPlan((prev) => {
        const next = { ...prev };
        delete next[userId];
        return next;
      });
    } catch {
      alert("Failed to update plan.");
    } finally {
      setSavingId(null);
    }
  }

  // ── Admin toggle ──
  async function toggleAdmin(user: UserRow) {
    setSavingId(user.id);
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isAdmin: !user.isAdmin }),
      });
      if (!res.ok) {
        const body = await res.json();
        alert(body.error ?? "Update failed");
        return;
      }
      setUsers((prev) =>
        prev.map((u) =>
          u.id === user.id ? { ...u, isAdmin: !user.isAdmin } : u
        )
      );
    } catch {
      alert("Failed to update admin status.");
    } finally {
      setSavingId(null);
    }
  }

  // ── Delete ──
  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/users/${deleteTarget.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const body = await res.json();
        alert(body.error ?? "Delete failed");
        return;
      }
      setUsers((prev) => prev.filter((u) => u.id !== deleteTarget.id));
      setPagination((prev) => ({ ...prev, total: prev.total - 1 }));
      setDeleteTarget(null);
    } catch {
      alert("Failed to delete user.");
    } finally {
      setDeleting(false);
    }
  }

  // ── Plan distribution for stats strip ──
  const planCounts = users.reduce(
    (acc, u) => {
      acc[u.plan] = (acc[u.plan] ?? 0) + 1;
      return acc;
    },
    {} as Record<Plan, number>
  );

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="mb-6">
        <h1
          className="text-2xl font-bold"
          style={{ color: "var(--sf-text-primary)" }}
        >
          Account Manager
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--sf-text-secondary)" }}>
          View and manage all registered user accounts.
        </p>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Total accounts", value: pagination.total },
          { label: "Starter", value: planCounts.STARTER ?? 0 },
          { label: "Pro", value: planCounts.PRO ?? 0 },
          { label: "Agency", value: planCounts.AGENCY ?? 0 },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl p-4"
            style={{
              background: "var(--sf-bg-secondary)",
              border: "1px solid var(--sf-border)",
            }}
          >
            <div
              className="text-2xl font-bold"
              style={{ color: "var(--sf-text-primary)" }}
            >
              {stat.value}
            </div>
            <div className="text-xs mt-0.5" style={{ color: "var(--sf-text-muted)" }}>
              {stat.label}
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <input
          type="search"
          placeholder="Search by email or name…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="flex-1 min-w-[200px] rounded-lg px-3 py-2 text-sm outline-none"
          style={{
            background: "var(--sf-bg-secondary)",
            border: "1px solid var(--sf-border)",
            color: "var(--sf-text-primary)",
          }}
        />
        <select
          value={planFilter}
          onChange={(e) => {
            setPlanFilter(e.target.value);
            setPage(1);
          }}
          className="rounded-lg px-3 py-2 text-sm outline-none"
          style={{
            background: "var(--sf-bg-secondary)",
            border: "1px solid var(--sf-border)",
            color: "var(--sf-text-primary)",
          }}
        >
          <option value="all">All plans</option>
          <option value="STARTER">Starter</option>
          <option value="PRO">Pro</option>
          <option value="AGENCY">Agency</option>
        </select>
      </div>

      {/* Error */}
      {error && (
        <div
          className="rounded-lg px-4 py-3 mb-4 text-sm"
          style={{ background: "#fee2e2", color: "#dc2626" }}
        >
          {error}
        </div>
      )}

      {/* Table */}
      <div
        className="rounded-xl overflow-hidden"
        style={{ border: "1px solid var(--sf-border)" }}
      >
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: "var(--sf-bg-elevated)" }}>
              {["User", "Plan", "Brands", "Joined", "Admin", "Actions"].map(
                (col) => (
                  <th
                    key={col}
                    className="px-4 py-3 text-left font-medium"
                    style={{ color: "var(--sf-text-muted)" }}
                  >
                    {col}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-12 text-center"
                  style={{ color: "var(--sf-text-muted)" }}
                >
                  Loading…
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-12 text-center"
                  style={{ color: "var(--sf-text-muted)" }}
                >
                  No accounts found.
                </td>
              </tr>
            ) : (
              users.map((user) => {
                const pendingPlan = editingPlan[user.id] ?? user.plan;
                const isSaving = savingId === user.id;

                return (
                  <tr
                    key={user.id}
                    className="border-t transition-colors hover:opacity-90"
                    style={{
                      borderColor: "var(--sf-border)",
                      background: "var(--sf-bg-secondary)",
                    }}
                  >
                    {/* User */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {user.image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={user.image}
                            alt=""
                            className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                          />
                        ) : (
                          <div
                            className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold"
                            style={{
                              background: "var(--sf-bg-elevated)",
                              color: "var(--sf-text-secondary)",
                            }}
                          >
                            {(user.name ?? user.email)[0].toUpperCase()}
                          </div>
                        )}
                        <div>
                          <div
                            className="font-medium leading-tight"
                            style={{ color: "var(--sf-text-primary)" }}
                          >
                            {user.name ?? "—"}
                          </div>
                          <div
                            className="text-xs"
                            style={{ color: "var(--sf-text-muted)" }}
                          >
                            {user.email}
                          </div>
                          {user.brands[0] && (
                            <div
                              className="text-xs mt-0.5 truncate max-w-[180px]"
                              style={{ color: "var(--sf-text-muted)" }}
                              title={user.brands[0].url}
                            >
                              {user.brands[0].name}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Plan */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <select
                          value={pendingPlan}
                          onChange={(e) =>
                            setEditingPlan((prev) => ({
                              ...prev,
                              [user.id]: e.target.value as Plan,
                            }))
                          }
                          disabled={isSaving}
                          className="rounded-md px-2 py-1 text-xs outline-none disabled:opacity-60"
                          style={{
                            background: "var(--sf-bg-elevated)",
                            border: "1px solid var(--sf-border)",
                            color: "var(--sf-text-primary)",
                          }}
                        >
                          <option value="STARTER">Starter</option>
                          <option value="PRO">Pro</option>
                          <option value="AGENCY">Agency</option>
                        </select>
                        {editingPlan[user.id] && editingPlan[user.id] !== user.plan && (
                          <button
                            onClick={() => savePlan(user.id)}
                            disabled={isSaving}
                            className="text-xs px-2 py-1 rounded-md font-medium transition-opacity hover:opacity-80 disabled:opacity-50"
                            style={{ background: "var(--sf-accent)", color: "#fff" }}
                          >
                            {isSaving ? "…" : "Save"}
                          </button>
                        )}
                      </div>
                      <span
                        className={`mt-1 inline-block text-xs px-2 py-0.5 rounded-full font-medium ${PLAN_COLORS[user.plan]}`}
                      >
                        {PLAN_LABELS[user.plan]}
                      </span>
                    </td>

                    {/* Brands */}
                    <td className="px-4 py-3" style={{ color: "var(--sf-text-secondary)" }}>
                      {user._count.brands}
                    </td>

                    {/* Joined */}
                    <td
                      className="px-4 py-3 text-xs whitespace-nowrap"
                      style={{ color: "var(--sf-text-muted)" }}
                    >
                      {fmtDate(user.createdAt)}
                    </td>

                    {/* Admin toggle */}
                    <td className="px-4 py-3">
                      <button
                        onClick={() => toggleAdmin(user)}
                        disabled={isSaving}
                        title={user.isAdmin ? "Revoke admin" : "Grant admin"}
                        className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none disabled:opacity-50 ${
                          user.isAdmin ? "bg-indigo-600" : "bg-gray-300"
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transform ring-0 transition duration-200 ease-in-out ${
                            user.isAdmin ? "translate-x-4" : "translate-x-0"
                          }`}
                        />
                      </button>
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <Link
                          href={`/admin/users/${user.id}`}
                          className="text-xs px-2 py-1 rounded-md transition-opacity hover:opacity-80"
                          style={{
                            background: "var(--sf-bg-elevated)",
                            border: "1px solid var(--sf-border)",
                            color: "var(--sf-text-secondary)",
                          }}
                        >
                          Manage
                        </Link>
                        <button
                          onClick={() => setDeleteTarget(user)}
                          className="text-xs px-2 py-1 rounded-md transition-opacity hover:opacity-80"
                          style={{
                            background: "#fee2e2",
                            color: "#dc2626",
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pagination.pages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <span className="text-xs" style={{ color: "var(--sf-text-muted)" }}>
            {pagination.total} account{pagination.total !== 1 ? "s" : ""} — page {page} / {pagination.pages}
          </span>
          <div className="flex gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="px-3 py-1 rounded-lg text-sm transition-opacity hover:opacity-80 disabled:opacity-40"
              style={{
                background: "var(--sf-bg-secondary)",
                border: "1px solid var(--sf-border)",
                color: "var(--sf-text-primary)",
              }}
            >
              ← Prev
            </button>
            <button
              disabled={page >= pagination.pages}
              onClick={() => setPage((p) => p + 1)}
              className="px-3 py-1 rounded-lg text-sm transition-opacity hover:opacity-80 disabled:opacity-40"
              style={{
                background: "var(--sf-bg-secondary)",
                border: "1px solid var(--sf-border)",
                color: "var(--sf-text-primary)",
              }}
            >
              Next →
            </button>
          </div>
        </div>
      )}

      {/* Delete modal */}
      {deleteTarget && (
        <DeleteModal
          user={deleteTarget}
          onConfirm={confirmDelete}
          onCancel={() => setDeleteTarget(null)}
          loading={deleting}
        />
      )}
    </div>
  );
}
