'use client'

import { useEffect, useRef } from 'react'

const MATRIX_CHARS =
  'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン0123456789ABCDEFabcdef{}[]<>/:;.=+-*&@#'

interface MatrixRainProps {
  className?: string
  opacity?: number
  color?: string
  fontSize?: number
  speed?: number
}

export default function MatrixRain({
  className = '',
  opacity = 0.04,
  color = '#00ff41',
  fontSize = 14,
  speed = 33,
}: MatrixRainProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animationId: number
    let columns: number[] = []

    const resize = () => {
      canvas.width = canvas.offsetWidth
      canvas.height = canvas.offsetHeight
      const colCount = Math.floor(canvas.width / fontSize)
      columns = Array.from({ length: colCount }, () =>
        Math.random() * canvas.height / fontSize
      )
    }

    resize()
    window.addEventListener('resize', resize)

    const draw = () => {
      // Fade effect
      ctx.fillStyle = `rgba(9, 9, 11, 0.05)`
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      ctx.fillStyle = color
      ctx.font = `${fontSize}px monospace`

      for (let i = 0; i < columns.length; i++) {
        const char = MATRIX_CHARS[Math.floor(Math.random() * MATRIX_CHARS.length)]
        const x = i * fontSize
        const y = columns[i] * fontSize

        // Vary brightness
        const brightness = Math.random()
        if (brightness > 0.95) {
          ctx.fillStyle = '#ffffff'
        } else if (brightness > 0.8) {
          ctx.fillStyle = color
        } else {
          ctx.fillStyle = `${color}88`
        }

        ctx.fillText(char, x, y)

        // Reset column to top randomly
        if (y > canvas.height && Math.random() > 0.975) {
          columns[i] = 0
        }
        columns[i]++
      }
    }

    const interval = setInterval(draw, speed)

    return () => {
      clearInterval(interval)
      window.removeEventListener('resize', resize)
      if (animationId) cancelAnimationFrame(animationId)
    }
  }, [color, fontSize, speed])

  return (
    <canvas
      ref={canvasRef}
      className={`pointer-events-none absolute inset-0 h-full w-full ${className}`}
      style={{ opacity }}
    />
  )
}
