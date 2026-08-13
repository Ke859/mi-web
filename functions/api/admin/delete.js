import { sbHeaders } from './login.js'

export async function onRequestPost(context) {
  const { request, env } = context
  try {
    if (request.headers.get('x-admin-password') !== env.ADMIN_PASSWORD) {
      return Response.json({ error: 'No autorizado.' }, { status: 401 })
    }
    const { id } = await request.json()
    if (!id) return Response.json({ error: 'Faltan datos.' }, { status: 400 })

    const headers = sbHeaders(env)
    const find = await fetch(`${env.SUPABASE_URL}/rest/v1/bookings?select=receipt_path&id=eq.${id}`, { headers })
    const rows = find.ok ? await find.json() : []
    const receiptPath = rows?.[0]?.receipt_path

    const del = await fetch(`${env.SUPABASE_URL}/rest/v1/bookings?id=eq.${id}`, { method: 'DELETE', headers })
    if (!del.ok) return Response.json({ error: 'No se pudo eliminar.' }, { status: 500 })

    if (receiptPath) {
      try {
        await fetch(`${env.SUPABASE_URL}/storage/v1/object/comprobantes-db/${receiptPath}`, { method: 'DELETE', headers })
      } catch {
        // archivo opcional
      }
    }
    return Response.json({ ok: true })
  } catch {
    return Response.json({ error: 'Error interno.' }, { status: 500 })
  }
}
