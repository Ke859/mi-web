import { type ReactNode, useRef } from 'react'
import { motion, useScroll, useTransform, type MotionValue } from 'framer-motion'

interface ParallaxProps {
  children?: ReactNode
  className?: string
  speed?: number
  direction?: 'y' | 'x'
}

export function Parallax({ children, className = '', speed = 80, direction = 'y' }: ParallaxProps) {
  const ref = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'],
  })

  const y = useTransform(scrollYProgress, [0, 1], [speed, -speed])
  const x = useTransform(scrollYProgress, [0, 1], [speed, -speed])

  const value: MotionValue<number> = direction === 'x' ? x : y

  return (
    <motion.div ref={ref} style={{ [direction]: value } as never} className={className}>
      {children}
    </motion.div>
  )
}
