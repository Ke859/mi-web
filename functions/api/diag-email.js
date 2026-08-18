import { sendBookingEmail } from '../_lib/email.js'

export async function onRequestGet(context) {
  const { env } = context
  const to = context.request.url.includes('to=') ? new URL(context.request.url).searchParams.get('to') : 'Oficialdarkbat@gmail.com'
  const result = await sendBookingEmail(env, {
    code: 'DB-TEST',
    name: 'Cliente Prueba',
    email: to,
    visit_date: '2026-08-20',
    visit_time: '12:00',
    people: 10,
    lunch: 'yes',
    comments: 'Prueba de diagnostico',
    total_cop: 150000,
    deposit_cop: 15000,
  })
  return Response.json(result)
}