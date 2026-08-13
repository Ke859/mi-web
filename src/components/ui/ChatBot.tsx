import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Send, ImagePlus } from 'lucide-react'
import { compressImage } from '../../utils/image'

const fileToBase64 = (file: File | Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = String(reader.result || '')
      resolve(result.replace(/^data:.*?base64,/, ''))
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })

interface Message {
  id: number
  text: string
  isUser: boolean
  booking?: BookingPrefill | null
  bookingDone?: boolean
  image?: string | null
}

interface BookingPrefill {
  date?: string
  time?: string
  people?: number
  lunch?: 'yes' | 'no'
  name?: string
  whatsapp?: string
  email?: string
}

const responses: Record<string, string> = {
  horario: '🕐 Abrimos de lunes a domingo de 8:00 a 17:00. ¡Te esperamos! 🦇',
  precio: '💰 Cada entrada tiene un costo de $15.000 COP por persona. 🎟️',
  ubicacion: '📍 Estamos en Santa Sofía, Colombia. Puedes ver el mapa y abrir la ubicación en Google Maps desde la sección de Ubicación de la página. 🗺️',
}

const defaultAnswers = [
  '¡Hola! 👋 Soy el asistente virtual de DARKBAT 🦇. Puedo ayudarte con horarios 🕐, precios 💰, ubicación 📍, verificar tu pago ✅ y consultar tus últimas reservas 📋. También puedes decirme algo como "quiero reservar el sábado con 8 personas" y te preparo el formulario. 😊',
]

const suggestionChips = ['📅 Quiero reservar', '🦇 Verificar mi pago', '📋 Mis últimas 3 reservas', '⏰ Horarios', '💰 Precios', '📍 Ubicación']

function getAnswer(input: string): string {
  const lower = input.toLowerCase()
  if (lower.includes('horario') || lower.includes('hora') || lower.includes('abren') || lower.includes('domingo')) return responses.horario
  if (lower.includes('precio') || lower.includes('costo') || lower.includes('vale') || lower.includes('cuesta')) return responses.precio
  if (lower.includes('ubicación') || lower.includes('ubicacion') || lower.includes('mapa') || lower.includes('donde') || lower.includes('llegar')) return responses.ubicacion
  return '🤔 Lo siento, no tengo esa información. Puedo ayudarte con horarios 🕐, precios 💰, ubicación 📍, verificar tu pago ✅ o consultar tus últimas reservas 📋. 😊'
}

type ChatStep = 'idle' | 'awaiting_name' | 'awaiting_whatsapp'

