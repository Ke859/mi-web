function sbHeaders(env) {
  const key = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_PUBLISHABLE_KEY
  return { apikey: key, Authorization: `Bearer ${key}` }
}

export async function onRequestDelete(context) {
  const { request, env } = context
  try {
    const { path } = await request.json()
    if (!path || !/^(pending|tmp)\//.test(path)) {
      return Response.json({ error: 'Ruta inválida.' }, { status: 400 })
    }
    const res = await fetch(`${env.SUPABASE_URL}/storage/v1/object/comprobantes-db/${path}`, {
      method: 'DELETE',
      headers: sbHeaders(env),
    })
    if (!res.ok) return Response.json({ error: 'No se pudo eliminar el archivo.' }, { status: 502 })
    return Response.json({ ok: true })
  } catch (e) {
    console.error('upload delete error', e)
    return Response.json({ error: 'Error interno.' }, { status: 500 })
  }
}

export async function onRequestPost(context) {
  const { request, env } = context
  try {
    const { base64, contentType = 'image/jpeg', folder = 'pending' } = await request.json()
    if (!base64 || typeof base64 !== 'string') {
      return Response.json({ error: 'Falta la imagen.' }, { status: 400 })
    }

    const extension = (contentType.split('/')[1] || 'jpg').replace('jpeg', 'jpg')
    const filename = `${folder}/${crypto.randomUUID()}.${extension}`

    const binary = atob(base64.replace(/^data:.*?base64,/, ''))
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)

    const res = await fetch(`${env.SUPABASE_URL}/storage/v1/object/comprobantes-db/${filename}`, {
      method: 'POST',
      headers: { ...sbHeaders(env), 'Content-Type': contentType },
      body: bytes,
    })
    if (!res.ok) return Response.json({ error: 'No se pudo subir el comprobante.' }, { status: 502 })

    return Response.json({
      ok: true,
      receipt_path: filename,
      receipt_url: `${env.SUPABASE_URL}/storage/v1/object/public/comprobantes-db/${filename}`,
    })
  } catch (e) {
    console.error('upload error', e)
    return Response.json({ error: 'Error interno.' }, { status: 500 })
  }
}
