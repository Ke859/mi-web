import { motion } from 'framer-motion'
import { SectionTitle } from '../ui/SectionTitle'
import { contactInfo } from '../../data/content'

export function Location() {
  return (
    <section id="location" className="relative py-24 md:py-32">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionTitle
          subtitle="Ubicación"
          title="Encuéntranos"
          description="Santa Sofía, Colombia."
        />

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="text-center"
        >
          <a
            href={contactInfo.mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-gradient-to-r from-gold-500 to-gold-400 text-deep-950 font-semibold hover:from-gold-400 hover:to-gold-300 transition-all duration-300 shadow-lg shadow-gold-500/20"
          >
            Abrir en Google Maps →
          </a>
        </motion.div>
      </div>
    </section>
  )
}
