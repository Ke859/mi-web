import { useEffect, useState, type FormEvent } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { AlertCircle, AlertTriangle, ArrowLeft, Calendar, CheckCircle, Clock, Copy, CreditCard, Send, Upload, Users as UsersIcon } from 'lucide-react'
import { SectionTitle } from '../ui/SectionTitle'
import { GlassCard } from '../ui/GlassCard'
import { Button } from '../ui/Button'
import { supabase } from '../../lib/supabase'
import { compressImage } from '../../utils/image'
import { contactInfo } from '../../data/content'
import type { BookingFormData } from '../../types'

const initialForm: BookingFormData = { name: '', email: '', whatsapp: '', date: '', time: '', people: '5', lunch: '', comments: '' }
const fieldClass = 'w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white text-sm placeholder:text-stone-600 focus:outline-none focus:ring-2 focus:ring-gold-500/40 transition-all'

type FormErrors = Partial<Record<keyof BookingFormData, string>>

export function Booking() {
  const [form, setForm] = useState<BookingFormData>(initialForm)
  const [errors, setErrors] = useState<FormErrors>({})
  const [step, setStep] = useState<'details' | 'payment' | 'success'>('details')
  const [receipt, setReceipt] = useState<File | null>(null)
  const [receiptError, setReceiptError] = useState('')
  const [submitError, setSubmitError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [verifyingAI, setVerifyingAI] = useState(false)
  const [autoVerified, setAutoVerified] = useState(false)
  const [verificationMsg, setVerificationMsg] = useState('')
  const [copied, setCopied] = useState(false)
  const total = (parseInt(form.people) || 0) * 15000
  const depositRate = (() => {
    const people = Number(form.people) || 0
    if (people >= 5 && people <= 10) return 0.10
    if (people >= 11 && people <= 20) return 0.15
    if (people >= 21 && people <= 30) return 0.20
    if (people >= 31 && people <= 40) return 0.25
    if (people >= 41 && people <= 50) return 0.30
    return 0.10
  })()
  const deposit = Math.round(total * depositRate)
  const today = new Date().toISOString().split('T')[0]

  useEffect(() => {
    const handlePrefill = (event: Event) => {
      const detail = (event as CustomEvent).detail as { date?: string; time?: string; people?: number; lunch?: 'yes' | 'no' } | undefined
      if (!detail) return
      setForm((current) => ({
        ...current,
        date: detail.date && detail.date >= today ? detail.date : current.date,
        time: detail.time && /^\d{2}:\d{2}$/.test(detail.time) ? detail.time : current.time,
        people: detail.people && detail.people >= 5 && detail.people <= 50 ? String(detail.people) : current.people,
        lunch: detail.lunch === 'yes' || detail.lunch === 'no' ? detail.lunch : current.lunch,
      }))
      setStep('details')
      document.querySelector('#booking')?.scrollIntoView({ behavior: 'smooth' })
    }
    window.addEventListener('darkbat:prefill-booking', handlePrefill)
    return () => window.removeEventListener('darkbat:prefill-booking', handlePrefill)
  }, [today])

  const set = (field: keyof BookingFormData, value: string) => {
    setForm((current) => ({ ...current, [field]: value }))
    setErrors((current) => ({ ...current, [field]: undefined }))
  }

  const validate = () => {
    const next: FormErrors = {}
    if (!form.name.trim()) next.name = 'El nombre es obligatorio'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) next.email = 'Ingresa un correo válido'
    if (!/^\+?\d{7,15}$/.test(form.whatsapp.replace(/[\s\-()]/g, ''))) next.whatsapp = 'Ingresa un número válido'
    if (!form.date) next.date = 'Selecciona una fecha'
    if (!form.time) next.time = 'Selecciona una hora'
    if (form.time && (form.time < '08:00' || form.time > '17:00')) next.time = 'Nuestro horario es de 8:00 a 17:00'
    if (!form.people || Number(form.people) < 5 || Number(form.people) > 50) next.people = 'De 5 a 50 personas'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const continueToPayment = (event: FormEvent) => {
    event.preventDefault()
    if (validate()) setStep('payment')
  }

  const selectReceipt = async (file: File | undefined) => {
    setReceiptError('')
    if (!file) return
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return setReceiptError('Sube una imagen JPG, PNG o WEBP.')
    if (file.size > 10 * 1024 * 1024) return setReceiptError('La imagen no puede superar 10 MB.')
    try {
      const compressed = await compressImage(file)
      setReceipt(compressed)
    } catch {
      setReceiptError('No pudimos procesar la imagen.')
    }
  }

  const submitBooking = async () => {
    if (!receipt) {
      setReceiptError('Debes adjuntar el comprobante de pago.')
      return
    }
    setIsSubmitting(true)
    setSubmitError('')
    const extension = receipt.name.split('.').pop()?.toLowerCase() || 'jpg'
    const receiptPath = `pending/${crypto.randomUUID()}.${extension}`
    const { error: uploadError } = await supabase.storage.from('comprobantes-db').upload(receiptPath, receipt, { contentType: receipt.type })
    if (uploadError) {
      setSubmitError('No pudimos subir el comprobante. Inténtalo de nuevo.')
      setIsSubmitting(false)
      return
    }
    const resp = await fetch('/api/booking', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: form.name.trim(), email: form.email.trim(), whatsapp: form.whatsapp.trim(), date: form.date,
        time: form.time, people: Number(form.people), lunch: form.lunch, comments: form.comments.trim() || null,
        receipt_path: receiptPath, source: 'form',
      }),
    })
    const data = await resp.json()
    if (!resp.ok) {
      await supabase.storage.from('comprobantes-db').remove([receiptPath])
      const alternatives = data.alternatives?.length ? ` Horarios libres: ${data.alternatives.join(', ')}.` : ''
      setSubmitError(`${data.error || 'No pudimos registrar tu reserva. Inténtalo de nuevo.'}${alternatives}`)
      setIsSubmitting(false)
      return
    }
    const bookingId = data.id
    setIsSubmitting(false)
    setStep('success')
    if (bookingId) autoVerifyReceipt(bookingId, receiptPath)
    notifyAdmin()
  }

  const autoVerifyReceipt = async (bookingId: string, receiptPath: string) => {
    setVerifyingAI(true)
    setVerificationMsg('')
    try {
      const receiptUrl = supabase.storage.from('comprobantes-db').getPublicUrl(receiptPath).data.publicUrl
      const resp = await fetch('/api/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ receiptUrl, expectedAmount: deposit, visitDate: form.date }),
      })
      const data = await resp.json()
      if (resp.ok && data.coincide) {
        await supabase.from('bookings').update({ payment_status: 'confirmed' }).eq('id', bookingId)
        setAutoVerified(true)
      } else if (resp.ok) {
        setVerificationMsg(data.detalle || 'El comprobante no coincide con el abono esperado.')
      }
    } catch {
      // Sin aprobación automática: queda pendiente de revisión manual
    }
    setVerifyingAI(false)
  }

  const notifyAdmin = () => {
    const msg = `🦇 *Nueva reserva DARKBAT*%0A%0A👤 *Nombre:* ${form.name}%0A📧 *Correo:* ${form.email}%0A📱 *WhatsApp:* ${form.whatsapp}%0A📅 *Fecha:* ${form.date}%0A⏰ *Hora:* ${form.time}%0A👥 *Personas:* ${form.people}%0A🍽️ *Almuerzo:* ${form.lunch === 'yes' ? 'Sí' : 'No'}%0A💰 *Total:* $${total.toLocaleString('es-CO')} COP%0A💳 *Abono (${Math.round(depositRate * 100)}%):* $${deposit.toLocaleString('es-CO')} COP%0A📝 *Comentarios:* ${form.comments || 'Ninguno'}%0A%0A⏳ Estado: Pendiente de confirmación%0A%0A📎 *Adjunta tu comprobante de pago a este chat para confirmar.*`
    window.open(`https://wa.me/${contactInfo.whatsapp}?text=${msg}`, '_blank')
  }

  const reset = () => {
    setForm(initialForm); setErrors({}); setReceipt(null); setReceiptError(''); setSubmitError(''); setStep('details')
  }

  const inputError = (field: keyof BookingFormData) => errors[field] && <p className="mt-1 text-xs text-red-400">{errors[field]}</p>

  return (
    <section id="booking" className="relative py-24 md:py-32 bg-deep-900/50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionTitle subtitle="Reserva" title="Asegura tu Lugar" description="Completa tu reserva, realiza el pago por Nequi y adjunta el comprobante." />
        <div className="grid grid-cols-3 gap-3 md:gap-4 mb-8">
          {[
            { key: 'details' as const, num: '1', icon: Send, label: 'Tus datos', hint: 'Fecha, hora y personas' },
            { key: 'payment' as const, num: '2', icon: CreditCard, label: 'Pago', hint: 'Abono por Nequi' },
            { key: 'success' as const, num: '3', icon: CheckCircle, label: 'Confirmación', hint: 'Comprobante y WhatsApp' },
          ].map((item, index) => {
            const done = step === 'payment' ? item.key === 'details' : step === 'success' ? item.key !== 'success' : false
            const active = step === 'success' ? item.key === 'success' : step === item.key
            const clickable = step === 'payment' ? item.key === 'details' : false
            const card = (
              <motion.button
                type="button"
                onClick={clickable ? () => setStep('details') : undefined}
                initial={{ opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: index * 0.1, ease: 'easeOut' }}
                whileHover={clickable || active ? { y: -3, scale: 1.03 } : { y: -2 }}
                whileTap={clickable ? { scale: 0.97 } : undefined}
                className={`relative w-full text-left rounded-xl border p-3 md:p-4 transition-colors duration-300 overflow-hidden ${
                  active
                    ? 'border-gold-500/60 bg-gold-500/10 shadow-lg shadow-gold-500/10'
                    : done
                    ? 'border-green-500/30 bg-green-500/5'
                    : 'border-white/10 bg-white/[.03]'
                } ${clickable ? 'cursor-pointer hover:border-gold-500/40' : 'cursor-default'}`}
              >
                {active && (
                  <motion.span
                    layoutId="step-glow"
                    className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold-400 to-transparent"
                  />
                )}
                <div className="flex items-center gap-3">
                  <motion.span
                    animate={active ? { scale: [1, 1.12, 1] } : {}}
                    transition={{ duration: 2, repeat: active ? Infinity : 0, ease: 'easeInOut' }}
                    className={`w-8 h-8 md:w-10 md:h-10 rounded-lg flex items-center justify-center shrink-0 ${active ? 'bg-gold-500 text-deep-950 font-bold shadow-lg shadow-gold-500/40' : done ? 'bg-green-500/20 text-green-400' : 'bg-white/5 text-stone-500'}`}
                  >
                    {done ? <CheckCircle className="w-4 h-4 md:w-5 md:h-5" /> : <item.icon className="w-4 h-4 md:w-5 md:h-5" />}
                  </motion.span>
                  <span className="min-w-0">
                    <span className={`block text-xs md:text-sm font-semibold ${active ? 'text-gold-300' : done ? 'text-green-400' : 'text-stone-300'}`}>{item.num}. {item.label}</span>
                    <span className="hidden sm:block text-[10px] md:text-xs text-stone-500 truncate">{item.hint}</span>
                  </span>
                </div>
                {clickable && (
                  <span className="absolute bottom-1.5 right-2 text-[10px] text-gold-400/70 hidden md:inline">← volver</span>
                )}
              </motion.button>
            )
            return <div key={item.key}>{card}</div>
          })}
        </div>
        <AnimatePresence mode="wait">
          {step === 'success' ? (
            <motion.div key="success" initial={{ opacity: 0, scale: .96 }} animate={{ opacity: 1, scale: 1 }}><GlassCard className="text-center py-12">
              {verifyingAI ? (
                <>
                  <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1.4, ease: 'linear' }} className="w-14 h-14 border-4 border-gold-500/20 border-t-gold-400 rounded-full mx-auto mb-5" />
                  <h3 className="text-2xl font-display font-bold text-white mb-2">Verificando tu pago...</h3>
                  <p className="text-stone-400 max-w-md mx-auto">Nuestra IA está leyendo el monto de tu comprobante. Un momento por favor.</p>
                </>
              ) : autoVerified ? (
                <>
                  <CheckCircle className="w-14 h-14 text-green-400 mx-auto mb-5" />
                  <h3 className="text-2xl font-display font-bold text-white mb-2">¡Pago confirmado! 🎉</h3>
                  <p className="text-stone-400 max-w-md mx-auto mb-6">Tu comprobante fue verificado con IA y el abono coincide. Tu cupo quedó <span className="text-green-400 font-semibold">asegurado automáticamente</span>. Te esperamos el <span className="text-white font-semibold">{form.date} a las {form.time}</span>.</p>
                  <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <Button variant="secondary" size="sm" onClick={notifyAdmin}>Reabrir WhatsApp y enviar reserva</Button>
                    <Button variant="ghost" size="sm" onClick={reset}>Nueva reserva</Button>
                  </div>
                </>
) : verificationMsg ? (
                <>
                  <AlertTriangle className="w-14 h-14 text-amber-400 mx-auto mb-5" />
                  <h3 className="text-2xl font-display font-bold text-white mb-2">Comprobante no coincide ⚠️</h3>
                  <p className="text-stone-400 max-w-md mx-auto mb-4">{verificationMsg}</p>
                  <p className="text-sm text-amber-300 mb-6">Tu reserva quedó guardada pero el pago está en revisión. Si es una foto incorrecta, envíanos el comprobante real de Nequi por WhatsApp y lo confirmamos al instante.</p>
                  <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <Button variant="secondary" size="sm" onClick={notifyAdmin}>Reabrir WhatsApp y enviar reserva</Button>
                    <Button variant="ghost" size="sm" onClick={reset}>Nueva reserva</Button>
                  </div>
                </>
              ) : (
                <>
                  <CheckCircle className="w-14 h-14 text-gold-400 mx-auto mb-5" />
                  <h3 className="text-2xl font-display font-bold text-white mb-2">Pago en revisión</h3>
                  <p className="text-stone-400 max-w-md mx-auto mb-6">Recibimos tu reserva y comprobante. Confirmaremos manualmente que el pago ingresó antes de asegurar tu cupo.</p>
                  <p className="text-sm text-gold-300 mb-6">📎 Se abrió un chat de WhatsApp con DARKBAT: envía el mensaje para que el comprobante con los datos de tu reserva llegue al admin.</p>
                  <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <Button variant="secondary" size="sm" onClick={notifyAdmin}>Reabrir WhatsApp y enviar reserva</Button>
                    <Button variant="ghost" size="sm" onClick={reset}>Nueva reserva</Button>
                  </div>
                </>
              )}
            </GlassCard></motion.div>
          ) : step === 'payment' ? (
            <motion.div key="payment" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}><GlassCard>
              <button type="button" onClick={() => setStep('details')} className="inline-flex items-center gap-2 text-sm text-stone-400 hover:text-white mb-6"><ArrowLeft className="w-4 h-4" />Editar datos</button>
              <div className="grid md:grid-cols-2 gap-4 md:gap-5">
                <motion.div
                  whileHover={{ y: -3 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                  className="rounded-xl border border-gold-500/20 bg-gold-500/5 p-5 flex flex-col justify-center"
                >
                  <p className="text-xs text-stone-500 uppercase tracking-wider mb-1">Abono a pagar hoy</p>
                  <p className="font-display text-3xl md:text-4xl font-bold text-gold-300">${deposit.toLocaleString('es-CO')} <span className="text-sm font-normal text-stone-500">COP</span></p>
                  <p className="text-sm text-stone-400 mt-2">{Math.round(depositRate * 100)}% de ${total.toLocaleString('es-CO')} COP <span className="text-stone-500">({Number(form.people) || 0} × $15.000)</span></p>
                  <p className="mt-3 pt-3 border-t border-white/10 text-xs text-stone-500">Saldo el día de la visita: <span className="text-white font-semibold">${(total - deposit).toLocaleString('es-CO')} COP</span></p>
                </motion.div>
                <motion.div whileHover={{ y: -3 }} transition={{ type: 'spring', stiffness: 300, damping: 20 }} className="flex flex-col items-center gap-3 rounded-xl border border-white/10 bg-white/[.03] p-5">
                  <motion.img
                    src="/nequi-qr.jpeg"
                    alt="Código QR para pagar con Nequi"
                    whileHover={{ scale: 1.08, rotate: -2 }}
                    transition={{ type: 'spring', stiffness: 260, damping: 18 }}
                    className="w-32 h-32 md:w-36 md:h-36 rounded-xl border border-white/10 object-cover shadow-lg shadow-black/30"
                  />
                  <motion.a
                    href="tel:3144595642"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#E91E8C] text-white text-xs font-semibold hover:bg-[#d0187a] transition-colors shadow-lg shadow-[#E91E8C]/25"
                  >
                    Pagar con Nequi
                  </motion.a>
                </motion.div>
              </div>
              <motion.div
                whileHover={{ y: -2 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[.03] p-4"
              >
                <div>
                  <p className="text-xs text-stone-500 uppercase tracking-wider">Nequi (destinatario)</p>
                  <p className="font-mono text-lg md:text-xl text-white mt-0.5">314 459 5642</p>
                </div>
                <motion.button
                  type="button"
                  whileHover={{ scale: 1.06 }}
                  whileTap={{ scale: 0.92 }}
                  onClick={() => {
                    navigator.clipboard.writeText('3144595642')
                    setCopied(true)
                    setTimeout(() => setCopied(false), 2000)
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-gold-500/10 border border-gold-500/30 text-xs text-gold-300 hover:bg-gold-500/20 transition-colors shrink-0"
                >
                  <Copy className="w-3.5 h-3.5" />
                  {copied ? '¡Copiado!' : 'Copiar número'}
                </motion.button>
              </motion.div>
              <div className="mt-4">
                <motion.label htmlFor="receipt" whileHover={{ scale: 1.015, borderColor: 'rgba(232, 178, 66, 0.7)' }} whileTap={{ scale: 0.99 }} className="block rounded-xl border border-dashed border-gold-500/40 bg-white/[.03] p-6 text-center cursor-pointer hover:bg-white/[.06] transition-colors">
                  <motion.span animate={{ y: [0, -4, 0] }} transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }} className="inline-block">
                    <Upload className="w-6 h-6 text-gold-300 mx-auto mb-2" />
                  </motion.span>
                  <span className="block text-white font-medium">{receipt ? receipt.name : 'Adjunta tu comprobante de Nequi'}</span><p className="text-xs text-stone-500 mt-1">JPG, PNG o WEBP. Máximo 10 MB.</p>
                  <input id="receipt" type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(event) => selectReceipt(event.target.files?.[0])} />
                </motion.label>
              </div>
              {receiptError && <p className="mt-2 text-xs text-red-400">{receiptError}</p>}
              {submitError && <p className="mt-4 flex gap-2 text-sm text-red-400"><AlertCircle className="w-4 h-4 shrink-0" />{submitError}</p>}
              <Button type="button" size="lg" className="w-full mt-6" onClick={submitBooking} disabled={isSubmitting}>{isSubmitting ? 'Guardando reserva...' : <><CreditCard className="w-4 h-4" />Enviar comprobante</>}</Button>
              <p className="mt-3 text-center text-xs text-stone-500">Tu pago quedará pendiente de confirmación manual.</p>
            </GlassCard></motion.div>
          ) : (
            <motion.form key="details" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} onSubmit={continueToPayment} noValidate><GlassCard>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div><label htmlFor="name" className="block text-sm text-stone-400 mb-1.5">Nombre completo *</label><input id="name" value={form.name} onChange={(e) => set('name', e.target.value)} className={fieldClass} placeholder="Tu nombre" />{inputError('name')}</div>
                <div><label htmlFor="email" className="block text-sm text-stone-400 mb-1.5">Correo electrónico *</label><input id="email" type="email" value={form.email} onChange={(e) => set('email', e.target.value)} className={fieldClass} placeholder="correo@ejemplo.com" />{inputError('email')}</div>
                <div><label htmlFor="whatsapp" className="block text-sm text-stone-400 mb-1.5">WhatsApp *</label><input id="whatsapp" type="tel" value={form.whatsapp} onChange={(e) => set('whatsapp', e.target.value)} className={fieldClass} placeholder="300 000 0000" />{inputError('whatsapp')}</div>
                <div><label htmlFor="date" className="block text-sm text-stone-400 mb-1.5">Fecha *</label><div className="relative"><input id="date" type="date" min={today} value={form.date} onChange={(e) => set('date', e.target.value)} className={`${fieldClass} [color-scheme:dark]`} /><Calendar className="w-4 h-4 text-stone-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" /></div>{inputError('date')}</div>
                <div><label htmlFor="time" className="block text-sm text-stone-400 mb-1.5">Hora *</label><div className="relative"><input id="time" type="time" min="08:00" max="17:00" value={form.time} onChange={(e) => set('time', e.target.value)} className={`${fieldClass} [color-scheme:dark]`} /><Clock className="w-4 h-4 text-stone-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" /></div>{inputError('time')}<p className="mt-1 text-[11px] text-stone-500">Horario de visita: 8:00 a 17:00</p></div>
                <div><label htmlFor="people" className="block text-sm text-stone-400 mb-1.5">Número de personas *</label><div className="relative"><input id="people" type="number" min={5} max={50} value={form.people} onChange={(e) => set('people', e.target.value)} className={fieldClass} /><UsersIcon className="w-4 h-4 text-stone-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" /></div>{inputError('people')}</div>
                <div className="md:col-span-2">
                  <span className="block text-sm text-stone-400 mb-1.5">¿Deseas incluir almuerzo?</span>
                  <div className="grid sm:grid-cols-2 gap-3">
                    {[
                      { value: 'yes', label: 'Sí, deseo almuerzo' },
                      { value: 'no', label: 'No, gracias' },
                    ].map((option) => (
                      <label key={option.value} className={`flex items-center gap-3 px-4 py-3 rounded-lg border cursor-pointer transition-all ${form.lunch === option.value ? 'border-gold-500/60 bg-gold-500/10' : 'border-white/10 bg-white/5 hover:bg-white/10'}`}>
                        <input type="radio" name="lunch" value={option.value} checked={form.lunch === option.value} onChange={(e) => set('lunch', e.target.value)} className="accent-gold-500" />
                        <span className="text-sm text-white">{option.label}</span>
                      </label>
                    ))}
                  </div>
                  {form.lunch === 'yes' && <p className="mt-2 text-xs text-gold-300 flex items-center gap-1.5"><AlertCircle className="w-3.5 h-3.5 shrink-0" />El almuerzo debe reservarse con al menos una semana de anticipación.</p>}
                </div>
                <div className="md:col-span-2"><label htmlFor="comments" className="block text-sm text-stone-400 mb-1.5">Comentarios</label><textarea id="comments" rows={3} value={form.comments} onChange={(e) => set('comments', e.target.value)} className={`${fieldClass} resize-none`} placeholder="Alguna solicitud especial" /></div>
              </div>
              <div className="mt-6 p-5 rounded-xl border border-gold-500/20 bg-gold-500/5 space-y-2">
                <div className="flex justify-between items-center"><span className="text-stone-400">Total visita ({Number(form.people) || 0} × $15.000)</span><span className="text-sm font-semibold text-white">${total.toLocaleString('es-CO')} COP</span></div>
                <div className="flex justify-between items-center"><span className="text-stone-400">Abono a pagar hoy ({Math.round(depositRate * 100)}%)</span><span className="text-sm font-semibold text-gold-300">${deposit.toLocaleString('es-CO')} COP</span></div>
                <div className="pt-2 border-t border-white/10 flex justify-between items-center"><span className="text-stone-400">Saldo el día de la visita</span><span className="font-display font-bold text-white">${(total - deposit).toLocaleString('es-CO')} COP</span></div>
              </div>
              <Button type="submit" size="lg" className="w-full mt-6"><Send className="w-4 h-4" />Continuar al pago</Button>
            </GlassCard></motion.form>
          )}
        </AnimatePresence>
      </div>
    </section>
  )
}
