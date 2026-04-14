// AppNavbar — shared authenticated navbar using --sf-* design tokens
// Reorganized per STA-69 UX spec:
//   Left:  logo + primary product nav (Dashboard / Library / Brand DNA / Generator)
//   Right: brand picker (multi-brand) + user menu avatar dropdown
//   Mobile: hamburger → slide-over panel covering all nav + utility links
// STA-134: brand picker shown when user has 2+ brands; persisted in localStorage.
// STA-135: brand switch now navigates to the equivalent page for the new brand.

'use client'

import { useState, useRef, useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import UserMenu from '@/components/UserMenu'

interface Brand {
  id: string
  name: string
}

interface AppNavbarProps {
  email?: string | null
  brands?: Brand[]   // All user brands — enables picker when length > 1
  isAdmin?: boolean
}

const NAV_LINKS = [
  { label: 'Dashboard', href: '/dashboard' },
  { label: 'Library',   href: '/library' },
  { label: 'Brand DNA', href: 'brand-dna' as const }, // resolved dynamically
  { label: 'Generator', href: 'generator' as const }, // resolved dynamically
]

const MOBILE_UTILITY = [
  { label: 'Account settings', href: '/dashboard/settings' },
  { label: 'API Keys',         href: '/dashboard/settings?tab=api-keys' },
]

const LS_KEY = 'sf_active_brand'

export default function AppNavbar({ email, brands = [], isAdmin }: AppNavbarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const overlayRef = useRef<HTMLDivElement>(null)
  const pickerRef = useRef<HTMLDivElement>(null)

  // ── Active brand state ────────────────────────────────────────────────────
  // Initialise from localStorage; fall back to the first brand in the list.
  const [activeBrandId, setActiveBrandId] = useState<string | null>(() => {
    // useState initialiser runs client-side only when hydrated.
    // We'll sync with localStorage in a useEffect.
    return brands[0]?.id ?? null
  })

  // On mount: restore persisted choice (or fall back if brand no longer exists)
  useEffect(() => {
    if (brands.length === 0) return
    try {
      const stored = localStorage.getItem(LS_KEY)
      const valid = brands.find((b) => b.id === stored)
      setActiveBrandId(valid ? stored : brands[0].id)
    } catch {
      setActiveBrandId(brands[0].id)
    }
  }, [brands])

  function selectBrand(id: string) {
    setActiveBrandId(id)
    try { localStorage.setItem(LS_KEY, id) } catch { /* ignore */ }
    setPickerOpen(false)
    setMobileOpen(false)

    // If the user is currently viewing a brand-specific page, navigate them to
    // the equivalent page for the newly selected brand so the switch takes effect
    // immediately rather than silently keeping the old brand's data in view.
    // Pattern: /dashboard/brands/[currentBrandId][/rest]
    const brandPathMatch = pathname.match(/^\/dashboard\/brands\/([^/]+)(\/.*)?$/)
    if (brandPathMatch) {
      const rest = brandPathMatch[2] ?? ''
      router.push(`/dashboard/brands/${id}${rest}`)
    }
  }

  const activeBrand = brands.find((b) => b.id === activeBrandId) ?? brands[0] ?? null

  // ── Derived hrefs ─────────────────────────────────────────────────────────
  const brandDnaHref = activeBrand
    ? `/dashboard/brands/${activeBrand.id}`
    : '/brand-dna'

  const generatorHref = activeBrand
    ? `/dashboard/brands/${activeBrand.id}/generate`
    : '/dashboard'

  function resolveHref(link: typeof NAV_LINKS[0]): string {
    if (link.href === 'brand-dna') return brandDnaHref
    if (link.href === 'generator') return generatorHref
    return link.href
  }

  // ── Active-state detection ────────────────────────────────────────────────
  function isActive(link: typeof NAV_LINKS[0]): boolean {
    if (link.href === 'generator') return pathname.includes('/generate')
    if (link.href === '/dashboard') return pathname === '/dashboard'
    if (link.href === 'brand-dna') {
      return pathname.startsWith('/dashboard/brands') &&
        !pathname.includes('/generate') &&
        !pathname.includes('/products') &&
        !pathname.includes('/inspirations')
    }
    return pathname.startsWith(link.href)
  }

  // ── Side-effects ──────────────────────────────────────────────────────────
  useEffect(() => { setMobileOpen(false) }, [pathname])

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [mobileOpen])

  // Close brand picker on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setPickerOpen(false)
      }
    }
    if (pickerOpen) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [pickerOpen])

  const showPicker = brands.length > 1

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
              const active = isActive(link)
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

        {/* Right: brand picker (multi-brand only) + user menu + hamburger */}
        <div className="flex items-center gap-3">

          {/* Brand picker — desktop only, shown when user has 2+ brands */}
          {showPicker && activeBrand && (
            <div ref={pickerRef} className="relative hidden md:block">
              <button
                type="button"
                onClick={() => setPickerOpen((v) => !v)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-md transition-colors"
                style={{
                  color: 'var(--sf-text-secondary)',
                  background: pickerOpen ? 'var(--sf-bg-elevated)' : 'transparent',
                  border: '1px solid var(--sf-border)',
                  maxWidth: '140px',
                }}
                aria-label="Switch brand"
                aria-expanded={pickerOpen}
              >
                <span className="truncate font-medium" style={{ color: 'var(--sf-text-primary)' }}>
                  {activeBrand.name}
                </span>
                {/* Chevron */}
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="flex-shrink-0"
                  style={{
                    transform: pickerOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: 'transform 150ms',
                  }}
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>

              {/* Dropdown */}
              {pickerOpen && (
                <div
                  className="absolute right-0 top-9 w-48 rounded-xl border shadow-lg z-50 py-1.5 overflow-hidden"
                  style={{
                    background: 'var(--sf-bg-elevated)',
                    borderColor: 'var(--sf-border)',
                  }}
                >
                  <p
                    className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wider"
                    style={{ color: 'var(--sf-text-muted)' }}
                  >
                    Switch brand
                  </p>
                  {brands.map((brand) => (
                    <button
                      key={brand.id}
                      type="button"
                      onClick={() => selectBrand(brand.id)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors"
                      style={{ color: 'var(--sf-text-primary)' }}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.background = 'var(--sf-bg-secondary)')
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.background = 'transparent')
                      }
                    >
                      {/* Checkmark for active brand */}
                      <span
                        className="w-3.5 h-3.5 flex items-center justify-center flex-shrink-0"
                        style={{ color: 'var(--sf-accent)' }}
                      >
                        {brand.id === activeBrand.id && (
                          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        )}
                      </span>
                      <span className="truncate">{brand.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* User menu avatar — desktop only */}
          <div className="hidden md:block">
            <UserMenu email={email} isAdmin={isAdmin} />
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

            {/* Mobile brand picker — shown when user has 2+ brands */}
            {showPicker && activeBrand && (
              <div
                className="px-5 py-3 border-b"
                style={{ borderColor: 'var(--sf-border)' }}
              >
                <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--sf-text-muted)' }}>
                  Active brand
                </p>
                <div className="flex flex-col gap-1">
                  {brands.map((brand) => (
                    <button
                      key={brand.id}
                      type="button"
                      onClick={() => selectBrand(brand.id)}
                      className="flex items-center gap-2 px-2 py-1.5 rounded-md text-sm text-left w-full transition-colors"
                      style={{
                        background: brand.id === activeBrand.id ? 'var(--sf-bg-elevated)' : 'transparent',
                        color: brand.id === activeBrand.id ? 'var(--sf-text-primary)' : 'var(--sf-text-secondary)',
                        fontWeight: brand.id === activeBrand.id ? 500 : 400,
                      }}
                    >
                      {brand.id === activeBrand.id && (
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--sf-accent)', flexShrink: 0 }}>
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                      {brand.id !== activeBrand.id && <span className="w-3" />}
                      <span className="truncate">{brand.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Primary nav */}
            <div className="flex-1 py-3">
              {NAV_LINKS.map((link) => {
                const href = resolveHref(link)
                const active = isActive(link)
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
