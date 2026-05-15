import { NextRequest, NextResponse } from 'next/server'

// ── Config ─────────────────────────────────────────────────────────────────────
const POSTBODE_BASE = 'https://postbode.app/api/v2'

// ── Types ──────────────────────────────────────────────────────────────────────

interface Adres {
  naam: string
  adres: string       // "Kerkstraat 12" — straat + huisnummer samen
  postcode: string
  woonplaats: string
  land: string
}

interface Opties {
  kleur: boolean
  dubbelzijdig: boolean
  aangetekend: boolean
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function resolveCountryCode(land: string): string {
  const map: Record<string, string> = {
    Nederland: 'NL',
    België: 'BE',
    Duitsland: 'DE',
    Frankrijk: 'FR',
    'Verenigd Koninkrijk': 'GB',
  }
  return map[land] ?? 'NL'
}

/** Determine the correct ShippingType based on country + registered option */
function resolveShipping(land: string, aangetekend: boolean): string {
  const country = resolveCountryCode(land)
  if (country === 'NL') return aangetekend ? 'NL_REGISTERED' : 'NL_FAST'
  if (['BE', 'DE', 'FR', 'GB'].includes(country)) return aangetekend ? 'EU_REGISTERED' : 'EU_FAST'
  return aangetekend ? 'INT_REGISTERED' : 'INT_FAST'
}

function postbodeHeaders(apiKey: string) {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
    Accept: 'application/json',
  }
}

// ── Shared: parse & validate form data ─────────────────────────────────────────

async function parseFormData(req: NextRequest) {
  const apiKey = process.env.POSTBODE_API_KEY
  const mailbox = process.env.POSTBODE_MAILBOX    // e.g. "BVNL"
  const envelope = process.env.POSTBODE_ENVELOPE  // UUID of your envelope

  if (!apiKey || !mailbox || !envelope) {
    return { error: 'Serverconfiguratie ontbreekt (API key, mailbox of envelope). Neem contact op met de beheerder.' }
  }

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return { error: 'Ongeldig formulier.' }
  }

  const pdfFile = formData.get('pdf')
  const afzenderRaw = formData.get('afzender')
  const ontvangerRaw = formData.get('ontvanger')
  const optiesRaw = formData.get('opties')

  if (!pdfFile || typeof pdfFile === 'string') {
    return { error: 'PDF-bestand ontbreekt.' }
  }
  if (!afzenderRaw || !ontvangerRaw || !optiesRaw) {
    return { error: 'Adresgegevens onvolledig.' }
  }

  let afzender: Adres, ontvanger: Adres, opties: Opties
  try {
    afzender = JSON.parse(afzenderRaw as string)
    ontvanger = JSON.parse(ontvangerRaw as string)
    opties = JSON.parse(optiesRaw as string)
  } catch {
    return { error: 'Ongeldige adresgegevens.' }
  }

  // Validate required address fields
  const required: (keyof Adres)[] = ['naam', 'adres', 'postcode', 'woonplaats']
  for (const veld of required) {
    if (!afzender[veld]?.trim()) return { error: `Afzender: veld "${veld}" is verplicht.` }
    if (!ontvanger[veld]?.trim()) return { error: `Ontvanger: veld "${veld}" is verplicht.` }
  }

  if (pdfFile.type !== 'application/pdf') {
    return { error: 'Alleen PDF-bestanden zijn toegestaan.' }
  }

  // Convert PDF to base64
  const arrayBuffer = await pdfFile.arrayBuffer()
  const pdfBase64 = Buffer.from(arrayBuffer).toString('base64')

  return { apiKey, mailbox, envelope, afzender, ontvanger, opties, pdfBase64, pdfFile }
}

// ── POST /api/verzend ──────────────────────────────────────────────────────────
// Creates a postal via Postbode.nu v2 API (POST /postal)

export async function POST(req: NextRequest) {
  const parsed = await parseFormData(req)

  if ('error' in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 })
  }

  const { apiKey, mailbox, envelope, afzender, ontvanger, opties, pdfBase64, pdfFile } = parsed

  // Build the postal payload per Postbode.nu v2 spec
  const payload = {
    mailbox,
    envelope,
    type: 'outbound_letter',
    customer_reference: `BV-${Date.now()}`,

    // Verzendopties
    shipping: resolveShipping(ontvanger.land, opties.aangetekend),
    printing: opties.kleur ? 'COLOR' : 'BLACK',
    plex: opties.dubbelzijdig ? 'DUPLEX' : 'SIMPLEX',
    paper_type: 'A4_90',

    // Ontvanger op de envelop
    cover_address: {
      name: ontvanger.naam,
      street: ontvanger.adres,
      postal_code: ontvanger.postcode.replace(/\s/g, ''),
      city: ontvanger.woonplaats.toUpperCase(),
      country: resolveCountryCode(ontvanger.land) === 'NL'
        ? 'Nederland'
        : ontvanger.land,
    },

    // PDF document
    documents: [
      {
        filename: (pdfFile as File).name || 'brief.pdf',
        content: pdfBase64,
      },
    ],

    // Direct versturen
    send: true,

    // Metadata voor eigen administratie
    metadata: {
      platform: 'briefverzenden.nl',
      afzender_naam: afzender.naam,
      afzender_adres: afzender.adres,
      afzender_postcode: afzender.postcode,
      afzender_woonplaats: afzender.woonplaats,
    },
  }

  // Call Postbode.nu
  let postbodeRes: Response
  try {
    postbodeRes = await fetch(`${POSTBODE_BASE}/postal`, {
      method: 'POST',
      headers: postbodeHeaders(apiKey),
      body: JSON.stringify(payload),
    })
  } catch (err) {
    console.error('[verzend] Postbode.nu API call failed:', err)
    return NextResponse.json(
      { error: 'Kon geen verbinding maken met Postbode.nu. Probeer het later opnieuw.' },
      { status: 502 }
    )
  }

  const responseText = await postbodeRes.text()
  let data: Record<string, unknown>

  try {
    data = JSON.parse(responseText)
  } catch {
    console.error('[verzend] Non-JSON response:', responseText)
    return NextResponse.json(
      { error: 'Onverwacht antwoord van Postbode.nu.' },
      { status: 502 }
    )
  }

  if (!postbodeRes.ok) {
    console.error('[verzend] Postbode.nu error:', postbodeRes.status, data)
    const message =
      typeof data.message === 'string'
        ? data.message
        : 'Postbode.nu kon de brief niet verwerken.'
    return NextResponse.json({ error: message }, { status: postbodeRes.status })
  }

  // Success — PostalResource returned
  return NextResponse.json({
    success: true,
    referentie: data.reference ?? data.uuid ?? null,
    status: (data.status as Record<string, unknown>)?.name ?? 'ingediend',
  })
}
