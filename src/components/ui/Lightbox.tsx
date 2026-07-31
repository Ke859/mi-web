import { useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, ChevronLeft, ChevronRight } from 'lucide-react'
import type { GalleryImage } from '../../types'

interface LightboxProps {
  images: GalleryImage[]
  currentIndex: number
  onClose: () => void
  onPrev: () => void
  onNext: () => void
}

export function Lightbox({ images, currentIndex, onClose, onPrev, onNext }: LightboxProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft') onPrev()
      if (e.key === 'ArrowRight') onNext()
    },
    [onClose, onPrev, onNext]
  )

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    }
  }, [handleKeyDown])

  const image = images[currentIndex]

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-sm"
        onClick={onClose}
        role="dialog"
        aria-modal="true"
        aria-label={`Imagen ${currentIndex + 1} de ${images.length}`}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
          aria-label="Cerrar"
        >
          <X className="w-6 h-6 text-white" />
        </button>

        <button
          onClick={(e) => { e.stopPropagation(); onPrev() }}
          className="absolute left-4 z-10 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
          aria-label="Anterior"
        >
          <ChevronLeft className="w-6 h-6 text-white" />
        </button>

        <motion.img
          key={image.id}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          transition={{ duration: 0.3 }}
          src={image.src}
          alt={image.alt}
          className="max-w-[90vw] max-h-[85vh] object-contain rounded-lg"
          onClick={(e) => e.stopPropagation()}
        />

        <button
          onClick={(e) => { e.stopPropagation(); onNext() }}
          className="absolute right-4 z-10 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
          aria-label="Siguiente"
        >
          <ChevronRight className="w-6 h-6 text-white" />
        </button>

        <div className="absolute bottom-4 text-white/60 text-sm">
          {currentIndex + 1} / {images.length}
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
