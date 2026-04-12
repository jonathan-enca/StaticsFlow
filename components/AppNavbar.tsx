// AppNavbar — shared authenticated navbar using --sf-* design tokens
// Reorganized per STA-69 UX spec:
//   Left:  logo + primary product nav (Dashboard / Library / Brand DNA / Generator / History)
//   Right: user menu avatar dropdown (account, API keys, billing, sign out)
//   Mobile: hamburger → slide-over panel covering all nav + utility links

'use client'

import { useState, useRef, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import UserMenu from '@/components/UserMenu'

interface AppNavbarProps {
  email?: string | null
  brandId?: string | null // Active brand context — needed for Generator deep-link
}

const NAV_LINKS = [
  { label: 'Dashboard',  href: '/dashboard' },
  { label: 'Library',    href: '/library' },
  { label: 'Brand DNA',  href: '/brand-dna' },
  { label: 'Generator',  href: null }, // dynamic — requires brandId; see below
  { label: 'History',    href: '/history' },
]

const MOBILE_UTILITY = [
  { label: 'Account settings', href: '/dashboard/settings' },
  { label: 'API Keys',         href: '/dashboard/settings?tab=api-keys' },
  { label: 'Billing & Plan',   href: '/dashboard/settings?tab=billing' },
]

export default function AppNavbar({ email, brandId }: AppNavbarProps) {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)
  const overlayRef = useRef<HTMLDivElement>(null)

  // Close mobile panel on route change
  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  // Prevent body scroll when mobile panel is open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [mobileOpen])

  function isActive(href: string | null): boolean {
    if (!href) return pathname.includes('/generate')
    if (href === '/dashboard') {
      return pathname === '/dashboard' || pathname.startsWith('/dashboard/brands')
    }
    return pathname.startsWith(href)
  }

  // Build Generator href: link to active brand's generate page, or /dashboard if no brand
  const generatorHref = brandId
    ? `/dashboard/brands/${brandId}/generate`
    : '/dashboard'

  function resolveHref(link: typeof NAV_LINKS[0]): string {
    return link.href ?? generatorHref
  }

  return (
    <>
      <nav
        style={{
          background: 'var(--sf-bg-secondary)',
          borderBottom: '1px solid var(--sf-border)',
          height: '56px',
        }}
        className="px-6 flex items-center justify-between"
      >
        {/* Left: logo + primary nav */}
        <div className="flex items-center gap-6">
          {/* Logo */}
          <a href="/dashboard" className="flex items-center gap-3 shrink-0">
            <div
              style={{ background: 'var(--sf-accent)' }}
              className="w-8 h-8 rounded-md flex items-center justify-center"
            >
              <span className="text-white font-bold text-sm font-display">S</span>
            </div>
            <span
              style={{ color: 'var(--sf-text-primary)', letterSpacing: '-0.02em' }}
              className="text-lg font-bold font-display hidden sm:block"
            >
              <span style={{ color: 'var(--sf-accent)' }}>S</span>taticsFlow
            </span>
          </a>

          {/* Desktop nav links — hidden on mobile */}
          <div className="hidden md:flex items-center gap-1">
            {NAV_LINKS.map((link) => {
              const href = resolveHref(link)
              const active = isActive(link.href)
              return (
                <a
                  key={link.label}
                  href={href}
                  className="px-3 py-1.5 text-sm rounded-md transition-opacity hover:opacity-80"
                  style={
                    active
                      ? {
                          color: 'var(--sf-text-primary)',
                          background: 'var(--sf-bg-elevated)',
                          fontWeight: 500,
                        }
                      : { color: 'var(--sf-text-secondary)' }
                  }
                >
                  {link.label}
                </a>
              )
            })}
          </div>
        </div>

        {/* Right: user menu + mobile hamburger */}
        <div className="flex items-center gap-3">
          {/* User menu avatar — desktop only (mobile uses slide panel) */}
          <div className="hidden md:block">
            <UserMenu email={email} />
          </div>

          {/* Hamburger button — mobile only */}
          <button
            type="button"
            className="md:hidden flex items-center justify-center w-8 h-8 rounded-md transition-colors"
            style={{ color: 'var(--sf-text-primary)' }}
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation menu"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
        </div>
      </nav>

      {/* Mobile slide-over overlay + panel */}
      {mobileOpen && (
        <>
          {/* Backdrop */}
          <div
            ref={overlayRef}
            className="fixed inset-0 z-40"
            style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
            onClick={() => setMobileOpen(false)}
          />

          {/* Slide panel */}
          <div
            className="fixed top-0 right-0 h-full z-50 flex flex-col overflow-y-auto"
            style={{
              width: '280px',
              background: 'var(--sf-bg-primary)',
              borderLeft: '1px solid var(--sf-border)',
              animation: 'slideInRight 200ms ease-out',
            }}
          >
            {/* Panel header */}
            <div
              className="flex items-center justify-between px-5 py-4 border-b"
              style={{ borderColor: 'var(--sf-border)' }}
            >
              <span
                style={{ color: 'var(--sf-text-primary)', letterSpacing: '-0.02em' }}
                className="text-base font-bold font-display"
              >
                <span style={{ color: 'var(--sf-accent)' }}>S</span>taticsFlow
              </span>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="w-7 h-7 rounded-md flex items-center justify-center transition-colors"
                style={{ color: 'var(--sf-text-muted)' }}
                aria-label="Close menu"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {/* Primary nav */}
            <div className="flex-1 py-3">
              {NAV_LINKS.map((link) => {
                const href = resolveHref(link)
                const active = isActive(link.href)
                return (
                  <a
                    key={link.label}
                    href={href}
                    className="flex items-center w-full px-5 py-3 text-base font-medium transition-colors"
                    style={
                      active
                        ? {
                            color: 'var(--sf-text-primary)',
                            borderLeft: '3px solid var(--sf-accent)',
                            paddingLeft: '17px',
                          }
                        : {
                            color: 'var(--sf-text-secondary)',
                            borderLeft: '3px solid transparent',
                            paddingLeft: '17px',
                          }
                    }
                  >
                    {link.label}
                  </a>
                )
              })}

              {/* Divider */}
              <div
                className="mx-5 my-3 border-t"
                style={{ borderColor: 'var(--sf-border)' }}
              />

              {/* Utility links */}
              {MOBILE_UTILITY.map(({ label, href }) => (
                <a
                  key={href}
                  href={href}
                  className="flex items-center w-full px-5 py-3 text-sm transition-colors"
                  style={{
                    color: 'var(--sf-text-secondary)',
                    borderLeft: '3px solid transparent',
                    paddingLeft: '17px',
                  }}
                >
                  {label}
                </a>
              ))}

              {/* Divider */}
              <div
                className="mx-5 my-3 border-t"
                style={{ borderColor: 'var(--sf-border)' }}
              />

              {/* Email */}
              {email && (
                <div
                  className="px-5 py-2 text-xs truncate"
                  style={{ color: 'var(--sf-text-muted)' }}
                >
                  {email}
                </div>
              )}

              {/* Sign out */}
              <button
                type="button"
                onClick={async () => {
                  const { signOut } = await import('next-auth/react')
                  signOut({ callbackUrl: '/login' })
                }}
                className="flex items-center w-full px-5 py-3 text-sm transition-colors text-left"
                style={{
                  color: 'var(--sf-text-muted)',
                  borderLeft: '3px solid transparent',
                  paddingLeft: '17px',
                }}
              >
                Sign out
              </button>
            </div>
          </div>
        </>
      )}

      {/* Slide-in keyframe */}
      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); }
          to   { transform: translateX(0); }
        }
      `}</style>
    </>
  )
}
