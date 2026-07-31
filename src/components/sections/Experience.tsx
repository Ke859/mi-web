import { motion } from 'framer-motion'
import { Clock, Map, Users, Shirt, Signal, Backpack } from 'lucide-react'
import { SectionTitle } from '../ui/SectionTitle'
import { GlassCard } from '../ui/GlassCard'
import { experienceDetails } from '../../data/content'

const iconMap: Record<string, React.ComponentType<any>> = { Clock, Map, Users, Shirt, Signal, Backpack }

export function Experience() {
  return (
    <section id="experience" className="relative py-24 md:py-32">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionTitle
          subtitle="El Recorrido"
          title="Todo lo que Necesitas Saber"
          description="Cada detalle está pensado para que disfrutes al máximo de esta experiencia única."
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {experienceDetails.map((item, i) => {
            const Icon = iconMap[item.icon]
            return (
              <GlassCard key={item.title} delay={i * 0.1} glow>
                <div className="w-12 h-12 rounded-xl bg-gold-500/10 border border-gold-500/20 flex items-center justify-center mb-5">
                  {Icon && <Icon className="w-6 h-6 text-gold-400" />}
                </div>
                <h3 className="text-white font-display text-lg font-semibold mb-2">{item.title}</h3>
                <p className="text-stone-500 text-sm leading-relaxed">{item.desc}</p>
              </GlassCard>
            )
          })}
        </div>

        {/* CTA Banner */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="mt-12 p-8 md:p-10 rounded-2xl border border-gold-500/20 bg-gradient-to-r from-gold-500/5 to-transparent text-center"
        >
          <div className="mb-6">
            <span className="text-4xl md:text-5xl font-display font-bold text-gradient-gold">$15.000 COP</span>
            <p className="text-stone-400 text-sm mt-1">por persona</p>
          </div>


          <h3 className="font-display text-2xl md:text-3xl text-white font-bold mb-3">
            ¿Listo para la aventura?
          </h3>
          <p className="text-stone-400 mb-6 max-w-xl mx-auto">
            Reserva tu lugar y prepárate para explorar el mundo subterráneo.
          </p>
          <a
            href="#booking"
            onClick={(e) => { e.preventDefault(); document.querySelector('#booking')?.scrollIntoView({ behavior: 'smooth' }) }}
            className="inline-flex items-center gap-2 px-8 py-4 rounded-lg bg-gradient-to-r from-gold-500 to-gold-400 text-deep-950 font-semibold hover:from-gold-400 hover:to-gold-300 transition-all duration-300 shadow-lg shadow-gold-500/20"
          >
            Reservar ahora
          </a>
        </motion.div>
      </div>
    </section>
  )
}
