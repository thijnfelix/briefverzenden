import { NextRequest, NextResponse } from 'next/server'

// ── POST /api/prijs ────────────────────────────────────────────────────────────
// Calls Postbode.nu v2 POST /postal/calculate for a live price quote.

const POSTBODE_BASE = 'https://postbode.app/api/v2'

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

  let body: {
    pages: number
    kleur: boolean
    dubbelzijdig: boolean
    aangetekend: boolean
    land: string
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Ongeldige request.' }, { status: 400 })
  }

  // Determine shipping type based on country
  const countryMap: Record<string, string> = {
    Nederland: 'NL', België: 'BE', Duitsland: 'DE',
    Frankrijk: 'FR', 'Verenigd Koninkrijk': 'GB',
  }
  const cc = countryMap[body.land] ?? 'NL'

  let shipping: string
  if (cc === 'NL') shipping = body.aangetekend ? 'NL_REGISTERED' : 'NL_FAST'
  else if (['BE', 'DE', 'FR', 'GB'].includes(cc)) shipping = body.aangetekend ? 'EU_REGISTERED' : 'EU_FAST'
  else shipping = body.aangetekend ? 'INT_REGISTERED' : 'INT_FAST'

  const payload = {
    mailbox,
    envelope,
    pages: Math.max(1, body.pages || 1),
    amount: 1,
    shipping,
    printing: body.kleur ? 'COLOR' : 'BLACK',
    plex: body.dubbelzijdig ? 'DUPLEX' : 'SIMPLEX',
    paper_type: 'A4_90',
  }

  try {
    const res = await fetch(`${POSTBODE_BASE}/postal/calculate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
    })

    const data = await res.json()

    if (!res.ok) {
      console.error('[prijs] Postbode.nu error:', res.status, data)
      return NextResponse.json(
        { error: data.message || 'Prijsberekening mislukt.' },
        { status: res.status }
      )
    }

    // Return the Postbode.nu price breakdown
    // Response: { total_ex_vat, vat, total_in_vat, elements: [{description, price, vat}] }
    return NextResponse.json(data)
  } catch (err) {
    console.error('[prijs] Postbode.nu API call failed:', err)
    return NextResponse.json(
      { error: 'Kon geen verbinding maken met Postbode.nu.' },
      { status: 502 }
    )
  }
}
