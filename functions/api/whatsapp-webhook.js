const SLOT_TIMES = ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00']
const SLOT_CAPACITY = 50
const ACTIVE_STATUS = 'payment_status=neq.rejected&payment_status=neq.cancelled&payment_status=neq.draft&payment_status=neq.awaiting_confirm&payment_status=neq.completed'
const DRAFT_STATUS = 'payment_status=in.(draft,awaiting_confirm)'
const PRICE = 15000
const NEQUI = '314 459 5642'
const t5 = (t) => String(t || '').slice(0, 5)

const getDepositRate = (people) => {
  if (people >= 5 && people <= 10) return 0.1
  if (people >= 11 && people <= 20) return 0.15
  if (people >= 21 && people <= 30) return 0.2
  if (people >= 31 && people <= 40) return 0.25
  if (people >= 41 && people <= 50) return 0.3
  return 0.1
}

export async function onRequestGet(context) {
  const { request, env } = context
  try {
    const url = new URL(request.url)
    const mode = url.searchParams.get('hub.mode')
    const token = url.searchParams.get('hub.verify_token')
    const challenge = url.searchParams.get('hub.challenge')

    if (mode === 'subscribe' && token === env.WHATSAPP_VERIFY_TOKEN) {
      return new Response(challenge, { status: 200 })
    }
    return new Response('Verification failed', { status: 403 })
  } catch {
    return new Response('Error', { status: 500 })
  }
}

export async function onRequestPost(context) {
  const { request, env } = context
  try {
    const body = await request.json()
    const entry = body?.entry?.[0]
    const change = entry?.changes?.[0]
    const value = change?.value
    const message = value?.messages?.[0]
    if (!value) return Response.json({ ok: true })

    if (!message && !value.statuses && value.contacts?.[0]?.wa_id) {
      await resetContact(env, value.contacts[0].wa_id)
      return Response.json({ ok: true })
    }
    if (!message) return Response.json({ ok: true })

    const from = message.from
    let text = message.text?.body || ''
    if (!text && message.interactive) {
      text = message.interactive.button_reply?.title || message.interactive.list_reply?.title || ''
    }
    if (!text && message.button) {
      text = message.button.text || ''
    }

    if (message.type === 'image' || message.image) {
      await processImage(env, from, message.image?.id)
    } else if (text) {
      await processText(env, from, text)
    } else {
      await sendWhatsApp(env, from, 'ðŸ™ Solo puedo leer mensajes de texto e imÃ¡genes. Intenta otra vez.')
    }

    return Response.json({ ok: true })
  } catch (e) {
    console.error('whatsapp webhook error', e)
    return Response.json({ ok: true })
  }
}

async function supabaseHeaders(env) {
  return {
    apikey: env.SUPABASE_PUBLISHABLE_KEY,
    Authorization: `Bearer ${env.SUPABASE_PUBLISHABLE_KEY}`,
  }
}

function bogotaHour() {
  try {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Bogota', hour: 'numeric', hour12: false }).formatToParts(new Date())
    return Number(parts.find((p) => p.type === 'hour').value)
  } catch {
    return new Date().getHours()
  }
}

function outOfHoursNotice() {
  const hour = bogotaHour()
  if (hour >= 8 && hour < 17) return ''
  return `\n\nðŸ¦‡ Gracias por comunicarte con DARKBAT.\n\nEn este momento estamos fuera de nuestro horario de atenciÃ³n.\n\nðŸ• Nuestro horario es todos los dÃ­as de 8:00 a. m. a 5:00 p. m.\n\nPuedes dejarnos tu mensaje y te atenderemos dentro de nuestro horario. ðŸ˜Š`
}

async function getAvailability(env) {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date())
  const headers = await supabaseHeaders(env)
  const res = await fetch(
    `${env.SUPABASE_URL}/rest/v1/bookings?select=visit_date,visit_time,people&visit_date=gte.${today}&${ACTIVE_STATUS}`,
    { headers }
  )
  const rows = res.ok ? await res.json() : []
  const usage = {}
  for (const r of rows) {
    const t = String(r.visit_time || '').slice(0, 5)
    usage[`${r.visit_date}|${t}`] = (usage[`${r.visit_date}|${t}`] || 0) + (r.people || 0)
  }
  const days = []
  for (let i = 0; i < 7; i++) {
    const d = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date(Date.now() + i * 86400000))
    const free = SLOT_TIMES.filter((t) => (usage[`${d}|${t}`] || 0) < SLOT_CAPACITY)
    days.push(`${d}: ${free.length ? free.join(', ') : 'DÃA COMPLETO'}`)
  }
  return { days, usage }
}

async function getDraft(env, from) {
  const headers = await supabaseHeaders(env)
  const res = await fetch(
    `${env.SUPABASE_URL}/rest/v1/bookings?select=id,name,email,lunch,comments,whatsapp,visit_date,visit_time,people,payment_status,created_at&whatsapp=eq.${from}&${DRAFT_STATUS}&order=created_at.desc&limit=1`,
    { headers }
  )
  if (!res.ok) return null
  const rows = await res.json()
  return rows?.[0] || null
}

