function buildSystemPrompt() {
  const now = new Date()
  const hoy = now.toISOString().split('T')[0]
  const dias = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
  const refs = {}
  refs.hoy = hoy
  refs.mañana = refs.mañana = addDaysIso(hoy, 1)
  refs.PAS = addDaysIso(hoy, 2)
  for (let i = 1; i <= 7; i++) {
    const d = addDaysIso(hoy, i)
    const name = dias[new Date(d + 'T00:00:00Z').getUTCDay()]
    if (!refs[name]) refs[name] = d
  }
  const refText = Object.entries(refs)
    .filter(([k]) => /domingo|lunes|martes|miércoles|miercoles|jueves|viernes|sábado|sabado/.test(k))
    .map(([k, v]) => `${k}=${v}`)
    .join(',')

  return `Asistente de DARKBAT (cueva turística, Santa Sofía, Boyacá). Precio $15.000 COP/persona. Horario 8:00-17:00 (solo HH:MM 24h: "2:30 pm"→"14:30"). Mín 5, máx 50 personas. Abono por Nequi 314 459 5642: 10%(5-10 pers), 15%(11-20), 20%(21-30), 25%(31-40), 30%(41-50); ej: 8 pers → 10% de $120.000 = $12.000; saldo el día de la visita. Almuerzo opcional (reservar 1 semana antes). Reservas en la sección "Reserva" de la web; pago se verifica por WhatsApp.
Hoy es ${hoy}. Calendario: mañana=${refs.mañana}, pasado mañana=${refs.PAS}, ${refText}. Fechas numéricas SIEMPRE DÍA/MES/AÑO → "YYYY-MM-DD".

REGLAS ESTRICTAS:
1. Tono de chat de WhatsApp: natural, amable, corto. MÁXIMO 4 líneas.
2. PROHIBIDO usar títulos, secciones, encabezados ni viñetas ("Confirmación:", "Abono y Precio:", "Paso siguiente:"...). Escribe párrafos fluidos.
3. Solo temas DARKBAT.
4. Si quiere reservar: confirma fecha y personas + abono exacto (tabla), y pregunta UN dato a la vez (1.hora, 2.nombre, 3.whatsapp 10 dígitos, 4.correo, 5.almuerzo).
5. Al final agrega en su propia línea, EXACTAMENTE con guion bajo y dos puntos: RESERVA_JSON:{"date":"YYYY-MM-DD","time":"HH:MM","people":N,"lunch":"yes|no","name":"","whatsapp":"","email":""} con SOLO datos dichos explícitamente por el usuario (lunch solo si lo mencionó; los demás van vacíos). Si no hay ningún dato, omite la línea. No inventes campos ni valores.
6. PROHIBIDO markdown: sin asteriscos, sin negritas, sin guiones. Texto plano.
7. PROHIBIDO simular conversaciones: responde solo al último mensaje del usuario.
8. Hora fuera de 08:00-17:00: pide otra hora sin "time" en el JSON.
9. Si el usuario confirma (sí/confirmo/dale/listo): si falta un dato pídelo, si no responde que procede a registrar.`
};

