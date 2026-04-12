'use client'

import { useState } from 'react'
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
} from 'lucide-react'

// ---------------------------------------------------------------------------
// Logo wordmark — Satoshi Bold, accent "S"
// ---------------------------------------------------------------------------
function LogoWordmark({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const textSize = size === 'sm' ? 'text-base' : size === 'lg' ? 'text-2xl' : 'text-lg'
  return (
    <span
      className={`${textSize} font-bold tracking-tight font-display`}
      style={{ letterSpacing: '-0.02em' }}
    >
      <span style={{ color: 'var(--sf-accent)' }}>S</span>
      <span style={{ color: 'var(--sf-text-primary)' }}>taticsFlow</span>
    </span>
  )
}

// ---------------------------------------------------------------------------
// Navbar
// ---------------------------------------------------------------------------
function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <nav className="sticky top-0 z-50 bg-white border-b border-gray-100 shadow-sm">
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
          <a href="#features" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">Features</a>
          <a href="#pricing" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">Pricing</a>
          <a href="/library" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">Library</a>
        </div>

        {/* Desktop CTA */}
        <div className="hidden md:flex items-center gap-3">
          <a href="/login" className="text-sm text-gray-600 hover:text-gray-900 font-medium transition-colors">Log in</a>
          <a
            href="/onboarding"
            className="px-4 py-2 text-white text-sm font-semibold rounded-md hover:opacity-90 transition-opacity"
            style={{ background: 'var(--sf-accent)' }}
          >
            Get started free
          </a>
        </div>

        {/* Mobile hamburger */}
        <button
          className="md:hidden p-2 text-gray-600"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Toggle menu"
        >
          {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden bg-white border-t border-gray-100 px-6 py-4 flex flex-col gap-4">
          <a href="#features" className="text-sm text-gray-700 font-medium" onClick={() => setMenuOpen(false)}>Features</a>
          <a href="#pricing" className="text-sm text-gray-700 font-medium" onClick={() => setMenuOpen(false)}>Pricing</a>
          <a href="/library" className="text-sm text-gray-700 font-medium" onClick={() => setMenuOpen(false)}>Library</a>
          <hr className="border-gray-100" />
          <a href="/login" className="text-sm text-gray-700 font-medium">Log in</a>
          <a
            href="/onboarding"
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
    <section className="py-20 lg:py-28 bg-white">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left column */}
          <div>
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-gray-100 rounded-full text-xs text-gray-600 font-medium mb-6">
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--sf-accent)' }}></span>
              Powered by Claude + Gemini
            </div>

            {/* Headline */}
            <h1 className="text-5xl lg:text-6xl font-bold leading-tight tracking-tight text-gray-900 mb-6 font-display" style={{ letterSpacing: '-0.02em' }}>
              Generate{' '}
              <span style={{ color: 'var(--sf-accent)' }}>
                on-brand
              </span>{' '}
              Meta Ads creatives in seconds
            </h1>

            {/* Sub-headline */}
            <p className="text-xl text-gray-500 max-w-lg mb-8 leading-relaxed">
              Paste your URL. Get your Brand DNA extracted automatically. Generate
              your first creative in under 3 minutes — no design skills needed.
            </p>

            {/* CTA group */}
            <div className="flex flex-col sm:flex-row gap-3 mb-5">
              <a
                href="/onboarding"
                className="inline-flex items-center justify-center px-7 py-3.5 text-white text-base font-semibold rounded-md hover:opacity-90 transition-opacity"
                style={{ background: 'var(--sf-accent)' }}
              >
                Start for free →
              </a>
              <a
                href="#how-it-works"
                className="inline-flex items-center justify-center px-7 py-3.5 border border-gray-200 text-gray-700 text-base font-medium rounded-md hover:bg-gray-50 transition-colors"
              >
                See how it works
              </a>
            </div>

            {/* Trust line */}
            <p className="text-sm text-gray-400">
              No credit card required · BYOK — use your own API keys
            </p>
          </div>

          {/* Right column — product mockup */}
          <div className="hidden lg:block">
            <div className="relative">
              {/* Browser chrome frame */}
              <div className="bg-white rounded-lg border border-gray-200 shadow-2xl overflow-hidden">
                {/* Browser bar */}
                <div className="bg-gray-50 border-b border-gray-200 px-4 py-3 flex items-center gap-3">
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-red-400"></div>
                    <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
                    <div className="w-3 h-3 rounded-full bg-green-400"></div>
                  </div>
                  <div className="flex-1 bg-white rounded px-3 py-1.5 text-xs text-gray-400 border border-gray-200 text-center">
                    app.staticsflow.com/dashboard
                  </div>
                </div>

                {/* Mockup content — Brand DNA card */}
                <div className="p-6 bg-white">
                  <div className="mb-4">
                    <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Brand DNA extracted</div>
                    <div className="text-base font-bold text-gray-900">Maison Élara</div>
                  </div>
                  {/* Color swatches */}
                  <div className="flex gap-2 mb-4">
                    <div className="w-8 h-8 rounded-md bg-gray-900"></div>
                    <div className="w-8 h-8 rounded-md bg-amber-50 border border-gray-200"></div>
                    <div className="w-8 h-8 rounded-md bg-amber-600"></div>
                    <div className="w-8 h-8 rounded-md bg-stone-400"></div>
                    <div className="flex items-center ml-2 text-xs text-gray-400">Brand palette</div>
                  </div>
                  {/* Tone tags */}
                  <div className="flex flex-wrap gap-2 mb-4">
                    {['Elevated', 'Minimal', 'Sophisticated', 'Understated'].map(t => (
                      <span key={t} className="px-2.5 py-1 bg-gray-100 rounded-full text-xs text-gray-700 font-medium">{t}</span>
                    ))}
                  </div>
                  {/* Creative preview */}
                  <div className="mt-4 rounded-lg bg-gray-900 p-4 text-white aspect-square max-w-[180px]">
                    <div className="text-xs text-gray-400 mb-2">Generated creative</div>
                    <div className="text-sm font-semibold leading-snug">Crafted for those who notice the difference.</div>
                    <div className="mt-3 text-xs font-medium" style={{ color: 'var(--sf-accent)' }}>Shop the collection →</div>
                  </div>
                </div>
              </div>
              {/* Decorative blob */}
              <div
                className="absolute -top-6 -right-6 w-32 h-32 rounded-full blur-3xl opacity-20 -z-10"
                style={{ background: 'var(--sf-accent)' }}
              />
            </div>
          </div>
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
    <section id="how-it-works" className="py-20 bg-gray-50">
      <div className="max-w-7xl mx-auto px-6">
        <h2 className="text-3xl font-bold text-center text-gray-900 mb-12 font-display" style={{ letterSpacing: '-0.01em' }}>How it works</h2>
        <div className="grid md:grid-cols-3 gap-6">
          {steps.map((step) => (
            <div key={step.num} className="bg-white rounded-lg border border-gray-100 p-8">
              <div className="w-10 h-10 rounded-md bg-gray-900 text-white flex items-center justify-center text-sm font-bold mb-4">
                {step.num}
              </div>
              <div className="mb-3 text-gray-500">{step.icon}</div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">{step.title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{step.desc}</p>
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
    <section id="features" className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-6">
        <h2 className="text-3xl font-bold text-center text-gray-900 mb-4 font-display" style={{ letterSpacing: '-0.01em' }}>Why StaticsFlow</h2>
        <p className="text-gray-500 text-center mb-12">Built for media buyers who refuse generic creatives.</p>
        <div className="grid md:grid-cols-2 gap-6">
          {features.map((f) => (
            <div key={f.title} className="p-8 rounded-lg bg-white border border-gray-100 hover:border-gray-200 transition-colors">
              <div className="mb-4 text-gray-400">{f.icon}</div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">{f.title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{f.desc}</p>
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
      desc: 'For solo media buyers testing the waters.',
      features: ['3 brands', '50 creatives / month', 'Brand DNA extraction', 'Basic inspiration library', 'Email support'],
      cta: 'Get started',
      highlighted: false,
    },
    {
      name: 'Pro',
      price: '79',
      desc: 'For agencies managing multiple clients.',
      features: ['15 brands', '300 creatives / month', 'Brand DNA + enrichment', 'Full inspiration library', 'BDD Manager access', 'Priority support'],
      cta: 'Get started',
      highlighted: true,
      badge: 'Most popular',
    },
    {
      name: 'Agency',
      price: '199',
      desc: 'For large teams running ads at scale.',
      features: ['Unlimited brands', 'Unlimited creatives', 'Everything in Pro', 'Custom BDD uploads', 'API access', 'Dedicated support'],
      cta: 'Get started',
      highlighted: false,
    },
  ]

  return (
    <section id="pricing" className="py-20 bg-gray-50">
      <div className="max-w-7xl mx-auto px-6">
        <h2 className="text-3xl font-bold text-center text-gray-900 mb-3 font-display" style={{ letterSpacing: '-0.01em' }}>Simple, transparent pricing</h2>
        <p className="text-gray-500 text-center mb-12">BYOK — you bring your own API keys. No hidden generation fees.</p>
        <div className="grid lg:grid-cols-3 gap-6">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`bg-white rounded-lg p-8 flex flex-col ${
                plan.highlighted
                  ? 'shadow-lg'
                  : 'border border-gray-200'
              }`}
              style={plan.highlighted ? { border: '2px solid var(--sf-accent)' } : undefined}
            >
              {plan.badge && (
                <div
                  className="inline-flex self-start mb-4 px-3 py-1 text-white text-xs font-semibold rounded-full"
                  style={{ background: 'var(--sf-accent)' }}
                >
                  {plan.badge}
                </div>
              )}
              <div className="text-lg font-semibold text-gray-900 mb-1">{plan.name}</div>
              <div className="text-gray-500 text-sm mb-5">{plan.desc}</div>
              <div className="mb-6">
                <span className="text-4xl font-bold text-gray-900">${plan.price}</span>
                <span className="text-gray-400 text-sm ml-1">/month</span>
              </div>
              <ul className="flex flex-col gap-3 mb-8 flex-1">
                {plan.features.map((feat) => (
                  <li key={feat} className="flex items-start gap-2 text-sm text-gray-600">
                    <Check className="w-4 h-4 text-gray-900 mt-0.5 shrink-0" strokeWidth={2.5} />
                    {feat}
                  </li>
                ))}
              </ul>
              <a
                href="/onboarding"
                className={`text-center px-6 py-3 rounded-md text-sm font-semibold transition-colors ${
                  plan.highlighted
                    ? 'text-white hover:opacity-90'
                    : 'border border-gray-200 text-gray-900 hover:bg-gray-50'
                }`}
                style={plan.highlighted ? { background: 'var(--sf-accent)' } : undefined}
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
    <section className="py-20 bg-gray-900">
      <div className="max-w-7xl mx-auto px-6 text-center">
        <h2 className="text-3xl font-bold text-white mb-4 font-display" style={{ letterSpacing: '-0.01em' }}>
          Ready to generate your first on-brand creative?
        </h2>
        <p className="text-gray-400 text-lg mb-8">
          Paste your URL. See your Brand DNA in 30 seconds. No credit card required.
        </p>
        <a
          href="/onboarding"
          className="inline-flex items-center px-8 py-3.5 bg-white text-gray-900 font-semibold rounded-md hover:bg-gray-100 transition-colors text-base"
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
    <footer className="bg-white border-t border-gray-100 py-8 px-6">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-gray-400">
        {/* Logo + copyright */}
        <div className="flex items-center gap-3">
          <div className="w-6 h-6 rounded flex items-center justify-center" style={{ background: 'var(--sf-accent)' }}>
            <span className="text-white font-bold text-xs font-display">S</span>
          </div>
          <span>© 2026 StaticsFlow</span>
        </div>
        {/* Links */}
        <div className="flex items-center gap-6">
          <a href="#features" className="hover:text-gray-700 transition-colors">Features</a>
          <a href="#pricing" className="hover:text-gray-700 transition-colors">Pricing</a>
          <a href="/privacy" className="hover:text-gray-700 transition-colors">Privacy</a>
          <a href="/terms" className="hover:text-gray-700 transition-colors">Terms</a>
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
    // data-theme="light" overrides the root html dark default for the landing page
    <main data-theme="light" className="min-h-screen bg-white">
      <Navbar />
      <Hero />
      <HowItWorks />
      <Features />
      <Pricing />
      <FinalCTA />
      <Footer />
    </main>
  )
}