function parseFields(text, dates) {
  const fields = {}
  const t = String(text || '').trim()
  if (!t) return fields

  const timeMatch = t.match(/(?:^|\s)(\d{1,2}):(\d{2})\b/)
  if (timeMatch) {
    const cand = `${timeMatch[1].padStart(2, '0')}:${timeMatch[2]}`
    if (SLOT_TIMES.includes(cand)) fields.visit_time = cand
  }

  const dateMatch = t.match(/(20\d{2})-(\d{2})-(\d{2})/)
  if (dateMatch) {
    const cand = `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`
    if (dates.includes(cand)) fields.visit_date = cand
  }

  const low = t.toLowerCase()
  let relIdx = -1
  if (/pasado\s+ma[nÃ±]ana/.test(low)) relIdx = 2
  else if (/ma[nÃ±]ana/.test(low)) relIdx = 1
  else if (/\bhoy\b/.test(low)) relIdx = 0
  else {
    const wdNames = ['lunes', 'martes', 'miÃ©rcoles', 'jueves', 'viernes', 'sÃ¡bado', 'domingo']
    const target = wdNames.findIndex((w) => new RegExp(`(^|\\s|,|el\\s+)${w}\\b`).test(low))
    if (target >= 0) {
      for (let i = 0; i < dates.length; i++) {
        const wd = new Date(`${dates[i]}T12:00:00Z`).toLocaleDateString('es-CO', { weekday: 'long', timeZone: 'UTC' })
        if (wd === wdNames[target]) {
          relIdx = i
          break
        }
      }
    }
  }
  if (relIdx >= 0 && dates[relIdx]) fields.visit_date = dates[relIdx]

  const peopleMatch = t.match(/(?:^|\s)(\d{1,2})(?:\s|$)/)
  if (peopleMatch) {
    const n = Number(peopleMatch[1])
    if (n >= 5 && n <= 50) fields.people = n
  }

  const emailMatch = t.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i)
  if (emailMatch) fields.email = emailMatch[0].toLowerCase()

  return fields
}

async function extractFields(env, text, daysText, dates) {
  const labels = dates.map((d, i) => {
    if (i === 0) return 'hoy'
    if (i === 1) return 'maÃ±ana'
    if (i === 2) return 'pasado maÃ±ana'
    return new Date(`${d}T12:00:00Z`).toLocaleDateString('es-CO', { weekday: 'long', timeZone: 'UTC' })
  })
  const dateList = dates.map((d, i) => `${labels[i]}=${d}`).join(', ')
  const prompt = `Extrae del mensaje del cliente en JSON puro (sin texto adicional): nombre, email (x@y), personas (entero 5-50), hora (HH:MM), fecha (YYYY-MM-DD) y almuerzo (true/false, null si no lo menciona). Si menciona un dÃ­a relativo usa: ${dateList}. Mensaje: "${text}" JSON: {"nombre": null, "email": null, "personas": null, "hora": null, "fecha": null, "almuerzo": null}`
  const ai = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.NVIDIA_API_KEY}` },
    body: JSON.stringify({
      model: 'nvidia/llama-3.3-nemotron-super-49b-v1',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 150,
      temperature: 0.2,
    }),
  })
  if (!ai.ok) return {}
  const data = await ai.json()
  const content = data.choices?.[0]?.message?.content ?? ''
  const match = content.match(/\{[\s\S]*?\}/)
  if (!match) return {}
  let obj = null
  try {
    obj = JSON.parse(match[0])
  } catch {
    try {
      obj = JSON.parse(match[0].replace(/([{,]\s*)([A-Za-z_][A-Za-z0-9_]*)\s*:/g, '$1"$2":'))
    } catch {
      return {}
    }
  }
  const fields = {}
  const name = String(obj.nombre || '').trim()
  if (name && name.toLowerCase() !== 'null') fields.name = name.slice(0, 100)
  const email = String(obj.email || '').trim().toLowerCase()
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email !== 'null') fields.email = email
  const fecha = String(obj.fecha || '')
  if (dates.includes(fecha)) fields.visit_date = fecha
  const hora = String(obj.hora || '')
  if (SLOT_TIMES.includes(hora)) fields.visit_time = hora
  const people = Number(obj.personas)
  if (Number.isInteger(people) && people >= 5 && people <= 50) fields.people = people
  if (obj.almuerzo === true || obj.almuerzo === false) fields.lunch = obj.almuerzo ? 'yes' : 'no'
  return fields
}

function freeSlots(usage, date, people) {
  return SLOT_TIMES.filter((t) => (usage[`${date}|${t}`] || 0) + (people || 0) <= SLOT_CAPACITY)
}

async function updateBooking(env, id, fields) {
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/bookings?id=eq.${id}`, {
    method: 'PATCH',
    headers: { ...(await supabaseHeaders(env)), 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify(fields),
  })
  if (!res.ok) return null
  return (await res.json())[0] || null
}

