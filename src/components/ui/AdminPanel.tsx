import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Lock, LogOut, X, RefreshCw, Eye, Download, Users, CalendarDays, Clock, Wallet, Trash2, AlertTriangle, Check, ThumbsDown, ShieldCheck, Loader2, ScanSearch, ClipboardList } from 'lucide-react'

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
  deposit_cop?: number | null
  payment_status: string
  receipt_path: string
  created_at: string
}

const statusMap: Record<string, { label: string; color: string }> = {
  pending_payment: { label: 'Pendiente de pago', color: 'bg-sky-500/15 text-sky-300 border-sky-500/30' },
  pending_confirmation: { label: 'Pendiente', color: 'bg-amber-500/15 text-amber-300 border-amber-500/30' },
  approved: { label: 'Confirmado', color: 'bg-green-500/15 text-green-300 border-green-500/30' },
  confirmed: { label: 'Confirmado', color: 'bg-green-500/15 text-green-300 border-green-500/30' },
  rejected: { label: 'Rechazado', color: 'bg-red-500/15 text-red-300 border-red-500/30' },
  cancelled: { label: 'Cancelado', color: 'bg-red-500/15 text-red-300 border-red-500/30' },
  completed: { label: 'Completada', color: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' },
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
  const [verifying, setVerifying] = useState<string | null>(null)
  const [verifyResult, setVerifyResult] = useState<Record<string, { monto: string; coincide: boolean; esComprobante: boolean; detalle: string }>>({})
  const [describeResult, setDescribeResult] = useState<Record<string, { descripcion: string; loading: boolean }>>({})
  const [sendingSummary, setSendingSummary] = useState(false)

  const adminHeaders = () => ({ 'Content-Type': 'application/json', 'x-admin-password': sessionStorage.getItem('darkbat_admin') || '' })

  const loadBookings = useCallback(async () => {
    setLoading(true)
    setLoadError('')
    try {
      const resp = await fetch('/api/admin/bookings', { headers: adminHeaders() })
      if (resp.status === 401) {
        setIsAuthed(false)
        throw new Error('Sesión expirada')
      }
      const data = await resp.json()
      if (!resp.ok) throw new Error(data.error || 'Error')
      setBookings(data || [])
    } catch {
      setLoadError('No se pudieron cargar las reservas. Verifica la política RLS de lectura.')
    }
    setLoading(false)
  }, [])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoginError('')
    try {
      const resp = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await resp.json()
      if (!resp.ok) throw new Error(data.error || 'Error')
      sessionStorage.setItem('darkbat_admin', password)
      setIsAuthed(true)
      loadBookings()
    } catch {
      setLoginError('Credenciales incorrectas.')
    }
  }

  const handleLogout = () => {
    sessionStorage.removeItem('darkbat_admin')
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
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/comprobantes-db/${path}`)
      if (!resp.ok) throw new Error('download')
      const blob = await resp.blob()
      const url = URL.createObjectURL(blob)
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
      const resp = await fetch('/api/admin/delete', {
        method: 'POST',
        headers: adminHeaders(),
        body: JSON.stringify({ id: booking.id }),
      })
      const data = await resp.json()
      if (!resp.ok) throw new Error(data.error || 'Error')
      setBookings((prev) => prev.filter((b) => b.id !== booking.id))
      setConfirmDelete(null)
    } catch {
      setLoadError('No se pudo eliminar la reserva. Verifica la política RLS de borrado.')
    }
  }

  const setStatus = async (booking: Booking, status: string) => {
    setLoadError('')
    try {
      const resp = await fetch('/api/admin/status', {
        method: 'POST',
        headers: adminHeaders(),
        body: JSON.stringify({ id: booking.id, status }),
      })
      const data = await resp.json()
      if (!resp.ok) throw new Error(data.error || 'Error')
      setBookings((prev) => prev.map((b) => (b.id === booking.id ? { ...b, payment_status: status } : b)))
    } catch {
      setLoadError('No se pudo actualizar el estado. Verifica la política RLS de actualización.')
    }
  }

  const verifyReceipt = async (booking: Booking) => {
    setVerifying(booking.id)
    setLoadError('')
    try {
      const receiptUrl = `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/comprobantes-db/${booking.receipt_path}`
      const resp = await fetch('/api/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ receiptUrl, expectedAmount: booking.deposit_cop, visitDate: booking.visit_date }),
      })
      const data = await resp.json()
      if (!resp.ok) throw new Error(data.error || 'Error')
      setVerifyResult((prev) => ({ ...prev, [booking.id]: { monto: data.monto, coincide: data.coincide, esComprobante: data.es_comprobante, detalle: data.detalle } }))
    } catch {
      setVerifyResult((prev) => ({ ...prev, [booking.id]: { monto: '', coincide: false, esComprobante: false, detalle: 'No se pudo verificar. Intenta de nuevo.' } }))
    }
    setVerifying(null)
  }

  const describeReceipt = async (bookingId: string, receiptPath: string) => {
    setDescribeResult((prev) => ({ ...prev, [bookingId]: { descripcion: '', loading: true } }))
    setLoadError('')
    try {
      const imageUrl = `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/comprobantes-db/${receiptPath}`
      const resp = await fetch('/api/describe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl }),
      })
      const data = await resp.json()
      if (!resp.ok) throw new Error(data.error || 'Error')
      setDescribeResult((prev) => ({ ...prev, [bookingId]: { descripcion: data.descripcion, loading: false } }))
    } catch {
      setDescribeResult((prev) => ({ ...prev, [bookingId]: { descripcion: 'No se pudo analizar la imagen.', loading: false } }))
    }
  }

  const sendDailySummary = async () => {
    setSendingSummary(true)
    setLoadError('')
    try {
      const resp = await fetch('/api/daily-summary', { method: 'POST' })
      const data = await resp.json()
      if (!resp.ok) throw new Error(data.error || 'Error')
      setLoadError(`📨 Resumen de ${data.date} enviado a Telegram (${data.total} reservas).`)
    } catch {
      setLoadError('No se pudo enviar el resumen a Telegram.')
    }
    setSendingSummary(false)
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
                    <button onClick={sendDailySummary} disabled={sendingSummary} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-teal-500/10 border border-teal-500/30 text-xs text-teal-300 hover:bg-teal-500/20 transition-all disabled:opacity-50">
                      {sendingSummary ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ClipboardList className="w-3.5 h-3.5" />} Resumen del día a Telegram
                    </button>
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
                            {booking.payment_status !== 'confirmed' && booking.payment_status !== 'approved' && booking.payment_status !== 'rejected' && booking.payment_status !== 'cancelled' && (
                              <>
                                <button onClick={() => setStatus(booking, 'confirmed')} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-500/10 border border-green-500/30 text-xs text-green-300 hover:bg-green-500/20 transition-all">
                                  <Check className="w-3.5 h-3.5" /> Confirmar pago
                                </button>
                                <button onClick={() => setStatus(booking, 'rejected')} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/30 text-xs text-red-300 hover:bg-red-500/20 transition-all">
                                  <ThumbsDown className="w-3.5 h-3.5" /> Rechazar
                                </button>
                              </>
                            )}
                            {booking.receipt_path && (
                              <>
                                <button onClick={() => verifyReceipt(booking)} disabled={verifying === booking.id} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-500/10 border border-sky-500/30 text-xs text-sky-300 hover:bg-sky-500/20 transition-all">
                                  {verifying === booking.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />} Verificar con IA
                                </button>
{(booking.payment_status === 'confirmed' || booking.payment_status === 'approved') && (
                              <>
                                <button onClick={() => setStatus(booking, 'completed')} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-300 hover:bg-emerald-500/20 transition-all">
                                  <Check className="w-3.5 h-3.5" /> Completar visita
                                </button>
                                <button onClick={() => setStatus(booking, 'cancelled')} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/30 text-xs text-red-300 hover:bg-red-500/20 transition-all">
                                  <ThumbsDown className="w-3.5 h-3.5" /> Cancelar
                                </button>
                              </>
                            )}
                            {booking.receipt_path && (
                                  <button onClick={() => describeReceipt(booking.id, booking.receipt_path!)} disabled={describeResult[booking.id]?.loading} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-500/10 border border-purple-500/30 text-xs text-purple-300 hover:bg-purple-500/20 transition-all">
                                    {describeResult[booking.id]?.loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ScanSearch className="w-3.5 h-3.5" />} ¿Qué muestra la imagen?
                                  </button>
                                )}
                                <button onClick={() => toggleReceipt(booking.id)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-stone-300 hover:border-gold-500/40 hover:text-gold-300 transition-all">
                                  <Eye className="w-3.5 h-3.5" /> {showReceipts[booking.id] ? 'Ocultar comprobante' : 'Ver comprobante'}
                                </button>
                                <button onClick={() => downloadReceipt(booking.receipt_path, booking.name)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-stone-300 hover:border-gold-500/40 hover:text-gold-300 transition-all">
                                  <Download className="w-3.5 h-3.5" /> Descargar comprobante
                                </button>
                              </>
                            )}
                            {describeResult[booking.id]?.descripcion && (
                              <div className="w-full rounded-lg border border-purple-500/40 bg-purple-500/10 px-3 py-2 text-xs text-purple-200">
                                <p className="font-semibold mb-0.5">🖼️ Contenido de la imagen</p>
                                <p className="opacity-90">{describeResult[booking.id].descripcion}</p>
                              </div>
                            )}
                            {verifyResult[booking.id] && (
                              <div className={`w-full rounded-lg border px-3 py-2 text-xs ${
                                verifyResult[booking.id].coincide ? 'border-green-500/40 bg-green-500/10 text-green-300'
                                : !verifyResult[booking.id].esComprobante ? 'border-amber-500/40 bg-amber-500/10 text-amber-300'
                                : 'border-red-500/40 bg-red-500/10 text-red-300'
                              }`}>
                                <p className="font-semibold">{verifyResult[booking.id].coincide ? '✅ Monto coincide' : !verifyResult[booking.id].esComprobante ? '❌ No es un comprobante de pago' : '⚠️ No coincide'}</p>
                                {verifyResult[booking.id].esComprobante && <p className="mt-0.5">Pagado: {verifyResult[booking.id].monto ? `$${verifyResult[booking.id].monto} COP` : 'no leído'} · Esperado: ${booking.deposit_cop?.toLocaleString('es-CO') || '—'} COP</p>}
                                <p className="mt-0.5 opacity-80">{verifyResult[booking.id].detalle}</p>
                              </div>
                            )}
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
                                    src={`${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/comprobantes-db/${booking.receipt_path}`}
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
