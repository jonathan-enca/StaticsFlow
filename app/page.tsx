'use client'

import { useState, useEffect } from 'react'
import {
  Link2,
  Dna,
  Sparkles,
  BookOpen,
  Key,
  MessageCircle,
  Menu,
  X,
  Check,
  Monitor,
} from 'lucide-react'

// ---------------------------------------------------------------------------
// Logo wordmark — Satoshi Bold, accent "S"
// ---------------------------------------------------------------------------
function LogoWordmark({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const textSize = size === 'sm' ? 'text-base' : size === 'lg' ? 'text-2xl' : 'text-lg'
  return (
    <span
      className={`${textSize} font-bold tracking-tight font-display`}
      style={{ letterSpacing: '-0.02em', color: 'var(--sf-text-primary)' }}
    >
      <span style={{ color: 'var(--sf-accent)' }}>S</span>taticsFlow
    </span>
  )
}

// ---------------------------------------------------------------------------
// Navbar — glassmorphism on scroll
// ---------------------------------------------------------------------------
function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <nav
      className="sticky top-0 z-50 transition-all duration-300"
      style={{
        background: scrolled ? 'rgba(255,255,255,0.8)' : 'var(--sf-bg-secondary)',
        backdropFilter: scrolled ? 'blur(12px)' : 'none',
        WebkitBackdropFilter: scrolled ? 'blur(12px)' : 'none',
        borderBottom: scrolled ? '1px solid var(--sf-border)' : '1px solid transparent',
        boxShadow: scrolled ? '0 1px 8px rgba(0,0,0,0.06)' : 'none',
      }}
    >
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        {/* Logo */}
        <a href="/" className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-md flex items-center justify-center" style={{ background: 'var(--sf-accent)' }}>
            <span className="text-white font-bold text-sm font-display">S</span>
          </div>
          <LogoWordmark />
        </a>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-8">
          <a href="#features" className="text-sm transition-colors hover:opacity-80" style={{ color: 'var(--sf-text-secondary)' }}>Features</a>
          <a href="#pricing" className="text-sm transition-colors hover:opacity-80" style={{ color: 'var(--sf-text-secondary)' }}>Pricing</a>
          <a href="/library" className="text-sm transition-colors hover:opacity-80" style={{ color: 'var(--sf-text-secondary)' }}>Library</a>
        </div>

        {/* Desktop CTA */}
        <div className="hidden md:flex items-center gap-3">
          <a href="/login" className="text-sm font-medium transition-colors hover:opacity-80" style={{ color: 'var(--sf-text-secondary)' }}>Log in</a>
          <a
            href="/signup"
            className="px-4 py-2 text-white text-sm font-semibold rounded-md hover:opacity-90 transition-opacity"
            style={{ background: 'var(--sf-accent)' }}
          >
            Get started free
          </a>
        </div>

        {/* Mobile hamburger */}
        <button
          className="md:hidden p-2"
          style={{ color: 'var(--sf-text-secondary)' }}
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Toggle menu"
        >
          {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div
          className="md:hidden px-6 py-4 flex flex-col gap-4"
          style={{ background: 'var(--sf-bg-secondary)', borderTop: '1px solid var(--sf-border)' }}
        >
          <a href="#features" className="text-sm font-medium" style={{ color: 'var(--sf-text-primary)' }} onClick={() => setMenuOpen(false)}>Features</a>
          <a href="#pricing" className="text-sm font-medium" style={{ color: 'var(--sf-text-primary)' }} onClick={() => setMenuOpen(false)}>Pricing</a>
          <a href="/library" className="text-sm font-medium" style={{ color: 'var(--sf-text-primary)' }} onClick={() => setMenuOpen(false)}>Library</a>
          <hr style={{ borderColor: 'var(--sf-border)' }} />
          <a href="/login" className="text-sm font-medium" style={{ color: 'var(--sf-text-primary)' }}>Log in</a>
          <a
            href="/signup"
            className="text-sm font-semibold text-white px-4 py-2.5 rounded-md text-center hover:opacity-90 transition-opacity"
            style={{ background: 'var(--sf-accent)' }}
          >
            Get started free
          </a>
        </div>
      )}
    </nav>
  )
}

