import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, HelpCircle } from 'lucide-react'
import { SectionTitle } from '../ui/SectionTitle'
import { GlassCard } from '../ui/GlassCard'
import { faqData } from '../../data/content'

export function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  const toggle = (i: number) => setOpenIndex(openIndex === i ? null : i)

  return (
    <section id="faq" className="relative py-24 md:py-32">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionTitle
          subtitle="FAQ"
          title="Preguntas Frecuentes"
          description="Resolvemos tus dudas para que vivas la experiencia con total tranquilidad."
        />

        <div className="space-y-3">
          {faqData.map((item, i) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.05 }}
            >
              <button
                onClick={() => toggle(i)}
                className={`w-full text-left p-5 rounded-xl border transition-all duration-300 ${
                  openIndex === i
                    ? 'border-gold-500/30 bg-gold-500/5'
                    : 'border-white/5 bg-white/[0.02] hover:bg-white/[0.04]'
                }`}
                aria-expanded={openIndex === i}
                aria-controls={`faq-answer-${item.id}`}
              >
                <div className="flex items-center justify-between gap-4">
                  <span className="text-white font-medium text-sm md:text-base">{item.question}</span>
                  <ChevronDown
                    className={`w-4 h-4 text-gold-400 shrink-0 transition-transform duration-300 ${
                      openIndex === i ? 'rotate-180' : ''
                    }`}
                  />
                </div>
                <AnimatePresence>
                  {openIndex === i && (
                    <motion.div
                      id={`faq-answer-${item.id}`}
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease: 'easeInOut' }}
                      className="overflow-hidden"
                    >
                      <p className="pt-4 text-stone-400 text-sm leading-relaxed">{item.answer}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </button>
            </motion.div>
          ))}
        </div>

        {/* Still have questions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="mt-10 text-center"
        >
          <GlassCard>
            <HelpCircle className="w-8 h-8 text-gold-400 mx-auto mb-3" />
            <h3 className="text-white font-semibold mb-1">¿Tienes más preguntas?</h3>
            <p className="text-stone-500 text-sm mb-4">Escríbenos y te responderemos en breve.</p>
            <a
              href="#booking"
              onClick={(e) => { e.preventDefault(); document.querySelector('#booking')?.scrollIntoView({ behavior: 'smooth' }) }}
              className="text-gold-400 hover:text-gold-300 text-sm font-medium transition-colors"
            >
              Contáctanos →
            </a>
          </GlassCard>
        </motion.div>
      </div>
    </section>
  )
}
