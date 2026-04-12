// AppNavbar — shared authenticated navbar using --sf-* design tokens
// Used by all authenticated app pages: Brand DNA, Generate, etc.

interface AppNavbarProps {
  email?: string | null;
}

export default function AppNavbar({ email }: AppNavbarProps) {
  return (
    <nav
      style={{
        background: "var(--sf-bg-secondary)",
        borderBottom: "1px solid var(--sf-border)",
      }}
      className="px-6 py-4 flex items-center justify-between"
    >
      <div className="flex items-center gap-3">
        <div
          style={{ background: "var(--sf-accent)" }}
          className="w-8 h-8 rounded-lg flex items-center justify-center"
        >
          <span className="text-white font-bold text-sm">S</span>
        </div>
        <span
          style={{ color: "var(--sf-text-primary)" }}
          className="text-lg font-bold"
        >
          StaticsFlow
        </span>
      </div>
      <div className="flex items-center gap-4">
        {email && (
          <span style={{ color: "var(--sf-text-muted)" }} className="text-sm">
            {email}
          </span>
        )}
        <form action="/api/auth/signout" method="post">
          <button
            type="submit"
            style={{ color: "var(--sf-text-secondary)" }}
            className="text-sm font-medium transition-colors hover:opacity-80"
          >
            Sign out
          </button>
        </form>
      </div>
    </nav>
  );
}
