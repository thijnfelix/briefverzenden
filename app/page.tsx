'use client'

import { useState, useCallback, useRef, useEffect } from 'react'

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

// Live price from Postbode.nu /postal/calculate
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

// ── Address Preview ────────────────────────────────────────────────────────────

function AdresPreview({ label, address }: { label: string; address: Address }) {
  const isEmpty = !address.naam && !address.adres && !address.woonplaats
  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
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
            <p>
              {address.postcode} {address.woonplaats}
            </p>
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
  address,
  onChange,
}: {
  label: string
  address: Address
  onChange: (a: Address) => void
}) {
  const field = (
    key: keyof Address,
    placeholder: string,
    transform?: (v: string) => string
  ) => (
    <input
      className="w-full rounded-lg border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
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
      <h3 className="text-sm font-semibold uppercase tracking-widest text-gray-500">
        {label}
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
        className="w-full rounded-lg border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
        value={address.land}
        onChange={(e) => onChange({ ...address, land: e.target.value })}
      >
        {['Nederland', 'België', 'Duitsland', 'Frankrijk', 'Verenigd Koninkrijk', 'Anders'].map(
          (l) => (
            <option key={l}>{l}</option>
          )
        )}
      </select>
    </div>
  )
}

// ── Upload Zone ────────────────────────────────────────────────────────────────

function UploadZone({
  file,
  onFile,
}: {
  file: File | null
  onFile: (f: File) => void
}) {
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
      className={`relative flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-12 text-center transition-all ${
        dragging
          ? 'border-blue-500 bg-blue-50'
          : file
          ? 'border-green-400 bg-green-50'
          : 'border-gray-300 bg-white hover:border-blue-400 hover:bg-blue-50'
      }`}
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => {
        e.preventDefault()
        setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
    >
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) onFile(f)
        }}
      />
      {file ? (
        <>
          <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-green-100">
            <svg className="h-7 w-7 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="font-semibold text-gray-800">{file.name}</p>
          <p className="mt-1 text-sm text-gray-400">
            {(file.size / 1024).toFixed(0)} KB · Klik om te wijzigen
          </p>
        </>
      ) : (
        <>
          <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-100">
            <svg className="h-7 w-7 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
          </div>
          <p className="font-semibold text-gray-700">Sleep je PDF hierheen</p>
          <p className="mt-1 text-sm text-gray-400">of klik om te bladeren</p>
        </>
      )}
    </div>
  )
}

// ── Option Toggle ──────────────────────────────────────────────────────────────

