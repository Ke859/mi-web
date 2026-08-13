import { useState, useRef } from 'react'
import { motion, useInView } from 'framer-motion'
import { SectionTitle } from '../ui/SectionTitle'
import { Lightbox } from '../ui/Lightbox'
import { Parallax } from '../effects/Parallax'
import { galleryImages } from '../../data/content'

function GalleryImage({
  img,
  index,
  onClick,
}: {
  img: (typeof galleryImages)[number]
  index: number
  onClick: () => void
}) {
  const ref = useRef<HTMLButtonElement>(null)
  const isInView = useInView(ref, { once: false, margin: '-50px' })

  return (
    <motion.button
      ref={ref}
      onClick={onClick}
      animate={{
        opacity: isInView ? 1 : 0,
        y: isInView ? 0 : 20,
        filter: isInView ? 'blur(0px)' : 'blur(6px)',
        scale: isInView ? 1 : 0.95,
      }}
      transition={{
        duration: 0.8,
        delay: isInView ? index * 0.1 : 0,
        ease: 'easeOut',
      }}
      whileHover={{ scale: 1.02 }}
      className="group relative aspect-[4/5] overflow-hidden rounded-xl border border-white/5"
      aria-label={`Ver ${img.alt}`}
    >
      <img
        src={img.src}
        alt={img.alt}
        loading="lazy"
        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      <div className="absolute bottom-0 left-0 right-0 p-4 translate-y-full group-hover:translate-y-0 transition-transform duration-300">
        <span className="text-white text-sm font-medium">{img.alt}</span>
      </div>
    </motion.button>
  )
}

export function Gallery() {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)

  const open = (i: number) => setLightboxIndex(i)
  const close = () => setLightboxIndex(null)
  const prev = () =>
    setLightboxIndex((i) =>
      i !== null ? (i - 1 + galleryImages.length) % galleryImages.length : null
    )
  const next = () =>
    setLightboxIndex((i) =>
      i !== null ? (i + 1) % galleryImages.length : null
    )

  const sectionRef = useRef<HTMLElement>(null)
  const sectionInView = useInView(sectionRef, { once: false, margin: '-100px' })

  return (
    <motion.section
      ref={sectionRef}
      id="gallery"
      animate={{
        opacity: sectionInView ? 1 : 0,
        filter: sectionInView ? 'blur(0px)' : 'blur(4px)',
      }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
      className="relative py-24 md:py-32 bg-deep-900/50"
    >
      <Parallax speed={40} direction="x" className="absolute -left-16 top-32 w-64 h-64 rounded-full bg-gold-500/5 blur-3xl pointer-events-none" />
      <Parallax speed={-50} direction="x" className="absolute -right-20 bottom-40 w-80 h-80 rounded-full bg-deep-700/30 blur-3xl pointer-events-none" />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          animate={{ opacity: sectionInView ? 1 : 0, y: sectionInView ? 0 : 20 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        >
          <SectionTitle
            subtitle="Galería"
            title="Explora la Cueva"
            description="Imágenes que capturan la majestuosidad de este mundo subterráneo."
          />
        </motion.div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          {galleryImages.map((img, i) => (
            <GalleryImage
              key={img.id}
              img={img}
              index={i}
              onClick={() => open(i)}
            />
          ))}
        </div>
      </div>

      {lightboxIndex !== null && (
        <Lightbox
          images={galleryImages}
          currentIndex={lightboxIndex}
          onClose={close}
          onPrev={prev}
          onNext={next}
        />
      )}
    </motion.section>
  )
}
