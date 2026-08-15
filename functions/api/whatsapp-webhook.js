const SLOT_TIMES = ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00']
const SLOT_CAPACITY = 50
const ACTIVE_STATUS = 'payment_status=neq.rejected&payment_status=neq.cancelled&payment_status=neq.draft&payment_status=neq.awaiting_confirm&payment_status=neq.completed'
const DRAFT_STATUS = 'payment_status=in.(draft,awaiting_confirm)'
const PRICE = 15000
const NEQUI = '314 459 5642'
const t5 = (t) => String(t || '').slice(0, 5)

const codeOf = (b) => b?.code || (b?.id ? `DB-${String(b.id).replace(/-/g, '').slice(0, 5).toUpperCase()}` : '')
const statusLabel = (s) => ({
  pending_payment: '💤 Pendiente de pago',
  pending_confirmation: '⏳ En revisión',
  confirmed: '✅ Confirmada',
  approved: '✅ Confirmada',
  rejected: '❌ Rechazada',
  cancelled: '🚫 Cancelada',
  completed: '🏁 Completada',
}[s] || s)

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
  const { request, env, waitUntil } = context
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
      const replyId = message.interactive.button_reply?.id || message.interactive.list_reply?.id || ''
      text = message.interactive.button_reply?.title || message.interactive.list_reply?.title || ''
      if (replyId === 'opt-info') text = '1'
      else if (replyId === 'opt-reservar') text = '2'
      else if (replyId === 'opt-precio') text = '3'
      else if (replyId === 'opt-ubicacion') text = '4'
    }
    if (!text && message.button) {
      text = message.button.text || ''
    }

    if (message.type === 'image' || message.image) {
      waitUntil(processImage(env, from, message.image?.id))
    } else if (text) {
      waitUntil(processText(env, from, text))
    } else {
      waitUntil(sendWhatsApp(env, from, '🙏 Solo puedo leer mensajes de texto e imágenes. Intenta otra vez.'))
    }

    return Response.json({ ok: true })
  } catch (e) {
    console.error('whatsapp webhook error', e)
    return Response.json({ ok: true })
  }
}

async function supabaseHeaders(env) {
  const key = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_PUBLISHABLE_KEY
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
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
  return `\n\n🦇 Gracias por comunicarte con DARKBAT.\n\nEn este momento estamos fuera de nuestro horario de atención.\n\n🕐 Nuestro horario es todos los días de 8:00 a. m. a 5:00 p. m.\n\nPuedes dejarnos tu mensaje y te atenderemos dentro de nuestro horario. 😊`
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
    days.push(`${d}: ${free.length ? free.join(', ') : 'DÍA COMPLETO'}`)
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
  if (/pasado\s+ma[nñ]ana/.test(low)) relIdx = 2
  else if (/ma[nñ]ana/.test(low)) relIdx = 1
  else if (/\bhoy\b/.test(low)) relIdx = 0
  else {
    const wdNames = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo']
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
    if (i === 1) return 'mañana'
    if (i === 2) return 'pasado mañana'
    return new Date(`${d}T12:00:00Z`).toLocaleDateString('es-CO', { weekday: 'long', timeZone: 'UTC' })
  })
  const dateList = dates.map((d, i) => `${labels[i]}=${d}`).join(', ')
  const prompt = `Extrae del mensaje del cliente en JSON puro (sin texto adicional): nombre, email (x@y), personas (entero 5-50), hora (HH:MM), fecha (YYYY-MM-DD) y almuerzo (true/false, null si no lo menciona). Si menciona un día relativo usa: ${dateList}. Mensaje: "${text}" JSON: {"nombre": null, "email": null, "personas": null, "hora": null, "fecha": null, "almuerzo": null}`
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
      type: 'list',
      header: { type: 'text', text: '🦇 ¡Hola! Bienvenido a DARKBAT.' },
      body: { text: '¿En qué podemos ayudarte? Toca una opción 👇' },
      footer: { text: 'DARKBAT · Visita guiada a cueva natural · Santa Sofía 🕳️' },
      action: {
        button: 'Ver opciones',
        sections: [
          {
            title: 'Opciones',
            rows: [
              { id: 'opt-info', title: '🕳️ Más información' },
              { id: 'opt-reservar', title: '📅 Reservar visita' },
              { id: 'opt-precio', title: '💰 Precios' },
              { id: 'opt-ubicacion', title: '📍 Ubicación' },
            ],
          },
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
    intro || '🦇 ¡Hola! Bienvenido a DARKBAT. 👋',
    ``,
    `Somos un sitio turístico de naturaleza ubicado en Santa Sofía, Boyacá, donde podrás disfrutar de una visita guiada a una cueva natural.`,
    `🕐 Nuestro horario de atención es todos los días de 8:00 a. m. a 5:00 p. m.`,
    ``,
    `¿En qué podemos ayudarte?`,
    `1️⃣ 🕳️ Más información`,
    `2️⃣ 📅 Quiero reservar`,
    `3️⃣ 💰 Precio`,
    `4️⃣ 📍 Ubicación`,
    outOfHoursNotice(),
  ].join('\n')
  return sendWhatsApp(env, from, text)
}

