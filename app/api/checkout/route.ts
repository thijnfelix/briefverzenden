import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'

const POSTBODE_BASE = 'https://postbode.app/api/v2'

// ── POST /api/checkout ─────────────────────────────────────────────────────────
// Creates a Stripe Checkout Session with the Postbode.nu-calculated price.
// Stores addresses + options in Stripe metadata so we can send the letter later.

export async function POST(req: NextRequest) {
  const apiKey = process.env.POSTBODE_API_KEY
  const mailbox = process.env.POSTBODE_MAILBOX
  const envelope = process.env.POSTBODE_ENVELOPE

  if (!apiKey || !mailbox || !envelope) {
    return NextResponse.json({ error: 'Serverconfiguratie ontbreekt.' }, { status: 500 })
  }

  let body: {
    afzender: Record<string, string>
    ontvanger: Record<string, string>
    opties: { kleur: boolean; dubbelzijdig: boolean; aangetekend: boolean }
    paginas: number
    email: string
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Ongeldige request.' }, { status: 400 })
  }

  // ── Step 1: Get live price from Postbode.nu ──────────────────────────────

  const countryMap: Record<string, string> = {
    Nederland: 'NL', België: 'BE', Duitsland: 'DE',
    Frankrijk: 'FR', 'Verenigd Koninkrijk': 'GB',
  }
  const cc = countryMap[body.ontvanger.land] ?? 'NL'

  let shipping: string
  if (cc === 'NL') shipping = body.opties.aangetekend ? 'NL_REGISTERED' : 'NL_FAST'
  else if (['BE', 'DE', 'FR', 'GB'].includes(cc)) shipping = body.opties.aangetekend ? 'EU_REGISTERED' : 'EU_FAST'
  else shipping = body.opties.aangetekend ? 'INT_REGISTERED' : 'INT_FAST'

  const calcPayload = {
    mailbox,
    envelope,
    pages: Math.max(1, body.paginas || 1),
    amount: 1,
    shipping,
    printing: body.opties.kleur ? 'COLOR' : 'BLACK',
    plex: body.opties.dubbelzijdig ? 'DUPLEX' : 'SIMPLEX',
    paper_type: 'A4_90',
  }

  let priceData: { total_in_vat: number }
  try {
    const priceRes = await fetch(`${POSTBODE_BASE}/postal/calculate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        Accept: 'application/json',
      },
      body: JSON.stringify(calcPayload),
    })
    priceData = await priceRes.json()
    if (!priceRes.ok || !priceData.total_in_vat) {
      throw new Error('Prijsberekening mislukt')
    }
  } catch (err) {
    console.error('[checkout] Price calculation failed:', err)
    return NextResponse.json({ error: 'Kon prijs niet berekenen.' }, { status: 502 })
  }

  // Convert euros to cents for Stripe
  const amountInCents = Math.round(priceData.total_in_vat * 100)

  // ── Step 2: Create Stripe Checkout Session ───────────────────────────────

  const baseUrl = req.headers.get('origin') || 'https://briefverzenden.nl'

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card', 'ideal'],
      mode: 'payment',
      customer_email: body.email,
      line_items: [
        {
          price_data: {
            currency: 'eur',
            unit_amount: amountInCents,
            product_data: {
              name: 'Brief verzenden via BriefVerzenden.nl',
              description: [
                `${body.paginas || 1} pagina`,
                body.opties.kleur ? 'Kleur' : 'Zwart-wit',
                body.opties.dubbelzijdig ? 'Dubbelzijdig' : 'Enkelzijdig',
                body.opties.aangetekend ? 'Aangetekend' : 'Normale post',
              ].join(' · '),
            },
          },
          quantity: 1,
        },
      ],
      // Store everything we need to send the letter after payment
      metadata: {
        afzender: JSON.stringify(body.afzender),
        ontvanger: JSON.stringify(body.ontvanger),
        opties: JSON.stringify(body.opties),
        paginas: String(body.paginas || 1),
        shipping,
      },
      success_url: `${baseUrl}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: baseUrl,
    })

    return NextResponse.json({ url: session.url })
  } catch (err) {
    console.error('[checkout] Stripe error:', err)
    return NextResponse.json({ error: 'Kon betaalsessie niet aanmaken.' }, { status: 500 })
  }
}