export async function onRequestPost(context) {
  const { request, env } = context
  const trace = new URL(request.url).searchParams.get('trace') === '1'
  try {
    const { message, history = [] } = await request.json()
    if (!message || typeof message !== 'string') {
      return Response.json({ error: 'Mensaje inválido' }, { status: 400 })
    }

    const bookingIntent = /(reserv|cupo|disponib|fecha|hora|personas|\d+\s*(persona|pers|pax)|sábado|sabado|domingo|lunes|martes|miércoles|miercoles|jueves|viernes)/i.test(message) && !/(verificar|mis reservas|ultimas|últimas)/i.test(message)

    let availability = ''
    if (bookingIntent) {
      const today = new Date().toISOString().split('T')[0]
      const avail = await getAvailability(env, today, 7)
      if (avail) {
        availability = `
CONSULTAS DE DISPONIBILIDAD REAL (traducidas SIEMPRE a la fecha concreta):
Fechas y horarios con cupo (rango 08:00-17:00, horarios de inicio sugeridos 08:00-16:00):
${avail}
IMPORTANTE: para la fecha que el usuario pida, usa SOLO los horarios listados como libres. Si un horario no aparece libre, no lo ofrezcas: sugiere los que sí estén libres. Si el día está completo, di qué otro día de los listados tiene cupo.`
      }
    }

    const messages = [
      { role: 'system', content: buildSystemPrompt() },
      ...history.slice(-8),
      { role: 'user', content: message + availability },
    ]

    const resp = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.NVIDIA_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'nvidia/llama-3.3-nemotron-super-49b-v1',
        messages,
        temperature: 0.6,
        top_p: 1,
        max_tokens: 800,
        seed: 42,
      }),
    })

    if (!resp.ok) {
      const detail = await resp.text()
      console.error('NVIDIA error', resp.status, detail)
      if (trace) return Response.json({ error: `NVIDIA ${resp.status}: ${detail.slice(0, 300)}` }, { status: 502 })
      return Response.json({ error: 'No pude conectar con el motor de IA.' }, { status: 502 })
    }

    const data = await resp.json()
    let content = data.choices?.[0]?.message?.content ?? ''

    let booking = null
    const extractBooking = (text) => {
      const tagged = text.match(/RESERVA[_ ]?JSON\s*[:＝]?\s*(\{[\s\S]*?\})/i)
      if (tagged) return { json: tagged[1], start: tagged.index, end: tagged.index + tagged[0].length }
      const any = text.match(/\{[\s\S]*?\}/g) || []
      for (const candidate of any) {
        try {
          const parsed = JSON.parse(candidate)
          if (parsed && typeof parsed === 'object' && ('date' in parsed || 'people' in parsed || 'time' in parsed)) {
            return { json: candidate, start: text.indexOf(candidate), end: text.indexOf(candidate) + candidate.length }
          }
        } catch {
          /* noop */
        }
      }
      return null
    }

    const found = extractBooking(content)
    if (found) {
      try {
        booking = JSON.parse(found.json)
      } catch {
        booking = null
      }
      content = content.slice(0, found.start) + content.slice(found.end)
    }

    content = content.replace(/[*_]{1,}/g, '').replace(/^\s*[-•]\s*/gm, '').trim()

    return Response.json({ reply: content, booking })
  } catch (error) {
    console.error('chat function error', error)
    if (trace) return Response.json({ error: `TRACE ${error?.message || error}`, stack: String(error?.stack || '').slice(0, 500) }, { status: 500 })
    return Response.json({ error: 'Ocurrió un error interno.' }, { status: 500 })
  }
}

const SLOT_TIMES = ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00']
const SLOT_CAPACITY = 50

function addDaysIso(iso, n) {
  const d = new Date(iso + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

async function getAvailability(env, fromDate, days) {
  try {
    const toDate = addDaysIso(fromDate, days - 1)
    const key = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_PUBLISHABLE_KEY
    const headers = {
      apikey: key,
      Authorization: `Bearer ${key}`,
    }
    const url = `${env.SUPABASE_URL}/rest/v1/bookings?select=visit_date,visit_time,people&visit_date=gte.${fromDate}&visit_date=lte.${toDate}&payment_status=neq.rejected&payment_status=neq.cancelled&payment_status=neq.draft&payment_status=neq.awaiting_confirm`
    const res = await fetch(url, { headers })
    if (!res.ok) return null
    const rows = await res.json()

    const usage = {}
    for (const r of rows) {
      const t = String(r.visit_time || '').slice(0, 5)
      const key = `${r.visit_date}|${t}`
      usage[key] = Math.min(SLOT_CAPACITY, (usage[key] || 0) + (r.people || 0))
    }

    const lines = []
    for (let i = 0; i < days; i++) {
      const d = addDaysIso(fromDate, i)
      const free = SLOT_TIMES.filter((t) => (usage[`${d}|${t}`] || 0) < SLOT_CAPACITY)
      lines.push(`${d}: ${free.length ? free.join(', ') : 'DÍA COMPLETO'}`)
    }
    return lines.join('\n')
  } catch {
    return null
  }
}
