import { useState } from 'react'
import { motion } from 'framer-motion'
import { ImagePlus, Star } from 'lucide-react'
import { SectionTitle } from '../ui/SectionTitle'
import type { Testimonial } from '../../types'

const storageKey = 'darkbat-testimonials'

function getTestimonials(): Testimonial[] {
  try {
    const saved = localStorage.getItem(storageKey)
    return saved ? JSON.parse(saved) : []
  } catch {
    return []
  }
}

export function Testimonials() {
  const [testimonials, setTestimonials] = useState<Testimonial[]>(getTestimonials)
  const [name, setName] = useState('')
  const [text, setText] = useState('')
  const [rating, setRating] = useState(0)
  const [photo, setPhoto] = useState('')
  const [message, setMessage] = useState('')

  const handlePhoto = (file: File | undefined) => {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setMessage('Selecciona una imagen válida.')
      return
    }

    const reader = new FileReader()
    reader.onload = () => setPhoto(String(reader.result))
    reader.readAsDataURL(file)
  }

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!rating) {
      setMessage('Selecciona una calificación de 1 a 5 estrellas.')
      return
    }

    const testimonial = { id: Date.now(), name: name.trim(), text: text.trim(), rating, photo }
    const updated = [testimonial, ...testimonials]

    try {
      localStorage.setItem(storageKey, JSON.stringify(updated))
      setTestimonials(updated)
      setName('')
      setText('')
      setRating(0)
      setPhoto('')
      setMessage('Gracias por compartir tu experiencia.')
    } catch {
      setMessage('No fue posible guardar tu reseña. Prueba con una foto más pequeña.')
    }
  }

  return (
    <section id="testimonials" className="relative py-24 md:py-32 bg-deep-900/50 overflow-hidden">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionTitle
          subtitle="Reseñas"
          title="Comparte Tu Experiencia"
          description="Cuéntanos cómo fue tu visita y califica la experiencia."
        />

        <form onSubmit={submit} className="rounded-2xl border border-white/10 bg-deep-950/60 p-6 md:p-8">
          <div className="grid gap-5 md:grid-cols-2">
            <label className="text-sm text-stone-300">
              Tu nombre
              <input value={name} onChange={(event) => setName(event.target.value)} required maxLength={80} className="mt-2 w-full rounded-lg border border-white/10 bg-deep-900 px-4 py-3 text-white outline-none focus:border-gold-400" />
            </label>
            <div>
              <p className="text-sm text-stone-300">Tu calificación</p>
              <div className="mt-2 flex gap-1" role="radiogroup" aria-label="Calificación">
                {[1, 2, 3, 4, 5].map((value) => (
                  <button key={value} type="button" onClick={() => setRating(value)} className="p-1" role="radio" aria-checked={rating === value} aria-label={`${value} estrella${value > 1 ? 's' : ''}`}>
                    <Star className={`h-7 w-7 transition-colors ${value <= rating ? 'fill-gold-400 text-gold-400' : 'text-stone-600 hover:text-gold-300'}`} />
                  </button>
                ))}
              </div>
            </div>
          </div>
          <label className="mt-5 block text-sm text-stone-300">
            Tu reseña
            <textarea value={text} onChange={(event) => setText(event.target.value)} required maxLength={600} rows={4} className="mt-2 w-full resize-y rounded-lg border border-white/10 bg-deep-900 px-4 py-3 text-white outline-none focus:border-gold-400" />
          </label>
          <div className="mt-5 flex flex-wrap items-center gap-4">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-white/10 px-4 py-3 text-sm text-stone-300 transition-colors hover:border-gold-500/50 hover:text-gold-300">
              <ImagePlus className="h-5 w-5" />
              {photo ? 'Cambiar foto' : 'Añadir foto'}
              <input type="file" accept="image/*" onChange={(event) => handlePhoto(event.target.files?.[0])} className="sr-only" />
            </label>
            {photo && <img src={photo} alt="Vista previa" className="h-14 w-14 rounded-lg object-cover" />}
            <button type="submit" className="ml-auto rounded-lg bg-gradient-to-r from-gold-500 to-gold-400 px-6 py-3 font-semibold text-deep-950 transition-all hover:from-gold-400 hover:to-gold-300">Publicar reseña</button>
          </div>
          {message && <p className="mt-4 text-sm text-gold-300" role="status">{message}</p>}
        </form>

        {testimonials.length > 0 ? (
          <div className="mt-10 grid gap-5 md:grid-cols-2">
            {testimonials.map((testimonial) => (
              <motion.article key={testimonial.id} initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="rounded-xl border border-white/10 bg-deep-950/40 p-6">
                <div className="flex items-center gap-4">
                  {testimonial.photo && <img src={testimonial.photo} alt={`Foto de ${testimonial.name}`} className="h-12 w-12 rounded-full object-cover" />}
                  <div><p className="font-semibold text-white">{testimonial.name}</p><div className="flex gap-1">{Array.from({ length: testimonial.rating }, (_, index) => <Star key={index} className="h-4 w-4 fill-gold-400 text-gold-400" />)}</div></div>
                </div>
                <p className="mt-4 leading-relaxed text-stone-400">{testimonial.text}</p>
              </motion.article>
            ))}
          </div>
        ) : <p className="mt-10 text-center text-stone-500">Aún no hay reseñas. Sé la primera persona en compartir la tuya.</p>}
      </div>
    </section>
  )
}
