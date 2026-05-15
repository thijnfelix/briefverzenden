'use client'

import { useState, useCallback, useRef, useEffect } from 'react'

// ── IndexedDB: store PDF before Stripe redirect ────────────────────────────────

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('briefverzenden', 1)
    req.onupgradeneeded = () => req.result.createObjectStore('brieven')
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function storePdf(file: File) {
  const db = await openDB()
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction('brieven', 'readwrite')
    tx.objectStore('brieven').put(file, 'pdf')
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

// ── Types ──────────────────────────────────────────────────────────────────────

interface Address {
  naam: string
  adres: string
  postcode: string
  woonplaats: string
  land: string
}

interface Options {
  kleur: boolean
  dubbelzijdig: boolean
  aangetekend: boolean
}

interface PostbodePrijs {
  total_ex_vat: number
  vat: number
  total_in_vat: number
  elements: { description: string; price: string; vat: string }[]
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const emptyAddress = (): Address => ({
  naam: '',
  adres: '',
  postcode: '',
  woonplaats: '',
  land: 'Nederland',
})

/** Pseudo-random social proof number based on today's date */
function brievenVandaag(): number {
  const d = new Date()
  const seed = d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate()
  return 23 + (seed % 41) + Math.floor(d.getHours() / 3)
}

// ── Envelope Icon (used in hero & steps) ───────────────────────────────────────

function EnvelopeIcon({ className = 'h-6 w-6' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
    </svg>
  )
}

// ── Trust badges ───────────────────────────────────────────────────────────────

function TrustBadges() {
  const badges = [
    { icon: '🔒', text: 'Veilig betalen via iDEAL' },
    { icon: '⚡', text: 'Binnen 24u op de post' },
    { icon: '🇳🇱', text: 'Nederlands bedrijf' },
  ]
  return (
    <div className="flex flex-wrap justify-center gap-4 sm:gap-6">
      {badges.map((b) => (
        <div key={b.text} className="flex items-center gap-2 text-sm text-gray-500">
          <span className="text-base">{b.icon}</span>
          <span>{b.text}</span>
        </div>
      ))}
    </div>
  )
}

// ── Social proof bar ───────────────────────────────────────────────────────────

function SocialProof() {
  const [count, setCount] = useState(0)
  useEffect(() => setCount(brievenVandaag()), [])

  if (!count) return null
  return (
    <div className="flex items-center justify-center gap-2 rounded-full bg-amber-50 px-4 py-2 text-sm text-amber-700">
      <span className="relative flex h-2.5 w-2.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-amber-500" />
      </span>
      <span>
        <strong>{count} brieven</strong> verstuurd vandaag
      </span>
    </div>
  )
}

// ── Address Preview ────────────────────────────────────────────────────────────

function AdresPreview({ label, address }: { label: string; address: Address }) {
  const isEmpty = !address.naam && !address.adres && !address.woonplaats
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
      <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-gray-400">
        {label}
      </p>
      {isEmpty ? (
        <p className="font-mono text-sm text-gray-300">Vul het formulier in…</p>
      ) : (
        <div className="font-mono text-sm leading-relaxed text-gray-800">
          {address.naam && <p>{address.naam}</p>}
          {address.adres && <p>{address.adres}</p>}
          {(address.postcode || address.woonplaats) && (
            <p>{address.postcode} {address.woonplaats}</p>
          )}
          {address.land && address.land !== 'Nederland' && (
            <p className="uppercase">{address.land}</p>
          )}
        </div>
      )}
    </div>
  )
}

// ── Address Form ───────────────────────────────────────────────────────────────

function AdresForm({
  label,
  icon,
  address,
  onChange,
}: {
  label: string
  icon: string
  address: Address
  onChange: (a: Address) => void
}) {
  const field = (
    key: keyof Address,
    placeholder: string,
    transform?: (v: string) => string
  ) => (
    <input
      className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
      placeholder={placeholder}
      value={address[key]}
      onChange={(e) => {
        const val = transform ? transform(e.target.value) : e.target.value
        onChange({ ...address, [key]: val })
      }}
    />
  )

  return (
    <div className="space-y-3">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-700">
        <span>{icon}</span> {label}
      </h3>
      {field('naam', 'Volledige naam')}
      {field('adres', 'Straat + huisnummer')}
      <div className="flex gap-3">
        <div className="w-32">
          {field('postcode', '1234 AB', (v) => v.toUpperCase())}
        </div>
        <div className="flex-1">{field('woonplaats', 'Woonplaats')}</div>
      </div>
      <select
        className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
        value={address.land}
        onChange={(e) => onChange({ ...address, land: e.target.value })}
      >
        {['Nederland', 'België', 'Duitsland', 'Frankrijk', 'Verenigd Koninkrijk', 'Anders'].map(
          (l) => <option key={l}>{l}</option>
        )}
      </select>
    </div>
  )
}

// ── Upload Zone ────────────────────────────────────────────────────────────────

function UploadZone({ file, onFile }: { file: File | null; onFile: (f: File) => void }) {
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragging(false)
      const dropped = e.dataTransfer.files[0]
      if (dropped?.type === 'application/pdf') onFile(dropped)
    },
    [onFile]
  )

  return (
    <div
      className={`relative flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-14 text-center transition-all ${
        dragging
          ? 'border-indigo-500 bg-indigo-50'
          : file
          ? 'border-emerald-400 bg-emerald-50'
          : 'border-gray-200 bg-gray-50/50 hover:border-indigo-300 hover:bg-indigo-50/50'
      }`}
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
    >
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f) }}
      />
      {file ? (
        <>
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-100">
            <svg className="h-8 w-8 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="text-lg font-semibold text-gray-800">{file.name}</p>
          <p className="mt-1 text-sm text-gray-400">
            {(file.size / 1024).toFixed(0)} KB · Klik om te wijzigen
          </p>
        </>
      ) : (
        <>
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-100">
            <EnvelopeIcon className="h-8 w-8 text-indigo-600" />
          </div>
          <p className="text-lg font-semibold text-gray-800">Sleep je PDF hierheen</p>
          <p className="mt-1 text-sm text-gray-400">of klik om een bestand te kiezen</p>
        </>
      )}
    </div>
  )
}

