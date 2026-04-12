// Shared layout for unauthenticated pages (login, signup)
// data-theme="light" overrides the root html dark default
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div data-theme="light" className="min-h-screen flex items-center justify-center px-4"
      style={{ background: 'var(--sf-bg-elevated)' }}
    >
      {children}
    </div>
  );
}
