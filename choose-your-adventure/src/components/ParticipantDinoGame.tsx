import { useEffect, useRef } from 'react'
import './ParticipantDinoGame.css'

type ParticipantDinoGameProps = {
  className?: string
  /**
   * When `true` (default), Space / ↑ work anywhere — good on the loading screen.
   * When `false`, keys only apply while the canvas is focused — avoids clashing with study cards / modals.
   */
  attachKeyboardToWindow?: boolean
}

/**
 * Lightweight endless-runner inspired by Chrome’s offline dinosaur game.
 * Space / ↑ / tap or click to jump; after game over, same action restarts.
 */
export default function ParticipantDinoGame({
  className,
  attachKeyboardToWindow = true
}: ParticipantDinoGameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const W = canvas.width
    const H = canvas.height
    const groundY = H - 22

    const dino = { x: 56, y: groundY - 46, w: 40, h: 46, vy: 0, grounded: true }
    const gravity = 0.82
    const jumpV = -13.5

    type Obs = { x: number; w: number; h: number }
    const obstacles: Obs[] = []

    let speed = 6.5
    let frame = 0
    let score = 0
    let gameOver = false
    let nextSpawn = 75
    let running = true

    const resetRun = () => {
      obstacles.length = 0
      score = 0
      speed = 6.5
      frame = 0
      nextSpawn = 75
      dino.y = groundY - dino.h
      dino.vy = 0
      dino.grounded = true
      gameOver = false
    }

    const spawn = () => {
      obstacles.push({
        x: W + 16,
        w: 16 + Math.floor(Math.random() * 28),
        h: 28 + Math.floor(Math.random() * 40)
      })
    }

    const collides = (): boolean => {
      const dx = dino.x + 4
      const dy = dino.y + 4
      const dw = dino.w - 8
      const dh = dino.h - 6
      for (const o of obstacles) {
        const ox = o.x
        const oy = groundY - o.h
        const ow = o.w
        const oh = o.h
        if (dx < ox + ow && dx + dw > ox && dy < oy + oh && dy + dh > oy) return true
      }
      return false
    }

    const jump = () => {
      if (gameOver) {
        resetRun()
        return
      }
      if (dino.grounded) {
        dino.vy = jumpV
        dino.grounded = false
      }
    }

    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'ArrowUp') {
        e.preventDefault()
        jump()
      }
    }

    const loop = () => {
      if (!running) return
      ctx.clearRect(0, 0, W, H)

      ctx.fillStyle = '#14141a'
      ctx.fillRect(0, 0, W, H)

      ctx.fillStyle = 'rgba(255,255,255,0.08)'
      for (let i = 0; i < 24; i++) {
        const sx = ((i * 53 + frame) % (W + 40)) - 20
        const sy = 12 + (i * 17) % (groundY - 24)
        ctx.fillRect(sx, sy, 2, 2)
      }

      ctx.strokeStyle = 'rgba(255,255,255,0.35)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(0, groundY)
      ctx.lineTo(W, groundY)
      ctx.stroke()
      ctx.fillStyle = 'rgba(255,255,255,0.06)'
      ctx.fillRect(0, groundY, W, H - groundY)

      if (!gameOver) {
        frame++
        score = Math.floor(frame / 5)
        if (speed < 13.5) speed += 0.0009

        dino.vy += gravity
        dino.y += dino.vy
        if (dino.y >= groundY - dino.h) {
          dino.y = groundY - dino.h
          dino.vy = 0
          dino.grounded = true
        } else {
          dino.grounded = false
        }

        nextSpawn -= 1
        if (nextSpawn <= 0) {
          spawn()
          nextSpawn = 48 + Math.floor(Math.random() * 55)
        }

        for (const o of obstacles) {
          o.x -= speed
        }
        while (obstacles.length > 0 && obstacles[0].x + obstacles[0].w < -12) {
          obstacles.shift()
        }

        if (collides()) gameOver = true
      }

      for (const o of obstacles) {
        ctx.fillStyle = 'rgba(90, 170, 110, 0.9)'
        ctx.fillRect(o.x, groundY - o.h, o.w, o.h)
        ctx.fillStyle = 'rgba(70, 140, 90, 0.95)'
        ctx.fillRect(o.x + 3, groundY - o.h + 4, 4, Math.min(o.h - 8, 22))
      }

      ctx.fillStyle = 'rgba(238, 238, 248, 0.96)'
      ctx.fillRect(dino.x, dino.y, dino.w, dino.h)
      ctx.fillStyle = '#14141a'
      ctx.fillRect(dino.x + dino.w - 16, dino.y + 10, 9, 7)

      ctx.fillStyle = 'rgba(255,255,255,0.65)'
      ctx.font = '13px ui-monospace, SFMono-Regular, Menlo, Monaco, monospace'
      ctx.textAlign = 'right'
      ctx.fillText(String(score), W - 12, 20)
      ctx.textAlign = 'start'

      if (gameOver) {
        ctx.fillStyle = 'rgba(0,0,0,0.5)'
        ctx.fillRect(0, 0, W, H)
        ctx.fillStyle = '#f5f5f5'
        ctx.font = '14px "Red Hat Text", system-ui, sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText(
          attachKeyboardToWindow
            ? 'Game over — Space or tap to go again'
            : 'Game over — tap, or focus here and press Space',
          W / 2,
          H / 2 - 6
        )
        ctx.textAlign = 'start'
      }

      if (running) {
        rafRef.current = requestAnimationFrame(loop)
      }
    }

    canvas.addEventListener('pointerdown', jump)
    if (attachKeyboardToWindow) {
      canvas.tabIndex = -1
      window.addEventListener('keydown', onKey)
    } else {
      canvas.tabIndex = 0
      canvas.addEventListener('keydown', onKey)
    }
    rafRef.current = requestAnimationFrame(loop)

    return () => {
      running = false
      cancelAnimationFrame(rafRef.current)
      if (attachKeyboardToWindow) {
        window.removeEventListener('keydown', onKey)
      } else {
        canvas.removeEventListener('keydown', onKey)
      }
      canvas.removeEventListener('pointerdown', jump)
    }
  }, [attachKeyboardToWindow])

  return (
    <div className={`participant-dino-game ${className ?? ''}`.trim()}>
      <canvas
        ref={canvasRef}
        className="participant-dino-game__canvas"
        width={600}
        height={168}
        role="img"
        aria-label={
          attachKeyboardToWindow
            ? 'Mini endless runner: press Space or tap to jump over blocks'
            : 'Mini endless runner: tap to jump, or focus this area and press Space'
        }
      />
    </div>
  )
}
