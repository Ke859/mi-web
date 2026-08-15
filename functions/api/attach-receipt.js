function sbHeaders(env) {
  const key = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_PUBLISHABLE_KEY
  return { apikey: key, Authorization: `Bearer ${key}` }
}

function addDaysIso(iso, n) {
  const d = new Date(iso + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

export async function onRequestPost(context) {
  const { request, env } = context
  try {
    const { bookingId, base64, contentType = 'image/jpeg', expectedAmount, visitDate } = await request.json()
    if (!bookingId || !base64) return Response.json({ error: 'Faltan datos.' }, { status: 400 })
    if (!expectedAmount || isNaN(Number(expectedAmount))) return Response.json({ error: 'Falta el abono esperado.' }, { status: 400 })

    const extension = (contentType.split('/')[1] || 'jpg').replace('jpeg', 'jpg')
    const filename = `pending/${crypto.randomUUID()}.${extension}`
    const binary = atob(base64.replace(/^data:.*?base64,/, ''))
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)

    const up = await fetch(`${env.SUPABASE_URL}/storage/v1/object/comprobantes-db/${filename}`, {
      method: 'POST',
      headers: { ...sbHeaders(env), 'Content-Type': contentType },
      body: bytes,
    })
    if (!up.ok) return Response.json({ error: 'No se pudo subir el comprobante.' }, { status: 502 })

    const headers = sbHeaders(env)
    await fetch(`${env.SUPABASE_URL}/rest/v1/bookings?id=eq.${bookingId}`, {
      method: 'PATCH',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ receipt_path: filename, payment_status: 'pending_confirmation' }),
    })

    const receiptUrl = `${env.SUPABASE_URL}/storage/v1/object/public/comprobantes-db/${filename}`
    const today = new Date(Date.now() - 5 * 3600 * 1000).toISOString().slice(0, 10)
    const minDate = addDaysIso(today, -5)
    const visitContext = visitDate ? `La visita de la reserva es el día ${visitDate}.` : ''

    const ai = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.NVIDIA_API_KEY}` },
      body: JSON.stringify({
        model: 'nvidia/nemotron-nano-12b-v2-vl',
        messages: [{
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Analiza la siguiente imagen. Es lo que un cliente de DARKBAT (cueva turística) envió como supuesto comprobante de un pago por Nequi. El abono esperado es $${Number(expectedAmount).toLocaleString('es-CO')} COP. Hoy es ${today}. ${visitContext}

Responde SOLO en este formato JSON (sin texto adicional):
{"es_comprobante":true|false,"monto":"monto en números sin puntos ni símbolos, ej 7500","fecha_pago":"YYYY-MM-DD del pago si es legible, si no ""","coincide":true|false,"detalle":"explicación breve en español"}

Reglas:
- es_comprobante: true SOLO si la imagen es un comprobante/recibo real de pago (Nequi, transferencia bancaria, soporte de pago con monto y fecha). false si es cualquier otra cosa: foto de persona, paisaje, meme, captura sin datos de pago, etc.
- monto: valor total pagado que veas (solo números). Si no es comprobante, pon "".
- fecha_pago: fecha del pago en YYYY-MM-DD. Si no es legible, pon "".
- coincide: true SOLO si: (1) es comprobante real, (2) monto igual al esperado ($${Number(expectedAmount).toLocaleString('es-CO')}), (3) fecha de pago no anterior a ${minDate} ni posterior a ${visitDate || 'la visita'}. Si la fecha no es legible, no bloquees.
- detalle: explica el resultado.`,
            },
            { type: 'image_url', image_url: { url: `data:${contentType};base64,${base64.replace(/^data:.*?base64,/, '')}` } },
          ],
        }],
        max_tokens: 180,
        temperature: 0.1,
      }),
    })
    if (!ai.ok) return Response.json({ error: 'No pude analizar el comprobante.' }, { status: 502 })

    const data = await ai.json()
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

    const coincide = Boolean(result.coincide)
    if (coincide) {
      await fetch(`${env.SUPABASE_URL}/rest/v1/bookings?id=eq.${bookingId}`, {
        method: 'PATCH',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ payment_status: 'confirmed' }),
      })
    }

    return Response.json({
      ok: true,
      es_comprobante: Boolean(result.es_comprobante),
      monto: result.monto ?? '',
      fecha_pago: result.fecha_pago ?? '',
      coincide,
      detalle: result.detalle ?? '',
      receipt_path: filename,
      receipt_url: receiptUrl,
    })
  } catch (e) {
    console.error('attach-receipt error', e)
    return Response.json({ error: 'Error interno.' }, { status: 500 })
  }
}