async function deleteBooking(env, id) {
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/bookings?id=eq.${id}`, {
    method: 'DELETE',
    headers: await supabaseHeaders(env),
  })
  return res.ok
}

async function sendInteractiveMenu(env, to) {
  const body = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'interactive',
    interactive: {
      type: 'button',
      header: { type: 'text', text: 'ðŸ¦‡ Â¡Hola! Bienvenido a DARKBAT.' },
      body: { text: 'Â¿En quÃ© podemos ayudarte? Toca una opciÃ³n ðŸ‘‡\n\nTambiÃ©n puedes escribir: 1 InformaciÃ³n Â· 2 Reservar Â· 3 Precio Â· 4 UbicaciÃ³n' },
      footer: { text: 'DARKBAT Â· Visita guiada a cueva natural Â· Santa SofÃ­a ðŸ•³ï¸' },
      action: {
        buttons: [
          { type: 'reply', reply: { id: 'btn-reservar', title: 'ðŸ“… Reservar visita' } },
          { type: 'reply', reply: { id: 'btn-precio', title: 'ðŸ’° Precios' } },
          { type: 'reply', reply: { id: 'btn-info', title: 'ðŸ•³ï¸ MÃ¡s informaciÃ³n' } },
        ],
      },
    },
  }
  return sendWhatsAppPayload(env, to, body)
}

async function contactStatus(env, from) {
  const headers = await supabaseHeaders(env)
  try {
    const res = await fetch(`${env.SUPABASE_URL}/rest/v1/wa_contacts?select=wa_id,last_seen&wa_id=eq.${from}`, { headers })
    if (!res.ok) return null
    const rows = await res.json()
    if (rows.length) {
      const hours = (Date.now() - new Date(rows[0].last_seen).getTime()) / 3600000
      await fetch(`${env.SUPABASE_URL}/rest/v1/wa_contacts?wa_id=eq.${from}`, {
        method: 'PATCH',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ last_seen: new Date().toISOString() }),
      })
      return { exists: true, stale: hours > 24 }
    }
    await fetch(`${env.SUPABASE_URL}/rest/v1/wa_contacts`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ wa_id: from }),
    })
    return { exists: false, stale: false }
  } catch {
    return null
  }
}

async function resetContact(env, waId) {
  const headers = await supabaseHeaders(env)
  try {
    const res = await fetch(`${env.SUPABASE_URL}/rest/v1/bookings?select=id&whatsapp=eq.${waId}&${DRAFT_STATUS}`, { headers })
    if (res.ok) {
      const rows = await res.json()
      for (const r of rows) {
        await fetch(`${env.SUPABASE_URL}/rest/v1/bookings?id=eq.${r.id}`, { method: 'DELETE', headers })
      }
    }
    await fetch(`${env.SUPABASE_URL}/rest/v1/wa_contacts?wa_id=eq.${waId}`, { method: 'DELETE', headers })
  } catch {
    // nothing
  }
}

async function sendMainMenu(env, from, intro) {
  const text = [
    intro || 'ðŸ¦‡ Â¡Hola! Bienvenido a DARKBAT. ðŸ‘‹',
    ``,
    `Somos un sitio turÃ­stico de naturaleza ubicado en Santa SofÃ­a, BoyacÃ¡, donde podrÃ¡s disfrutar de una visita guiada a una cueva natural.`,
    `ðŸ• Nuestro horario de atenciÃ³n es todos los dÃ­as de 8:00 a. m. a 5:00 p. m.`,
    ``,
    `Â¿En quÃ© podemos ayudarte?`,
    `1ï¸âƒ£ ðŸ•³ï¸ MÃ¡s informaciÃ³n`,
    `2ï¸âƒ£ ðŸ“… Quiero reservar`,
    `3ï¸âƒ£ ðŸ’° Precio`,
    `4ï¸âƒ£ ðŸ“ UbicaciÃ³n`,
    outOfHoursNotice(),
  ].join('\n')
  return sendWhatsApp(env, from, text)
}

async function sendInfo(env, from) {
  const text = [
    `ðŸ¦‡ *DARKBAT*`,
    `ðŸ“ Santa SofÃ­a, BoyacÃ¡`,
    `ðŸ• Horario de atenciÃ³n: todos los dÃ­as de 8:00 a. m. a 5:00 p. m.`,
    `ðŸ’° Precio: $15.000 COP por persona`,
    `ðŸ§­ Incluye visita guiada a la cueva.`,
    ``,
    `Si quieres visitarnos, puedo ayudarte a realizar una reserva. ðŸ“…`,
    `Responde *2* para reservar.`,
    outOfHoursNotice(),
  ].join('\n')
  return sendWhatsApp(env, from, text)
}

async function sendPrice(env, from) {
  const text = [
    `ðŸ’° El precio de entrada a DARKBAT es de *$15.000 COP* por persona.`,
    `La entrada incluye la visita guiada a la cueva. ðŸ¦‡`,
    `ðŸ• Nuestro horario de atenciÃ³n es de 8:00 a. m. a 5:00 p. m.`,
    ``,
    `Â¿Quieres realizar una reserva? ðŸ“… Responde *2*`,
    outOfHoursNotice(),
  ].join('\n')
  return sendWhatsApp(env, from, text)
}

async function sendPaymentInfo(env, from) {
  const text = [
    `ðŸ’³ *Formas de pago DARKBAT*`,
    ``,
    `El pago se realiza por *Nequi* al nÃºmero *${NEQUI}* ðŸ’™`,
    ``,
    `Al reservar se paga un *abono* segÃºn el grupo:`,
    `Â· 5-10 personas: 10%`,
    `Â· 11-20 personas: 15%`,
    `Â· 21-30 personas: 20%`,
    `Â· 31-40 personas: 25%`,
    `Â· 41-50 personas: 30%`,
    ``,
    `El saldo restante se paga el dÃ­a de la visita.`,
    `DespuÃ©s de pagar, envÃ­a aquÃ­ la captura del comprobante. ðŸ“·`,
    ``,
    `Â¿Quieres reservar? Responde *2* ðŸ“…`,
  ].join('\n')
  return sendWhatsApp(env, from, text)
}

async function sendLocation(env, from) {
  const text = [
    `ðŸ“ DARKBAT se encuentra en *Santa SofÃ­a, BoyacÃ¡, Colombia*. ðŸ¦‡`,
    `ðŸ• Nuestro horario de atenciÃ³n es de 8:00 a. m. a 5:00 p. m.`,
    outOfHoursNotice(),
  ].join('\n')
  return sendWhatsApp(env, from, text)
}

async function askNext(env, from, booking, usage) {
  if (!booking.name) {
    return sendWhatsApp(env, from, 'ðŸ¦‡ Â¡Perfecto! Vamos a realizar tu reserva.\n\nPrimero, Â¿cuÃ¡l es tu nombre?')
  }
  if (!booking.email || booking.email.startsWith('wa-')) {
    return sendWhatsApp(env, from, 'ðŸ“§ Â¿CuÃ¡l es tu correo electrÃ³nico?\n(Ej: correo@ejemplo.com)')
  }
  if (!booking.people) {
    return sendWhatsApp(env, from, 'ðŸ‘¥ Â¿CuÃ¡ntas personas asistirÃ¡n?\n(MÃ­nimo 5, mÃ¡ximo 50)')
  }
  if (!booking.visit_date) {
    return sendWhatsApp(env, from, 'ðŸ“… Â¿QuÃ© fecha deseas visitar DARKBAT?\n(Ej: "maÃ±ana", "el sÃ¡bado" â€” no aceptamos fechas pasadas)')
  }
  if (!booking.visit_time) {
    const free = freeSlots(usage, booking.visit_date, booking.people || 0)
    if (!free.length) return sendWhatsApp(env, from, `ðŸ˜… Ese dÃ­a estÃ¡ completo. Elige otra fecha (ej: "maÃ±ana").`)
    return sendWhatsApp(env, from, `ðŸ• Â¿A quÃ© hora deseas realizar la visita?\n\nNuestro horario de atenciÃ³n es de 8:00 a. m. a 5:00 p. m.\nHorarios libres para el ${booking.visit_date}: ${free.join(', ')}`)
  }
  if (!booking.lunch) {
    return sendWhatsApp(env, from, [
      `ðŸ½ï¸ Â¿Deseas incluir almuerzo en tu visita?`,
      ``,
      `1ï¸âƒ£ SÃ­, deseo almuerzo`,
      `2ï¸âƒ£ No, gracias`,
      ``,
      `âš ï¸ El almuerzo debe reservarse con al menos una semana de anticipaciÃ³n.`,
    ].join('\n'))
  }
  if (booking.comments === undefined || booking.comments === null) {
    return sendWhatsApp(env, from, 'ðŸ“ Â¿Alguna solicitud especial? (opcional)\n\nEscribe tu comentario o responde *ninguno* para continuar.')
  }
  return showSummary(env, from, booking)
}

async function showSummary(env, from, booking) {
  const total = booking.people * PRICE
  const rate = getDepositRate(booking.people)
  const deposit = Math.round(total * rate)
  await updateBooking(env, booking.id, { payment_status: 'awaiting_confirm', comments: null })
  const text = [
    `ðŸ¦‡ *RESUMEN DE TU RESERVA*`,
    ``,
    `ðŸ‘¤ Nombre: ${booking.name}`,
    `ðŸ“§ Correo: ${booking.email}`,
    `ðŸ‘¥ Personas: ${booking.people}`,
    `ðŸ“… Fecha: ${booking.visit_date}`,
    `ðŸ• Hora: ${t5(booking.visit_time)}`,
    `ðŸ½ï¸ Almuerzo: ${booking.lunch === 'yes' ? 'SÃ­' : 'No'}`,
    `ðŸ“ Comentarios: ${booking.comments || 'Ninguno'}`,
    `ðŸ’° Total: $${total.toLocaleString('es-CO')} COP`,
    ``,
    `Â¿Los datos son correctos?`,
    `1ï¸âƒ£ âœ… Confirmar`,
    `2ï¸âƒ£ âœï¸ Modificar`,
  ].join('\n')
  return sendWhatsApp(env, from, text)
}

async function startBooking(env, from, text) {
  const { days, usage } = await getAvailability(env)
  const dates = days.map((l) => l.split(':')[0])
  const deterministic = parseFields(text, dates)
  const fields = Object.keys(deterministic).length ? deterministic : await extractFields(env, text, days.join('\n'), dates)
  const headers = await supabaseHeaders(env)
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/bookings`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify({
      name: fields.name || null,
      whatsapp: from,
      email: fields.email || `wa-${from}@darkbat.local`,
      visit_date: fields.visit_date || null,
      visit_time: fields.visit_time || null,
      people: fields.people || null,
      lunch: fields.lunch || null,
      payment_status: 'draft',
    }),
  })
  const booking = res.ok ? (await res.json())[0] : null
  if (!booking) return sendWhatsApp(env, from, 'ðŸ˜¢ Hubo un problema guardando tu reserva. Intenta de nuevo.')
  return askNext(env, from, booking, usage)
}

