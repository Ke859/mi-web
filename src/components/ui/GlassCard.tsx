import type { ReactNode } from 'react'
import { motion } from 'framer-motion'

interface GlassCardProps {
  children: ReactNode
  className?: string
  delay?: number
  glow?: boolean
}

export function GlassCard({ children, className = '', delay = 0, glow = false }: GlassCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6, delay, ease: 'easeOut' }}
      className={`relative rounded-2xl border border-white/5 bg-gradient-to-b from-white/[0.06] to-white/[0.02] backdrop-blur-xl p-6 md:p-8 ${glow ? 'shadow-lg shadow-gold-500/5' : ''} ${className}`}
    >
      {children}
    </motion.div>
  )
}
