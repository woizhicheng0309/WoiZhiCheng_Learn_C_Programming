import type { CSSProperties, PropsWithChildren } from 'react'
import { motion } from 'motion/react'

type RevealProps = PropsWithChildren<{
  className?: string
  delay?: number
  style?: CSSProperties
}>

export function Reveal({ children, className, delay = 0, style }: RevealProps) {
  return (
    <motion.div
      className={className}
      style={style}
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.16 }}
      transition={{ duration: 0.62, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  )
}
