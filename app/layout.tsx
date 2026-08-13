import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { Sora, Manrope, IBM_Plex_Mono } from 'next/font/google'
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      className={`${sora.variable} ${manrope.variable} ${plexMono.variable} bg-background`}
    >
      <body className="font-sans antialiased">
        {children}
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
