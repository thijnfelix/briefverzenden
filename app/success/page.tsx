'use client'

import { useEffect, useState, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

// ── IndexedDB helpers ──────────────────────────────────────────────────────────

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('briefverzenden', 1)
    req.onupgradeneeded = () => req.result.createObjectStore('brieven')
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function getPdf(): Promise<File | null> {
  const db = await openDB()
  return new Promise((resolve) => {
    const tx = db.transaction('brieven', 'readonly')
    const req = tx.objectStore('brieven').get('pdf')
    req.onsuccess = () => resolve(req.result ?? null)
    req.onerror = () => resolve(null)
  })
}

async function clearPdf() {
  const db = await openDB()
  const tx = db.transaction('brieven', 'readwrite')
  tx.objectStore('brieven').delete('pdf')
}

// ── Success page content ───────────────────────────────────────────────────────

type Status = 'loading' | 'sending' | 'success' | 'error'

function SuccessContent() {
  const params = useSearchParams()
  const sessionId = params.get('session_id')
  const [status, setStatus] = useState<Status>('loading')
  const [message, setMessage] = useState('')
  const [referentie, setReferentie] = useState('')
  const sent = useRef(false)

  useEffect(() => {
    if (!sessionId || sent.current) return
    sent.current = true

    async function sendLetter() {
      // Get PDF from IndexedDB
      const pdf = await getPdf()
      if (!pdf) {
        setStatus('error')
        setMessage('PDF niet gevonden. Probeer de brief opnieuw te versturen.')
        return
      }

      setStatus('sending')

      // Send to our API with the Stripe session ID for verification
      const formData = new FormData()
      formData.append('session_id', sessionId!)
      formData.append('pdf', pdf)

      try {
        const res = await fetch('/api/verzend', { method: 'POST', body: formData })
        const data = await res.json()

        if (!res.ok) {
          throw new Error(data.error || 'Onbekende fout')
        }

        setStatus('success')
        setReferentie(data.referentie || '')
        setMessage('Je brief wordt verwerkt door Postbode.nu en gaat zo snel mogelijk de post in.')

        // Clean up stored PDF
        await clearPdf()
      } catch (err) {
        setStatus('error')
        setMessage(err instanceof Error ? err.message : 'Er ging iets mis.')
      }
    }

    sendLetter()
  }, [sessionId])

  if (!sessionId) {
    return (
      <div className="text-center space-y-4">
        <h1 className="text-2xl font-bold text-gray-900">Geen sessie gevonden</h1>
        <p className="text-gray-500">Ga terug naar de homepage om een brief te versturen.</p>
        <a href="/" className="inline-block rounded-xl bg-blue-600 px-8 py-4 font-semibold text-white hover:bg-blue-700">
          Terug naar home
        </a>
      </div>
    )
  }

  return (
    <div className="text-center space-y-6">
      {/* Icon */}
      <div className={`mx-auto flex h-20 w-20 items-center justify-center rounded-full ${
        status === 'success' ? 'bg-green-100' :
        status === 'error' ? 'bg-red-100' :
        'bg-blue-100'
      }`}>
        {status === 'success' ? (
          <svg className="h-10 w-10 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        ) : status === 'error' ? (
          <svg className="h-10 w-10 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="h-10 w-10 text-blue-500 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
        )}
      </div>

      {/* Title */}
      <h1 className="text-2xl font-bold text-gray-900">
        {status === 'loading' && 'Even geduld...'}
        {status === 'sending' && 'Brief wordt verstuurd...'}
        {status === 'success' && 'Brief verzonden!'}
        {status === 'error' && 'Er ging iets mis'}
      </h1>

      {/* Message */}
      <p className="text-gray-500 max-w-md mx-auto">{message}</p>

      {/* Reference */}
      {referentie && (
        <div className="rounded-xl bg-gray-50 border border-gray-200 px-6 py-4 inline-block">
          <p className="text-xs text-gray-400 uppercase tracking-widest">Referentie</p>
          <p className="mt-1 font-mono font-semibold text-gray-800">{referentie}</p>
        </div>
      )}

      {/* Betaling geslaagd indicator */}
      {(status === 'sending' || status === 'success') && (
        <div className="flex items-center justify-center gap-2 text-sm text-green-600">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          Betaling ontvangen
        </div>
      )}

      {/* Actions */}
      <div className="pt-4">
        <a
          href="/"
          className="inline-block w-full max-w-xs rounded-xl bg-blue-600 py-4 font-semibold text-white hover:bg-blue-700"
        >
          {status === 'success' ? 'Nog een brief versturen' : 'Terug naar home'}
        </a>
      </div>

      <p className="text-xs text-gray-400">
        Verwerking door <span className="font-medium text-gray-500">BriefVerzenden.nl</span>
      </p>
    </div>
  )
}

// ── Page wrapper with Suspense ─────────────────────────────────────────────────

export default function SuccessPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-white px-4">
      <div className="max-w-md w-full">
        <Suspense fallback={
          <div className="text-center text-gray-400">Laden...</div>
        }>
          <SuccessContent />
        </Suspense>
      </div>
    </main>
  )
}