async function continueBooking(env, from, draft, text, lower) {
  if (/^(no|nel|nop|nada)\b/i.test(lower.trim())) {
    await deleteBooking(env, draft.id)
    return sendWhatsApp(env, from, 'Listo, cancelamos el proceso. ðŸ˜Š Â¿En quÃ© mÃ¡s te ayudo?')
  }
  if (/^(cancelar|cancelaciÃ³n|cancelacion|anular)\b/i.test(lower.trim())) {
    await deleteBooking(env, draft.id)
    return sendWhatsApp(env, from, 'Listo, cancelamos el proceso de reserva. ðŸ˜Š')
  }
  if (/^(volver|men[uÃº]|ayuda|ayudame)\b/i.test(lower.trim())) {
    await deleteBooking(env, draft.id)
    return sendMainMenu(env, from, 'ðŸ¦‡ Volvamos al menÃº principal.')
  }
  if (/^(hola|buenas|buen[oa]s?|hey|hi|ey|saludos)\b/i.test(lower.trim())) {
    await deleteBooking(env, draft.id)
    return sendMainMenu(env, from, 'ðŸ¦‡ Â¡Hola! Bienvenido a DARKBAT. ðŸ‘‹')
  }
  if (/(m[aÃ¡]s informaci|ubicaci[oÃ³]n|precios?|reservar visita)/i.test(lower)) {
    await deleteBooking(env, draft.id)
    if (/reservar visita/.test(lower)) return startBooking(env, from, text)
    if (/preci/.test(lower)) return sendPrice(env, from)
    if (/ubicaci/.test(lower)) return sendLocation(env, from)
    return sendInfo(env, from)
  }

  const { days, usage } = await getAvailability(env)
  const dates = days.map((l) => l.split(':')[0])

  if (draft.payment_status === 'awaiting_confirm') {
    if (draft.comments === 'modify' && /^([1-7])$/.test(lower.trim())) {
      const field = ['name', 'people', 'visit_date', 'visit_time', 'email', 'lunch', 'comments'][Number(lower.trim()) - 1]
      const clear = field === 'email' ? `wa-${from}@darkbat.local` : null
      await updateBooking(env, draft.id, { [field]: clear, payment_status: 'draft', comments: null })
      const updated = { ...draft, [field]: clear, payment_status: 'draft' }
      return askNext(env, from, updated, usage)
    }
    if (/^(2|modificar|modific)\b/i.test(lower.trim())) {
      await updateBooking(env, draft.id, { comments: 'modify' })
      return sendWhatsApp(env, from, [
        `âœï¸ Â¿QuÃ© dato deseas modificar?`,
        `1ï¸âƒ£ Nombre`,
        `2ï¸âƒ£ Personas`,
        `3ï¸âƒ£ Fecha`,
        `4ï¸âƒ£ Hora`,
        `5ï¸âƒ£ Correo electrÃ³nico`,
        `6ï¸âƒ£ Almuerzo`,
        `7ï¸âƒ£ Comentarios`,
      ].join('\n'))
    }
    if (/^(1|confirmar|confirmo|s[Ã­i]|sip|sisi|dale|ok|okey|listo|adelante|sisas)\b/i.test(lower.trim())) {
      return finalizeBooking(env, from, draft)
    }
  }

  const step = !draft.lunch ? 'lunch' : draft.comments === null || draft.comments === undefined ? 'comments' : null
  const fields = {}
  if (step === 'lunch') {
    if (/^(1|s[Ã­i]|sip|sisi|claro|dale)\b/i.test(lower.trim())) fields.lunch = 'yes'
    else if (/^(2|no|nop|nel)\b/i.test(lower.trim())) fields.lunch = 'no'
  } else if (step === 'comments') {
    if (/^(ninguno|no|nada|[-.])\b/i.test(lower.trim())) fields.comments = null
    else fields.comments = text.trim().slice(0, 300)
  }

  if (!Object.keys(fields).length) {
    Object.assign(fields, parseFields(text, dates))
  }

  if (!Object.keys(fields).length) {
    const extracted = await extractFields(env, text, days.join('\n'), dates)
    Object.assign(fields, extracted)
  }

  if (!Object.keys(fields).length && !draft.name && text.trim().length <= 60 && !/\d/.test(text.trim()) && !dates.includes(text.trim())) {
    fields.name = text.trim().slice(0, 100)
  }

  if (!Object.keys(fields).length) {
    if (draft.payment_status === 'awaiting_confirm') return showSummary(env, from, draft)
    return askNext(env, from, draft, usage)
  }

  const updated = await updateBooking(env, draft.id, { ...fields })
  if (!updated) return sendWhatsApp(env, from, 'ðŸ˜¢ Hubo un error guardando tus datos. Intenta de nuevo.')

  if (updated.visit_time && updated.visit_date === draft.visit_date && freeSlots(usage, updated.visit_date, updated.people || 0).indexOf(t5(updated.visit_time)) === -1) {
    await updateBooking(env, draft.id, { visit_time: null })
    const free = freeSlots(usage, updated.visit_date, updated.people || 0)
    return sendWhatsApp(env, from, `ðŸ˜… Ese horario ya no estÃ¡ libre. Disponibles: ${free.length ? free.join(', ') : 'otro dÃ­a'}.\nÂ¿A quÃ© hora prefieres?`)
  }

  return askNext(env, from, updated, usage)
}

