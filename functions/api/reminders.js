const ACTIVE_STATUS = 'payment_status=in.(pending_payment,pending_confirmation,confirmed,approved)'

function sbHeaders(env) {
  const key = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_PUBLISHABLE_KEY
  return { apikey: key, Authorization: `Bearer ${key}` }
}

function bogotaDate() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date())
}

function addDays(iso, n) {
  const d = new Date(iso + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

const codeOf = (b) => b?.code || (b?.id ? `DB-${String(b.id).replace(/-/g, '').slice(0, 5).toUpperCase()}` : '')

export async function onRequestGet(context) {
  return handle(context)
}

export async function onRequestPost(context) {
  return handle(context)
}

async function handle({ request, env }) {
  try {
    const url = new URL(request.url)
    if (env.DAILY_SUMMARY_KEY && url.searchParams.get('key') !== env.DAILY_SUMMARY_KEY) {
      return Response.json({ error: 'Acceso denegado' }, { status: 403 })
    }

    const tomorrow = addDays(bogotaDate(), 1)
    const headers = sbHeaders(env)
    const res = await fetch(
      `${env.SUPABASE_URL}/rest/v1/bookings?select=id,code,name,whatsapp,visit_date,visit_time,people&visit_date=eq.${tomorrow}&${ACTIVE_STATUS}`,
      { headers }
    )
    if (!res.ok) return Response.json({ error: 'No se pudieron consultar las reservas.' }, { status: 500 })
    const rows = await res.json()

    let sent = 0
    const failed = []
    for (const r of rows) {
      if (!r.whatsapp) continue
      const text = [
        `🦇 ¡Hola, ${r.name}!`,
        ``,
        `Te recordamos que mañana tienes una visita programada en DARKBAT.`,
        ``,
        `🎫 Reserva: ${codeOf(r)}`,
        `📅 ${r.visit_date}`,
        `🕐 ${String(r.visit_time || '').slice(0, 5)}`,
        `👥 ${r.people} personas`,
        ``,
        `¡Te esperamos! 🦇`,
      ].join('\n')
      const msg = await fetch(`https://graph.facebook.com/v21.0/${env.WHATSAPP_PHONE_ID}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`,
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: r.whatsapp,
          type: 'text',
          text: { body: text },
        }),
      })
      if (msg.ok) {
        sent++
      } else {
        failed.push(r.whatsapp)
      }
    }

    if (env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID) {
      await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: env.TELEGRAM_CHAT_ID,
          text: `🔔 *Recordatorio automático* · Visitas del ${tomorrow}\n\nEnviados: ${sent}${failed.length ? `\nFallidos: ${failed.join(', ')}` : ''}`,
          parse_mode: 'Markdown',
        }),
      })
    }

    return Response.json({ ok: true, date: tomorrow, total: rows.length, sent, failed: failed.length })
  } catch (e) {
    console.error('reminders error', e)
    return Response.json({ error: 'Error interno.' }, { status: 500 })
  }
}
