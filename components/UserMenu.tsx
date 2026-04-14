// UserMenu — avatar dropdown for account, billing, API keys, sign out
// Replaces the inline email + sign-out button pattern in AppNavbar.
// Follows Stripe/Linear pattern: utility actions in a top-right user dropdown.

'use client'

import { useState, useRef, useEffect } from 'react'
import { signOut } from 'next-auth/react'

interface UserMenuProps {
  email?: string | null
  isAdmin?: boolean
}

const MENU_ITEMS = [
  { label: 'Account settings', href: '/dashboard/settings' },
  { label: 'API Keys',         href: '/dashboard/settings?tab=api-keys' },
]

export default function UserMenu({ email, isAdmin }: UserMenuProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Initials from email
  const initials = email
    ? email
        .split('@')[0]
        .split(/[._-]/)
        .map((s) => s[0]?.toUpperCase() ?? '')
        .slice(0, 2)
        .join('')
    : '?'

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  return (
    <div ref={ref} className="relative">
      {/* Avatar trigger */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold transition-opacity hover:opacity-80 focus:outline-none"
        style={{ background: 'var(--sf-accent)', fontSize: '13px' }}
        aria-label="User menu"
        aria-expanded={open}
      >
        {initials}
      </button>

      {/* Dropdown */}
      {open && (
        <div
          className="absolute right-0 top-10 w-52 rounded-xl border shadow-lg z-50 py-1.5"
          style={{
            background: 'var(--sf-bg-elevated)',
            borderColor: 'var(--sf-border)',
          }}
        >
          {/* Email display */}
          {email && (
            <div
              className="px-3 py-2 text-xs truncate"
              style={{ color: 'var(--sf-text-muted)' }}
            >
              {email}
            </div>
          )}
          {email && (
            <div className="my-1 border-t" style={{ borderColor: 'var(--sf-border)' }} />
          )}

          {MENU_ITEMS.map(({ label, href }) => (
            <a
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-3 py-2 text-sm transition-colors"
              style={{ color: 'var(--sf-text-primary)' }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background = 'var(--sf-bg-secondary)')
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.background = 'transparent')
              }
            >
              {label}
            </a>
          ))}

          <div className="my-1 border-t" style={{ borderColor: 'var(--sf-border)' }} />

          {isAdmin && (
            <a
              href="/admin"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-3 py-2 text-sm transition-colors"
              style={{ color: 'var(--sf-text-primary)' }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background = 'var(--sf-bg-secondary)')
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.background = 'transparent')
              }
            >
              Admin
            </a>
          )}

          <button
            type="button"
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left transition-colors"
            style={{ color: 'var(--sf-text-muted)' }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.background = 'var(--sf-bg-secondary)')
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.background = 'transparent')
            }
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  )
}
