import { motion } from 'framer-motion'
import { Mail, Phone, MapPin, ChevronUp } from 'lucide-react'
import { navLinks, contactInfo } from '../../data/content'

export function Footer() {
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <footer id="footer" className="relative border-t border-white/5 bg-deep-950">
      {/* Scroll to top */}
      <motion.button
        onClick={scrollToTop}
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="absolute -top-5 left-1/2 -translate-x-1/2 w-10 h-10 rounded-full bg-gold-500 text-deep-950 flex items-center justify-center hover:bg-gold-400 transition-colors shadow-lg shadow-gold-500/20"
        aria-label="Volver arriba"
      >
        <ChevronUp className="w-5 h-5" />
      </motion.button>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-20">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">
          {/* Brand */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <div className="mb-4">
              <span className="font-display text-lg font-bold text-white tracking-wider">DARKBAT</span>
            </div>
            <p className="text-stone-500 text-sm leading-relaxed">
              Explora las profundidades de la tierra y descubre un mundo subterráneo lleno de misterio y maravillas naturales.
            </p>
            <div className="flex items-center gap-3 mt-5">
              <a
                href="https://www.facebook.com/share/19G2aLuLmR/"
                target="_blank"
                rel="noopener noreferrer"
                className="w-9 h-9 rounded-full bg-white/5 border border-white/10 flex items-center justify-center hover:bg-gold-500/10 hover:border-gold-500/30 transition-all group"
                aria-label="Facebook"
              >
                <svg viewBox="0 0 24 24" className="w-4 h-4 fill-stone-400 group-hover:fill-gold-400 transition-colors">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                </svg>
              </a>
              <a
                href="https://www.instagram.com/dark.bat00?igsh=eHQxb29rcmZtNXBr"
                target="_blank"
                rel="noopener noreferrer"
                className="w-9 h-9 rounded-full bg-white/5 border border-white/10 flex items-center justify-center hover:bg-gold-500/10 hover:border-gold-500/30 transition-all group"
                aria-label="Instagram"
              >
                <svg viewBox="0 0 24 24" className="w-4 h-4 fill-stone-400 group-hover:fill-gold-400 transition-colors">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/>
                </svg>
              </a>
              <a
                href="https://tiktok.com/@darkbat605"
                target="_blank"
                rel="noopener noreferrer"
                className="w-9 h-9 rounded-full bg-white/5 border border-white/10 flex items-center justify-center hover:bg-gold-500/10 hover:border-gold-500/30 transition-all group"
                aria-label="TikTok"
              >
                <svg viewBox="0 0 24 24" className="w-4 h-4 fill-stone-400 group-hover:fill-gold-400 transition-colors">
                  <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/>
                </svg>
              </a>
            </div>
          </motion.div>

          {/* Links */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <h3 className="font-display text-white text-sm font-semibold tracking-wider mb-4">ENLACES</h3>
            <ul className="space-y-3">
              {navLinks.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    onClick={(e) => {
                      e.preventDefault()
                      document.querySelector(link.href)?.scrollIntoView({ behavior: 'smooth' })
                    }}
                    className="text-stone-500 hover:text-gold-300 text-sm transition-colors duration-300"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </motion.div>

          {/* Contact */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <h3 className="font-display text-white text-sm font-semibold tracking-wider mb-4">CONTACTO</h3>
            <ul className="space-y-4">
              <li>
                <a href={`mailto:${contactInfo.email}`} className="flex items-center gap-3 text-stone-500 hover:text-gold-300 text-sm transition-colors">
                  <Mail className="w-4 h-4 text-gold-500 shrink-0" />
                  {contactInfo.email}
                </a>
              </li>
              <li>
                <a href={`tel:${contactInfo.phone}`} className="flex items-center gap-3 text-stone-500 hover:text-gold-300 text-sm transition-colors">
                  <Phone className="w-4 h-4 text-gold-500 shrink-0" />
                  {contactInfo.phone}
                </a>
              </li>
              <li className="flex items-start gap-3 text-stone-500 text-sm">
                <MapPin className="w-4 h-4 text-gold-500 shrink-0 mt-0.5" />
                <span>{contactInfo.address}</span>
              </li>
            </ul>
          </motion.div>

          {/* Hours */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            <h3 className="font-display text-white text-sm font-semibold tracking-wider mb-4">HORARIOS</h3>
            <div className="space-y-2 text-sm text-stone-500">
              <p className="flex justify-between"><span>Lun - Dom</span><span className="text-stone-400">8:00 - 17:00</span></p>
            </div>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="mt-12 pt-8 border-t border-white/5 text-center"
        >
          <p className="text-stone-600 text-xs">
            &copy; {new Date().getFullYear()} DARKBAT. Todos los derechos reservados. Diseñado con pasión por la naturaleza.
          </p>
        </motion.div>
      </div>
    </footer>
  )
}
