import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'

// ── Config ─────────────────────────────────────────────────────────────────────
const POSTBODE_BASE = 'https://postbode.app/api/v2'

// ── Helpers ────────────────────────────────────────────────────────────────────

function resolveCountryCode(land: string): string {
  const map: Record<string, string> = {
    Nederland: 'NL', België: 'BE', Duitsland: 'DE',
    Frankrijk: 'FR', 'Verenigd Koninkrijk': 'GB',
  }
  return map[land] ?? 'NL'
}

function resolveShipping(land: string, aangetekend: boolean): string {
  const cc = resolveCountryCode(land)
  if (cc === 'NL') return aangetekend ? 'NL_REGISTERED' : 'NL_FAST'
  if (['BE', 'DE', 'FR', 'GB'].includes(cc)) return aangetekend ? 'EU_REGISTERED' : 'EU_FAST'
  return aangetekend ? 'INT_REGISTERED' : 'INT_FAST'
}

// ── POST /api/verzend ──────────────────────────────────────────────────────────
// Receives a Stripe session_id + PDF. Verifies payment, then sends via Postbode.nu.

export async function POST(req: NextRequest) {
  const apiKey = process.env.POSTBODE_API_KEY
  const mailbox = process.env.POSTBODE_MAILBOX
  const envelope = process.env.POSTBODE_ENVELOPE

  if (!apiKey || !mailbox || !envelope) {
    return NextResponse.json(
      { error: 'Serverconfiguratie ontbreekt.' },
      { status: 500 }
    )
  }

  // Parse multipart form data
  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Ongeldig formulier.' }, { status: 400 })
  }

  const sessionId = formData.get('session_id') as string
  const pdfFile = formData.get('pdf')

  if (!sessionId) {
    return NextResponse.json({ error: 'Geen betaalsessie gevonden.' }, { status: 400 })
  }
  if (!pdfFile || typeof pdfFile === 'string') {
    return NextResponse.json({ error: 'PDF-bestand ontbreekt.' }, { status: 400 })
  }

  // ── Step 1: Verify Stripe payment ────────────────────────────────────────

  let session
  try {
    session = await stripe.checkout.sessions.retrieve(sessionId)
  } catch {
    return NextResponse.json({ error: 'Ongeldige betaalsessie.' }, { status: 400 })
  }

  if (session.payment_status !== 'paid') {
    return NextResponse.json({ error: 'Betaling is niet voltooid.' }, { status: 402 })
  }

  // Read addresses and options from Stripe metadata
  const meta = session.metadata
  if (!meta?.afzender || !meta?.ontvanger || !meta?.opties) {
    return NextResponse.json({ error: 'Sessiegegevens onvolledig.' }, { status: 400 })
  }

  const afzender = JSON.parse(meta.afzender)
  const ontvanger = JSON.parse(meta.ontvanger)
  const opties = JSON.parse(meta.opties)

  // ── Step 2: Convert PDF to base64 ────────────────────────────────────────

  const arrayBuffer = await pdfFile.arrayBuffer()
  const pdfBase64 = Buffer.from(arrayBuffer).toString('base64')

  // ── Step 3: Send to Postbode.nu ──────────────────────────────────────────

  const payload = {
    mailbox,
    envelope,
    type: 'outbound_letter',
    customer_reference: `BV-${sessionId.slice(-8)}`,
    shipping: resolveShipping(ontvanger.land, opties.aangetekend),
    printing: opties.kleur ? 'COLOR' : 'BLACK',
    plex: opties.dubbelzijdig ? 'DUPLEX' : 'SIMPLEX',
    paper_type: 'A4_90',
    cover_address: {
      name: ontvanger.naam,
      street: ontvanger.adres,
      postal_code: ontvanger.postcode.replace(/\s/g, ''),
      city: ontvanger.woonplaats.toUpperCase(),
      country: resolveCountryCode(ontvanger.land) === 'NL' ? 'Nederland' : ontvanger.land,
    },
    documents: [
      {
        filename: (pdfFile as File).name || 'brief.pdf',
        content: pdfBase64,
      },
    ],
    send: true,
    metadata: {
      platform: 'briefverzenden.nl',
      stripe_session: sessionId,
      afzender_naam: afzender.naam,
      afzender_adres: afzender.adres,
      afzender_postcode: afzender.postcode,
      afzender_woonplaats: afzender.woonplaats,
    },
  }

  let postbodeRes: Response
  try {
    postbodeRes = await fetch(`${POSTBODE_BASE}/postal`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
    })
  } catch (err) {
    console.error('[verzend] Postbode.nu API call failed:', err)
    return NextResponse.json(
      { error: 'Kon geen verbinding maken met Postbode.nu.' },
      { status: 502 }
    )
  }

  const data = await postbodeRes.json()

  if (!postbodeRes.ok) {
    console.error('[verzend] Postbode.nu error:', postbodeRes.status, data)
    return NextResponse.json(
      { error: data.message || 'Brief kon niet verwerkt worden.' },
      { status: postbodeRes.status }
    )
  }

  return NextResponse.json({
    success: true,
    referentie: data.reference ?? data.uuid ?? null,
    status: data.status?.name ?? 'ingediend',
  })
}
