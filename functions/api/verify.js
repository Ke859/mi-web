export async function onRequestPost(context) {
  const { request, env } = context
  try {
    const { receiptUrl, expectedAmount, visitDate } = await request.json()

    if (!receiptUrl || typeof receiptUrl !== 'string') {
      return Response.json({ error: 'Falta la URL del comprobante' }, { status: 400 })
    }
    if (!expectedAmount || isNaN(Number(expectedAmount))) {
      return Response.json({ error: 'Falta el abono esperado' }, { status: 400 })
    }

    const image = await fetchImage(receiptUrl)
    if (!image) return Response.json({ error: 'No pude descargar el comprobante.' }, { status: 502 })

    const today = new Date(Date.now() - 5 * 3600 * 1000).toISOString().slice(0, 10)
    const minDate = addDaysIso(today, -5)
    const visitContext = visitDate ? `La visita de la reserva es el día ${visitDate}.` : ''

    const resp = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.NVIDIA_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'nvidia/nemotron-nano-12b-v2-vl',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Analiza la siguiente imagen. Es lo que un cliente de DARKBAT (reserva de cabaña) envió como supuesto comprobante de un pago por Nequi. El abono esperado es $${expectedAmount.toLocaleString('es-CO')} COP. Hoy es ${today}. ${visitContext}

Responde SOLO en este formato JSON (sin texto adicional):
{"es_comprobante":true|false,"monto":"monto en números sin puntos ni símbolos, ej 7500","fecha_pago":"YYYY-MM-DD del pago si es legible, si no ""","coincide":true|false,"detalle":"explicación breve en español"}

Reglas:
- es_comprobante: true SOLO si la imagen es un comprobante/recibo real de pago (Nequi, transferencia bancaria, recibidora, soporte de pago con monto y fecha). false si es cualquier otra cosa: foto de persona, paisaje, meme, captura de pantalla sin datos de pago, foto de comida, pantalla de otra app, etc.
- monto: valor total pagado que veas (solo números, ej 7500). Si no es comprobante o no hay monto, pon "".
- fecha_pago: fecha del pago en formato YYYY-MM-DD (ej: 15/08/2026 → 2026-08-15). Si no es legible, pon "".
- coincide: true SOLO si TODAS estas condiciones se cumplen: (1) es un comprobante real, (2) el monto es igual al esperado ($${expectedAmount.toLocaleString('es-CO')}), y (3) la fecha de pago es válida: no puede ser anterior a ${minDate} (no se admiten comprobantes viejos) ni posterior a la fecha de la visita (${visitDate || 'la visita'}) ni posterior a hoy. Si la fecha no es legible, no bloquees por eso. En cualquier otro caso, false.
- detalle: explica el resultado. Si no es comprobante di algo como "La imagen no parece un comprobante de pago (parece una foto de ...)". Si el monto difiere, di "El monto leído (X) no coincide con el abono esperado (Y)". Si la fecha es inválida, di "La fecha de pago (X) no es válida para esta reserva". Si no pudiste leer el monto, di "No pude leer el monto de la imagen".`,
              },
              {
                type: 'image_url',
                image_url: { url: image.dataUrl },
              },
            ],
          },
        ],
        max_tokens: 180,
        temperature: 0.1,
      }),
    })

    if (!resp.ok) {
      const detail = await resp.text()
      console.error('NVIDIA vision error', resp.status, detail)
      return Response.json({ error: 'No pude analizar el comprobante.' }, { status: 502 })
    }

    const data = await resp.json()
    const content = data.choices?.[0]?.message?.content ?? ''

    const match = content.match(/\{[\s\S]*?\}/)
    if (!match) return Response.json({ error: 'No pude interpretar el comprobante.' }, { status: 502 })

    let result = null
    try {
      result = JSON.parse(match[0])
    } catch {
      const fixed = match[0].replace(/([{,]\s*)([A-Za-z_][A-Za-z0-9_]*)\s*:/g, '$1"$2":')
      try {
        result = JSON.parse(fixed)
      } catch {
        return Response.json({ error: 'No pude interpretar el comprobante.' }, { status: 502 })
      }
    }
    return Response.json({
      es_comprobante: Boolean(result.es_comprobante),
      monto: result.monto ?? '',
      fecha_pago: result.fecha_pago ?? '',
      coincide: Boolean(result.coincide),
      detalle: result.detalle ?? '',
      expectedAmount,
    })
  } catch (e) {
    console.error('verify function error', e)
    return Response.json({ error: 'Error interno.' }, { status: 500 })
  }
}

async function fetchImage(imageUrl) {
  try {
    const resp = await fetch(imageUrl, { signal: AbortSignal.timeout(20000) })
    if (!resp.ok) return null
    const buffer = await resp.arrayBuffer()
    const contentType = resp.headers.get('content-type') || 'image/jpeg'
    let binary = ''
    const bytes = new Uint8Array(buffer)
    for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i])
    const base64 = btoa(binary)
    return { dataUrl: `data:${contentType};base64,${base64}` }
  } catch {
    return null
  }
}

function addDaysIso(iso, n) {
  const d = new Date(iso + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}