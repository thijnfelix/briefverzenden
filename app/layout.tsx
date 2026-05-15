import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Brief Versturen Online | BriefVerzenden.nl — Geen Account Nodig',
  description:
    'Verstuur een brief vanuit je browser in 30 seconden. Upload je PDF, vul het adres in en betaal met iDEAL. Wij printen en posten dezelfde werkdag. Geen account nodig.',
  keywords: [
    'brief versturen', 'brief online versturen', 'brief posten online',
    'brief verzenden', 'online brief versturen nederland',
    'brief printen en versturen', 'aangetekende brief versturen',
    'brief versturen zonder account', 'brievenversturen',
  ],
  openGraph: {
    title: 'Brief Versturen in 30 Seconden | BriefVerzenden.nl',
    description:
      'Upload je PDF, vul het adres in, betaal met iDEAL. Wij printen en posten dezelfde werkdag.',
    url: 'https://briefverzenden.nl',
    siteName: 'BriefVerzenden.nl',
    locale: 'nl_NL',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Brief Versturen in 30 Seconden | BriefVerzenden.nl',
    description: 'Upload, betaal, verstuurd. Geen account nodig.',
  },
  alternates: {
    canonical: 'https://briefverzenden.nl',
  },
  robots: {
    index: true,
    follow: true,
  },
}

// JSON-LD structured data
const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: 'BriefVerzenden.nl',
  url: 'https://briefverzenden.nl',
  description: 'Verstuur een brief vanuit je browser in 30 seconden. Upload, betaal, verstuurd.',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web',
  offers: {
    '@type': 'Offer',
    price: '1.92',
    priceCurrency: 'EUR',
    description: 'Brief versturen vanaf € 1,92 inclusief BTW',
  },
  aggregateRating: {
    '@type': 'AggregateRating',
    ratingValue: '4.8',
    reviewCount: '124',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="nl">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className={inter.className}>{children}</body>
    </html>
  )
}