async function finalizeBooking(env, from, draft) {
  const { usage } = await getAvailability(env)
  if ((usage[`${draft.visit_date}|${t5(draft.visit_time)}`] || 0) + draft.people > SLOT_CAPACITY) {
    const free = freeSlots(usage, draft.visit_date, draft.people)
    await updateBooking(env, draft.id, { visit_time: null, payment_status: 'draft', comments: null })
    return sendWhatsApp(env, from, `ðŸ˜… Ese horario se acaba de llenar. Estos siguen libres: ${free.length ? free.join(', ') : 'otro dÃ­a'}.\nÂ¿A quÃ© hora prefieres?`)
  }

  const total = draft.people * PRICE
  const rate = getDepositRate(draft.people)
  const deposit = Math.round(total * rate)
  await updateBooking(env, draft.id, {
    payment_status: 'pending_payment',
    total_cop: total,
    deposit_rate: rate,
    deposit_cop: deposit,
    comments: 'WhatsApp',
  })
  await sendTelegramAlert(env, { ...draft, total, deposit, depositRate: rate, receiptPath: null, source: 'bot' })
  return sendWhatsApp(env, from, [
    `âœ… Â¡Reserva registrada correctamente!`,
    ``,
    `ðŸ¦‡ *DARKBAT*`,
    `ðŸ‘¤ ${draft.name}`,
    `ðŸ“§ ${draft.email}`,
    `ðŸ‘¥ ${draft.people} personas`,
    `ðŸ“… ${draft.visit_date}`,
    `ðŸ• ${t5(draft.visit_time)}`,
    `ðŸ½ï¸ Almuerzo: ${draft.lunch === 'yes' ? 'SÃ­' : 'No'}${draft.comments ? `\nðŸ“ ${draft.comments}` : ''}`,
    `ðŸ’° Total: $${total.toLocaleString('es-CO')} COP`,
    ``,
    `ðŸ’³ Para confirmar tu cupo, paga el abono de *$${deposit.toLocaleString('es-CO')} COP* por Nequi (*${NEQUI}*) y envÃ­ame la captura del pago aquÃ­ mismo. âœ…`,
    `Â¡Te esperamos en DARKBAT! ðŸ¦‡`,
  ].join('\n'))
}

