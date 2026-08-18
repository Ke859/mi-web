const formatCOP = (n) => `$${Number(n || 0).toLocaleString('es-CO')} COP`

const fmtDate = (d) => {
  try {
    return new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${d}T00:00:00Z`))
  } catch {
    return String(d)
  }
}

const realEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(e || '').toLowerCase()) && !String(e).toLowerCase().startsWith('wa-')

export async function sendBookingEmail(env, booking) {
  if (!env.RESEND_API_KEY || !env.EMAIL_FROM) return
  if (!realEmail(booking.email)) return

  const code = booking.code || (booking.id ? `DB-${String(booking.id).replace(/-/g, '').slice(0, 5).toUpperCase()}` : '')
  const total = Number(booking.total_cop || booking.people * 15000 || 0)
  const deposit = Number(booking.deposit_cop || 0)
  const lunch = booking.lunch === 'yes' ? 'Sí 🍽️' : 'No'
  const nequi = env.NEQUI || '314 459 5642'

  const html = `
    <div style="background:#0c0a09;color:#f5f5f4;font-family:Arial,Helvetica,sans-serif;padding:32px 16px">
      <div style="max-width:520px;margin:0 auto;background:#1c1917;border:1px solid rgba(212,175,55,.35);border-radius:16px;overflow:hidden">
        <div style="background:linear-gradient(135deg,rgba(212,175,55,.25),transparent);padding:24px;border-bottom:1px solid rgba(255,255,255,.08)">
          <p style="margin:0;font-size:22px;font-weight:bold;color:#eab308;letter-spacing:2px">🦇 DARKBAT</p>
          <p style="margin:4px 0 0;font-size:13px;color:#a8a29e">Bar · Reservas · Experiencias</p>
        </div>
        <div style="padding:24px">
          <h2 style="margin:0 0 12px;font-size:18px;color:#fff">¡Tu reserva está registrada, ${booking.name}! 🎉</h2>
          <p style="margin:0 0 16px;font-size:14px;color:#d6d3d1;line-height:1.6">
            Hemos recibido tu reserva en <strong style="color:#eab308">DARKBAT</strong>.
            Tu código de reserva es <strong style="color:#eab308">${code}</strong>.
            Tenlo a la mano el día de tu visita. 🎟️
          </p>
          <table style="width:100%;border-collapse:collapse;font-size:14px;color:#e7e5e4">
            <tr>
              <td style="padding:8px 0;color:#a8a29e;border-bottom:1px solid rgba(255,255,255,.06)">📅 Fecha</td>
              <td style="padding:8px 0;text-align:right;border-bottom:1px solid rgba(255,255,255,.06)">${fmtDate(booking.visit_date)}</td>
            </tr>
            <tr>
              <td style="padding:8px 0;color:#a8a29e;border-bottom:1px solid rgba(255,255,255,.06)">🕐 Hora</td>
              <td style="padding:8px 0;text-align:right;border-bottom:1px solid rgba(255,255,255,.06)">${String(booking.visit_time).slice(0, 5)}</td>
            </tr>
            <tr>
              <td style="padding:8px 0;color:#a8a29e;border-bottom:1px solid rgba(255,255,255,.06)">👥 Personas</td>
              <td style="padding:8px 0;text-align:right;border-bottom:1px solid rgba(255,255,255,.06)">${booking.people}</td>
            </tr>
            <tr>
              <td style="padding:8px 0;color:#a8a29e;border-bottom:1px solid rgba(255,255,255,.06)">🍽️ Almuerzo</td>
              <td style="padding:8px 0;text-align:right;border-bottom:1px solid rgba(255,255,255,.06)">${lunch}</td>
            </tr>
            ${booking.comments ? `<tr>
              <td style="padding:8px 0;color:#a8a29e;border-bottom:1px solid rgba(255,255,255,.06)">📝 Comentarios</td>
              <td style="padding:8px 0;text-align:right;border-bottom:1px solid rgba(255,255,255,.06)">${booking.comments}</td>
            </tr>` : ''}
            <tr>
              <td style="padding:8px 0;color:#a8a29e">💰 Total</td>
              <td style="padding:8px 0;text-align:right;font-weight:bold;color:#eab308">${formatCOP(total)}</td>
            </tr>
          </table>
          <div style="margin-top:20px;background:rgba(212,175,55,.12);border:1px solid rgba(212,175,55,.4);border-radius:12px;padding:16px">
            <p style="margin:0 0 8px;font-size:14px;color:#eab308;font-weight:bold">💳 Para confirmar tu cupo</p>
            <p style="margin:0;font-size:13px;color:#d6d3d1;line-height:1.6">
              Realiza el abono de <strong style="color:#fff">${formatCOP(deposit)}</strong> por Nequi
              (<strong style="color:#fff">${nequi}</strong>) y envíanos la captura del pago por nuestro WhatsApp,
              así tu reserva quedará confirmada. 📲
            </p>
          </div>
          <p style="margin:20px 0 0;font-size:12px;color:#78716c;line-height:1.5">
            Si necesitas modificar o cancelar tu reserva, escríbenos por WhatsApp con tu código ${code}.
            ¡Te esperamos! 🦇
          </p>
        </div>
      </div>
    </div>`

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: env.EMAIL_FROM,
        to: booking.email,
        subject: `🎟️ Tu reserva en DARKBAT está registrada — Código ${code}`,
        html,
      }),
    })
    if (!res.ok) {
      const body = await res.text()
      console.error('Resend send error', res.status, body)
    }
  } catch (e) {
    console.error('Booking email error', e)
  }
}
