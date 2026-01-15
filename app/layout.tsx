import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Fundraise Pipeline Tracker',
  description: 'Track your fundraising pipeline',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&family=Space+Grotesk:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body style={{ margin: 0, background: '#0a0a0f' }}>{children}</body>
    </html>
  )
}
