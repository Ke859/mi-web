export default {
  async scheduled(event, env, ctx) {
    ctx.waitUntil(runDaily())
  },

  async fetch(_request) {
    const result = await runDaily()
    return Response.json(result)
  },
}

async function runDaily() {
  const results = []
  for (const path of ['api/daily-summary', 'api/reminders']) {
    try {
      const resp = await fetch(`https://darkbat-web.pages.dev/${path}`, { method: 'POST' })
      const data = await resp.json()
      results.push({ path, ok: resp.ok, status: resp.status, data })
    } catch (e) {
      results.push({ path, ok: false, error: e.message })
    }
  }
  return { ok: true, results }
}