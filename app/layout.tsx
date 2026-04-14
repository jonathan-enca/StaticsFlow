import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })

export const metadata: Metadata = {
  title: 'StaticsFlow — On-brand Meta Ads Creatives',
  description:
    'Generate on-brand static Meta Ads creatives powered by AI. Brand DNA extraction, creative generation, and QA — all in one platform.',
  icons: {
    icon: '/favicon.svg',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    // data-theme="light" — app-wide light theme. No dark mode.
    <html lang="en" className={inter.variable} data-theme="light" suppressHydrationWarning>
      <head>
        {/* Satoshi — display font for headlines and logo wordmark (Fontshare CDN) */}
        <link rel="preconnect" href="https://api.fontshare.com" />
        <link
          rel="stylesheet"
          href="https://api.fontshare.com/v2/css?f[]=satoshi@900,700,500,400&display=swap"
        />
      </head>
      <body className="font-sans">{children}</body>
    </html>
  )
}
