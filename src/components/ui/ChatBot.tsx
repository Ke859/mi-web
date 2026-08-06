import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Send } from 'lucide-react'
import { supabase } from '../../lib/supabase'

interface Message {
  id: number
  text: string
  isUser: boolean
}

const responses: Record<string, string> = {
  horario: '🕐 Abrimos de lunes a domingo de 8:00 a 17:00. ¡Te esperamos! 🦇',
  precio: '💰 Cada entrada tiene un costo de $15.000 COP por persona. 🎟️',
  ubicacion: '📍 Estamos en Santa Sofía, Colombia. Puedes ver el mapa y abrir la ubicación en Google Maps desde la sección de Ubicación de la página. 🗺️',
}

const defaultAnswers = [
  '¡Hola! 👋 Soy el asistente virtual de DARKBAT 🦇. Puedo ayudarte con horarios 🕐, precios 💰, ubicación 📍, verificar tu pago ✅ y consultar tus últimas reservas 📋. ¿En qué puedo ayudarte? 😊',
]

const suggestionChips = ['🦇 Verificar mi pago', '📋 Mis últimas 3 reservas', '⏰ Horarios', '💰 Precios', '📍 Ubicación']

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
  const chatRef = useRef<HTMLDivElement>(null)
  const idRef = useRef(2)

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight
  }, [messages, isTyping])

  const addBotMsg = useCallback(async (text: string, delay = 800) => {
    await new Promise((r) => setTimeout(r, delay + Math.random() * 800))
    setMessages((prev) => [...prev, { id: idRef.current++, text, isUser: false }])
    setIsTyping(false)
  }, [])

  const handlePaymentCheck = useCallback(async (name: string, whatsapp: string) => {
    setIsTyping(true)
    try {
      const cleanNumber = whatsapp.replace(/[\s\-()]/g, '')
      const { data, error } = await supabase
        .from('bookings')
        .select('payment_status, total_cop, visit_date, visit_time, people, lunch, whatsapp, created_at')
        .eq('name', name.trim())
        .order('created_at', { ascending: false })
        .limit(3)

      if (error) throw error

      const filtered = (data || []).filter((booking) => booking.whatsapp === undefined || booking.whatsapp?.replace(/[\s\-()]/g, '') === cleanNumber)

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
          const status = statusMap[booking.payment_status] || booking.payment_status
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

    // Normal responses
    setIsTyping(true)
    setTimeout(() => {
      const answer = getAnswer(text)
      addBotMsg(answer, 0)
    }, 800 + Math.random() * 800)
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
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Escribe tu pregunta..."
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
