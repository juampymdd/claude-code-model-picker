// Flappy: one key, a bird, and pipes to fly between. In pixels.

import { below, lcg } from './arcade'
import type { GameDef, Phase } from './arcade'
import { blank, plot, rect, toRows } from './pixels'

export type Flappy = {
  w: number
  h: number
  y: number
  vy: number
  // Each pipe's left edge, the middle of its gap, and whether it was passed.
  pipes: { x: number; gap: number; isPassed: boolean }[]
  score: number
  seed: number
  phase: Phase
}

export const BIRD_X = 10
const GRAVITY = 90
const FLAP = -30
const SPEED = 22
const PIPE_W = 4
const SPACING = 26
const GROUND = 2

/** The gap between a pipe's halves: it narrows as the score grows. */
export const gapOf = (score: number): number => Math.max(9, 14 - Math.floor(score / 5))

const pipeAt = (s: Pick<Flappy, 'h' | 'score'>, x: number, seed: number): Flappy['pipes'][number] => {
  const half = gapOf(s.score) / 2

  return { x, gap: half + 2 + below(seed, Math.max(1, s.h - GROUND - gapOf(s.score) - 4)), isPassed: false }
}

export const newFlappy = (w: number, rows: number, seed: number): Flappy => {
  const base = { w, h: rows * 2, score: 0 }
  const pipes: Flappy['pipes'] = []
  let next = seed

  for (let x = w; x < w + SPACING * 3; x += SPACING) {
    next = lcg(next)
    pipes.push(pipeAt(base, x, next))
  }

  return { ...base, y: rows, vy: 0, pipes, seed: next, phase: 'ready' }
}

export const flap = (s: Flappy): Flappy => ({ ...s, vy: FLAP })

export const stepFlappy = (s: Flappy, dt: number): Flappy => {
  const vy = s.vy + GRAVITY * dt
  const y = s.y + vy * dt
  let { score, seed } = s

  let pipes = s.pipes.map(pipe => {
    const x = pipe.x - SPEED * dt
    if (!pipe.isPassed && x + PIPE_W < BIRD_X) {
      score += 1

      return { ...pipe, x, isPassed: true }
    }

    return { ...pipe, x }
  })
  // A pipe that left the screen comes back at the far end.
  if ((pipes[0]?.x ?? 0) < -PIPE_W) {
    seed = lcg(seed)
    pipes = [...pipes.slice(1), pipeAt({ h: s.h, score }, (pipes[pipes.length - 1]?.x ?? s.w) + SPACING, seed)]
  }

  const half = gapOf(score) / 2
  const hitsPipe = pipes.some(pipe => BIRD_X + 1 >= pipe.x && BIRD_X <= pipe.x + PIPE_W && Math.abs(y - pipe.gap) > half - 1)
  const moved: Flappy = { ...s, y, vy, pipes, score, seed }

  return y < 0 || y > s.h - GROUND - 1 || hitsPipe ? { ...moved, phase: 'over' } : moved
}

export const flappy: GameDef<Flappy> = {
  id: 'flappy',
  label: 'Flappy',
  glyph: '▶',
  hint: 'espacio, ↑ o clic aletea · p pausa · r reinicia',
  minW: 30,
  maxW: 60,
  minRows: 10,
  maxRows: 18,
  create: newFlappy,
  step: stepFlappy,
  key: (s, key) => (key === ' ' || key === 'up' || key === 'w' ? flap(s) : s),
  pointer: (s, e) => (e.type === 'down' ? flap(s) : s),
  score: s => s.score,
  hud: s => [
    { text: 'FLAPPY  ', dim: true },
    { text: String(s.score), bold: true },
  ],
  draw: (s, color) => {
    const f = blank(s.w, s.h / 2)
    const half = gapOf(s.score) / 2

    for (const pipe of s.pipes) {
      const x = Math.round(pipe.x)
      rect(f, x, 0, PIPE_W, Math.round(pipe.gap - half), 'success')
      rect(f, x, Math.round(pipe.gap + half), PIPE_W, s.h, 'success')
    }
    rect(f, 0, s.h - GROUND, s.w, GROUND, 'subtle')
    rect(f, BIRD_X, Math.round(s.y) - 1, 2, 2, s.phase === 'over' ? 'error' : color)
    plot(f, BIRD_X + 2, Math.round(s.y) - 1, 'warning')

    return toRows(f)
  },
}
