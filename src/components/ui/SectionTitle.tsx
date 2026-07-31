import { motion } from 'framer-motion'

interface SectionTitleProps {
  subtitle?: string
  title: string
  description?: string
  align?: 'center' | 'left'
  light?: boolean
}

export function SectionTitle({ subtitle, title, description, align = 'center', light = false }: SectionTitleProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6 }}
      className={`max-w-3xl mb-12 md:mb-16 ${align === 'center' ? 'mx-auto text-center' : ''}`}
    >
      {subtitle && (
        <span className="inline-block text-xs uppercase tracking-[0.3em] text-gold-400 font-medium mb-3">
          {subtitle}
        </span>
      )}
      <h2 className={`font-display text-3xl md:text-4xl lg:text-5xl font-bold leading-tight ${light ? 'text-white' : 'text-stone-300'}`}>
        {title}
      </h2>
      {description && (
        <p className="mt-4 text-stone-500 text-base md:text-lg leading-relaxed max-w-2xl mx-auto">
          {description}
        </p>
      )}
    </motion.div>
  )
}
