const sbHeaders = (env) => {
  const key = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_PUBLISHABLE_KEY
  return { apikey: key, Authorization: `Bearer ${key}` }
}

export async function onRequestPost(context) {
  const { request, env } = context
  try {
    const { email, password } = await request.json()
    if (!env.ADMIN_EMAIL || !env.ADMIN_PASSWORD) {
      return Response.json({ error: 'Admin no configurado.' }, { status: 500 })
    }
    if (String(email || '').trim().toLowerCase() === env.ADMIN_EMAIL.toLowerCase() && String(password || '') === env.ADMIN_PASSWORD) {
      return Response.json({ ok: true, email: env.ADMIN_EMAIL })
    }
    return Response.json({ error: 'Credenciales incorrectas.' }, { status: 401 })
  } catch {
    return Response.json({ error: 'Error interno.' }, { status: 500 })
  }
}

export { sbHeaders }