// ---------------------------------------------------------------------------
// Hero
// ---------------------------------------------------------------------------
function Hero() {
  return (
    <section className="py-20 lg:py-28" style={{ background: 'var(--sf-bg-secondary)' }}>
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left column */}
          <div>
            {/* Badge */}
            <div
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium mb-6"
              style={{ background: 'var(--sf-bg-elevated)', color: 'var(--sf-text-secondary)' }}
            >
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--sf-accent)' }}></span>
              ✦ From URL to on-brand ad in under 3 minutes
            </div>

            {/* Headline */}
            <h1
              className="text-5xl lg:text-6xl font-bold leading-tight tracking-tight mb-6 font-display"
              style={{ letterSpacing: '-0.02em', color: 'var(--sf-text-primary)' }}
            >
              Generate{' '}
              <span style={{ color: 'var(--sf-accent)' }}>
                on-brand
              </span>{' '}
              Meta Ads creatives in seconds
            </h1>

            {/* Sub-headline */}
            <p className="text-xl max-w-lg mb-8 leading-relaxed" style={{ color: 'var(--sf-text-secondary)' }}>
              Stop producing generic creatives that break your brand. Paste your URL,
              get your Brand DNA extracted, and generate ads that look like your
              in-house designer made them.
            </p>

            {/* CTA group */}
            <div className="flex flex-col sm:flex-row gap-3 mb-5">
              <a
                href="/signup"
                className="inline-flex items-center justify-center px-7 py-3.5 text-white text-base font-semibold rounded-md hover:opacity-90 transition-opacity"
                style={{ background: 'var(--sf-accent)' }}
              >
                Start for free →
              </a>
              <a
                href="#how-it-works"
                className="inline-flex items-center justify-center px-7 py-3.5 text-base font-medium rounded-md hover:opacity-80 transition-colors"
                style={{ border: '1px solid var(--sf-border)', color: 'var(--sf-text-primary)' }}
              >
                See how it works
              </a>
            </div>

            {/* Trust line */}
            <p className="text-sm" style={{ color: 'var(--sf-text-muted)' }}>
              No credit card required · BYOK — use your own API keys
            </p>
          </div>

          {/* Right column — placeholder frame for product screenshot */}
          <div className="relative aspect-[4/3]">
            <div
              className="w-full h-full rounded-xl flex flex-col items-center justify-center gap-4"
              style={{
                background: 'linear-gradient(135deg, var(--sf-bg-elevated), rgba(108,71,255,0.06))',
                border: '1px solid var(--sf-border)',
              }}
            >
              <Monitor
                className="w-10 h-10 opacity-25"
                style={{ color: 'var(--sf-accent)' }}
              />
              <p className="text-sm font-medium text-center px-6" style={{ color: 'var(--sf-text-muted)' }}>
                Product screenshot coming soon
              </p>
            </div>
            {/* Decorative blob */}
            <div
              className="absolute -top-6 -right-6 w-32 h-32 rounded-full blur-3xl opacity-20 -z-10"
              style={{ background: 'var(--sf-accent)' }}
            />
          </div>
        </div>
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Social Proof Stats Bar
// ---------------------------------------------------------------------------
function StatsBar() {
  const stats = [
    { value: '1,000+', label: 'creatives in inspiration database' },
    { value: '< 3 min', label: 'from URL to first creative' },
    { value: '30 sec', label: 'Brand DNA extraction' },
    { value: '0', label: 'design skills required' },
  ]

  return (
    <section className="py-10" style={{ background: 'var(--sf-bg-primary)', borderTop: '1px solid var(--sf-border)', borderBottom: '1px solid var(--sf-border)' }}>
      <div className="max-w-4xl mx-auto px-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {stats.map((s) => (
            <div key={s.label}>
              <div
                className="text-3xl md:text-4xl font-bold font-display mb-1"
                style={{ letterSpacing: '-0.02em', color: 'var(--sf-text-primary)' }}
              >
                {s.value}
              </div>
              <div className="text-sm leading-snug" style={{ color: 'var(--sf-text-muted)' }}>
                {s.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// How It Works
// ---------------------------------------------------------------------------
function HowItWorks() {
  const steps = [
    {
      num: '1',
      icon: <Link2 className="w-5 h-5" />,
      title: 'Paste your URL',
      desc: 'Drop your website URL. We extract your Brand DNA in ~30 seconds — colors, fonts, tone of voice, key benefits.',
    },
    {
      num: '2',
      icon: <Dna className="w-5 h-5" />,
      title: 'Review Brand DNA',
      desc: 'Validate the auto-extracted profile. Add assets, adjust personas, set forbidden words. Your brand identity, locked in.',
    },
    {
      num: '3',
      icon: <Sparkles className="w-5 h-5" />,
      title: 'Generate on-brand ads',
      desc: 'Choose an angle, pick inspiration from our living database, and generate creatives that look like your in-house designer made them.',
    },
  ]

  return (
    <section id="how-it-works" className="py-20" style={{ background: 'var(--sf-bg-primary)' }}>
      <div className="max-w-7xl mx-auto px-6">
        <h2
          className="text-3xl font-bold text-center mb-12 font-display"
          style={{ letterSpacing: '-0.01em', color: 'var(--sf-text-primary)' }}
        >
          How it works
        </h2>
        <div className="grid md:grid-cols-3 gap-6">
          {steps.map((step) => (
            <div
              key={step.num}
              className="rounded-lg p-8"
              style={{ background: 'var(--sf-bg-secondary)', border: '1px solid var(--sf-border)' }}
            >
              <div
                className="w-10 h-10 rounded-md text-white flex items-center justify-center text-sm font-bold mb-4"
                style={{ background: 'var(--sf-text-primary)' }}
              >
                {step.num}
              </div>
              <div className="mb-3" style={{ color: 'var(--sf-text-muted)' }}>{step.icon}</div>
              <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--sf-text-primary)' }}>{step.title}</h3>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--sf-text-secondary)' }}>{step.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Features
// ---------------------------------------------------------------------------
function Features() {
  const features = [
    {
      icon: <BookOpen className="w-5 h-5" />,
      title: 'Inspired by what actually works',
      desc: 'Our database of high-performing creatives is enriched continuously — not 700 static templates. Every generation benefits from fresh, real-world inspiration.',
    },
    {
      icon: <Dna className="w-5 h-5" />,
      title: 'Your brand identity, auto-extracted',
      desc: 'Colors, fonts, tone of voice, customer vocabulary, forbidden words — extracted in 30 seconds from your URL. Every creative is on-brand by default.',
    },
    {
      icon: <Key className="w-5 h-5" />,
      title: 'Your keys, your costs',
      desc: 'Bring your own Claude and Gemini API keys. No hidden generation fees. Full transparency on what you pay.',
    },
    {
      icon: <MessageCircle className="w-5 h-5" />,
      title: 'Iterate in natural language',
      desc: '"Make it more premium", "stronger hook", "more contrast" — refine your creatives without starting over.',
    },
  ]

  return (
    <section id="features" className="py-20" style={{ background: 'var(--sf-bg-secondary)' }}>
      <div className="max-w-7xl mx-auto px-6">
        <h2 className="text-3xl font-bold text-center mb-4 font-display" style={{ letterSpacing: '-0.01em', color: 'var(--sf-text-primary)' }}>Why StaticsFlow</h2>
        <p className="text-center mb-12" style={{ color: 'var(--sf-text-secondary)' }}>Built for media buyers who refuse generic creatives.</p>
        <div className="grid md:grid-cols-2 gap-6">
          {features.map((f) => (
            <div
              key={f.title}
              className="p-8 rounded-lg transition-colors"
              style={{ background: 'var(--sf-bg-secondary)', border: '1px solid var(--sf-border)' }}
            >
              <div className="mb-4" style={{ color: 'var(--sf-text-muted)' }}>{f.icon}</div>
              <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--sf-text-primary)' }}>{f.title}</h3>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--sf-text-secondary)' }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Pricing
// ---------------------------------------------------------------------------
function Pricing() {
  const plans = [
    {
      name: 'Starter',
      price: '29',
      desc: 'For solo media buyers getting started.',
      features: [
        '1 brand',
        '1 Brand DNA profile',
        'Full inspiration library',
        '3 competitor references',
        'Multi-format (1:1, 4:5, 1.91:1)',
        'Email support',
      ],
      cta: 'Get started',
      highlighted: false,
    },
    {
      name: 'Pro',
      price: '79',
      desc: 'For growing teams managing multiple clients.',
      features: [
        '3 brands',
        '3 Brand DNA profiles',
        'Full inspiration library',
        '5 competitor references',
        'Multi-format',
        'Multi-language',
        'Team collaboration',
        'Priority support',
      ],
      cta: 'Get started',
      highlighted: true,
      badge: 'Most popular',
    },
    {
      name: 'Agency',
      price: '199',
      desc: 'For large teams running ads at scale.',
      features: [
        'Unlimited brands',
        'Unlimited Brand DNA profiles',
        'Full library + early access',
        '15 competitor references',
        'Multi-format',
        'Multi-language',
        'Agency mode',
        'Team collaboration',
        'Dedicated support',
      ],
      cta: 'Get started',
      highlighted: false,
    },
  ]

  return (
    <section id="pricing" className="py-20" style={{ background: 'var(--sf-bg-primary)' }}>
      <div className="max-w-7xl mx-auto px-6">
        <h2 className="text-3xl font-bold text-center mb-3 font-display" style={{ letterSpacing: '-0.01em', color: 'var(--sf-text-primary)' }}>Simple, transparent pricing</h2>
        <p className="text-center mb-12" style={{ color: 'var(--sf-text-secondary)' }}>
          BYOK — you bring your own API keys. You pay API providers directly. No hidden generation fees.
        </p>
        <div className="grid lg:grid-cols-3 gap-6">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className="rounded-lg p-8 flex flex-col"
              style={
                plan.highlighted
                  ? { background: 'var(--sf-bg-secondary)', border: '2px solid var(--sf-accent)', boxShadow: '0 10px 40px rgba(108,71,255,0.15)' }
                  : { background: 'var(--sf-bg-secondary)', border: '1px solid var(--sf-border)' }
              }
            >
              {plan.badge && (
                <div
                  className="inline-flex self-start mb-4 px-3 py-1 text-white text-xs font-semibold rounded-full"
                  style={{ background: 'var(--sf-accent)' }}
                >
                  {plan.badge}
                </div>
              )}
              <div className="text-lg font-semibold mb-1" style={{ color: 'var(--sf-text-primary)' }}>{plan.name}</div>
              <div className="text-sm mb-5" style={{ color: 'var(--sf-text-secondary)' }}>{plan.desc}</div>
              <div className="mb-6">
                <span className="text-4xl font-bold" style={{ color: 'var(--sf-text-primary)' }}>€{plan.price}</span>
                <span className="text-sm ml-1" style={{ color: 'var(--sf-text-muted)' }}>/month</span>
              </div>
              <ul className="flex flex-col gap-3 mb-8 flex-1">
                {plan.features.map((feat) => (
                  <li key={feat} className="flex items-start gap-2 text-sm" style={{ color: 'var(--sf-text-secondary)' }}>
                    <Check className="w-4 h-4 mt-0.5 shrink-0" strokeWidth={2.5} style={{ color: 'var(--sf-text-primary)' }} />
                    {feat}
                  </li>
                ))}
              </ul>
              <a
                href="/signup"
                className="text-center px-6 py-3 rounded-md text-sm font-semibold transition-colors"
                style={
                  plan.highlighted
                    ? { background: 'var(--sf-accent)', color: '#fff' }
                    : { border: '1px solid var(--sf-border)', color: 'var(--sf-text-primary)' }
                }
              >
                {plan.cta}
              </a>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Final CTA
// ---------------------------------------------------------------------------
function FinalCTA() {
  return (
    <section className="py-20" style={{ background: 'var(--sf-text-primary)' }}>
      <div className="max-w-7xl mx-auto px-6 text-center">
        <h2 className="text-3xl font-bold text-white mb-4 font-display" style={{ letterSpacing: '-0.01em' }}>
          Ready to generate your first on-brand creative?
        </h2>
        <p className="text-lg mb-8" style={{ color: 'rgba(255,255,255,0.7)' }}>
          Paste your URL. See your Brand DNA in 30 seconds. No credit card required.
        </p>
        <a
          href="/signup"
          className="inline-flex items-center px-8 py-3.5 font-semibold rounded-md transition-colors text-base"
          style={{ background: 'var(--sf-bg-secondary)', color: 'var(--sf-text-primary)' }}
        >
          Start for free →
        </a>
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Footer
// ---------------------------------------------------------------------------
function Footer() {
  return (
    <footer className="py-8 px-6" style={{ background: 'var(--sf-bg-secondary)', borderTop: '1px solid var(--sf-border)' }}>
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm" style={{ color: 'var(--sf-text-muted)' }}>
        {/* Logo + copyright */}
        <div className="flex items-center gap-3">
          <div className="w-6 h-6 rounded flex items-center justify-center" style={{ background: 'var(--sf-accent)' }}>
            <span className="text-white font-bold text-xs font-display">S</span>
          </div>
          <span>© 2026 StaticsFlow</span>
        </div>
        {/* Links */}
        <div className="flex items-center gap-6">
          <a href="#features" className="hover:opacity-80 transition-opacity">Features</a>
          <a href="#pricing" className="hover:opacity-80 transition-opacity">Pricing</a>
          <a href="/privacy" className="hover:opacity-80 transition-opacity">Privacy</a>
          <a href="/terms" className="hover:opacity-80 transition-opacity">Terms</a>
        </div>
      </div>
    </footer>
  )
}

// ---------------------------------------------------------------------------
// Page — landing page uses light theme
// ---------------------------------------------------------------------------
export default function Home() {
  return (
    // data-theme="light" overrides the root html dark default for the landing page.
    // The [data-theme='light'] rule in globals.css re-declares the light palette.
    <main data-theme="light" className="min-h-screen" style={{ background: 'var(--sf-bg-secondary)' }}>
      <Navbar />
      <Hero />
      <StatsBar />
      <HowItWorks />
      <Features />
      <Pricing />
      <FinalCTA />
      <Footer />
    </main>
  )
}