async function sendInfo(env, from) {
  const text = [
    `🦇 *DARKBAT*`,
    `📍 Santa Sofía, Boyacá`,
    `🕐 Horario de atención: todos los días de 8:00 a. m. a 5:00 p. m.`,
    `💰 Precio: $15.000 COP por persona`,
    `🧭 Incluye visita guiada a la cueva.`,
    ``,
    `Si quieres visitarnos, puedo ayudarte a realizar una reserva. 📅`,
    `Responde *2* para reservar.`,
    outOfHoursNotice(),
  ].join('\n')
  return sendWhatsApp(env, from, text)
}

async function sendPrice(env, from) {
  const text = [
    `💰 El precio de entrada a DARKBAT es de *$15.000 COP* por persona.`,
    `La entrada incluye la visita guiada a la cueva. 🦇`,
    `🕐 Nuestro horario de atención es de 8:00 a. m. a 5:00 p. m.`,
    ``,
    `¿Quieres realizar una reserva? 📅 Responde *2*`,
    outOfHoursNotice(),
  ].join('\n')
  return sendWhatsApp(env, from, text)
}

async function sendPaymentInfo(env, from) {
  const text = [
    `💳 *Formas de pago DARKBAT*`,
    ``,
    `El pago se realiza por *Nequi* al número *${NEQUI}* 💙`,
    ``,
    `Al reservar se paga un *abono* según el grupo:`,
    `· 5-10 personas: 10%`,
    `· 11-20 personas: 15%`,
    `· 21-30 personas: 20%`,
    `· 31-40 personas: 25%`,
    `· 41-50 personas: 30%`,
    ``,
    `El saldo restante se paga el día de la visita.`,
    `Después de pagar, envía aquí la captura del comprobante. 📷`,
    ``,
    `¿Quieres reservar? Responde *2* 📅`,
  ].join('\n')
  return sendWhatsApp(env, from, text)
}

async function sendLocation(env, from) {
  const text = [
    `📍 DARKBAT se encuentra en *Santa Sofía, Boyacá, Colombia*. 🦇`,
    `🕐 Nuestro horario de atención es de 8:00 a. m. a 5:00 p. m.`,
    outOfHoursNotice(),
  ].join('\n')
  return sendWhatsApp(env, from, text)
}