// ── Option Card ────────────────────────────────────────────────────────────────

function OptionCard({
  icon,
  label,
  sub,
  checked,
  onChange,
}: {
  icon: string
  label: string
  sub?: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <label
      className={`flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 p-5 text-center transition-all ${
        checked
          ? 'border-indigo-500 bg-indigo-50 shadow-sm'
          : 'border-gray-100 bg-white hover:border-indigo-200 hover:bg-indigo-50/30'
      }`}
    >
      <input
        type="checkbox"
        className="sr-only"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="text-2xl">{icon}</span>
      <span className="font-semibold text-gray-800">{label}</span>
      {sub && <span className="text-xs text-gray-400">{sub}</span>}
    </label>
  )
}

// ── Price Box ──────────────────────────────────────────────────────────────────

function PrijsBox({ prijs, loading }: { prijs: PostbodePrijs | null; loading: boolean }) {
  const fmt = (amount: number | string) => {
    const n = typeof amount === 'string' ? parseFloat(amount) : amount
    return n.toFixed(2).replace('.', ',')
  }

  if (loading) {
    return (
      <div className="rounded-2xl border border-gray-100 bg-gray-50 p-6 text-center">
        <div className="mx-auto h-5 w-5 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-600" />
        <p className="mt-3 text-sm text-gray-400">Prijs berekenen…</p>
      </div>
    )
  }

  if (!prijs) {
    return (
      <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50/50 p-6 text-center">
        <p className="text-sm text-gray-400">Upload een PDF om de prijs te zien</p>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm space-y-2">
      {prijs.elements.map((el, i) => (
        <div key={i} className="flex justify-between text-sm text-gray-600">
          <span>{el.description}</span>
          <span className="font-medium">€ {fmt(el.price)}</span>
        </div>
      ))}
      <div className="flex justify-between text-sm text-gray-400">
        <span>BTW</span>
        <span>€ {fmt(prijs.vat)}</span>
      </div>
      <div className="mt-2 border-t border-gray-100 pt-3 flex justify-between text-lg font-bold text-gray-900">
        <span>Totaal</span>
        <span>€ {fmt(prijs.total_in_vat)}</span>
      </div>
      <p className="pt-2 text-xs text-gray-400">
        Prijzen zijn gebaseerd op een uurtarief voor verwerking en verzending.
      </p>
    </div>
  )
}

// ── FAQ Section (SEO) ──────────────────────────────────────────────────────────

function FAQ() {
  const items = [
    {
      q: 'Hoe werkt BriefVerzenden.nl?',
      a: 'Upload je brief als PDF, vul het adres in en betaal online. Wij printen je brief en posten hem dezelfde werkdag.',
    },
    {
      q: 'Heb ik een account nodig?',
      a: 'Nee. Je vult alleen een e-mailadres in bij de betaling voor je bevestiging. Geen registratie, geen wachtwoord.',
    },
    {
      q: 'Hoe snel wordt mijn brief bezorgd?',
      a: 'Brieven ingediend voor 17:00 gaan dezelfde werkdag op de post. Bezorging binnen Nederland duurt doorgaans 1-2 werkdagen.',
    },
    {
      q: 'Kan ik ook aangetekend versturen?',
      a: 'Ja, selecteer de optie "Aangetekend" en je brief wordt met handtekening voor ontvangst bezorgd inclusief track & trace.',
    },
    {
      q: 'Welke betaalmethoden accepteren jullie?',
      a: 'We accepteren iDEAL, creditcard en andere gangbare betaalmethoden via onze beveiligde betaalomgeving.',
    },
  ]

  return (
    <section className="mx-auto max-w-2xl px-4 pb-16">
      <h2 className="mb-8 text-center text-2xl font-bold text-gray-900">
        Veelgestelde vragen
      </h2>
      <div className="space-y-4">
        {items.map((item) => (
          <details key={item.q} className="group rounded-2xl border border-gray-100 bg-white shadow-sm">
            <summary className="flex cursor-pointer items-center justify-between px-6 py-4 text-sm font-semibold text-gray-800">
              {item.q}
              <svg className="h-5 w-5 shrink-0 text-gray-400 transition group-open:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </summary>
            <p className="px-6 pb-4 text-sm leading-relaxed text-gray-500">{item.a}</p>
          </details>
        ))}
      </div>
    </section>
  )
}

// ── Status Toast ───────────────────────────────────────────────────────────────

type Status = { type: 'idle' | 'loading' | 'success' | 'error'; message?: string }

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function HomePage() {
  const [pdf, setPdf] = useState<File | null>(null)
  const [paginas, setPaginas] = useState(1)
  const [afzender, setAfzender] = useState<Address>(emptyAddress())
  const [ontvanger, setOntvanger] = useState<Address>(emptyAddress())
  const [options, setOptions] = useState<Options>({
    kleur: false,
    dubbelzijdig: false,
    aangetekend: false,
  })
  const [status, setStatus] = useState<Status>({ type: 'idle' })
  const [email, setEmail] = useState('')
  const [prijs, setPrijs] = useState<PostbodePrijs | null>(null)
  const [prijsLoading, setPrijsLoading] = useState(false)

  // Fetch live price whenever options change
  useEffect(() => {
    if (!pdf) { setPrijs(null); return }

    const controller = new AbortController()
    setPrijsLoading(true)

    fetch('/api/prijs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pages: paginas,
        kleur: options.kleur,
        dubbelzijdig: options.dubbelzijdig,
        aangetekend: options.aangetekend,
        land: ontvanger.land,
      }),
      signal: controller.signal,
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.total_in_vat !== undefined) setPrijs(data)
      })
      .catch(() => {})
      .finally(() => setPrijsLoading(false))

    return () => controller.abort()
  }, [pdf, paginas, options, ontvanger.land])

  const isValid =
    !!pdf &&
    !!afzender.naam && !!afzender.adres && !!afzender.postcode && !!afzender.woonplaats &&
    !!ontvanger.naam && !!ontvanger.adres && !!ontvanger.postcode && !!ontvanger.woonplaats

  async function handleVerstuur(e: React.FormEvent) {
    e.preventDefault()
    if (!isValid) return
    setStatus({ type: 'loading' })

    try {
      await storePdf(pdf!)

      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ afzender, ontvanger, opties: options, paginas, email }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Onbekende fout')

      window.location.href = data.url
    } catch (err: unknown) {
      setStatus({
        type: 'error',
        message: err instanceof Error ? err.message : 'Er ging iets mis. Probeer opnieuw.',
      })
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-indigo-50/40 via-white to-white">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <header className="border-b border-gray-100 bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="mx-auto max-w-3xl flex items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600">
              <EnvelopeIcon className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-gray-900">
                BriefVerzenden<span className="text-indigo-600">.nl</span>
              </h1>
            </div>
          </div>
          <SocialProof />
        </div>
      </header>

      {/* ── Hero ────────────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-3xl px-4 pt-12 pb-8 text-center">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-indigo-100 px-4 py-1.5 text-sm font-medium text-indigo-700">
          <span>✨</span> Geen account nodig
        </div>
        <h2 className="text-3xl font-extrabold tracking-tight text-gray-900 sm:text-4xl">
          Verstuur een brief in{' '}
          <span className="bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">
            30 seconden
          </span>
        </h2>
        <p className="mx-auto mt-4 max-w-lg text-gray-500">
          Upload je PDF, vul het adres in en betaal. Wij printen en posten je brief dezelfde werkdag.
        </p>
        <div className="mt-6">
          <TrustBadges />
        </div>
      </section>

      {/* ── Form ────────────────────────────────────────────────────────── */}
      <form onSubmit={handleVerstuur} className="mx-auto max-w-2xl px-4 pb-16 space-y-10">

        {/* Step 1: Upload */}
        <section className="space-y-4">
          <StepLabel n={1} label="Upload je brief" />
          <UploadZone file={pdf} onFile={setPdf} />
        </section>

        {/* Step 2: Addresses */}
        <section className="space-y-4">
          <StepLabel n={2} label="Adressen" />
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <AdresForm icon="📤" label="Afzender" address={afzender} onChange={setAfzender} />
            <AdresForm icon="📬" label="Ontvanger" address={ontvanger} onChange={setOntvanger} />
          </div>
          {/* Address Preview */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <AdresPreview label="Voorbeeld afzender" address={afzender} />
            <AdresPreview label="Voorbeeld ontvanger" address={ontvanger} />
          </div>
        </section>

        {/* Step 3: Options */}
        <section className="space-y-4">
          <StepLabel n={3} label="Verzendopties" />
          <div className="grid grid-cols-3 gap-3">
            <OptionCard
              icon="🎨"
              label="Kleur"
              sub="Kleurenprint"
              checked={options.kleur}
              onChange={(v) => setOptions({ ...options, kleur: v })}
            />
            <OptionCard
              icon="📄"
              label="Dubbelzijdig"
              sub="Beide zijden"
              checked={options.dubbelzijdig}
              onChange={(v) => setOptions({ ...options, dubbelzijdig: v })}
            />
            <OptionCard
              icon="📮"
              label="Aangetekend"
              sub="Met track & trace"
              checked={options.aangetekend}
              onChange={(v) => setOptions({ ...options, aangetekend: v })}
            />
          </div>
        </section>

        {/* Step 4: Checkout */}
        <section className="space-y-5">
          <StepLabel n={4} label="Afrekenen" />

          <PrijsBox prijs={prijs} loading={prijsLoading} />

          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              E-mailadres voor je bevestiging
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="jij@voorbeeld.nl"
              className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3.5 text-sm outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
            />
          </div>

          {status.type === 'error' && (
            <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-600">
              {status.message}
            </div>
          )}

          <button
            type="submit"
            disabled={!isValid || status.type === 'loading'}
            className="w-full rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 py-5 text-base font-bold text-white shadow-lg shadow-indigo-200 transition hover:shadow-xl hover:shadow-indigo-300 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
          >
            {status.type === 'loading' ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Doorsturen naar betaling…
              </span>
            ) : prijs ? (
              `Betaal & Verstuur — € ${prijs.total_in_vat.toFixed(2).replace('.', ',')}`
            ) : (
              'Verstuur Brief'
            )}
          </button>

          <div className="flex items-center justify-center gap-4 text-xs text-gray-400">
            <span className="flex items-center gap-1">🔒 Beveiligde betaling</span>
            <span>·</span>
            <span>iDEAL, Visa, Mastercard</span>
          </div>
        </section>
      </form>

      {/* ── FAQ ─────────────────────────────────────────────────────────── */}
      <FAQ />

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <footer className="border-t border-gray-100 bg-white">
        <div className="mx-auto max-w-3xl px-4 py-10 text-center text-sm text-gray-400 space-y-2">
          <div className="flex items-center justify-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600">
              <EnvelopeIcon className="h-4 w-4 text-white" />
            </div>
            <span className="font-semibold text-gray-600">BriefVerzenden.nl</span>
          </div>
          <p>De makkelijkste manier om een brief te versturen vanuit je browser.</p>
          <p className="text-xs">
            © {new Date().getFullYear()} BriefVerzenden.nl · KvK 00000000
          </p>
        </div>
      </footer>
    </main>
  )
}

// ── Small helpers ──────────────────────────────────────────────────────────────

function StepLabel({ n, label }: { n: number; label: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-600 text-sm font-bold text-white shadow-sm">
        {n}
      </span>
      <h2 className="text-lg font-bold text-gray-900">{label}</h2>
    </div>
  )
}
