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
  horario: 'Abrimos de lunes a domingo de 8:00 a 17:00.',
  precio: 'Cada entrada tiene un costo de $15.000 COP por persona. El tour guiado dura aproximadamente 2 horas.',
  duracion: 'El recorrido dura aproximadamente 2 horas, recorriendo 1.5 km de senderos iluminados dentro de la cueva.',
  llevar: 'Recomendamos llevar ropa cómoda, calzado cerrado y una chaqueta ligera. Nosotros proporcionamos casco y linterna.',
  niños: '¡Sí! El recorrido es apto para mayores de 5 años. Los niños deben ir acompañados de un adulto.',
  seguro: 'Completamente seguro. Contamos con pasarelas, barandales, iluminación LED y guías certificados en primeros auxilios.',
  murcielagos: 'Sí, la colonia habita la cueva permanentemente. La mejor hora para verlos más activos es al atardecer.',
  ubicacion: 'Estamos en la Carretera Federal Km 14, Zona Arqueológica, Yucatán, México. Puedes ver el mapa en la sección de Ubicación.',
}

const defaultAnswers = [
  '¡Hola! Soy el asistente virtual de DARKBAT. Puedo ayudarte con horarios, precios, qué llevar, seguridad y más. ¿En qué puedo ayudarte?',
]

function getAnswer(input: string): string {
  const lower = input.toLowerCase()
  if (lower.includes('horario') || lower.includes('hora') || lower.includes('abren') || lower.includes('domingo')) return responses.horario
  if (lower.includes('precio') || lower.includes('costo') || lower.includes('vale') || lower.includes('cuesta') || lower.includes('pago')) return responses.precio
  if (lower.includes('dura') || lower.includes('tiempo') || lower.includes('recorrido') || lower.includes('largo')) return responses.duracion
  if (lower.includes('llevar') || lower.includes('ropa') || lower.includes('traer') || lower.includes('necesito')) return responses.llevar
  if (lower.includes('niño') || lower.includes('niña') || lower.includes('menor') || lower.includes('familia')) return responses.niños
  if (lower.includes('seguro') || lower.includes('peligro') || lower.includes('riesgo')) return responses.seguro
  if (lower.includes('murciélago') || lower.includes('murcielago') || lower.includes('bat') || lower.includes('vuelan')) return responses.murcielagos
  if (lower.includes('ubicación') || lower.includes('ubicacion') || lower.includes('mapa') || lower.includes('donde') || lower.includes('llegar')) return responses.ubicacion
  return 'Lo siento, no tengo esa información. ¿Puedes preguntarme sobre horarios, precios, duración del recorrido, qué llevar, seguridad o ubicación?'
}

type ChatStep = 'idle' | 'awaiting_name' | 'awaiting_date'

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

  const handlePaymentCheck = useCallback(async (name: string, date: string) => {
    setIsTyping(true)
    try {
      const { data, error } = await supabase
        .from('bookings')
        .select('payment_status, total_cop, visit_date, visit_time')
        .eq('name', name.trim())
        .eq('visit_date', date)
        .limit(1)

      if (error) throw error

      if (!data || data.length === 0) {
        await addBotMsg(`No encontré ninguna reserva con el nombre "${name}" para el día "${date}". Verifica que los datos sean correctos.`)
      } else {
        const { payment_status, total_cop, visit_date, visit_time } = data[0]
        const statusMap: Record<string, string> = {
          pending_confirmation: '⏳ Pendiente de confirmación',
          confirmed: '✅ Pagado y confirmado',
          cancelled: '❌ Cancelado',
        }
        const status = statusMap[payment_status] || payment_status
        await addBotMsg(`Reserva encontrada:\n- Fecha: ${visit_date} a las ${visit_time}\n- Total: $${total_cop?.toLocaleString('es-CO')} COP\n- Estado: ${status}`)
      }
    } catch {
      await addBotMsg('Ocurrió un error al consultar el pago. Intenta de nuevo más tarde.')
    }
    setStep('idle')
  }, [addBotMsg])

  const handleSend = () => {
    const text = input.trim()
    if (!text) return

    const userMsg: Message = { id: idRef.current++, text, isUser: true }
    setMessages((prev) => [...prev, userMsg])
    setInput('')

    const lower = text.toLowerCase()

    // Conversation flow
    if (step === 'awaiting_name') {
      setVerifyName(text)
      setStep('awaiting_date')
      setIsTyping(true)
      addBotMsg('¿Y la fecha de tu visita? (formato: YYYY-MM-DD)')
      return
    }

    if (step === 'awaiting_date') {
      setIsTyping(true)
      handlePaymentCheck(verifyName, text)
      return
    }

    // Check if asking about payment
    if (lower.includes('verificar') && (lower.includes('pago') || lower.includes('reserva'))) {
      setStep('awaiting_name')
      setIsTyping(true)
      addBotMsg('Claro. Dime tu nombre completo con el que hiciste la reserva.')
      return
    }

    if (lower.includes('confirmar') && (lower.includes('pago') || lower.includes('reserva'))) {
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
            <img src="/bat-logo.png" alt="" className="w-full h-full object-cover" />
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
            className="fixed bottom-24 left-4 sm:left-6 z-50 w-[calc(100vw-2rem)] sm:w-80 md:w-96 h-[500px] max-h-[70vh] rounded-2xl border border-white/10 bg-deep-950/95 backdrop-blur-xl shadow-2xl shadow-black/40 flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center gap-3 p-4 border-b border-white/5 bg-gradient-to-r from-gold-500/10 to-transparent">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gold-400 to-gold-600 flex items-center justify-center">
                <img src="/bat-logo.png" alt="" className="w-5 h-5 object-contain" />
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

            {/* Input */}
            <div className="p-4 border-t border-white/5">
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
                  onClick={handleSend}
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