async function askNext(env, from, booking, usage) {
  if (!booking.name) {
    return sendWhatsApp(env, from, '🦇 ¡Perfecto! Vamos a realizar tu reserva.\n\nPrimero, ¿cuál es tu nombre?')
  }
  if (!booking.email || booking.email.startsWith('wa-')) {
    return sendWhatsApp(env, from, '📧 ¿Cuál es tu correo electrónico?\n(Ej: correo@ejemplo.com)')
  }
  if (!booking.people) {
    return sendWhatsApp(env, from, '👥 ¿Cuántas personas asistirán?\n(Mínimo 5, máximo 50)')
  }
  if (!booking.visit_date) {
    return sendWhatsApp(env, from, '📅 ¿Qué fecha deseas visitar DARKBAT?\n(Ej: "mañana", "el sábado" — no aceptamos fechas pasadas)')
  }
  if (!booking.visit_time) {
    const free = freeSlots(usage, booking.visit_date, booking.people || 0)
    if (!free.length) return sendWhatsApp(env, from, `😅 Ese día está completo. Elige otra fecha (ej: "mañana").`)
    return sendWhatsApp(env, from, `🕐 ¿A qué hora deseas realizar la visita?\n\nNuestro horario de atención es de 8:00 a. m. a 5:00 p. m.\nHorarios libres para el ${booking.visit_date}: ${free.join(', ')}`)
  }
  if (!booking.lunch) {
    return sendWhatsApp(env, from, [
      `🍽️ ¿Deseas incluir almuerzo en tu visita?`,
      ``,
      `1️⃣ Sí, deseo almuerzo`,
      `2️⃣ No, gracias`,
      ``,
      `⚠️ El almuerzo debe reservarse con al menos una semana de anticipación.`,
    ].join('\n'))
  }
  if (booking.comments === 'pending') {
    return sendWhatsApp(env, from, '✍️ Escribe tu comentario o responde *2* para omitirlo.')
  }
  if (booking.comments === undefined || booking.comments === null) {
    return sendWhatsApp(env, from, [
      `📝 ¿Alguna solicitud especial? (opcional)`,
      ``,
      `1️⃣ Sí, escribir un comentario`,
      `2️⃣ No tengo comentarios`,
    ].join('\n'))
  }
  return showSummary(env, from, booking)
}

async function showSummary(env, from, booking) {
  const total = booking.people * PRICE
  await updateBooking(env, booking.id, { payment_status: 'awaiting_confirm' })
  const text = [
    `🦇 *RESUMEN DE TU RESERVA*`,
    ``,
    `🎟️ Código: ${codeOf(booking)}`,
    `👤 Nombre: ${booking.name}`,
    `📧 Correo: ${booking.email}`,
    `👥 Personas: ${booking.people}`,
    `📅 Fecha: ${booking.visit_date}`,
    `🕐 Hora: ${t5(booking.visit_time)}`,
    `🍽️ Almuerzo: ${booking.lunch === 'yes' ? 'Sí' : 'No'}`,
    `📝 Comentarios: ${booking.comments || 'Ninguno'}`,
    `💰 Total: $${total.toLocaleString('es-CO')} COP`,
    ``,
    `¿Los datos son correctos?`,
    `1️⃣ ✅ Confirmar`,
    `2️⃣ ✏️ Modificar`,
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
  if (!booking) return sendWhatsApp(env, from, '😢 Hubo un problema guardando tu reserva. Intenta de nuevo.')
  return askNext(env, from, booking, usage)
}

async function continueBooking(env, from, draft, text, lower) {
  if (/^(no|nel|nop|nada)\b/i.test(lower.trim())) {
    await deleteBooking(env, draft.id)
    return sendWhatsApp(env, from, 'Listo, cancelamos el proceso. 😊 ¿En qué más te ayudo?')
  }
  if (/^(cancelar|cancelación|cancelacion|anular)\b/i.test(lower.trim())) {
    await deleteBooking(env, draft.id)
    return sendWhatsApp(env, from, 'Listo, cancelamos el proceso de reserva. 😊')
  }
  if (/^(volver|men[uú]|ayuda|ayudame)\b/i.test(lower.trim())) {
    await deleteBooking(env, draft.id)
    return sendMainMenu(env, from, '🦇 Volvamos al menú principal.')
  }
  if (/^(hola|buenas|buen[oa]s?|hey|hi|ey|saludos)\b/i.test(lower.trim())) {
    await deleteBooking(env, draft.id)
    return sendMainMenu(env, from, '🦇 ¡Hola! Bienvenido a DARKBAT. 👋')
  }
  if (/(m[aá]s informaci|ubicaci[oó]n|precios?|reservar visita)/i.test(lower)) {
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
        `✏️ ¿Qué dato deseas modificar?`,
        `1️⃣ Nombre`,
        `2️⃣ Personas`,
        `3️⃣ Fecha`,
        `4️⃣ Hora`,
        `5️⃣ Correo electrónico`,
        `6️⃣ Almuerzo`,
        `7️⃣ Comentarios`,
      ].join('\n'))
    }
    if (/^(1|confirmar|confirmo|s[íi]|sip|sisi|dale|ok|okey|listo|adelante|sisas)\b/i.test(lower.trim())) {
      return finalizeBooking(env, from, draft)
    }
  }

  const step = !draft.lunch ? 'lunch' : draft.comments === 'pending' ? 'comment_text' : draft.comments === null || draft.comments === undefined ? 'comments' : null
  const fields = {}
  if (step === 'lunch') {
    if (/^(1|s[íi]|sip|sisi|claro|dale)\b/i.test(lower.trim())) fields.lunch = 'yes'
    else if (/^(2|no|nop|nel)\b/i.test(lower.trim())) fields.lunch = 'no'
  } else if (step === 'comments') {
    if (/^(1|s[íi]|sip|sisi|claro|dale)\b/i.test(lower.trim())) fields.comments = 'pending'
    else if (/^(2|ninguno|nada|[-.])\b/i.test(lower.trim())) fields.comments = ''
    else fields.comments = text.trim().slice(0, 300)
  } else if (step === 'comment_text') {
    if (/^(2|ninguno|nada|[-.])\b/i.test(lower.trim())) fields.comments = ''
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
  if (!updated) return sendWhatsApp(env, from, '😢 Hubo un error guardando tus datos. Intenta de nuevo.')

  if (updated.visit_time && updated.visit_date === draft.visit_date && freeSlots(usage, updated.visit_date, updated.people || 0).indexOf(t5(updated.visit_time)) === -1) {
    await updateBooking(env, draft.id, { visit_time: null })
    const free = freeSlots(usage, updated.visit_date, updated.people || 0)
    return sendWhatsApp(env, from, `😅 Ese horario ya no está libre. Disponibles: ${free.length ? free.join(', ') : 'otro día'}.\n¿A qué hora prefieres?`)
  }

  return askNext(env, from, updated, usage)
}

