import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'BriefVerzenden.nl — Brief versturen zonder account',
  description:
    'Upload je PDF, vul de adressen in en verstuur je brief in 30 seconden. Verwerking via Postbode.nu.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="nl">
      <body className={inter.className}>{children}</body>
    </html>
  )
}
