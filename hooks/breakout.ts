// Breakout, in pixels: a paddle, a ball and a wall of bricks.

import { clamp } from './arcade'
import type { GameDef, Phase } from './arcade'
import { blank, plot, rect, toRows } from './pixels'

export type Breakout = {
  w: number
  h: number
  // The paddle's middle, and where it is headed.
  paddle: number
  aim: number
  ball: { x: number; y: number; vx: number; vy: number }
  // The ball waits on the paddle until launched.
  isHeld: boolean
  // Row-major, `cols` to a row.
  bricks: boolean[]
  cols: number
  score: number
  lives: number
  level: number
  phase: Phase
}

export const BRICK_ROWS = 6
export const BRICK_W = 4
const BRICK_H = 2
const TOP = 4
const PADDLE_W = 8
const PADDLE_SPEED = 90
const SPEED = 38

// A color per row of bricks, top first.
const TINTS: readonly string[] = ['#F87171', '#FB923C', '#FBBF24', '#34D399', '#38BDF8', '#C084FC']

const paddleY = (s: Pick<Breakout, 'h'>): number => s.h - 2
const speedOf = (level: number): number => SPEED * (1 + (level - 1) * 0.15)

const wall = (w: number): { bricks: boolean[]; cols: number } => {
  const cols = Math.floor(w / BRICK_W)

  return { bricks: Array.from({ length: cols * BRICK_ROWS }, () => true), cols }
}

export const newBreakout = (w: number, rows: number): Breakout => ({
  w,
  h: rows * 2,
  paddle: w / 2,
  aim: w / 2,
  ball: { x: w / 2, y: rows * 2 - 3, vx: 0, vy: 0 },
  isHeld: true,
  ...wall(w),
  score: 0,
  lives: 3,
  level: 1,
  phase: 'ready',
})

/** Sends a held ball up from the paddle. */
export const launch = (s: Breakout): Breakout =>
  s.isHeld ? { ...s, isHeld: false, ball: { ...s.ball, vx: speedOf(s.level) * 0.5, vy: -speedOf(s.level) } } : s

const tick = (s: Breakout, dt: number): Breakout => {
  const half = PADDLE_W / 2
  const paddle = clamp(s.paddle + clamp(s.aim - s.paddle, -PADDLE_SPEED * dt, PADDLE_SPEED * dt), half, s.w - half)
  if (s.isHeld) return { ...s, paddle, ball: { x: paddle, y: paddleY(s) - 1, vx: 0, vy: 0 } }

  let { x, y, vx, vy } = s.ball
  x += vx * dt
  y += vy * dt

  if (x < 0.5) {
    x = 0.5
    vx = Math.abs(vx)
  } else if (x > s.w - 0.5) {
    x = s.w - 0.5
    vx = -Math.abs(vx)
  }
  if (y < 0.5) {
    y = 0.5
    vy = Math.abs(vy)
  }

  // The paddle sends the ball up, at the angle of where it was hit.
  if (vy > 0 && y >= paddleY(s) - 0.5 && s.ball.y < paddleY(s) - 0.5 && Math.abs(x - paddle) <= half + 0.5) {
    const speed = speedOf(s.level)
    y = paddleY(s) - 0.5
    vx = ((x - paddle) / half) * speed * 0.9
    vy = -speed
  }

  let { bricks, score } = s
  const col = Math.floor(x / BRICK_W)
  const row = Math.floor((y - TOP) / BRICK_H)
  if (row >= 0 && row < BRICK_ROWS && col >= 0 && col < s.cols && bricks[row * s.cols + col]) {
    bricks = bricks.map((is, i) => is && i !== row * s.cols + col)
    score += BRICK_ROWS - row
    vy = -vy
  }

  const moved: Breakout = { ...s, paddle, ball: { x, y, vx, vy }, bricks, score }

  if (y > s.h) {
    const lives = s.lives - 1

    return lives <= 0 ? { ...moved, lives: 0, phase: 'over' } : { ...moved, lives, isHeld: true }
  }
  if (!bricks.some(Boolean)) return { ...moved, ...wall(s.w), level: s.level + 1, isHeld: true }

  return moved
}

export const stepBreakout = (s: Breakout, dt: number): Breakout => {
  let now = s
  const steps = Math.max(1, Math.ceil(speedOf(s.level) * dt * 2))
  for (let i = 0; i < steps && now.phase === 'playing'; i += 1) now = tick(now, dt / steps)

  return now
}

export const breakout: GameDef<Breakout> = {
  id: 'breakout',
  label: 'Breakout',
  glyph: '▬',
  hint: '←→ o mouse mueven · espacio o clic lanza · p pausa · r reinicia',
  minW: 32,
  maxW: 60,
  minRows: 12,
  maxRows: 20,
  create: newBreakout,
  step: stepBreakout,
  key: (s, key) => {
    if (key === ' ') return launch(s)
    if (key === 'left' || key === 'a') return { ...s, aim: clamp(s.aim - 5, 0, s.w) }
    if (key === 'right' || key === 'd') return { ...s, aim: clamp(s.aim + 5, 0, s.w) }

    return s
  },
  pointer: (s, e) => (e.type === 'down' ? launch({ ...s, aim: e.x }) : { ...s, aim: e.x }),
  score: s => s.score,
  hud: (s, color) => [
    { text: 'PUNTOS ', dim: true },
    { text: String(s.score), bold: true },
    { text: `   ${'◆'.repeat(s.lives)}${' '.repeat(Math.max(0, 3 - s.lives))}   `, color },
    { text: `NIVEL ${s.level}`, dim: true },
  ],
  draw: (s, color) => {
    const f = blank(s.w, s.h / 2)

    s.bricks.forEach((is, i) => {
      if (!is) return

      const row = Math.floor(i / s.cols)
      // A pixel of gap between bricks, so they read as bricks.
      rect(f, (i % s.cols) * BRICK_W, TOP + row * BRICK_H, BRICK_W - 1, BRICK_H, TINTS[row] ?? color)
    })
    rect(f, Math.round(s.paddle - PADDLE_W / 2), paddleY(s), PADDLE_W, 1, color)
    plot(f, s.ball.x, s.ball.y, 'text')

    return toRows(f)
  },
}