async function finalizeBooking(env, from, draft) {
  const { usage } = await getAvailability(env)
  if ((usage[`${draft.visit_date}|${t5(draft.visit_time)}`] || 0) + draft.people > SLOT_CAPACITY) {
    const free = freeSlots(usage, draft.visit_date, draft.people)
    await updateBooking(env, draft.id, { visit_time: null, payment_status: 'draft', comments: null })
    return sendWhatsApp(env, from, `😅 Ese horario se acaba de llenar. Estos siguen libres: ${free.length ? free.join(', ') : 'otro día'}.\n¿A qué hora prefieres?`)
  }

  const total = draft.people * PRICE
  const rate = getDepositRate(draft.people)
  const deposit = Math.round(total * rate)
  await updateBooking(env, draft.id, {
    payment_status: 'pending_payment',
    total_cop: total,
    deposit_rate: rate,
    deposit_cop: deposit,
  })
  await sendTelegramAlert(env, { ...draft, total, deposit, depositRate: rate, receiptPath: null, source: 'bot' })
  return sendWhatsApp(env, from, [
    `✅ ¡Reserva registrada correctamente!`,
    ``,
    `🎟️ *Código de reserva:* ${codeOf(draft)}`,
    `🦇 *DARKBAT*`,
    `👤 ${draft.name}`,
    `📧 ${draft.email}`,
    `👥 ${draft.people} personas`,
    `📅 ${draft.visit_date}`,
    `🕐 ${t5(draft.visit_time)}`,
    `🍽️ Almuerzo: ${draft.lunch === 'yes' ? 'Sí' : 'No'}${draft.comments ? `\n📝 ${draft.comments}` : ''}`,
    `💰 Total: $${total.toLocaleString('es-CO')} COP`,
    ``,
    `💳 Para confirmar tu cupo, paga el abono de *$${deposit.toLocaleString('es-CO')} COP* por Nequi (*${NEQUI}*) y envíame la captura del pago aquí mismo. ✅`,
    `¡Te esperamos en DARKBAT! 🦇`,
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
    return sendWhatsApp(env, from, '⚠️ No encontré reservas activas a tu nombre. Si quieres visitarnos, responde *2* para reservar. 🦇')
  }
  await updateBooking(env, booking.id, { payment_status: 'cancelled' })
  await sendTelegramCancel(env, booking)
  return sendWhatsApp(env, from, `✅ Tu reserva *${codeOf(booking)}* del *${booking.visit_date}* a las *${String(booking.visit_time || '').slice(0, 5)}* para *${booking.people}* personas fue *cancelada*.\n\n¡Te esperamos en otra ocasión! 🦇`)
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
  if (isNew) {
    await sendInteractiveMenu(env, from)
    return
  }

  if (/(cancelar|cancelaci|anular)/i.test(lower)) return handleCancel(env, from)
  if (/^(buenas|hola|buen|ayuda|ayudame|info\b|infor)/i.test(lower) || /^(volver|men[uú]|1)\b/.test(lower) || /^1$/.test(lower)) {
    if (/^(1|info)/i.test(lower)) return sendInfo(env, from)
    return sendMainMenu(env, from)
  }
  if (/^(2|reserv|quiero ir|vamos|me gustaría ir|me gustaria ir|cupo|disponib|horario|personas|pax|fecha\b|día\b|dia\b|hoy\b|mañana|manana)/i.test(lower)) {
    return startBooking(env, from, text)
  }
  if (/^(pago|pagar|nequi|abono)\b/i.test(lower) || /c[oó]mo pago|como pago|d[oó]nde pago|donde pago|qu[eé] es el abono|cu[aá]nto es el abono|cuanto es el abono/i.test(lower)) {
    return sendPaymentInfo(env, from)
  }
  if (/^(3|precio|cu[aá]nto vale|cuanto vale|cu[aá]nto cuesta|cuanto cuesta|cobran|tarifa|valor|entrada)/i.test(lower) || /^3$/.test(lower)) {
    return sendPrice(env, from)
  }
  if (/^(4|ubica|d[oó]nde queda|donde queda|d[oó]nde quedan|donde quedan|c[oó]mo llego|como llego|c[oó]mo llegar|como llegar|direcci[oó]n|direccion)/i.test(lower) || /^4$/.test(lower)) {
    return sendLocation(env, from)
  }
  if (/informaci[oó]n|informacion|m[aá]s|mas|conocer|cueva/i.test(lower)) return sendInfo(env, from)
  if (/reserv/i.test(lower)) return startBooking(env, from, text)

  return generalChat(env, from, text)
}

async function generalChat(env, from, text) {
  const { days } = await getAvailability(env)
  const prompt = `Eres el asistente de WhatsApp de DARKBAT, cueva turística en Santa Sofía (Boyacá, Colombia). Precio $15.000 COP/persona, horario 8:00-17:00, mínimo 5 personas. Pago por Nequi (314 459 5642). Menú: 1 información, 2 reservar, 3 precio, 4 ubicación.
El cliente (${from}) escribió: "${text}".
Disponibilidad real consultada (fecha: horarios libres):
${days.join('\n')}
Responde en máximO 3 líneas, en español, amable, SOLO lo que pregunta el cliente. NO repitas la información general de DARKBAT ni el menú completo a menos que te lo pidan. Si quiere reservar, dile que responda "2".`
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
  await sendWhatsApp(env, from, `${'🦇 ¡Hola! Soy el asistente de DARKBAT.\n\nResponde con el número de la opción:\n1️⃣ Información\n2️⃣ Reservar\n3️⃣ Precio\n4️⃣ Ubicación'}${outOfHoursNotice()}`)
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
    } catch {
      await sendWhatsApp(env, from, '😢 No pude descargar tu imagen. Intenta enviarla nuevamente.')
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
              text: `¿Esta imagen es un comprobante de pago de Nequi o transferencia bancaria? El abono esperado es $${deposit.toLocaleString('es-CO')} COP. Responde SOLO JSON: {"es_comprobante":true|false,"monto":"solo números, ej 22500","detalle":"breve en español"}. Reglas: es_comprobante es true SOLO si se ve un recibo/soporte real de pago con monto y fecha (pantalla de Nequi, transferencia, comprobante bancario). false si es foto de persona, paisaje, meme, captura sin datos de pago, etc. El monto debe ser el valor pagado que veas. Si el monto es menor al abono esperado, indica "es_comprobante":false con detalle del monto leído.`,
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
      await sendWhatsApp(env, from, `❌ Esa imagen no parece un comprobante de pago. ${result.detalle || ''}\n\nAdjunta la captura del pago de Nequi (${NEQUI}).`)
      return
    }
    if (!booking) {
      await sendWhatsApp(env, from, `📷 ¡Recibí tu comprobante ($${result.monto || '—'} COP)! Pero aún no tengo tu reserva.\n\nResponde *2* para reservar y luego me envías el comprobante. 🦇`)
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
      await sendWhatsApp(env, from, `✅ ¡Pago confirmado! *$${amount.toLocaleString('es-CO')} COP* recibidos. Tu reserva *${codeOf(booking)}* para el ${booking.visit_date} a las ${t5(booking.visit_time)} está lista. ¡Te esperamos! 🦇`)
      return
    }

    await updateBooking(env, booking.id, { payment_status: 'pending_confirmation' })
    await sendTelegramPayment(env, booking, amount, deposit, false)
    await sendWhatsApp(env, from, `📷 Recibí tu comprobante por *$${(amount || 0).toLocaleString('es-CO')} COP*, pero el abono esperado es *$${deposit.toLocaleString('es-CO')} COP*.\n\n¿El pago es correcto? Mientras tanto lo reviso y te confirmo. 🙏`)
  } catch {
    if (booking) await updateBooking(env, booking.id, { payment_status: 'pending_confirmation' })
    await sendWhatsApp(env, from, '😢 No pude leer tu imagen. Intenta con una captura más clara del pago de Nequi.')
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
    `🦇 *NUEVA RESERVA DARKBAT*`,
    ``,
    `🎟️ *Código:* ${codeOf(booking)}`,
    `👤 *Cliente:* ${booking.name || '—'}`,
    `📧 *Correo:* ${booking.email || '—'}`,
    `📱 *WhatsApp:* ${booking.whatsapp}`,
    `👥 *Personas:* ${booking.people || '—'}`,
    `📅 *Fecha:* ${booking.visit_date || '—'}`,
    `🕐 *Hora:* ${t5(booking.visit_time) || '—'}`,
    `🍽️ *Almuerzo:* ${booking.lunch === 'yes' ? 'Sí' : booking.lunch === 'no' ? 'No' : '—'}`,
    `📝 *Comentarios:* ${booking.comments || 'Ninguno'}`,
    `💰 *Total:* $${(booking.total || 0).toLocaleString('es-CO')} COP`,
    `💳 *Abono (${Math.round(booking.depositRate * 100)}%):* $${(booking.deposit || 0).toLocaleString('es-CO')} COP`,
    `📌 *Estado:* ${statusLabel(booking.payment_status || 'pending_payment')}`,
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
    `🚫 *RESERVA CANCELADA*`,
    `🎟️ ${codeOf(booking)} · 👤 ${booking.name || '—'} · 📱 ${booking.whatsapp}`,
    `📅 ${booking.visit_date || '—'} ${booking.visit_time ? `a las ${String(booking.visit_time).slice(0, 5)}` : ''} · 👥 ${booking.people || '—'} pers`,
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
    `🧾 *Comprobante por WhatsApp*`,
    `🎟️ ${codeOf(booking)} · 👤 ${booking.name || '—'} · 📱 ${booking.whatsapp}`,
    `📅 ${booking.visit_date || '—'} ${booking.visit_time ? `a las ${String(booking.visit_time).slice(0, 5)}` : ''} · 👥 ${booking.people || '—'} pers`,
    `💰 Comprobante: $${(amount || 0).toLocaleString('es-CO')} COP`,
    `💳 Abono esperado: $${(deposit || 0).toLocaleString('es-CO')} COP`,
    `📌 Estado: ${match ? '✅ CONFIRMADO' : '⚠️ REVISAR (no coincide)'}`,
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