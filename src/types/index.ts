export interface GalleryImage {
  id: number
  src: string
  alt: string
  width: number
  height: number
}

export interface FAQItem {
  id: number
  question: string
  answer: string
}

export interface Testimonial {
  id: number
  name: string
  text: string
  rating: number
  photo?: string
}

export interface BookingFormData {
  name: string
  email: string
  whatsapp: string
  date: string
  time: string
  people: string
  lunch: string
  comments: string
}

export interface NavLink {
  label: string
  href: string
}
