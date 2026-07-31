import { type ButtonHTMLAttributes, forwardRef } from 'react'
import { motion } from 'framer-motion'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  icon?: React.ReactNode
  href?: string
}

const variants = {
  primary:
    'bg-gradient-to-r from-gold-500 to-gold-400 text-deep-950 font-semibold hover:from-gold-400 hover:to-gold-300 shadow-lg shadow-gold-500/20',
  secondary:
    'border border-gold-500/40 text-gold-300 hover:bg-gold-500/10 hover:border-gold-400/60',
  ghost:
    'text-stone-300 hover:text-white hover:bg-white/5',
}

const sizes = {
  sm: 'px-4 py-2 text-sm',
  md: 'px-6 py-3 text-base',
  lg: 'px-8 py-4 text-lg',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', icon, href, children, className = '', ...props }, ref) => {
    const base = 'inline-flex items-center justify-center gap-2 rounded-lg font-body transition-all duration-300 cursor-pointer border-none outline-none'
    const cls = `${base} ${variants[variant]} ${sizes[size]} ${className}`

    const content = (
      <>
        {children}
        {icon && <span className="w-4 h-4">{icon}</span>}
      </>
    )

    if (href) {
      return (
        <a href={href} className={cls}>
          {content}
        </a>
      )
    }

    return (
      <motion.button
        ref={ref}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className={cls}
        {...(props as any)}
      >
        {content}
      </motion.button>
    )
  }
)

Button.displayName = 'Button'
