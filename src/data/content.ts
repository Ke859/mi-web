import type { GalleryImage, FAQItem } from '../types'

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

export const experienceDetails = [
  { icon: 'Clock', title: 'Duración', desc: '2 horas de recorrido guiado por las profundidades de la cueva.' },
  { icon: 'Map', title: 'Recorrido', desc: '1.5 km de senderos iluminados con pasarelas seguras.' },
  { icon: 'Users', title: 'Guías', desc: 'Expertos espeleólogos bilingües te acompañarán en todo momento.' },
  { icon: 'Shirt', title: 'Recomendaciones', desc: 'Ropa cómoda, calzado cerrado y chaqueta ligera.' },
  { icon: 'Signal', title: 'Dificultad', desc: 'Baja — apto para toda la familia. Sin experiencia previa.' },
  { icon: 'Backpack', title: 'Qué llevar', desc: 'Cámara, agua y muchas ganas de explorar. Linterna incluida.' },
]

export const faqData: FAQItem[] = [
  { id: 1, question: '¿Es seguro el recorrido?', answer: 'Sí, todas nuestras rutas cuentan con pasarelas, barandales e iluminación LED. Los guías están certificados en primeros auxilios y rescate.' },
  { id: 2, question: '¿Hay murciélagos todo el año?', answer: 'Sí, la colonia habita la cueva permanentemente. La mejor época para verlos en actividad es al atardecer.' },
  { id: 3, question: '¿Los niños pueden entrar?', answer: 'Sí, recomendado para mayores de 5 años. Los menores deben ir acompañados de un adulto.' },
  { id: 4, question: '¿Qué incluye el boleto?', answer: 'Incluye guía especializado, equipo de seguridad (casco y linterna), y acceso a todas las áreas habilitadas.' },
  { id: 5, question: '¿Puedo cancelar mi reserva?', answer: 'Sí, hasta 48 horas antes del tour con reembolso completo. Consulta nuestra política de cancelación.' },
  { id: 6, question: '¿Hay servicio de transporte?', answer: 'Ofrecemos recogida desde los hoteles del centro. Pregunta al reservar para coordinar.' },
]

export const contactInfo = {
  email: 'darkbatoficial@gmail.com',
  phone: '3043899234',
  whatsapp: '3043899234',
  address: 'Santa Sofía, Colombia',
  mapsUrl: 'https://maps.app.goo.gl/dNPhe6A4s5gs4mjz9',
  lat: 5.786,
  lng: -73.586,
}
