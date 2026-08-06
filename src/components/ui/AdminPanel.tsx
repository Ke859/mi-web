import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Lock, LogOut, X, RefreshCw, Eye, Download, Users, CalendarDays, Clock, Wallet, Trash2, AlertTriangle } from 'lucide-react'
import { supabase } from '../../lib/supabase'

interface Booking {
  id: string
  name: string
  email: string
  whatsapp: string
  visit_date: string
  visit_time: string
  people: number
  lunch: string
  comments: string | null
  total_cop: number
  payment_status: string
  receipt_path: string
  created_at: string
}

const ADMIN_EMAIL = 'kevin001lbh@gmail.com'
const ADMIN_PASSWORD = 'kevin001456'
const statusMap: Record<string, { label: string; color: string }> = {
  pending_confirmation: { label: 'Pendiente', color: 'bg-amber-500/15 text-amber-300 border-amber-500/30' },
  approved: { label: 'Confirmado', color: 'bg-green-500/15 text-green-300 border-green-500/30' },
  confirmed: { label: 'Confirmado', color: 'bg-green-500/15 text-green-300 border-green-500/30' },
  rejected: { label: 'Rechazado', color: 'bg-red-500/15 text-red-300 border-red-500/30' },
  cancelled: { label: 'Cancelado', color: 'bg-red-500/15 text-red-300 border-red-500/30' },
}

