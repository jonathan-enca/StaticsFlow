import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'StaticsFlow — On-brand Meta Ads Creatives',
  description:
    'Generate on-brand static Meta Ads creatives powered by AI. Brand DNA extraction, creative generation, and QA — all in one platform.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
