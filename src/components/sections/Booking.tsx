import { useState, type FormEvent } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { AlertCircle, ArrowLeft, Calendar, CheckCircle, Clock, Copy, CreditCard, Send, Upload, Users as UsersIcon } from 'lucide-react'
import { SectionTitle } from '../ui/SectionTitle'
import { GlassCard } from '../ui/GlassCard'
import { Button } from '../ui/Button'
import { supabase } from '../../lib/supabase'
import { contactInfo } from '../../data/content'
import type { BookingFormData } from '../../types'

const initialForm: BookingFormData = { name: '', email: '', whatsapp: '', date: '', time: '', people: '5', comments: '' }
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
  const [copied, setCopied] = useState(false)
  const total = (parseInt(form.people) || 0) * 15000
  const today = new Date().toISOString().split('T')[0]

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
    if (!form.people || Number(form.people) < 5 || Number(form.people) > 50) next.people = 'De 5 a 50 personas'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const continueToPayment = (event: FormEvent) => {
    event.preventDefault()
    if (validate()) setStep('payment')
  }

  const selectReceipt = (file: File | undefined) => {
    setReceiptError('')
    if (!file) return
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return setReceiptError('Sube una imagen JPG, PNG o WEBP.')
    if (file.size > 10 * 1024 * 1024) return setReceiptError('La imagen no puede superar 10 MB.')
    setReceipt(file)
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
    const { error: uploadError } = await supabase.storage.from('payment-receipts').upload(receiptPath, receipt, { contentType: receipt.type })
    if (uploadError) {
      setSubmitError('No pudimos subir el comprobante. Inténtalo de nuevo.')
      setIsSubmitting(false)
      return
    }
    const { error: bookingError } = await supabase.from('bookings').insert({
      name: form.name.trim(), email: form.email.trim(), whatsapp: form.whatsapp.trim(), visit_date: form.date,
      visit_time: form.time, people: Number(form.people), comments: form.comments.trim() || null,
      total_cop: total, receipt_path: receiptPath, payment_status: 'pending_confirmation',
    })
    if (bookingError) {
      await supabase.storage.from('payment-receipts').remove([receiptPath])
      setSubmitError('No pudimos registrar tu reserva. Inténtalo de nuevo.')
      setIsSubmitting(false)
      return
    }
    setIsSubmitting(false)
    setStep('success')
    notifyAdmin()
  }

  const notifyAdmin = () => {
    const msg = `🦇 *Nueva reserva DARKBAT*%0A%0A👤 *Nombre:* ${form.name}%0A📧 *Correo:* ${form.email}%0A📱 *WhatsApp:* ${form.whatsapp}%0A📅 *Fecha:* ${form.date}%0A⏰ *Hora:* ${form.time}%0A👥 *Personas:* ${form.people}%0A💰 *Total:* $${total.toLocaleString('es-CO')} COP%0A📝 *Comentarios:* ${form.comments || 'Ninguno'}%0A%0A⏳ Estado: Pendiente de confirmación`
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
        <div className="flex justify-center gap-2 mb-8 text-xs font-medium">
          {['1. Datos', '2. Pago', '3. Confirmación'].map((label, index) => <span key={label} className={`rounded-full px-3 py-1 ${index <= (step === 'details' ? 0 : step === 'payment' ? 1 : 2) ? 'bg-gold-500/20 text-gold-300' : 'bg-white/5 text-stone-500'}`}>{label}</span>)}
        </div>
        <AnimatePresence mode="wait">
          {step === 'success' ? (
            <motion.div key="success" initial={{ opacity: 0, scale: .96 }} animate={{ opacity: 1, scale: 1 }}><GlassCard className="text-center py-12">
              <CheckCircle className="w-14 h-14 text-green-400 mx-auto mb-5" />
              <h3 className="text-2xl font-display font-bold text-white mb-2">Pago en revisión</h3>
              <p className="text-stone-400 max-w-md mx-auto mb-6">Recibimos tu reserva y comprobante. Confirmaremos manualmente que el pago ingresó antes de asegurar tu cupo.</p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button variant="secondary" size="sm" onClick={notifyAdmin}>Notificar a DARKBAT por WhatsApp</Button>
                <Button variant="ghost" size="sm" onClick={reset}>Nueva reserva</Button>
              </div>
            </GlassCard></motion.div>
          ) : step === 'payment' ? (
            <motion.div key="payment" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}><GlassCard>
              <button type="button" onClick={() => setStep('details')} className="inline-flex items-center gap-2 text-sm text-stone-400 hover:text-white mb-6"><ArrowLeft className="w-4 h-4" />Editar datos</button>
              <h3 className="font-display text-2xl text-white font-bold">Paga y adjunta el comprobante</h3>
              <p className="text-stone-400 mt-2">Envía exactamente <strong className="text-gold-300">${total.toLocaleString('es-CO')} COP</strong> a Nequi.</p>
              <div className="my-6 grid sm:grid-cols-2 gap-5 items-center rounded-xl border border-gold-500/20 bg-gold-500/5 p-5">
                <div>
                  <p className="text-xs text-stone-500 uppercase tracking-wider">Nequi</p>
                  <p className="font-mono text-xl text-white mt-1">314 459 5642</p>
                  <p className="text-sm text-stone-400 mt-2">Incluye el valor y destinatario visibles en la captura.</p>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText('3144595642')
                      setCopied(true)
                      setTimeout(() => setCopied(false), 2000)
                    }}
                    className="mt-3 inline-flex items-center gap-1.5 text-xs text-gold-400 hover:text-gold-300 transition-colors"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    {copied ? '¡Copiado!' : 'Copiar número'}
                  </button>
                </div>
                <div className="flex flex-col items-center gap-3">
                  <img src="/nequi-qr.jpeg" alt="Código QR para pagar con Nequi" className="w-36 h-36 rounded-xl border border-white/10 object-cover" />
                  <a
                    href="tel:3144595642"
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#E91E8C] text-white text-xs font-semibold hover:bg-[#d0187a] transition-colors"
                  >
                    Pagar con Nequi
                  </a>
                </div>
              </div>
              <label htmlFor="receipt" className="block rounded-xl border border-dashed border-gold-500/40 bg-white/[.03] p-6 text-center cursor-pointer hover:bg-white/[.06] transition-colors">
                <Upload className="w-6 h-6 text-gold-300 mx-auto mb-2" /><span className="text-white font-medium">{receipt ? receipt.name : 'Adjunta tu comprobante de Nequi'}</span><p className="text-xs text-stone-500 mt-1">JPG, PNG o WEBP. Máximo 10 MB.</p>
                <input id="receipt" type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(event) => selectReceipt(event.target.files?.[0])} />
              </label>
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
                <div><label htmlFor="time" className="block text-sm text-stone-400 mb-1.5">Hora *</label><div className="relative"><select id="time" value={form.time} onChange={(e) => set('time', e.target.value)} className={fieldClass}><option value="" className="bg-deep-900">Selecciona una hora</option>{['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00'].map((time) => <option key={time} value={time} className="bg-deep-900">{time}</option>)}</select><Clock className="w-4 h-4 text-stone-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" /></div>{inputError('time')}</div>
                <div><label htmlFor="people" className="block text-sm text-stone-400 mb-1.5">Número de personas *</label><div className="relative"><input id="people" type="number" min={5} max={50} value={form.people} onChange={(e) => set('people', e.target.value)} className={fieldClass} /><UsersIcon className="w-4 h-4 text-stone-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" /></div>{inputError('people')}</div>
                <div className="md:col-span-2"><label htmlFor="comments" className="block text-sm text-stone-400 mb-1.5">Comentarios</label><textarea id="comments" rows={3} value={form.comments} onChange={(e) => set('comments', e.target.value)} className={`${fieldClass} resize-none`} placeholder="Alguna solicitud especial" /></div>
              </div>
              <div className="mt-6 p-5 rounded-xl border border-gold-500/20 bg-gold-500/5 flex justify-between items-center"><span className="text-stone-400">Total a pagar</span><span className="text-xl font-display font-bold text-gradient-gold">${total.toLocaleString('es-CO')} COP</span></div>
              <Button type="submit" size="lg" className="w-full mt-6"><Send className="w-4 h-4" />Continuar al pago</Button>
            </GlassCard></motion.form>
          )}
        </AnimatePresence>
      </div>
    </section>
  )
}
