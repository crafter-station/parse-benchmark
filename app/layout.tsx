import React from "react"
import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'

const _geist = Geist({ subsets: ["latin"] });
const _geistMono = Geist_Mono({ subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL('https://parse.crafter.run'),
  title: 'ParseBench - Document Parsing Playground',
  description: 'Compare document parsing providers side-by-side. Benchmark LlamaParse, Mistral OCR, Gemini and more.',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: '32x32' },
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
    ],
    apple: '/apple-touch-icon.png',
  },
  openGraph: {
    title: 'ParseBench - Document Parsing Playground',
    description: 'Compare document parsing providers side-by-side. Benchmark LlamaParse, Mistral OCR, Gemini and more.',
    url: 'https://parse.crafter.run',
    siteName: 'ParseBench',
    images: [{ url: '/og.png', width: 1200, height: 630, alt: 'ParseBench - Document Parsing Playground' }],
    type: 'website',
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ParseBench - Document Parsing Playground',
    description: 'Compare document parsing providers side-by-side. Benchmark LlamaParse, Mistral OCR, Gemini and more.',
    images: ['/og-twitter.png'],
    creator: '@crafterstation',
  },
  robots: {
    index: true,
    follow: true,
  },
  alternates: {
    canonical: 'https://parse.crafter.run',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={`font-sans antialiased`}>
        {children}
        <Analytics />
      </body>
    </html>
  )
}
