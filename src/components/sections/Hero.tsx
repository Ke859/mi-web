import { motion } from 'framer-motion'
import { ArrowDown, Play } from 'lucide-react'
import { Button } from '../ui/Button'
import { Parallax } from '../effects/Parallax'

export function Hero() {
  const scrollTo = (id: string) => {
    document.querySelector(id)?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <section id="hero" className="relative min-h-svh flex items-center justify-center overflow-hidden">
      {/* Background Video */}
      <Parallax speed={120} className="absolute inset-0">
        <video
          autoPlay
          muted
          loop
          playsInline
          poster="/hero-bg.png"
          className="w-full h-[120%] object-cover"
        >
          <source src="/hero-video.mp4" type="video/mp4" />
        </video>
      </Parallax>
      <div className="absolute inset-0 bg-gradient-to-b from-deep-950/80 via-deep-950/60 to-deep-950" />
      <div className="absolute inset-0 bg-gradient-to-r from-deep-950/40 to-transparent" />

      {/* Overlay gradient vignette */}
      <div className="absolute inset-0 bg-gradient-to-t from-deep-950 via-transparent to-deep-950/30" />

      <div className="relative z-10 max-w-5xl mx-auto px-4 text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-gold-500/20 bg-gold-500/5 backdrop-blur-sm mb-6">
            <span className="w-2 h-2 rounded-full bg-gold-400 animate-pulse" />
            <span className="text-xs uppercase tracking-[0.25em] text-gold-300 font-medium">Experiencia única</span>
          </div>
        </motion.div>



        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2, ease: 'easeOut' }}
          className="font-display text-[2.75rem] xs:text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bold text-white leading-[0.95] tracking-tight"
        >
          <span className="text-shadow-glow">DARK</span>
          <span className="text-gradient-gold">BAT</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4, ease: 'easeOut' }}
          className="mt-6 text-stone-400 text-sm xs:text-base md:text-xl max-w-2xl mx-auto leading-relaxed"
        >
          Explora una de las cuevas más fascinantes del mundo. Descubre formaciones milenarias y maravíllate con los murciélagos en su hábitat natural.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.6, ease: 'easeOut' }}
          className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          <Button size="lg" onClick={() => scrollTo('#booking')}>
            Reservar ahora
            <ArrowDown className="w-4 h-4" />
          </Button>
          <Button variant="secondary" size="lg" onClick={() => scrollTo('#booking')}>
            <Play className="w-4 h-4" />
            Ver disponibilidad
          </Button>
        </motion.div>

        {/* Scroll indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5, duration: 1 }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2"
        >
          <motion.button
            onClick={() => scrollTo('#gallery')}
            animate={{ y: [0, 8, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            className="text-stone-500 hover:text-stone-300 transition-colors"
            aria-label="Scroll down"
          >
            <ArrowDown className="w-5 h-5" />
          </motion.button>
        </motion.div>
      </div>
    </section>
  )
}
