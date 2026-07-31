import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'

interface Bat {
  id: number
  startX: number
  endX: number
  yKeyframes: string[]
  scale: number
  duration: number
  delay: number
  direction: 1 | -1
  flipY: boolean
  flapSpeed: number
}

function BatSVG({ scale }: { scale: number }) {
  return (
    <svg
      width={32 * scale}
      height={20 * scale}
      viewBox="0 0 32 20"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M16 4 C10 0 3 2 1 6 C4 7 8 7 11 9 C7 13 4 17 2 20 C7 18 12 14 16 10 C20 14 25 18 30 20 C28 17 25 13 21 9 C24 7 28 7 31 6 C29 2 22 0 16 4Z"
        className="fill-gold-600/70"
        stroke="rgba(201,168,76,0.3)"
        strokeWidth="0.5"
      />
      <circle cx="16" cy="7" r="1.5" fill="#050505" opacity="0.8" />
    </svg>
  )
}

export function Bats() {
  const [bats, setBats] = useState<Bat[]>([])

  useEffect(() => {
    const generated: Bat[] = Array.from({ length: 20 }, (_, i) => {
      const fromLeft = Math.random() > 0.5
      const startY = Math.random() * 90 + 5
      return {
        id: i,
        startX: fromLeft ? -10 : 110,
        endX: fromLeft ? 110 : -10,
        yKeyframes: [
          `${startY}vh`,
          `${startY + (Math.random() * 20 - 10)}vh`,
          `${startY + (Math.random() * 15 - 7)}vh`,
          `${startY + (Math.random() * 20 - 10)}vh`,
          `${startY}vh`,
        ],
        scale: Math.random() * 0.7 + 0.4,
        duration: Math.random() * 20 + 18,
        delay: Math.random() * 20,
        direction: fromLeft ? 1 : -1,
        flipY: Math.random() > 0.5,
        flapSpeed: 1.5 + Math.random() * 1.5,
      }
    })
    setBats(generated)
  }, [])

  return (
    <div className="fixed inset-0 pointer-events-none z-[1]" aria-hidden="true">
      {bats.map((bat) => (
        <motion.div
          key={bat.id}
          className="absolute"
          initial={{ x: `${bat.startX}vw`, y: bat.yKeyframes[0], opacity: 0 }}
          animate={{
            x: `${bat.endX}vw`,
            y: bat.yKeyframes,
            opacity: [0, 0.8, 0.9, 0.6, 0],
          }}
          transition={{
            duration: bat.duration,
            delay: bat.delay,
            repeat: Infinity,
            ease: 'linear',
            times: [0, 0.15, 0.5, 0.85, 1],
          }}
        >
          <motion.div
            style={{ scaleX: bat.direction, scaleY: bat.flipY ? -1 : 1 }}
            animate={{
              rotate: [0, -12, 6, -10, 0],
              y: [0, -4, 3, -3, 0],
            }}
            transition={{ duration: bat.flapSpeed, repeat: Infinity, ease: 'easeInOut' }}
          >
            <BatSVG scale={bat.scale} />
          </motion.div>
        </motion.div>
      ))}
    </div>
  )
}
