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

    const today = new Date(Date.now() - 5 * 3600 * 1000).toISOString().slice(0, 10)
    const headers = {
      apikey: env.SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_PUBLISHABLE_KEY}`,
    }

    const res = await fetch(
      `${env.SUPABASE_URL}/rest/v1/bookings?select=name,whatsapp,visit_time,people,lunch,total_cop,deposit_cop,payment_status,receipt_path&visit_date=eq.${today}&payment_status=neq.draft&payment_status=neq.awaiting_confirm&order=visit_time.asc`,
      { headers }
    )
    if (!res.ok) return Response.json({ error: 'No se pudo consultar las reservas.' }, { status: 500 })
    const rows = await res.json()

    const label = (s) => ({ confirmed: '✅ Confirmada', approved: '✅ Confirmada', pending_confirmation: '⏳ En revisión', pending_payment: '💤 Sin comprobante', rejected: '❌ Rechazada', cancelled: '🚫 Cancelada', completed: '🏁 Completada' }[s] || s)

    const lines = rows.map((r) => {
      const lunch = r.lunch === 'yes' ? '🍽️ almuerzo' : ''
      const saldo = (r.total_cop || 0) - (r.deposit_cop || 0)
      const extra = r.payment_status === 'pending_payment'
        ? `· 💳 abono pendiente $${(r.deposit_cop || 0).toLocaleString('es-CO')}`
        : r.payment_status === 'pending_confirmation'
          ? '· ⏳ comprobante en revisión'
          : `· 💵 saldo a cobrar $${saldo.toLocaleString('es-CO')}`
      return `⏰ ${r.visit_time?.slice(0, 5) || '—'} · 👤 ${r.name} · 👥 ${r.people} pers ${lunch}\n📱 ${r.whatsapp}\n${label(r.payment_status)} ${extra}`
    })

    const totalPeople = rows.reduce((s, r) => s + (r.people || 0), 0)
    const confirmed = rows.filter((r) => ['confirmed', 'approved'].includes(r.payment_status))
    const pending = rows.filter((r) => r.payment_status === 'pending_payment')
    const review = rows.filter((r) => r.payment_status === 'pending_confirmation')
    const toCollect = confirmed.reduce((s, r) => s + (r.total_cop || 0) - (r.deposit_cop || 0), 0)
    const pendingDeposits = pending.reduce((s, r) => s + (r.deposit_cop || 0), 0)

    const message = [
      `🦇 *DARKBAT · Resumen del día ${today}*`,
      ``,
      `📋 Reservas: ${rows.length} · 👥 Personas: ${totalPeople}`,
      `✅ Confirmadas: ${confirmed.length} · ⏳ En revisión: ${review.length} · 💤 Sin comprobante: ${pending.length}`,
      `💵 Saldo a cobrar hoy: $${toCollect.toLocaleString('es-CO')} COP`,
      `💳 Abonos pendientes: $${pendingDeposits.toLocaleString('es-CO')} COP`,
      ``,
      rows.length ? lines.join('\n\n') : '🎉 *No hay reservas para hoy.*',
    ].join('\n')

    if (env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID) {
      const t = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, text: message, parse_mode: 'Markdown' }),
      })
      if (!t.ok) return Response.json({ error: 'No se pudo enviar a Telegram.' }, { status: 502 })
    }

    return Response.json({ ok: true, date: today, total: rows.length })
  } catch (e) {
    console.error('daily-summary error', e)
    return Response.json({ error: 'Error interno.' }, { status: 500 })
  }
}