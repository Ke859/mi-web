import { ParticleBackground } from './components/effects/ParticleBackground'
import { Bats } from './components/effects/Bats'
import { LightEffect } from './components/effects/LightEffect'
import { Navbar } from './components/layout/Navbar'
import { Footer } from './components/layout/Footer'
import { Hero } from './components/sections/Hero'
import { Gallery } from './components/sections/Gallery'
import { Booking } from './components/sections/Booking'
import { Testimonials } from './components/sections/Testimonials'
import { Location } from './components/sections/Location'
import { WhatsAppButton } from './components/ui/WhatsAppButton'
import { ChatBot } from './components/ui/ChatBot'

export default function App() {
  return (
    <div className="relative min-h-screen bg-deep-950 text-stone-300">
      <ParticleBackground />
      <Bats />
      <LightEffect />
      <Navbar />
      <main>
        <Hero />
        <Gallery />
        <Booking />
        <Testimonials />
        <Location />
      </main>
      <Footer />
      <WhatsAppButton />
      <ChatBot />
    </div>
  )
}
