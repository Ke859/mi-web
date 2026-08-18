import { connect } from 'cloudflare:sockets'

const formatCOP = (n) => `$${Number(n || 0).toLocaleString('es-CO')} COP`

const fmtDate = (d) => {
  try {
    return new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${d}T00:00:00Z`))
  } catch {
    return String(d)
  }
}

const realEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(e || '').toLowerCase()) && !String(e).toLowerCase().startsWith('wa-')

const encodeHeader = (value) => {
  const bytes = new TextEncoder().encode(String(value))
  let bin = ''
  bytes.forEach((b) => { bin += String.fromCharCode(b) })
  return `=?UTF-8?B?${btoa(bin)}?=`
}

const b64 = (value) => {
  const bytes = new TextEncoder().encode(String(value))
  let bin = ''
  bytes.forEach((b) => { bin += String.fromCharCode(b) })
  return btoa(bin)
}

const withTimeout = (promise, ms) =>
  Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error('Tiempo de espera agotado')), ms))])

class SmtpClient {
  constructor(env) {
    this.host = 'smtp.gmail.com'
    this.port = 465
    this.user = env.SMTP_USER
    this.password = String(env.SMTP_PASSWORD || '').replace(/\s+/g, '')
    this.buffer = ''
  }

  async connect() {
    this.socket = connect({ hostname: this.host, port: this.port, secureTransport: 'on' })
    this.reader = this.socket.readable.getReader()
    this.writer = this.socket.writable.getWriter()
    await this.expect(220, 'Conexión rechazada')
  }

  async readResponse() {
    const max = 64 * 1024
    while (true) {
      const nl = this.buffer.indexOf('\n')
      if (nl !== -1) {
        const line = this.buffer.slice(0, nl).replace(/\r$/, '')
        this.buffer = this.buffer.slice(nl + 1)
        const code = parseInt(line, 10)
        const cont = line.length > 3 && line[3] === '-'
        if (!cont) return { code, line }
        continue
      }
      const { value, done } = await withTimeout(this.reader.read(), 15000)
      if (done) throw new Error('Conexión cerrada por el servidor')
      this.buffer += new TextDecoder().decode(value)
      if (this.buffer.length > max) throw new Error('Respuesta SMTP demasiado larga')
    }
  }

  async expect(code, message) {
    const res = await this.readResponse()
    if (res.code !== code) throw new Error(`${message}: ${res.line}`)
    return res
  }

  async sendLine(line) {
    await this.writer.write(new TextEncoder().encode(line + '\r\n'))
  }

  async say(code, line) {
    await this.sendLine(line)
    return this.expect(code, `SMTP ${line.split(' ')[0]} falló`)
  }

  async sendMail({ from, to, subject, html }) {
    const data = [
      `From: DARKBAT <${from}>`,
      `To: <${to}>`,
      `Subject: ${encodeHeader(subject)}`,
      'MIME-Version: 1.0',
      'Content-Type: text/html; charset=utf-8',
      '',
      html,
    ].join('\r\n')

    await this.say(250, `EHLO ${this.host}`)
    await this.say(235, `AUTH PLAIN ${b64(`\u0000${this.user}\u0000${this.password}`)}`)
    await this.say(250, `MAIL FROM:<${from}>`)
    await this.say(250, `RCPT TO:<${to}>`)
    await this.say(354, 'DATA')
    await this.sendLine(data.replace(/\n/g, '\r\n').replace(/^\./gm, '..'))
    await this.say(250, '.')
    await this.sendLine('QUIT')
    await withTimeout(this.socket.closed, 10000).catch(() => {})
  }

  async close() {
    try {
      this.reader?.releaseLock()
      this.writer?.releaseLock()
      this.socket?.close()
    } catch {
      // socket ya cerrado
    }
  }
}

export async function sendBookingEmail(env, booking) {
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

  const from = env.EMAIL_FROM || env.SMTP_USER
  if (env.SMTP_USER && env.SMTP_PASSWORD && from) {
    const client = new SmtpClient(env)
    try {
      await withTimeout(client.connect(), 20000)
      await client.sendMail({
        from,
        to: booking.email,
        subject: `🎟️ Tu reserva en DARKBAT está registrada — Código ${code}`,
        html,
      })
    } catch (e) {
      console.error('SMTP send error', e)
    } finally {
      await client.close()
    }
    return
  }

  if (env.RESEND_API_KEY && env.EMAIL_FROM) {
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
}