async function handleCancel(env, from) {
  const headers = await supabaseHeaders(env)
  const res = await fetch(
    `${env.SUPABASE_URL}/rest/v1/bookings?select=id,name,whatsapp,visit_date,visit_time,people&whatsapp=eq.${from}&payment_status=in.(pending_payment,pending_confirmation,confirmed,approved)&order=created_at.desc&limit=1`,
    { headers }
  )
  const booking = res.ok ? (await res.json())[0] : null
  if (!booking) {
    return sendWhatsApp(env, from, 'âš ï¸ No encontrÃ© reservas activas a tu nombre. Si quieres visitarnos, responde *2* para reservar. ðŸ¦‡')
  }
  await updateBooking(env, booking.id, { payment_status: 'cancelled' })
  await sendTelegramCancel(env, booking)
  return sendWhatsApp(env, from, `âœ… Tu reserva del *${booking.visit_date}* a las *${String(booking.visit_time || '').slice(0, 5)}* para *${booking.people}* personas fue *cancelada*.\n\nÂ¡Te esperamos en otra ocasiÃ³n! ðŸ¦‡`)
}

async function processText(env, from, text) {
  const lower = text.trim().replace(/^[^\p{L}\p{N}]+/u, '').toLowerCase()
  const draftRow = await getDraft(env, from)
  let draft = draftRow
  if (draftRow) {
    const ageHours = (Date.now() - new Date(draftRow.created_at).getTime()) / 3600000
    if (ageHours > 12) {
      await deleteBooking(env, draftRow.id)
      draft = null
    }
  }
  if (draft) return continueBooking(env, from, draft, text, lower)

  const contact = await contactStatus(env, from)
  let isNew = !contact || !contact.exists
  if (contact?.stale) {
    await resetContact(env, from)
    isNew = true
  }
  if (isNew && /^(hola|buenas|buen[oa]s?|hey|hi|ey|saludos|ola|alo)\b/i.test(lower)) {
    await sendInteractiveMenu(env, from)
    return
  }

  if (/(cancelar|cancelaci|anular)/i.test(lower)) return handleCancel(env, from)
  if (/^(buenas|hola|buen|ayuda|ayudame|info\b|infor)/i.test(lower) || /^(volver|men[uÃº]|1)\b/.test(lower) || /^1$/.test(lower)) {
    if (/^(1|info)/i.test(lower)) return sendInfo(env, from)
    return sendMainMenu(env, from)
  }
  if (/^(2|reserv|quiero ir|vamos|me gustarÃ­a ir|me gustaria ir|cupo|disponib|horario|personas|pax|fecha\b|dÃ­a\b|dia\b|hoy\b|maÃ±ana|manana)/i.test(lower)) {
    return startBooking(env, from, text)
  }
  if (/^(pago|pagar|nequi|abono)\b/i.test(lower) || /c[oÃ³]mo pago|como pago|d[oÃ³]nde pago|donde pago|qu[eÃ©] es el abono|cu[aÃ¡]nto es el abono|cuanto es el abono/i.test(lower)) {
    return sendPaymentInfo(env, from)
  }
  if (/^(3|precio|cu[aÃ¡]nto vale|cuanto vale|cu[aÃ¡]nto cuesta|cuanto cuesta|cobran|tarifa|valor|entrada)/i.test(lower) || /^3$/.test(lower)) {
    return sendPrice(env, from)
  }
  if (/^(4|ubica|d[oÃ³]nde queda|donde queda|d[oÃ³]nde quedan|donde quedan|c[oÃ³]mo llego|como llego|c[oÃ³]mo llegar|como llegar|direcci[oÃ³]n|direccion)/i.test(lower) || /^4$/.test(lower)) {
    return sendLocation(env, from)
  }
  if (/informaci[oÃ³]n|informacion|m[aÃ¡]s|mas|conocer|cueva/i.test(lower)) return sendInfo(env, from)
  if (/reserv/i.test(lower)) return startBooking(env, from, text)

  return generalChat(env, from, text)
}