export function ChatBot() {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([{ id: 1, text: defaultAnswers[0], isUser: false }])
  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [step, setStep] = useState<ChatStep>('idle')
  const [verifyName, setVerifyName] = useState('')
  const [pendingBooking, setPendingBooking] = useState<BookingPrefill | null>(null)
  const [lastBooking, setLastBooking] = useState<BookingPrefill | null>(null)
  const [chatBookingId, setChatBookingId] = useState<string | null>(null)
  const [chatDeposit, setChatDeposit] = useState<number | null>(null)
  const chatRef = useRef<HTMLDivElement>(null)
  const idRef = useRef(2)

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight
  }, [messages, isTyping])

  const addBotMsg = useCallback(async (text: string, delay = 800, booking: BookingPrefill | null = null, bookingDone = false) => {
    await new Promise((r) => setTimeout(r, delay + Math.random() * 800))
    setMessages((prev) => [...prev, { id: idRef.current++, text, isUser: false, booking, bookingDone }])
    setIsTyping(false)
  }, [])

  const askAI = useCallback(async (text: string) => {
    setIsTyping(true)
    try {
      const history = messages
        .slice(-6)
        .map((m) => ({ role: m.isUser ? 'user' : 'assistant', content: m.text }))
      const resp = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, history }),
      })
      if (!resp.ok) throw new Error('AI error')
      const data = await resp.json()
      let booking: BookingPrefill | null = data.booking || null

      const merged: BookingPrefill | null = booking ? { ...pendingBooking, ...booking } : null

      const complete =
        merged &&
        merged.date && merged.time && merged.people &&
        merged.name && merged.whatsapp && merged.email

      if (complete) {
        setPendingBooking(merged)
        const fDate = merged.date as string
        const fTime = merged.time as string
        const fPeople = merged.people as number
        const fName = merged.name as string
        const fLunch = merged.lunch
        const rate = fPeople <= 10 ? 0.1 : fPeople <= 20 ? 0.15 : fPeople <= 30 ? 0.2 : fPeople <= 40 ? 0.25 : 0.3
        const bookResp = await fetch('/api/booking', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...merged, source: 'bot' }),
        })
        const bookData = await bookResp.json()
        if (bookResp.ok) {
          setLastBooking(merged)
          setChatBookingId(bookData.id || null)
          setChatDeposit(Math.round(fPeople * 15000 * rate))
          await addBotMsg(
            `✅ ¡Reserva registrada, ${fName}! 🦇\n\n📅 ${fDate} · ${fTime}\n👥 ${fPeople} personas${fLunch === 'yes' ? ' · 🍽️ con almuerzo' : ''}\n\n💰 Total: $${(fPeople * 15000).toLocaleString('es-CO')} COP\n💳 Abono: $${(Math.round(fPeople * 15000 * rate)).toLocaleString('es-CO')} COP por Nequi (314 459 5642)\n\n📷 Paga por Nequi y adjunta el comprobante aquí mismo: la IA lo verifica y tu cupo queda asegurado al instante.`,
            0, null, true
          )
          setPendingBooking(null)
          return
        }
        const alternatives = bookData.alternatives?.length
          ? `\n\n🕓 *Horarios libres ese día:* ${bookData.alternatives.join(', ')}. ¿Te sirve alguno?`
          : ''
        await addBotMsg(`😢 No se pudo registrar: ${bookData.error || 'error desconocido'}.${alternatives}`, 0)
        return
      }

      setPendingBooking(merged)
      await addBotMsg(data.reply || '🤔 No pude procesar tu mensaje. Intenta de nuevo.', 0, booking)
    } catch {
      const answer = getAnswer(text)
      await addBotMsg(answer, 0)
    }
  }, [addBotMsg, messages, pendingBooking])

  const attachReceipt = useCallback(async (file: File | undefined) => {
    if (!file) return
    if (!chatBookingId) {
      await addBotMsg('⚠️ Primero haz una reserva conmigo y luego adjunta el comprobante.', 0)
      return
    }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      await addBotMsg('📷 Sube una imagen JPG, PNG o WEBP.', 0)
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      await addBotMsg('🖼️ La imagen no puede superar 10 MB.', 0)
      return
    }
    setIsTyping(true)
    try {
      const compressed = await compressImage(file)
      const base64 = await fileToBase64(compressed)
      const resp = await fetch('/api/attach-receipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId: chatBookingId, base64, contentType: compressed.type, expectedAmount: chatDeposit, visitDate: lastBooking?.date }),
      })
      const data = await resp.json()
      if (resp.ok && data.coincide) {
        await addBotMsg('✅ *¡Pago verificado!* Tu comprobante coincide con el abono y tu reserva quedó *CONFIRMADA automáticamente*. 🦇 ¡Te esperamos!', 0)
      } else if (resp.ok && data.es_comprobante === false) {
        await addBotMsg(`❌ *Esa imagen no parece un comprobante de pago.* ${data.detalle || ''}\n\nAdjunta la captura real del pago de Nequi (o envíala por WhatsApp 👇). Tu reserva sigue guardada.`, 0)
      } else if (resp.ok) {
        await addBotMsg(`⚠️ La IA leyó tu comprobante pero *no coincide* con el abono esperado ($${chatDeposit?.toLocaleString('es-CO')} COP).\n\n${data.detalle || ''}\n\nSi pagaste otro valor o por otro medio, envíalo por WhatsApp para revisión manual: 💬👇`, 0)
      } else {
        await addBotMsg(`😢 ${data.error || 'No pude analizar tu comprobante.'} Intenta de nuevo o envíalo por WhatsApp para revisión manual.`, 0)
      }
    } catch {
      await addBotMsg('😢 No pude subir tu comprobante. Intenta de nuevo o envíalo por WhatsApp.', 0)
    }
    setIsTyping(false)
  }, [addBotMsg, chatBookingId, chatDeposit, lastBooking])

  const describeImage = useCallback(async (file: File | undefined) => {
    if (!file) return
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      await addBotMsg('📷 Sube una imagen JPG, PNG o WEBP.', 0)
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      await addBotMsg('🖼️ La imagen no puede superar 10 MB.', 0)
      return
    }
    setIsTyping(true)
    try {
      const compressed = await compressImage(file)
      const base64 = await fileToBase64(compressed)
      const up = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base64, contentType: compressed.type, folder: 'tmp' }),
      })
      const upData = await up.json()
      if (!up.ok) throw new Error('upload')
      const imageUrl = upData.receipt_url
      setMessages((prev) => [...prev, { id: idRef.current++, text: '📷', isUser: true, image: imageUrl }])
      const resp = await fetch('/api/describe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl }),
      })
      const data = await resp.json()
      if (!resp.ok) throw new Error('describe')
      await addBotMsg(`🖼️ *Veo lo siguiente en la imagen:*\n\n${data.descripcion}`, 0)
    } catch {
      await addBotMsg('😢 No pude analizar la imagen. Intenta de nuevo.', 0)
    }
    setIsTyping(false)
  }, [addBotMsg])

  const prefillBooking = (booking: BookingPrefill) => {
    window.dispatchEvent(new CustomEvent('darkbat:prefill-booking', { detail: booking }))
    setIsOpen(false)
  }

  const handlePaymentCheck = useCallback(async (name: string, whatsapp: string) => {
    setIsTyping(true)
    try {
      const cleanNumber = whatsapp.replace(/[\s\-()]/g, '')
      const resp = await fetch('/api/check-booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, whatsapp }),
      })
      const data = await resp.json()
      if (!resp.ok) throw new Error(data.error || 'Error')

      type CheckedBooking = {
        whatsapp?: string
        payment_status?: string
        lunch?: 'yes' | 'no'
        visit_date?: string
        visit_time?: string
        people?: number
        total_cop?: number
      }
      const bookings = (data.bookings || []) as CheckedBooking[]
      const filtered = bookings.filter((booking) => booking.whatsapp === undefined || booking.whatsapp?.replace(/[\s\-()]/g, '') === cleanNumber)

      if (filtered.length === 0) {
        await addBotMsg(`😢 No se encontraron resultados para el nombre "${name.trim()}" y el número de celular ${whatsapp.trim()}. Verifica que sean los mismos con los que hiciste la reserva. 🤔`)
      } else {
        const statusMap: Record<string, string> = {
          pending_confirmation: '⏳ Pendiente de confirmación',
          confirmed: '✅ Pagado y confirmado',
          approved: '✅ Pagado y confirmado',
          cancelled: '❌ Cancelado',
        }
        const lines = filtered.map((booking, index) => {
          const status = statusMap[booking.payment_status || ''] || booking.payment_status || 'Registrada'
          const lunch = booking.lunch === 'yes' ? '🍽️ Con almuerzo' : 'Sin almuerzo'
          return `${index + 1}. 📅 ${booking.visit_date} ⏰ ${booking.visit_time} · 👥 ${booking.people} pers · ${lunch}\n   💰 $${booking.total_cop?.toLocaleString('es-CO')} COP · ${status}`
        })
        await addBotMsg(`🎉 ¡Encontré tus últimas ${filtered.length} reserva(s) a nombre de "${name.trim()}"! 🦇✨\n\n${lines.join('\n')}\n\n¿Necesitas algo más? 😊`)
      }
    } catch {
      await addBotMsg('Ocurrió un error al consultar tus reservas. Intenta de nuevo más tarde.')
    }
    setStep('idle')
  }, [addBotMsg])

  const handleSend = (overrideText?: string) => {
    const text = (overrideText ?? input).trim()
    if (!text) return

    const userMsg: Message = { id: idRef.current++, text, isUser: true }
    setMessages((prev) => [...prev, userMsg])
    setInput('')

    const lower = text.toLowerCase()

    // Conversation flow
    if (step === 'awaiting_name') {
      setVerifyName(text)
      setStep('awaiting_whatsapp')
      setIsTyping(true)
      addBotMsg('¡Perfecto! 👍 Para verificar tu identidad, dime el número de WhatsApp 📱 con el que hiciste la reserva.')
      return
    }

    if (step === 'awaiting_whatsapp') {
      setIsTyping(true)
      handlePaymentCheck(verifyName, text)
      return
    }

    // Check if asking about payment
    if (lower.includes('verificar') && (lower.includes('pago') || lower.includes('reserva'))) {
      setStep('awaiting_name')
      setIsTyping(true)
      addBotMsg('¡Claro! ✅ Dime tu nombre completo con el que hiciste la reserva. 😊')
      return
    }

    if (lower.includes('confirmar') && (lower.includes('pago') || lower.includes('reserva'))) {
      setStep('awaiting_name')
      setIsTyping(true)
      addBotMsg('¡Claro! ✅ Dime tu nombre completo con el que hiciste la reserva. 😊')
      return
    }

    if (lower.includes('mis reservas') || lower.includes('estado de mi') || (lower.includes('reservas') && !lower.includes('hacer'))) {
      setStep('awaiting_name')
      setIsTyping(true)
      addBotMsg('Claro. Dime tu nombre completo con el que hiciste la reserva.')
      return
    }

    // Any free-form message goes to the AI (local answers as fallback inside askAI)
    askAI(text)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const sendChip = (text: string) => {
    handleSend(text)
  }

  return (
    <>
      {/* Toggle button */}
      <div className="fixed bottom-6 left-6 z-50 flex flex-col items-center gap-1.5">
        <motion.span
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: [0, -3, 0] }}
          transition={{ delay: 2.8, duration: 0.3, y: { duration: 2, repeat: Infinity, ease: 'easeInOut' } }}
          className="text-[11px] font-display tracking-[0.15em] font-bold text-gold-300 bg-gradient-to-r from-gold-500/10 to-gold-600/10 backdrop-blur-sm px-2.5 py-1 rounded-full border border-gold-500/20 shadow-sm"
        >
          AI
        </motion.span>
        <motion.button
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 2.5, type: 'spring', stiffness: 200 }}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => setIsOpen(!isOpen)}
          className="w-14 h-14 rounded-full bg-gradient-to-br from-gold-400 to-gold-600 shadow-lg shadow-gold-500/30 hover:shadow-xl hover:shadow-gold-500/40 transition-shadow overflow-hidden"
          aria-label={isOpen ? 'Cerrar chat' : 'Abrir chat'}
        >
          {isOpen ? (
            <div className="w-full h-full flex items-center justify-center">
              <X className="w-6 h-6 text-deep-950" />
            </div>
          ) : (
            <img src="/chatbot-avatar.png" alt="" className="w-full h-full object-cover" />
          )}
        </motion.button>
      </div>

      {/* Chat window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="fixed bottom-24 left-4 sm:left-6 z-50 w-[calc(100vw-2rem)] max-w-[24rem] h-[500px] max-h-[70dvh] rounded-2xl border border-white/10 bg-deep-950/95 backdrop-blur-xl shadow-2xl shadow-black/40 flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center gap-3 p-4 border-b border-white/5 bg-gradient-to-r from-gold-500/10 to-transparent">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gold-400 to-gold-600 flex items-center justify-center overflow-hidden">
                <img src="/chatbot-avatar.png" alt="" className="w-full h-full object-cover" />
              </div>
              <div>
                <p className="text-white text-sm font-semibold">Asistente DARKBAT</p>
                <p className="text-stone-500 text-xs">Online</p>
              </div>
            </div>

            {/* Messages */}
            <div ref={chatRef} className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin">
              {messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex ${msg.isUser ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                      msg.isUser
                        ? 'bg-gold-500/20 text-gold-200 border border-gold-500/20 rounded-br-md'
                        : 'bg-white/5 text-stone-300 border border-white/5 rounded-bl-md'
                    }`}
                  >
                    {msg.text}
                    {msg.image && (
                      <img src={msg.image} alt="Imagen enviada" className="mt-2 rounded-lg max-h-40 object-cover border border-white/10" />
                    )}
                    {!msg.isUser && msg.bookingDone && (
                      <div className="mt-3 space-y-2">
                        <label className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-gold-500 text-deep-950 text-xs font-semibold cursor-pointer hover:bg-gold-400 transition-all">
                          📷 Adjuntar comprobante (verificación con IA)
                          <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            className="sr-only"
                            onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; attachReceipt(f) }}
                          />
                        </label>
                        <a
                          href={`https://wa.me/3043899234?text=${encodeURIComponent(
                            `🦇 *Nueva reserva desde el asistente*%0A%0A👤 *Nombre:* ${lastBooking?.name || '—'}%0A📧 *Correo:* ${lastBooking?.email || '—'}%0A📱 *WhatsApp:* ${lastBooking?.whatsapp || '—'}%0A📅 *Fecha:* ${lastBooking?.date || '—'}%0A⏰ *Hora:* ${lastBooking?.time || '—'}%0A👥 *Personas:* ${lastBooking?.people || '—'}%0A🍽️ *Almuerzo:* ${lastBooking?.lunch === 'yes' ? 'Sí' : lastBooking?.lunch === 'no' ? 'No' : '—'}%0A💰 *Total:* $${((lastBooking?.people || 0) * 15000).toLocaleString('es-CO')} COP%0A%0A⏳ Estado: Pendiente de pago%0A%0A📎 *Adjunta aquí tu comprobante de pago para confirmar.*`
                          )}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#25D366] text-white text-xs font-semibold hover:bg-[#1fb958] transition-all"
                        >
                          💬 Enviar reserva y comprobante por WhatsApp
                        </a>
                      </div>
                    )}
                    {!msg.isUser && msg.booking && !msg.bookingDone && (
                      <div className="mt-3">
                        <div className="rounded-lg bg-gold-500/10 border border-gold-500/30 px-3 py-2 mb-2 text-xs text-gold-200 space-y-0.5">
                          {msg.booking.date && <p>📅 Fecha: {msg.booking.date}</p>}
                          {msg.booking.time && <p>⏰ Hora: {msg.booking.time}</p>}
                          {msg.booking.people && <p>👥 Personas: {msg.booking.people}</p>}
                          {msg.booking.lunch && <p>🍽️ {msg.booking.lunch === 'yes' ? 'Con almuerzo' : 'Sin almuerzo'}</p>}
                        </div>
                        <button
                          type="button"
                          onClick={() => msg.booking && prefillBooking(msg.booking)}
                          className="w-full px-4 py-2.5 rounded-lg bg-gradient-to-r from-gold-500 to-gold-400 text-deep-950 text-xs font-semibold hover:from-gold-400 hover:to-gold-300 transition-all"
                        >
                          ✅ Ir a reservar con estos datos
                        </button>
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
              {isTyping && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex justify-start"
                >
                  <div className="bg-white/5 border border-white/5 px-4 py-3 rounded-2xl rounded-bl-md">
                    <div className="flex gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-stone-500 animate-bounce" style={{ animationDelay: '0s' }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-stone-500 animate-bounce" style={{ animationDelay: '0.15s' }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-stone-500 animate-bounce" style={{ animationDelay: '0.3s' }} />
                    </div>
                  </div>
                </motion.div>
              )}
            </div>

            {/* Suggestion chips */}
            <div className="px-4 pb-2 flex flex-wrap gap-2">
              {suggestionChips.map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => sendChip(chip)}
                  className="px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs text-stone-300 hover:border-gold-500/40 hover:text-gold-300 transition-all"
                >
                  {chip}
                </button>
              ))}
            </div>

            {/* Input */}
            <div className="px-4 pb-4 pt-1 border-t border-white/5">
              <div className="flex gap-2">
                <label className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-stone-300 hover:text-gold-300 hover:border-gold-500/40 cursor-pointer transition-all shrink-0" title="Enviar imagen y describirla">
                  <ImagePlus className="w-4 h-4" />
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="sr-only"
                    onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; describeImage(f) }}
                  />
                </label>
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Escribe tu pregunta o envía una foto..."
                  className="flex-1 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder:text-stone-600 focus:outline-none focus:ring-2 focus:ring-gold-500/40 transition-all"
                />
                <button
                  onClick={() => handleSend()}
                  disabled={!input.trim()}
                  className="p-2.5 rounded-xl bg-gold-500 text-deep-950 hover:bg-gold-400 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                  aria-label="Enviar"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
