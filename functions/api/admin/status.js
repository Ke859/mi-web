import { sbHeaders } from './login.js'

export async function onRequestPost(context) {
  const { request, env } = context
  try {
    if (request.headers.get('x-admin-password') !== env.ADMIN_PASSWORD) {
      return Response.json({ error: 'No autorizado.' }, { status: 401 })
    }
    const { id, status } = await request.json()
    if (!id || !status) return Response.json({ error: 'Faltan datos.' }, { status: 400 })

    const res = await fetch(`${env.SUPABASE_URL}/rest/v1/bookings?id=eq.${id}`, {
      method: 'PATCH',
      headers: { ...sbHeaders(env), 'Content-Type': 'application/json', Prefer: 'return=representation' },
      body: JSON.stringify({ payment_status: status }),
    })
    if (!res.ok) return Response.json({ error: 'No se pudo actualizar.' }, { status: 500 })
    return Response.json((await res.json())[0] || { ok: true })
  } catch {
    return Response.json({ error: 'Error interno.' }, { status: 500 })
  }
}