async function generalChat(env, from, text) {
  const { days } = await getAvailability(env)
  const prompt = `Eres el asistente de WhatsApp de DARKBAT, cueva turÃ­stica en Santa SofÃ­a (BoyacÃ¡, Colombia). Precio $15.000 COP/persona, horario 8:00-17:00, mÃ­nimo 5 personas. Pago por Nequi (314 459 5642). MenÃº: 1 informaciÃ³n, 2 reservar, 3 precio, 4 ubicaciÃ³n.
El cliente (${from}) escribiÃ³: "${text}".
Disponibilidad real consultada (fecha: horarios libres):
${days.join('\n')}
Responde en mÃ¡ximO 3 lÃ­neas, en espaÃ±ol, amable, SOLO lo que pregunta el cliente. NO repitas la informaciÃ³n general de DARKBAT ni el menÃº completo a menos que te lo pidan. Si quiere reservar, dile que responda "2".`
  const ai = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.NVIDIA_API_KEY}` },
    body: JSON.stringify({
      model: 'nvidia/llama-3.3-nemotron-super-49b-v1',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 250,
      temperature: 0.6,
    }),
  })
  if (ai.ok) {
    const data = await ai.json()
    const reply = data.choices?.[0]?.message?.content
    if (reply) {
      await sendWhatsApp(env, from, `${reply}${outOfHoursNotice()}`)
      return
    }
  }
  await sendWhatsApp(env, from, `${'ðŸ¦‡ Â¡Hola! Soy el asistente de DARKBAT.\n\nResponde con el nÃºmero de la opciÃ³n:\n1ï¸âƒ£ InformaciÃ³n\n2ï¸âƒ£ Reservar\n3ï¸âƒ£ Precio\n4ï¸âƒ£ UbicaciÃ³n'}${outOfHoursNotice()}`)
}

async function processImage(env, from, mediaId) {
  const headers = await supabaseHeaders(env)
  const bookingRes = await fetch(
    `${env.SUPABASE_URL}/rest/v1/bookings?select=id,name,whatsapp,visit_date,visit_time,people,deposit_cop,payment_status&whatsapp=eq.${from}&payment_status=in.(pending_payment,pending_confirmation)&order=created_at.desc&limit=1`,
    { headers }
  )
  const booking = bookingRes.ok ? (await bookingRes.json())[0] : null

    let buffer = null
    let contentType = 'image/jpeg'
    let base64 = ''
    try {
      const media = await fetch(`https://graph.facebook.com/v21.0/${mediaId}`, {
        headers: { Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}` },
      })
      if (!media.ok) throw new Error('media')
      const mediaData = await media.json()
      const img = await fetch(mediaData.url, {
        headers: { Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}` },
      })
      if (!img.ok) throw new Error('download')
      buffer = await img.arrayBuffer()
      contentType = img.headers.get('content-type') || 'image/jpeg'
      let binary = ''
      const bytes = new Uint8Array(buffer)
      for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i])
      base64 = btoa(binary)
    } catch (e) {
      await sendWhatsApp(env, from, 'ðŸ˜¢ No pude descargar tu imagen. Intenta enviarla nuevamente.')
      return
    }

    const deposit = Number(booking?.deposit_cop || 0)
    try {
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
              text: `Â¿Esta imagen es un comprobante de pago de Nequi o transferencia bancaria? El abono esperado es $${deposit.toLocaleString('es-CO')} COP. Responde SOLO JSON: {"es_comprobante":true|false,"monto":"solo nÃºmeros, ej 22500","detalle":"breve en espaÃ±ol"}. Reglas: es_comprobante es true SOLO si se ve un recibo/soporte real de pago con monto y fecha (pantalla de Nequi, transferencia, comprobante bancario). false si es foto de persona, paisaje, meme, captura sin datos de pago, etc. El monto debe ser el valor pagado que veas. Si el monto es menor al abono esperado, indica "es_comprobante":false con detalle del monto leÃ­do.`,
            },
            { type: 'image_url', image_url: { url: `data:${contentType};base64,${base64}` } },
          ],
        }],
        max_tokens: 200,
        temperature: 0.1,
      }),
    })
    if (!ai.ok) throw new Error('ai')

    const data = await ai.json()
    const content = data.choices?.[0]?.message?.content ?? ''
    const match = content.match(/\{[\s\S]*?\}/)
    let result = null
    if (match) {
      try {
        result = JSON.parse(match[0])
      } catch {
        const fixed = match[0].replace(/([{,]\s*)([A-Za-z_][A-Za-z0-9_]*)\s*:/g, '$1"$2":')
        try {
          result = JSON.parse(fixed)
        } catch { result = null }
      }
    }

    if (!result) throw new Error('parse')
    if (!result.es_comprobante) {
      await sendWhatsApp(env, from, `âŒ Esa imagen no parece un comprobante de pago. ${result.detalle || ''}\n\nAdjunta la captura del pago de Nequi (${NEQUI}).`)
      return
    }
    if (!booking) {
      await sendWhatsApp(env, from, `ðŸ“· Â¡RecibÃ­ tu comprobante ($${result.monto || 'â€”'} COP)! Pero aÃºn no tengo tu reserva.\n\nResponde *2* para reservar y luego me envÃ­as el comprobante. ðŸ¦‡`)
      return
    }

    const amount = Number(result.monto)
    const matchAmount = deposit > 0 && amount > 0 && Math.abs(amount - deposit) <= Math.max(1000, deposit * 0.05)

    if (matchAmount) {
      const receiptPath = await uploadReceipt(env, buffer, contentType, `wa-${from}-${Date.now()}.jpg`)
      await updateBooking(env, booking.id, {
        payment_status: 'confirmed',
        receipt_path: receiptPath || booking.receipt_path,
      })
      await sendTelegramPayment(env, booking, amount, deposit, true)
      await sendWhatsApp(env, from, `âœ… Â¡Pago confirmado! *$${amount.toLocaleString('es-CO')} COP* recibidos. Tu reserva para el ${booking.visit_date} a las ${t5(booking.visit_time)} estÃ¡ lista. Â¡Te esperamos! ðŸ¦‡`)
      return
    }

    await updateBooking(env, booking.id, { payment_status: 'pending_confirmation' })
    await sendTelegramPayment(env, booking, amount, deposit, false)
    await sendWhatsApp(env, from, `ðŸ“· RecibÃ­ tu comprobante por *$${(amount || 0).toLocaleString('es-CO')} COP*, pero el abono esperado es *$${deposit.toLocaleString('es-CO')} COP*.\n\nÂ¿El pago es correcto? Mientras tanto lo reviso y te confirmo. ðŸ™`)
  } catch {
    if (booking) await updateBooking(env, booking.id, { payment_status: 'pending_confirmation' })
    await sendWhatsApp(env, from, 'ðŸ˜¢ No pude leer tu imagen. Intenta con una captura mÃ¡s clara del pago de Nequi.')
  }
}

