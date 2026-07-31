import { motion } from 'framer-motion'

export function LightEffect() {
  return (
    <div className="fixed inset-0 pointer-events-none z-[1]" aria-hidden="true">
      {/* Top-left light ray */}
      <motion.div
        className="absolute -top-40 -left-40 w-96 h-96 rounded-full"
        style={{
          background: 'radial-gradient(circle, rgba(201,168,76,0.06) 0%, transparent 70%)',
        }}
        animate={{
          opacity: [0.3, 0.6, 0.3],
          scale: [1, 1.1, 1],
        }}
        transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* Bottom-right light ray */}
      <motion.div
        className="absolute -bottom-40 -right-40 w-[500px] h-[500px] rounded-full"
        style={{
          background: 'radial-gradient(circle, rgba(201,168,76,0.04) 0%, transparent 70%)',
        }}
        animate={{
          opacity: [0.2, 0.5, 0.2],
          scale: [1, 1.15, 1],
        }}
        transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
      />

      {/* Center soft glow */}
      <motion.div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full"
        style={{
          background: 'radial-gradient(circle, rgba(255,255,255,0.015) 0%, transparent 60%)',
        }}
        animate={{
          opacity: [0.3, 0.5, 0.3],
        }}
        transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}
      />
    </div>
  )
}
