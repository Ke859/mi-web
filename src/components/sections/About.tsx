import { motion } from 'framer-motion'
import { SectionTitle } from '../ui/SectionTitle'
import { Sparkles, Mountain, Eye } from 'lucide-react'

const highlights = [
  {
    icon: Mountain,
    title: 'Formaciones Milenarias',
    desc: 'Estalactitas y estalagmitas que han tardado miles de años en formarse creando un paisaje subterráneo único.',
  },
  {
    icon: Sparkles,
    title: 'Iluminación Escénica',
    desc: 'Un sistema de iluminación cuidadosamente diseñado resalta la belleza natural de cada rincón de la cueva.',
  },
  {
    icon: Eye,
    title: 'Avistamiento de Murciélagos',
    desc: 'Observa colonias de murciélagos en su hábitat natural, una experiencia educativa y fascinante para toda la familia.',
  },
]

export function About() {
  return (
    <section id="about" className="relative py-24 md:py-32">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionTitle
          subtitle="Sobre DARKBAT"
          title="La Aventura Subterránea Definitiva"
          description="DARKBAT te invita a explorar las profundidades de una cueva natural donde la naturaleza ha esculpido su obra maestra durante milenios. Cada paso es un descubrimiento."
        />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center mt-8">
          {/* Image */}
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, ease: 'easeOut' }}
            className="relative"
          >
            <div className="aspect-[4/5] rounded-2xl overflow-hidden">
              <img
                src="https://images.unsplash.com/photo-1582642010675-8f3c0b5fe6e0?w=800&q=80"
                alt="Guía iluminando formaciones rocosas en la cueva"
                className="w-full h-full object-cover"
                loading="lazy"
              />
            </div>
            {/* Decorative gradient */}
            <div className="absolute -inset-2 rounded-2xl bg-gradient-to-r from-gold-500/10 to-transparent -z-10" />
          </motion.div>

          {/* Content */}
          <motion.div
            initial={{ opacity: 0, x: 50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, ease: 'easeOut', delay: 0.2 }}
            className="space-y-8"
          >
            <p className="text-stone-400 text-lg leading-relaxed">
              Ubicada en el corazón de la península de Yucatán, DARKBAT ofrece una experiencia única que combina
              aventura, educación y respeto por la naturaleza. Nuestros guías expertos te acompañarán en un
              recorrido seguro e inolvidable.
            </p>
            <p className="text-stone-500 leading-relaxed">
              Desde imponentes salas subterráneas hasta estrechos pasadizos adornados con cristales de calcita,
              cada visita es diferente. La cueva alberga una de las colonias de murciélagos más importantes de la
              región, permitiendo una observación responsable y fascinante.
            </p>

            <div className="grid gap-6 pt-4">
              {highlights.map((item, i) => (
                <motion.div
                  key={item.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: 0.3 + i * 0.1 }}
                  className="flex gap-4"
                >
                  <div className="w-10 h-10 rounded-lg bg-gold-500/10 border border-gold-500/20 flex items-center justify-center shrink-0">
                    <item.icon className="w-5 h-5 text-gold-400" />
                  </div>
                  <div>
                    <h3 className="text-white font-semibold text-sm mb-1">{item.title}</h3>
                    <p className="text-stone-500 text-sm leading-relaxed">{item.desc}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
