import { sbHeaders } from './login.js'

export async function onRequestGet(context) {
  const { request, env } = context
  try {
    if (!env.ADMIN_PASSWORD) return Response.json({ error: 'Admin no configurado.' }, { status: 500 })
    const auth = request.headers.get('x-admin-password')
    if (auth !== env.ADMIN_PASSWORD) return Response.json({ error: 'No autorizado.' }, { status: 401 })

    const res = await fetch(
      `${env.SUPABASE_URL}/rest/v1/bookings?select=*&payment_status=not.in.(draft,awaiting_confirm)&order=created_at.desc&limit=200`,
      { headers: sbHeaders(env) }
    )
    if (!res.ok) return Response.json({ error: 'No se pudieron cargar las reservas.' }, { status: 500 })
    return Response.json(await res.json())
  } catch (e) {
    console.error('admin bookings error', e)
    return Response.json({ error: 'Error interno.' }, { status: 500 })
  }
}
