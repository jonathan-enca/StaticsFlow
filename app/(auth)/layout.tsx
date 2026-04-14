// Shared layout for unauthenticated pages (login, signup)
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4"
      style={{ background: 'var(--sf-bg-elevated)' }}
    >
      {children}
    </div>
  );
}
