// AppNavbar — shared authenticated navbar using --sf-* design tokens
// Client component: uses usePathname for active nav state.
// Used by ALL authenticated app pages.

'use client'

import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'

interface AppNavbarProps {
  email?: string | null
}

const NAV_LINKS = [
  { label: 'Dashboard', href: '/dashboard' },
  { label: 'Library',   href: '/library' },
  { label: 'Settings',  href: '/dashboard/settings' },
]

export default function AppNavbar({ email }: AppNavbarProps) {
  const pathname = usePathname()

  function isActive(href: string) {
    if (href === '/dashboard') {
      // Only active on exact /dashboard or brand sub-pages, not /dashboard/settings
      return pathname === '/dashboard' || pathname.startsWith('/dashboard/brands')
    }
    return pathname.startsWith(href)
  }

  return (
    <nav
      style={{
        background: 'var(--sf-bg-secondary)',
        borderBottom: '1px solid var(--sf-border)',
      }}
      className="px-6 py-4 flex items-center justify-between"
    >
      {/* Left: logo + nav links */}
      <div className="flex items-center gap-6">
        <a href="/dashboard" className="flex items-center gap-3">
          <div
            style={{ background: 'var(--sf-accent)' }}
            className="w-8 h-8 rounded-md flex items-center justify-center"
          >
            <span className="text-white font-bold text-sm font-display">S</span>
          </div>
          <span
            style={{ color: 'var(--sf-text-primary)', letterSpacing: '-0.02em' }}
            className="text-lg font-bold font-display"
          >
            <span style={{ color: 'var(--sf-accent)' }}>S</span>taticsFlow
          </span>
        </a>

        <div className="flex items-center gap-1">
          {NAV_LINKS.map(({ label, href }) => (
            <a
              key={href}
              href={href}
              className="px-3 py-1.5 text-sm rounded-md transition-opacity hover:opacity-80"
              style={
                isActive(href)
                  ? {
                      color: 'var(--sf-text-primary)',
                      background: 'var(--sf-bg-elevated)',
                      fontWeight: 500,
                    }
                  : { color: 'var(--sf-text-secondary)' }
              }
            >
              {label}
            </a>
          ))}
        </div>
      </div>

      {/* Right: email + sign out */}
      <div className="flex items-center gap-4">
        {email && (
          <span style={{ color: 'var(--sf-text-muted)' }} className="text-sm hidden sm:block">
            {email}
          </span>
        )}
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: '/login' })}
          style={{ color: 'var(--sf-text-secondary)' }}
          className="text-sm font-medium transition-opacity hover:opacity-80"
        >
          Sign out
        </button>
      </div>
    </nav>
  )
}
