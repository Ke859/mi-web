export default {
  async scheduled(event, env, ctx) {
    ctx.waitUntil(runSummary())
  },

  async fetch(_request) {
    const result = await runSummary()
    return Response.json(result)
  },
}

async function runSummary() {
  try {
    const resp = await fetch('https://darkbat-web.pages.dev/api/daily-summary', { method: 'POST' })
    const data = await resp.json()
    return { ok: true, status: resp.status, data }
  } catch (e) {
    return { ok: false, error: e.message }
  }
}