export function AdminPanel({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [isAuthed, setIsAuthed] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loginError, setLoginError] = useState('')
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [showReceipts, setShowReceipts] = useState<Record<string, boolean>>({})
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  const loadBookings = useCallback(async () => {
    setLoading(true)
    setLoadError('')
    try {
      const { data, error } = await supabase
        .from('bookings')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200)
      if (error) throw error
      setBookings(data || [])
    } catch {
      setLoadError('No se pudieron cargar las reservas. Verifica la política RLS de lectura.')
    }
    setLoading(false)
  }, [])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoginError('')
    if (email.trim().toLowerCase() === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
      setIsAuthed(true)
      loadBookings()
    } else {
      setLoginError('Credenciales incorrectas.')
    }
  }

  const handleLogout = () => {
    setIsAuthed(false)
    setBookings([])
    setEmail('')
    setPassword('')
    onClose()
  }

  const toggleReceipt = (id: string) => {
    setShowReceipts((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  const downloadReceipt = async (path: string, name: string) => {
    try {
      const { data, error } = await supabase.storage.from('payment-receipts').download(path)
      if (error) throw error
      const url = URL.createObjectURL(data)
      const a = document.createElement('a')
      a.href = url
      a.download = `${name.replace(/\s+/g, '_')}_comprobante.jpg`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      setLoadError('No se pudo descargar el comprobante.')
    }
  }

  const deleteBooking = async (booking: Booking) => {
    setLoadError('')
    try {
      if (booking.receipt_path) {
        await supabase.storage.from('payment-receipts').remove([booking.receipt_path])
      }
      const { error } = await supabase.from('bookings').delete().eq('id', booking.id)
      if (error) throw error
      setBookings((prev) => prev.filter((b) => b.id !== booking.id))
      setConfirmDelete(null)
    } catch {
      setLoadError('No se pudo eliminar la reserva. Verifica la política RLS de borrado.')
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] bg-deep-950/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-5xl max-h-[85vh] rounded-2xl border border-gold-500/20 bg-deep-900 shadow-2xl shadow-black/50 overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-gradient-to-r from-gold-500/10 to-transparent">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-gold-400 to-gold-600 flex items-center justify-center">
                  <img src="/bat-logo.png" alt="" className="w-6 h-6 object-contain" />
                </div>
                <div>
                  <h2 className="font-display font-bold text-white">Panel DARKBAT</h2>
                  <p className="text-xs text-stone-500">Gestión de reservas</p>
                </div>
              </div>
              <button onClick={onClose} className="p-2 rounded-lg text-stone-400 hover:text-white hover:bg-white/10 transition-all" aria-label="Cerrar">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            {!isAuthed ? (
              <form onSubmit={handleLogin} className="p-8 sm:p-12 flex flex-col items-center">
                <div className="w-16 h-16 rounded-2xl bg-gold-500/10 border border-gold-500/30 flex items-center justify-center mb-6">
                  <Lock className="w-8 h-8 text-gold-300" />
                </div>
                <h3 className="font-display text-2xl font-bold text-white mb-1">Acceso restringido</h3>
                <p className="text-sm text-stone-500 mb-8">Ingresa tus credenciales de administrador</p>
                <div className="w-full max-w-sm space-y-4">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Correo del administrador"
                    className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white text-sm placeholder:text-stone-600 focus:outline-none focus:ring-2 focus:ring-gold-500/40 transition-all"
                  />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Contraseña"
                    className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white text-sm placeholder:text-stone-600 focus:outline-none focus:ring-2 focus:ring-gold-500/40 transition-all"
                  />
                  {loginError && <p className="text-xs text-red-400">{loginError}</p>}
                  <button type="submit" className="w-full py-3 rounded-lg bg-gold-500 text-deep-950 font-semibold text-sm hover:bg-gold-400 transition-all">
                    Ingresar
                  </button>
                </div>
              </form>
            ) : (
              <div className="flex-1 overflow-y-auto p-6">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
                  <div className="flex items-center gap-2 text-sm text-stone-400">
                    <Users className="w-4 h-4 text-gold-300" />
                    <span className="text-white font-semibold">{bookings.length}</span> reservas
                  </div>
                  <div className="flex gap-2">
                    <button onClick={loadBookings} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-xs text-stone-300 hover:border-gold-500/40 hover:text-gold-300 transition-all">
                      <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Actualizar
                    </button>
                    <button onClick={handleLogout} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-xs text-red-300 hover:bg-red-500/20 transition-all">
                      <LogOut className="w-3.5 h-3.5" /> Salir
                    </button>
                  </div>
                </div>

                {loadError && <p className="mb-4 text-xs text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-lg px-4 py-3">{loadError}</p>}

                {loading ? (
                  <p className="text-center text-sm text-stone-500 py-12">Cargando reservas...</p>
                ) : bookings.length === 0 ? (
                  <p className="text-center text-sm text-stone-500 py-12">Aún no hay reservas.</p>
                ) : (
                  <div className="space-y-3">
                    {bookings.map((booking) => {
                      const status = statusMap[booking.payment_status] || { label: booking.payment_status, color: 'bg-white/5 text-stone-300 border-white/10' }
                      return (
                        <div key={booking.id} className="rounded-xl border border-white/10 bg-white/[.03] p-4">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <p className="text-white font-semibold">{booking.name} <span className="ml-1 text-xs text-stone-500">{booking.email}</span></p>
                              <p className="text-xs text-stone-400 mt-1 flex items-center gap-1.5"><CalendarDays className="w-3.5 h-3.5" />{booking.visit_date} · <Clock className="w-3.5 h-3.5" />{booking.visit_time} · <Users className="w-3.5 h-3.5" />{booking.people} pers · 🍽️ {booking.lunch === 'yes' ? 'Almuerzo' : 'Sin almuerzo'}</p>
                              <p className="text-xs text-stone-500 mt-1">WhatsApp: {booking.whatsapp} {booking.comments ? `· Comentarios: ${booking.comments}` : ''}</p>
                            </div>
                            <div className="flex flex-col items-end gap-2">
                              <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border ${status.color}`}>{status.label}</span>
                              <span className="flex items-center gap-1 text-sm font-semibold text-gold-300"><Wallet className="w-3.5 h-3.5" />${booking.total_cop.toLocaleString('es-CO')} COP</span>
                            </div>
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <button onClick={() => toggleReceipt(booking.id)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-stone-300 hover:border-gold-500/40 hover:text-gold-300 transition-all">
                              <Eye className="w-3.5 h-3.5" /> {showReceipts[booking.id] ? 'Ocultar comprobante' : 'Ver comprobante'}
                            </button>
                            <button onClick={() => downloadReceipt(booking.receipt_path, booking.name)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-stone-300 hover:border-gold-500/40 hover:text-gold-300 transition-all">
                              <Download className="w-3.5 h-3.5" /> Descargar comprobante
                            </button>
                            {confirmDelete === booking.id ? (
                              <span className="inline-flex items-center gap-2 ml-auto">
                                <button onClick={() => deleteBooking(booking)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/20 border border-red-500/50 text-xs text-red-300 hover:bg-red-500/30 transition-all">
                                  <AlertTriangle className="w-3.5 h-3.5" /> ¿Eliminar?
                                </button>
                                <button onClick={() => setConfirmDelete(null)} className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-stone-400 hover:text-white transition-all">
                                  Cancelar
                                </button>
                              </span>
                            ) : (
                              <button onClick={() => setConfirmDelete(booking.id)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/30 text-xs text-red-300 hover:bg-red-500/20 ml-auto transition-all">
                                <Trash2 className="w-3.5 h-3.5" /> Eliminar
                              </button>
                            )}
                          </div>
                          <AnimatePresence>
                            {showReceipts[booking.id] && (
                              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                                <div className="mt-3 flex justify-center rounded-lg bg-deep-950/60 border border-white/10 p-4">
                                  <img
                                    src={`https://okhianmifspbwuauxyfe.supabase.co/storage/v1/object/public/payment-receipts/${booking.receipt_path}`}
                                    alt="Comprobante"
                                    className="max-h-64 rounded-lg object-contain"
                                  />
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
