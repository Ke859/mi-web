function sbHeaders(env) {
  const key = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_PUBLISHABLE_KEY
  return { apikey: key, Authorization: `Bearer ${key}` }
}

export async function onRequestPost(context) {
  const { request, env } = context
  try {
    const { name, whatsapp } = await request.json()
    if (!name) return Response.json({ error: 'Falta el nombre.' }, { status: 400 })

    const cleanNumber = String(whatsapp || '').replace(/[\s\-()]/g, '')
    const res = await fetch(
      `${env.SUPABASE_URL}/rest/v1/bookings?select=payment_status,total_cop,visit_date,visit_time,people,lunch,whatsapp,created_at&name=eq.${encodeURIComponent(name.trim())}&order=created_at.desc&limit=10`,
      { headers: sbHeaders(env) }
    )
    if (!res.ok) return Response.json({ error: 'No se pudo consultar.' }, { status: 500 })
    const rows = await res.json()

    const filtered = (rows || []).filter(
      (b) => !b.whatsapp || String(b.whatsapp).replace(/[\s\-()]/g, '') === cleanNumber
    ).slice(0, 3)

    return Response.json({ bookings: filtered })
  } catch (e) {
    console.error('check-booking error', e)
    return Response.json({ error: 'Error interno.' }, { status: 500 })
  }
}
