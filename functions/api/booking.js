const getDepositRate = (people) => {
  if (people >= 5 && people <= 10) return 0.1
  if (people >= 11 && people <= 20) return 0.15
  if (people >= 21 && people <= 30) return 0.2
  if (people >= 31 && people <= 40) return 0.25
  if (people >= 41 && people <= 50) return 0.3
  return 0.1
}

const PRICE = 15000
const genCode = () => `DB-${Math.floor(10000 + Math.random() * 90000)}`
const codeOf = (b) => b?.code || (b?.id ? `DB-${String(b.id).replace(/-/g, '').slice(0, 5).toUpperCase()}` : '')

export async function onRequestPost(context) {
  const { request, env } = context
  try {
    const body = await request.json()
    const name = String(body.name || '').trim()
    const email = String(body.email || '').trim()
    const whatsapp = String(body.whatsapp || '').trim()
    const date = body.date
    const time = body.time
    const people = Number(body.people)
    const lunch = body.lunch === 'yes' ? 'yes' : body.lunch === 'no' ? 'no' : null
    const comments = String(body.comments || '').trim() || null
    const receiptPath = String(body.receipt_path || '').trim() || null
    const source = body.source === 'bot' ? 'bot' : 'form'

    if (!name) return Response.json({ error: 'Falta el nombre' }, { status: 400 })
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return Response.json({ error: 'Correo inválido' }, { status: 400 })
    if (!/^\+?\d{7,15}$/.test(whatsapp.replace(/[\s\-()]/g, ''))) return Response.json({ error: 'WhatsApp inválido' }, { status: 400 })
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) return Response.json({ error: 'Fecha inválida' }, { status: 400 })
    if (!/^\d{2}:\d{2}$/.test(time || '') || time < '08:00' || time > '17:00') return Response.json({ error: 'Hora fuera del horario (8:00 a 17:00)' }, { status: 400 })
    if (!people || people < 5 || people > 50) return Response.json({ error: 'Personas entre 5 y 50' }, { status: 400 })

    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date())
    if (date < today) return Response.json({ error: 'La fecha ya pasó' }, { status: 400 })

    const capacity = await checkCapacity(env, date, time, people)
    if (capacity.conflict) {
      return Response.json({
        error: `El horario de las ${time} de esa fecha ya está completo para ${people} personas.`,
        alternatives: capacity.alternatives,
      }, { status: 409 })
    }

    const total = people * PRICE
    const depositRate = getDepositRate(people)
    const deposit = Math.round(total * depositRate)
    const paymentStatus = receiptPath ? 'pending_confirmation' : 'pending_payment'

    const { data, error } = await supabaseRequest(env, {
      code: genCode(), name, email, whatsapp, visit_date: date, visit_time: time, people,
      lunch, comments, total_cop: total, price_per_cop: PRICE, deposit_rate: depositRate, deposit_cop: deposit,
      receipt_path: receiptPath, payment_status: paymentStatus,
    })

    if (error) {
      console.error('Insert booking error', error)
      return Response.json({ error: 'No se pudo registrar la reserva.' }, { status: 500 })
    }

    const bookingId = data?.[0]?.id || null
    const bookingCode = codeOf(data?.[0] || { id: bookingId, code: genCode() })
    if (env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID) {
      await sendTelegramAlert(env, {
        id: bookingId, code: bookingCode, name, email, whatsapp, date, time, people,
        lunch, comments, total, deposit, depositRate, receiptPath, source,
      })
    }

    return Response.json({ ok: true, id: bookingId, code: bookingCode })
  } catch (e) {
    console.error('booking function error', e)
    return Response.json({ error: 'Error interno.' }, { status: 500 })
  }
}

async function sendTelegramAlert(env, booking) {
  const lunchText = booking.lunch === 'yes' ? 'Sí 🍽️' : booking.lunch === 'no' ? 'No' : '—'
  const message = [
    `🦇 *Nueva reserva DARKBAT*`,
    ``,
    `🎟️ *Código:* ${codeOf(booking)}`,
    `📱 *Origen:* ${booking.source === 'bot' ? 'Asistente IA 🤖' : 'Formulario web'}`,
    `👤 *Nombre:* ${booking.name}`,
    `📧 *Correo:* ${booking.email}`,
    `📱 *WhatsApp:* ${booking.whatsapp}`,
    `📅 *Fecha:* ${booking.date}`,
    `⏰ *Hora:* ${booking.time}`,
    `👥 *Personas:* ${booking.people}`,
    `🍽️ *Almuerzo:* ${lunchText}`,
    `📝 *Comentarios:* ${booking.comments || 'Ninguno'}`,
    `💰 *Total:* $${booking.total.toLocaleString('es-CO')} COP`,
    `💳 *Abono (${Math.round(booking.depositRate * 100)}%):* $${booking.deposit.toLocaleString('es-CO')} COP`,
    `📎 *Comprobante:* ${booking.receiptPath ? 'Adjuntado, pendiente de verificación' : 'Sin adjuntar (bot)'}`,
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
  if (env.ADMIN_WHATSAPP_NUMBER) {
    const adminMsg = [
      `🦇 NUEVA RESERVA`,
      `🎫 ID: ${codeOf(booking)}`,
      `👤 Cliente: ${booking.name}`,
      `📱 WhatsApp: ${booking.whatsapp}`,
      `👥 Personas: ${booking.people}`,
      `📅 Fecha: ${booking.date}`,
      `🕐 Hora: ${booking.time}`,
      `💰 Total: $${booking.total.toLocaleString('es-CO')} COP`,
      `📌 Estado: ${booking.payment_status === 'pending_confirmation' ? 'En revisión' : 'Pendiente de pago'}`,
    ].join('\n')
    try {
      await fetch(`https://graph.facebook.com/v21.0/${env.WHATSAPP_PHONE_ID}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}` },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: env.ADMIN_WHATSAPP_NUMBER,
          type: 'text',
          text: { body: adminMsg },
        }),
      })
    } catch (e) {
      console.error('Admin WhatsApp notify error', e)
    }
  }
}

const SLOT_TIMES = ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00']
const SLOT_CAPACITY = 50

async function checkCapacity(env, date, time, people) {
  try {
    const headers = sbHeaders(env)
    const url = `${env.SUPABASE_URL}/rest/v1/bookings?select=visit_time,people&visit_date=eq.${date}&payment_status=neq.rejected&payment_status=neq.cancelled&payment_status=neq.draft&payment_status=neq.awaiting_confirm`
    const res = await fetch(url, { headers })
    if (!res.ok) return { conflict: false }

    const rows = await res.json()
    const usage = {}
    for (const r of rows) {
      const t = String(r.visit_time || '').slice(0, 5)
      usage[t] = Math.min(SLOT_CAPACITY, (usage[t] || 0) + (r.people || 0))
    }

    if ((usage[time] || 0) + people > SLOT_CAPACITY) {
      const alternatives = SLOT_TIMES.filter((t) => (usage[t] || 0) + people <= SLOT_CAPACITY && t !== time)
      return { conflict: true, alternatives }
    }
    return { conflict: false }
  } catch {
    return { conflict: false }
  }
}

async function supabaseRequest(env, booking) {
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/bookings`, {
    method: 'POST',
    headers: { ...sbHeaders(env), 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify(booking),
  })
  if (res.ok) return { error: null, data: await res.json() }
  const text = await res.text()
  let error = null
  try {
    error = JSON.parse(text).message || text
  } catch {
    error = text
  }
  return { error }
}

function sbHeaders(env) {
  const key = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_PUBLISHABLE_KEY
  return { apikey: key, Authorization: `Bearer ${key}` }
}