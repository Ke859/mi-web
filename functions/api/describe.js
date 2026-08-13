export async function onRequestPost(context) {
  const { request, env } = context
  try {
    const { imageUrl } = await request.json()

    if (!imageUrl || typeof imageUrl !== 'string') {
      return Response.json({ error: 'Falta la URL de la imagen' }, { status: 400 })
    }

    const image = await fetchImage(imageUrl)
    if (!image.dataUrl) return Response.json({ error: 'No pude descargar la imagen.' }, { status: 502 })

    const resp = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.NVIDIA_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'nvidia/nemotron-nano-12b-v2-vl',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Describe esta imagen en español. Di qué es lo que se ve, el contenido principal, los elementos, colores y cualquier texto legible. Sé claro y breve (máximo 3 oraciones). Si es un comprobante de pago, dilo y menciona el monto y el negocio si los ves.`,
              },
              {
                type: 'image_url',
                image_url: { url: image.dataUrl },
              },
            ],
          },
        ],
        max_tokens: 200,
        temperature: 0.3,
      }),
    })

    if (!resp.ok) {
      const detail = await resp.text()
      console.error('NVIDIA vision error', resp.status, detail)
      return Response.json({ error: 'No pude analizar la imagen.' }, { status: 502 })
    }

    const data = await resp.json()
    const content = data.choices?.[0]?.message?.content ?? ''
    if (!content.trim()) {
      return Response.json({ error: 'No pude analizar la imagen.' }, { status: 502 })
    }

    return Response.json({ descripcion: content.trim() })
  } catch (e) {
    console.error('describe function error', e)
    return Response.json({ error: 'Error interno.' }, { status: 500 })
  }
}

async function fetchImage(imageUrl) {
  try {
    const resp = await fetch(imageUrl, { signal: AbortSignal.timeout(20000) })
    if (!resp.ok) return { dataUrl: null, reason: `HTTP ${resp.status}` }
    const buffer = await resp.arrayBuffer()
    const contentType = resp.headers.get('content-type') || 'image/jpeg'
    let binary = ''
    const bytes = new Uint8Array(buffer)
    for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i])
    const base64 = btoa(binary)
    return { dataUrl: `data:${contentType};base64,${base64}`, reason: null }
  } catch (e) {
    return { dataUrl: null, reason: e?.message || String(e) }
  }
}