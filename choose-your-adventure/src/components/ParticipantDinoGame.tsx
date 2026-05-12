import { useEffect, useRef, useState } from 'react'
import './ParticipantDinoGame.css'
/* Hat-only mark: https://commons.wikimedia.org/wiki/File:Red_Hat_logo.svg */
import redHatHatMarkUrl from '../images/Red_Hat_logo_hat_only_from_Wikimedia_Commons.svg?url'

const HIGH_SCORE_STORAGE_KEY = 'summit-cya-dino-highscore'

function readHighScoreFromStorage(): number {
  if (typeof window === 'undefined') return 0
  try {
    const raw = localStorage.getItem(HIGH_SCORE_STORAGE_KEY)
    const n = parseInt(raw ?? '0', 10)
    return Number.isFinite(n) && n >= 0 ? n : 0
  } catch {
    return 0
  }
}

type ParticipantDinoGameProps = {
  className?: string
  /**
   * When `true` (default), Space / ↑ work anywhere — good on the loading screen.
   * When `false`, keys only apply while the canvas is focused — avoids clashing with study cards / modals.
   */
  attachKeyboardToWindow?: boolean
}

/** Draw Wikimedia Red Hat hat mark (192.3×146) into the runner hit box, feet aligned. */
function drawRedHatMarkSprite(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  dino: { x: number; y: number; w: number; h: number }
) {
  const nw = img.naturalWidth
  const nh = img.naturalHeight
  if (!(nw > 0 && nh > 0)) return
  const pad = 3
  const maxW = dino.w - pad * 2
  const maxH = dino.h - pad * 2
  const scale = Math.min(maxW / nw, maxH / nh)
  const dw = nw * scale
  const dh = nh * scale
  const dx = dino.x + (dino.w - dw) * 0.5
  const dy = dino.y + dino.h - dh - 3
  ctx.drawImage(img, 0, 0, nw, nh, dx, dy, dw, dh)
}

/** Obstacle: freestanding coat rack (weighted base, pole, staggered curved hooks). */
function drawCoatRack(
  ctx: CanvasRenderingContext2D,
  hitLeft: number,
  hitW: number,
  hitH: number,
  groundY: number
) {
  const cx = hitLeft + hitW * 0.5

  const woodDark = '#3d2818'
  const woodMid = '#6b4a32'
  const woodBar = '#5c3d28'
  const woodLight = '#8b623f'

  ctx.save()

  const baseH = Math.min(Math.max(hitH * 0.14, 5), 11)
  const baseHalf = hitW * 0.44
  ctx.fillStyle = woodDark
  ctx.beginPath()
  ctx.moveTo(cx - baseHalf, groundY)
  ctx.lineTo(cx + baseHalf, groundY)
  ctx.lineTo(cx + baseHalf * 0.62, groundY - baseH)
  ctx.lineTo(cx - baseHalf * 0.62, groundY - baseH)
  ctx.closePath()
  ctx.fill()

  const poleTop = groundY - hitH * 0.94
  const poleBot = groundY - baseH + 1
  const poleW = Math.max(3, Math.min(7, hitW * 0.12))
  ctx.fillStyle = woodMid
  ctx.fillRect(cx - poleW * 0.5, poleTop, poleW, poleBot - poleTop)

  const finialR = Math.max(2.5, poleW * 0.55)
  ctx.fillStyle = woodBar
  ctx.beginPath()
  ctx.arc(cx, poleTop, finialR, 0, Math.PI * 2)
  ctx.fill()

  const reach = Math.min(hitW * 0.4, 26, hitH * 0.22)
  const hookLo = Math.max(2.5, poleW * 0.5)
  const hookStartY = poleTop + finialR + 5
  const poleSpan = poleBot - hookStartY - 6
  const hookCount = Math.min(6, Math.max(3, Math.round(poleSpan / Math.max(hitH * 0.14, 9))))

  const strokeHook = (hx: number, hy: number, side: number) => {
    const tipX = hx + side * reach
    ctx.beginPath()
    ctx.moveTo(hx, hy)
    ctx.lineTo(tipX - side * 3, hy)
    ctx.quadraticCurveTo(tipX + side * 5, hy + 3, tipX - side * 2, hy + Math.min(reach * 0.5, 12))
    ctx.stroke()
  }

  ctx.strokeStyle = woodLight
  ctx.lineWidth = hookLo
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  for (let i = 0; i < hookCount; i++) {
    const t = hookCount <= 1 ? 0.5 : (i + 0.5) / hookCount
    const hy = hookStartY + t * poleSpan
    const side = i % 2 === 0 ? -1 : 1
    strokeHook(cx, hy, side)
  }

  ctx.restore()
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
  const [highScore, setHighScore] = useState(readHighScoreFromStorage)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const W = canvas.width
    const H = canvas.height
    const groundY = H - 22

    const dino = { x: 48, y: groundY - 64, w: 58, h: 64, vy: 0, grounded: true }
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

    const hatImage = new Image()
    let hatMarkReady = false
    hatImage.onload = () => {
      hatMarkReady = true
    }
    hatImage.src = redHatHatMarkUrl

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

        if (collides()) {
          gameOver = true
          const runScore = score
          setHighScore((prev) => {
            if (runScore <= prev) return prev
            try {
              localStorage.setItem(HIGH_SCORE_STORAGE_KEY, String(runScore))
            } catch {
              /* quota / private mode */
            }
            return runScore
          })
        }
      }

      for (const o of obstacles) {
        drawCoatRack(ctx, o.x, o.w, o.h, groundY)
        // light ground contact shadow
        ctx.fillStyle = 'rgba(0,0,0,0.2)'
        ctx.beginPath()
        ctx.ellipse(o.x + o.w * 0.5, groundY + 2, o.w * 0.35, 3, 0, 0, Math.PI * 2)
        ctx.fill()
      }

      if (hatMarkReady && hatImage.naturalWidth > 0) {
        drawRedHatMarkSprite(ctx, hatImage, dino)
      }
      ctx.fillStyle = 'rgba(0,0,0,0.18)'
      ctx.beginPath()
      ctx.ellipse(dino.x + dino.w * 0.5, groundY + 2, dino.w * 0.38, 3.5, 0, 0, Math.PI * 2)
      ctx.fill()

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
            ? 'Mini runner: jump your fedora over coat racks — Space or tap'
            : 'Mini runner: jump your fedora over coat racks — tap or focus and press Space'
        }
      />
      <p className="participant-dino-game__highscore" aria-live="polite">
        Top score: <strong>{highScore}</strong>
      </p>
    </div>
  )
}
