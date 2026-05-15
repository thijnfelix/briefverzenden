import { NextRequest, NextResponse } from 'next/server'

// ── Types ──────────────────────────────────────────────────────────────────────

interface Adres {
  naam: string
  adres: string
  postcode: string
  woonplaats: string
  land: string
}

interface Opties {
  kleur: boolean
  dubbelzijdig: boolean
  aangetekend: boolean
}

// ── Postbode.nu payload builder ────────────────────────────────────────────────
// Follows the official api.postbode.nu JSON structure.

function buildPostbodePayload(
  afzender: Adres,
  ontvanger: Adres,
  opties: Opties,
  pdfBase64: string
) {
  return {
    letter: {
      sender: {
        name: afzender.naam,
        address: afzender.adres,
        zipcode: afzender.postcode.replace(/\s/g, ''),
        city: afzender.woonplaats,
        country: resolveCountryCode(afzender.land),
      },
      recipient: {
        name: ontvanger.naam,
        address: ontvanger.adres,
        zipcode: ontvanger.postcode.replace(/\s/g, ''),
        city: ontvanger.woonplaats,
        country: resolveCountryCode(ontvanger.land),
      },
      settings: {
        color: opties.kleur,
        duplex: opties.dubbelzijdig,
        registered: opties.aangetekend,
        // Postbode.nu defaults: A4, 80gsm paper
        paper_size: 'A4',
        paper_weight: 80,
      },
      file: {
        content: pdfBase64,
        mime_type: 'application/pdf',
      },
    },
  }
}

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

// ── Route handler ──────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const apiKey = process.env.POSTBODE_API_KEY

  if (!apiKey) {
    console.error('[verzend] POSTBODE_API_KEY is not set')
    return NextResponse.json(
      { error: 'Serverconfiguratie ontbreekt. Neem contact op met de beheerder.' },
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

  const pdfFile = formData.get('pdf')
  const afzenderRaw = formData.get('afzender')
  const ontvangerRaw = formData.get('ontvanger')
  const optiesRaw = formData.get('opties')

  // Validate presence
  if (!pdfFile || typeof pdfFile === 'string') {
    return NextResponse.json({ error: 'PDF-bestand ontbreekt.' }, { status: 400 })
  }
  if (!afzenderRaw || !ontvangerRaw || !optiesRaw) {
    return NextResponse.json({ error: 'Adresgegevens onvolledig.' }, { status: 400 })
  }

  // Parse JSON fields
  let afzender: Adres, ontvanger: Adres, opties: Opties
  try {
    afzender = JSON.parse(afzenderRaw as string)
    ontvanger = JSON.parse(ontvangerRaw as string)
    opties = JSON.parse(optiesRaw as string)
  } catch {
    return NextResponse.json({ error: 'Ongeldige adresgegevens.' }, { status: 400 })
  }

  // Validate required address fields
  const requiredFields: (keyof Adres)[] = ['naam', 'adres', 'postcode', 'woonplaats']
  for (const veld of requiredFields) {
    if (!afzender[veld]?.trim()) {
      return NextResponse.json(
        { error: `Afzender: veld "${veld}" is verplicht.` },
        { status: 400 }
      )
    }
    if (!ontvanger[veld]?.trim()) {
      return NextResponse.json(
        { error: `Ontvanger: veld "${veld}" is verplicht.` },
        { status: 400 }
      )
    }
  }

  // Validate PDF MIME type
  if (pdfFile.type !== 'application/pdf') {
    return NextResponse.json(
      { error: 'Alleen PDF-bestanden zijn toegestaan.' },
      { status: 400 }
    )
  }

  // Convert PDF to base64
  const arrayBuffer = await pdfFile.arrayBuffer()
  const pdfBase64 = Buffer.from(arrayBuffer).toString('base64')

  // Build payload
  const payload = buildPostbodePayload(afzender, ontvanger, opties, pdfBase64)

  // Call Postbode.nu API
  let postbodeRes: Response
  try {
    postbodeRes = await fetch('https://api.postbode.nu/v1/letters', {
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
      { error: 'Kon geen verbinding maken met Postbode.nu. Probeer het later opnieuw.' },
      { status: 502 }
    )
  }

  const responseText = await postbodeRes.text()
  let responseData: Record<string, unknown>

  try {
    responseData = JSON.parse(responseText)
  } catch {
    console.error('[verzend] Postbode.nu non-JSON response:', responseText)
    return NextResponse.json(
      { error: 'Onverwacht antwoord van Postbode.nu.' },
      { status: 502 }
    )
  }

  if (!postbodeRes.ok) {
    console.error('[verzend] Postbode.nu error:', postbodeRes.status, responseData)
    const message =
      typeof responseData.message === 'string'
        ? responseData.message
        : 'Postbode.nu kon de brief niet verwerken.'
    return NextResponse.json({ error: message }, { status: postbodeRes.status })
  }

  // Success — return reference to the client
  return NextResponse.json({
    success: true,
    referentie: responseData.id ?? responseData.reference ?? null,
    status: responseData.status ?? 'ingediend',
  })
}