function OptionRow({
  label,
  sub,
  checked,
  onChange,
}: {
  label: string
  sub?: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <label className="flex cursor-pointer items-start gap-4 rounded-xl border border-gray-200 bg-white p-4 transition hover:border-blue-300 hover:bg-blue-50">
      <div className="relative mt-0.5">
        <input
          type="checkbox"
          className="peer sr-only"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
        />
        <div className="h-5 w-5 rounded border-2 border-gray-300 bg-white transition peer-checked:border-blue-500 peer-checked:bg-blue-500" />
        <svg
          className={`absolute left-0.5 top-0.5 h-4 w-4 text-white transition ${checked ? 'opacity-100' : 'opacity-0'}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <div>
        <p className="font-medium text-gray-800">{label}</p>
        {sub && <p className="text-sm text-gray-400">{sub}</p>}
      </div>
    </label>
  )
}

// ── Price Box ──────────────────────────────────────────────────────────────────

function PrijsBox({ prijs, loading }: { prijs: PostbodePrijs | null; loading: boolean }) {
  if (loading) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-gray-50 p-5 text-center text-sm text-gray-400">
        Prijs berekenen…
      </div>
    )
  }

  if (!prijs) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-gray-50 p-5 text-center text-sm text-gray-400">
        Upload een PDF om de prijs te berekenen.
      </div>
    )
  }

  const fmt = (amount: number | string) => {
    const n = typeof amount === 'string' ? parseFloat(amount) : amount
    return n.toFixed(2).replace('.', ',')
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-gray-50 p-5 space-y-2">
      {prijs.elements.map((el, i) => (
        <div key={i} className="flex justify-between text-sm text-gray-600">
          <span>{el.description}</span>
          <span>€ {fmt(el.price)}</span>
        </div>
      ))}
      <div className="flex justify-between text-sm text-gray-400">
        <span>BTW</span>
        <span>€ {fmt(prijs.vat)}</span>
      </div>
      <div className="mt-1 border-t border-gray-200 pt-3 flex justify-between font-bold text-gray-900">
        <span>Totaal</span>
        <span>€ {fmt(prijs.total_in_vat)}</span>
      </div>
      <p className="pt-1 text-xs text-gray-400">
        Prijzen zijn gebaseerd op een uurtarief voor verwerking en verzending.
      </p>
    </div>
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

  // Fetch live price from Postbode.nu whenever options or page count change
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
    !!afzender.naam &&
    !!afzender.adres &&
    !!afzender.postcode &&
    !!afzender.woonplaats &&
    !!ontvanger.naam &&
    !!ontvanger.adres &&
    !!ontvanger.postcode &&
    !!ontvanger.woonplaats

  async function handleVerstuur(e: React.FormEvent) {
    e.preventDefault()
    if (!isValid) return
    setStatus({ type: 'loading' })

    try {
      const formData = new FormData()
      formData.append('pdf', pdf!)
      formData.append('afzender', JSON.stringify(afzender))
      formData.append('ontvanger', JSON.stringify(ontvanger))
      formData.append('opties', JSON.stringify(options))
      formData.append('email', email)

      const res = await fetch('/api/verzend', { method: 'POST', body: formData })
      const data = await res.json()

      if (!res.ok) throw new Error(data.error || 'Onbekende fout')

      setStatus({
        type: 'success',
        message: `Je brief is aangeboden aan Postbode.nu. Referentie: ${data.referentie || 'onbekend'}`,
      })
    } catch (err: unknown) {
      setStatus({
        type: 'error',
        message: err instanceof Error ? err.message : 'Er ging iets mis. Probeer opnieuw.',
      })
    }
  }

  if (status.type === 'success') {
    return (
      <main className="flex min-h-screen items-center justify-center bg-white px-4">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-green-100">
            <svg className="h-10 w-10 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Brief verzonden!</h1>
          <p className="text-gray-500">{status.message}</p>
          <button
            className="w-full rounded-xl bg-blue-600 py-4 font-semibold text-white hover:bg-blue-700"
            onClick={() => {
              setPdf(null)
              setAfzender(emptyAddress())
              setOntvanger(emptyAddress())
              setOptions({ kleur: false, dubbelzijdig: false, aangetekend: false })
              setEmail('')
              setStatus({ type: 'idle' })
            }}
          >
            Nog een brief versturen
          </button>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-gray-100 px-4 py-5">
        <div className="mx-auto max-w-2xl flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-gray-900">
              BriefVerzenden<span className="text-blue-600">.nl</span>
            </h1>
            <p className="text-xs text-gray-400">Powered by Postbode.nu</p>
          </div>
          <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
            Geen account nodig
          </span>
        </div>
      </header>

      <form onSubmit={handleVerstuur} className="mx-auto max-w-2xl px-4 py-8 space-y-8">
        {/* Step 1: PDF */}
        <section className="space-y-3">
          <StepLabel n={1} label="Upload je brief (PDF)" />
          <UploadZone file={pdf} onFile={setPdf} />
        </section>

        {/* Step 2: Addresses */}
        <section className="space-y-3">
          <StepLabel n={2} label="Adressen" />
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <AdresForm label="Afzender" address={afzender} onChange={setAfzender} />
            <AdresForm label="Ontvanger" address={ontvanger} onChange={setOntvanger} />
          </div>
        </section>

        {/* Address Preview */}
        <section className="space-y-3">
          <p className="text-sm font-semibold uppercase tracking-widest text-gray-400">
            Voorbeeld op de envelop
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <AdresPreview label="Afzender" address={afzender} />
            <AdresPreview label="Ontvanger" address={ontvanger} />
          </div>
        </section>

        {/* Step 3: Options */}
        <section className="space-y-3">
          <StepLabel n={3} label="Verzendopties" />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <OptionRow
              label="Kleur"
              sub="+ € 0,50 p/pagina"
              checked={options.kleur}
              onChange={(v) => setOptions({ ...options, kleur: v })}
            />
            <OptionRow
              label="Dubbelzijdig"
              sub="Beide zijden bedrukken"
              checked={options.dubbelzijdig}
              onChange={(v) => setOptions({ ...options, dubbelzijdig: v })}
            />
            <OptionRow
              label="Aangetekend"
              sub="+ € 7,40 extra"
              checked={options.aangetekend}
              onChange={(v) => setOptions({ ...options, aangetekend: v })}
            />
          </div>
        </section>

        {/* Step 4: Checkout */}
        <section className="space-y-4">
          <StepLabel n={4} label="Afrekenen" />

          <PrijsBox prijs={prijs} loading={prijsLoading} />

          {/* Email — only at checkout */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              E-mailadres voor bevestiging
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="jij@voorbeeld.nl"
              className="w-full rounded-lg border border-gray-200 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          {status.type === 'error' && (
            <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
              {status.message}
            </div>
          )}

          <button
            type="submit"
            disabled={!isValid || status.type === 'loading'}
            className="w-full rounded-2xl bg-blue-600 py-5 text-base font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {status.type === 'loading' ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Bezig met versturen…
              </span>
            ) : prijs ? (
              `Verstuur Brief — € ${prijs.total_in_vat.toFixed(2).replace('.', ',')}`
            ) : (
              'Verstuur Brief'
            )}
          </button>

          <p className="text-center text-xs text-gray-400">
            Verwerking via{' '}
            <span className="font-medium text-gray-500">Postbode.nu</span> · Betaling via iDEAL of
            creditcard
          </p>
        </section>
      </form>
    </main>
  )
}

// ── Small helpers ──────────────────────────────────────────────────────────────

function StepLabel({ n, label }: { n: number; label: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
        {n}
      </span>
      <h2 className="font-semibold text-gray-800">{label}</h2>
    </div>
  )
}
