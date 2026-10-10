// Snake, in pixels: two to a cell of text.

import { below, lcg } from './arcade'
import type { GameDef, Phase } from './arcade'
import { blank, plot, toRows } from './pixels'

type Point = { x: number; y: number }

export type Snake = {
  w: number
  h: number
  // Head first.
  body: Point[]
  dir: Point
  // Turns asked for and not taken yet, at most two.
  turns: Point[]
  food: Point
  eaten: number
  // Milliseconds until the next step.
  wait: number
  seed: number
  phase: Phase
}

const DIRS: Readonly<Record<string, Point>> = {
  up: { x: 0, y: -1 },
  w: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  s: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  a: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
  d: { x: 1, y: 0 },
}

/** How long a step takes: shorter every five meals. */
export const paceOf = (eaten: number): number => Math.max(50, 125 - Math.floor(eaten / 5) * 10)

const same = (a: Point, b: Point): boolean => a.x === b.x && a.y === b.y

// A free pixel for the food, by the seed.
const place = (s: Pick<Snake, 'w' | 'h' | 'body'>, seed: number): { food: Point; seed: number } => {
  let next = seed
  let food = { x: 0, y: 0 }

  for (let tries = 0; tries < 500; tries += 1) {
    next = lcg(next)
    const x = below(next, s.w)
    next = lcg(next)
    food = { x, y: below(next, s.h) }
    if (!s.body.some(part => same(part, food))) break
  }

  return { food, seed: next }
}

export const newSnake = (w: number, rows: number, seed: number): Snake => {
  const h = rows * 2
  const y = Math.floor(h / 2)
  const body = [0, 1, 2, 3].map(i => ({ x: Math.floor(w / 3) - i, y }))
  const placed = place({ w, h, body }, seed)

  return { w, h, body, dir: { x: 1, y: 0 }, turns: [], ...placed, eaten: 0, wait: paceOf(0), phase: 'ready' }
}

/** Asks for a turn; one straight back on itself is ignored. */
export const turnSnake = (s: Snake, dir: Point): Snake => {
  const last = s.turns[s.turns.length - 1] ?? s.dir
  if (s.turns.length >= 2 || (last.x + dir.x === 0 && last.y + dir.y === 0) || same(last, dir)) return s

  return { ...s, turns: [...s.turns, dir] }
}

const advance = (s: Snake): Snake => {
  const [turn, ...turns] = s.turns
  const dir = turn ?? s.dir
  const head = { x: (s.body[0] as Point).x + dir.x, y: (s.body[0] as Point).y + dir.y }
  const grows = same(head, s.food)
  const rest = grows ? s.body : s.body.slice(0, -1)

  if (head.x < 0 || head.y < 0 || head.x >= s.w || head.y >= s.h || rest.some(part => same(part, head))) {
    return { ...s, dir, turns, phase: 'over' }
  }

  const body = [head, ...rest]
  if (!grows) return { ...s, body, dir, turns }

  return { ...s, body, dir, turns, eaten: s.eaten + 1, ...place({ w: s.w, h: s.h, body }, s.seed) }
}

export const stepSnake = (s: Snake, dt: number): Snake => {
  let now = { ...s, wait: s.wait - dt * 1000 }
  while (now.wait <= 0 && now.phase === 'playing') now = { ...advance(now), wait: now.wait + paceOf(now.eaten) }

  return now
}

export const snake: GameDef<Snake> = {
  id: 'snake',
  label: 'Snake',
  glyph: '●',
  hint: 'flechas o wasd giran · clic apunta · p pausa · r reinicia',
  minW: 30,
  maxW: 60,
  minRows: 10,
  maxRows: 20,
  create: newSnake,
  step: stepSnake,
  key: (s, key) => (DIRS[key] === undefined ? s : turnSnake(s, DIRS[key] as Point)),
  // A press turns the snake toward it, along the axis it is furthest on.
  pointer: (s, e) => {
    if (e.type !== 'down') return s

    const head = s.body[0] as Point
    const dx = e.x - head.x
    const dy = e.y * 2 - head.y

    return turnSnake(s, Math.abs(dx) > Math.abs(dy) ? { x: Math.sign(dx), y: 0 } : { x: 0, y: Math.sign(dy) || 1 })
  },
  score: s => s.eaten * 10,
  hud: s => [
    { text: 'SNAKE  ', dim: true },
    { text: `${s.eaten * 10}`, bold: true },
    { text: `  largo ${s.body.length}`, dim: true },
  ],
  draw: (s, color) => {
    const f = blank(s.w, s.h / 2)
    const tint = s.phase === 'over' ? 'error' : color

    plot(f, s.food.x, s.food.y, 'warning')
    s.body.forEach((part, i) => plot(f, part.x, part.y, i === 0 && s.phase !== 'over' ? 'text' : tint))

    return toRows(f)
  },
}
