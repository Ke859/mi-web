import type { GalleryImage } from '../types'

export const navLinks = [
  { label: 'Inicio', href: '#hero' },
  { label: 'Galería', href: '#gallery' },
  { label: 'Reservar', href: '#booking' },
  { label: 'Contacto', href: '#footer' },
]

export const galleryImages: GalleryImage[] = [
  { id: 1, src: '/gallery-1.jpeg', alt: 'Exploración en la cueva', width: 800, height: 600 },
  { id: 2, src: '/gallery-2.jpeg', alt: 'Formaciones rocosas iluminadas', width: 800, height: 900 },
  { id: 3, src: '/gallery-3.jpeg', alt: 'Visitantes en el recorrido', width: 800, height: 600 },
  { id: 4, src: '/gallery-4.jpeg', alt: 'Interior de la cueva', width: 800, height: 800 },
  { id: 5, src: '/gallery-5.jpeg', alt: 'Murciélagos en su hábitat', width: 800, height: 800 },
  { id: 6, src: '/gallery-6.jpeg', alt: 'Vista panorámica de la cueva', width: 800, height: 600 },
  { id: 7, src: '/gallery-7.jpeg', alt: 'El recorrido subterráneo', width: 800, height: 800 },
  { id: 8, src: '/gallery-8.jpeg', alt: 'Formaciones milenarias', width: 800, height: 600 },
]

export const contactInfo = {
  email: 'Oficialdarkbat@gmail.com',
  phone: '3043899234',
  whatsapp: '3043899234',
  address: 'Santa Sofía, Colombia',
  mapsUrl: 'https://maps.app.goo.gl/dNPhe6A4s5gs4mjz9',
  lat: 5.786,
  lng: -73.586,
}