async function uploadReceipt(env, bytes, contentType, filename) {
  try {
    const res = await fetch(`${env.SUPABASE_URL}/storage/v1/object/comprobantes-db/${filename}`, {
      method: 'POST',
      headers: { ...(await supabaseHeaders(env)), 'Content-Type': contentType },
      body: bytes,
    })
    if (!res.ok) return null
    return `${env.SUPABASE_URL}/storage/v1/object/public/comprobantes-db/${filename}`
  } catch {
    return null
  }
}

async function sendWhatsApp(env, to, text) {
  return sendWhatsAppPayload(env, to, {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'text',
    text: { body: text },
  })
}

async function sendWhatsAppPayload(env, to, body) {
  const res = await fetch(`https://graph.facebook.com/v21.0/${env.WHATSAPP_PHONE_ID}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`,
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const detail = await res.text()
    console.error('WhatsApp send error', res.status, detail)
  }
  return res
}

async function sendTelegramAlert(env, booking) {
  const message = [
    `ðŸ¦‡ *NUEVA RESERVA DARKBAT*`,
    ``,
    `ðŸ‘¤ *Cliente:* ${booking.name || 'â€”'}`,
    `ðŸ“§ *Correo:* ${booking.email || 'â€”'}`,
    `ðŸ“± *WhatsApp:* ${booking.whatsapp}`,
    `ðŸ‘¥ *Personas:* ${booking.people || 'â€”'}`,
    `ðŸ“… *Fecha:* ${booking.visit_date || 'â€”'}`,
    `ðŸ• *Hora:* ${t5(booking.visit_time) || 'â€”'}`,
    `ðŸ½ï¸ *Almuerzo:* ${booking.lunch === 'yes' ? 'SÃ­' : booking.lunch === 'no' ? 'No' : 'â€”'}`,
    `ðŸ“ *Comentarios:* ${booking.comments || 'Ninguno'}`,
    `ðŸ’° *Total:* $${(booking.total || 0).toLocaleString('es-CO')} COP`,
    `ðŸ’³ *Abono (${Math.round(booking.depositRate * 100)}%):* $${(booking.deposit || 0).toLocaleString('es-CO')} COP`,
    `ðŸ“Œ *Estado:* Confirmada por el cliente (pendiente de pago)`,
  ].join('\n')

  try {
    await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, text: message, parse_mode: 'Markdown' }),
    })
  } catch (e) {
    console.error('Telegram alert error', e)
  }
}

async function sendTelegramCancel(env, booking) {
  const message = [
    `ðŸš« *RESERVA CANCELADA*`,
    `ðŸ‘¤ ${booking.name || 'â€”'} Â· ðŸ“± ${booking.whatsapp}`,
    `ðŸ“… ${booking.visit_date || 'â€”'} ${booking.visit_time ? `a las ${String(booking.visit_time).slice(0, 5)}` : ''} Â· ðŸ‘¥ ${booking.people || 'â€”'} pers`,
  ].join('\n')

  try {
    await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, text: message }),
    })
  } catch (e) {
    console.error('Telegram alert error', e)
  }
}

async function sendTelegramPayment(env, booking, amount, deposit, match) {
  const message = [
    `ðŸ§¾ *Comprobante por WhatsApp*`,
    `ðŸ‘¤ ${booking.name || 'â€”'} Â· ðŸ“± ${booking.whatsapp}`,
    `ðŸ“… ${booking.visit_date || 'â€”'} ${booking.visit_time ? `a las ${String(booking.visit_time).slice(0, 5)}` : ''} Â· ðŸ‘¥ ${booking.people || 'â€”'} pers`,
    `ðŸ’° Comprobante: $${(amount || 0).toLocaleString('es-CO')} COP`,
    `ðŸ’³ Abono esperado: $${(deposit || 0).toLocaleString('es-CO')} COP`,
    `ðŸ“Œ Estado: ${match ? 'âœ… CONFIRMADO' : 'âš ï¸ REVISAR (no coincide)'}`,
  ].join('\n')

  try {
    await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, text: message }),
    })
  } catch (e) {
    console.error('Telegram alert error', e)
  }
}