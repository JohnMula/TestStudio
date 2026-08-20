import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { headers } from 'next/headers'
import { Sora, Manrope, IBM_Plex_Mono } from 'next/font/google'
import { AuthProvider } from '@/components/auth-provider'
import './globals.css'

const sora = Sora({
  subsets: ['latin'],
  weight: ['600', '700'],
  variable: '--font-sora',
})

const manrope = Manrope({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-manrope',
})

const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-plex-mono',
})

export const metadata: Metadata = {
  title: 'TestStudio — Make a test. Share a code.',
  description:
    'Free, unlimited tests. Build a test, publish it, and share it as a code or link. No account needed to take one.',
  generator: 'v0.app',
  manifest: '/manifest.json',
  icons: {
    icon: '/logo/t.png',
    shortcut: '/logo/t.png',
    apple: '/logo/t.png',
  },
  openGraph: {
    title: 'TestStudio',
    description:
      'Free, unlimited tests. Build a test, publish it, and share it as a code or link. No account needed to take one.',
    type: 'website',
    images: [
      {
        url: '/logo/t.png',
        width: 512,
        height: 512,
        alt: 'TestStudio logo',
      },
    ],
  },
  twitter: {
    card: 'summary',
    title: 'TestStudio',
    description:
      'Free, unlimited tests. Build a test, publish it, and share it as a code or link. No account needed to take one.',
    images: ['/logo/t.png'],
  },
}

export const viewport: Viewport = {
  colorScheme: 'light',
  themeColor: '#f7f3ec',
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  // Reading a dynamic API here is what makes this work: it opts every
  // page under this layout into per-request rendering, so the nonce
  // baked into the HTML always matches the fresh one proxy.ts puts on
  // that same request's CSP header. Next.js then automatically stamps
  // its own framework/hydration scripts with this nonce, and — because
  // the CSP uses 'strict-dynamic' — that trust propagates to anything
  // those scripts load at runtime (Turnstile, Vercel Analytics), so
  // neither of those needs to be touched directly.
  await headers()

  return (
    <html
      lang="en"
      className={`${sora.variable} ${manrope.variable} ${plexMono.variable} bg-background`}
    >
      <body className="font-sans antialiased">
        <AuthProvider>{children}</AuthProvider>
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}