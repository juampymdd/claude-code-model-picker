// Space Invaders, in cells of text. Pure: a state and the functions that move
// it. As in Pong, the ship follows an aim that a key nudges and the pointer sets.

import type { Phase } from './pong'

export type Invaders = {
  w: number
  h: number
  // The ship's middle column, and where it is headed.
  ship: number
  aim: number
  // The block of invaders: who is left (row-major), its corner, its heading.
  alive: boolean[]
  ox: number
  oy: number
  dir: 1 | -1
  // Which of their two shapes the invaders show; it flips each time they move.
  pose: 0 | 1
  // Milliseconds until their next move.
  wait: number
  // The player's shot (one at a time) and the invaders' bombs.
  shot: { x: number; y: number } | null
  bombs: { x: number; y: number }[]
  // What is left of the shields, cell by cell.
  shields: { x: number; y: number; hp: number }[]
  blasts: { x: number; y: number; ttl: number }[]
  score: number
  lives: number
  wave: number
  seed: number
  phase: Phase
}

export const ROWS = 3
export const COLS = 8
// An invader is two cells wide, with one between it and the next.
export const PITCH = 3
export const POINTS: readonly number[] = [30, 20, 10]
const SHIP_SPEED = 40
const SHOT_SPEED = 36
const BOMB_SPEED = 12
const BLAST_MS = 300
const BLOCK = COLS * PITCH - 1

const clamp = (n: number, low: number, high: number): number => Math.min(high, Math.max(low, n))

/** The row the ship flies on. */
export const shipRow = (s: Pick<Invaders, 'h'>): number => s.h - 1

// How long the invaders wait between moves: shorter each wave and as their numbers thin.
const pace = (s: Pick<Invaders, 'wave' | 'alive'>): number => {
  const left = s.alive.filter(Boolean).length

  return Math.max(60, (560 - (s.wave - 1) * 70) * (0.35 + (0.65 * left) / (ROWS * COLS)))
}

const shieldsFor = (w: number, h: number): Invaders['shields'] => {
  const count = w >= 50 ? 4 : 3
  const gap = w / (count + 1)

  return Array.from({ length: count }, (_, i) => Math.round(gap * (i + 1)) - 1).flatMap(x =>
    [0, 1, 2].map(dx => ({ x: x + dx, y: h - 4, hp: 2 })),
  )
}

const wave = (s: Invaders, n: number): Invaders => {
  const next = {
    ...s,
    alive: Array.from({ length: ROWS * COLS }, () => true),
    ox: Math.floor((s.w - BLOCK) / 2),
    oy: 1,
    dir: 1 as const,
    pose: 0 as const,
    shot: null,
    bombs: [],
    wave: n,
  }

  return { ...next, wait: pace(next) }
}

export const newInvaders = (w: number, h: number): Invaders =>
  wave(
    {
      w,
      h,
      ship: w / 2,
      aim: w / 2,
      alive: [],
      ox: 0,
      oy: 0,
      dir: 1,
      pose: 0,
      wait: 0,
      shot: null,
      bombs: [],
      shields: shieldsFor(w, h),
      blasts: [],
      score: 0,
      lives: 3,
      wave: 1,
      seed: 7,
      phase: 'ready',
    },
    1,
  )

/** The ship's aim moved by `dx` cells, or set to column `x`. */
export const nudgeInvaders = (s: Invaders, dx: number): Invaders => ({ ...s, aim: clamp(s.aim + dx, 1, s.w - 2) })
export const aimInvaders = (s: Invaders, x: number): Invaders => ({ ...s, aim: clamp(x, 1, s.w - 2) })

/** Starts, pauses or resumes; a finished game starts over. */
export const toggleInvaders = (s: Invaders): Invaders => {
  if (s.phase === 'over') return { ...newInvaders(s.w, s.h), phase: 'playing' }

  return { ...s, phase: s.phase === 'playing' ? 'paused' : 'playing' }
}

/** Fires, if no shot of the player's is in the air; a game that waits starts. */
export const fireInvaders = (s: Invaders): Invaders => {
  if (s.phase === 'ready' || s.phase === 'over') return toggleInvaders(s)
  if (s.phase !== 'playing' || s.shot !== null) return s

  return { ...s, shot: { x: Math.round(s.ship), y: shipRow(s) - 1 } }
}

/** The cells invader (row, col) covers: its left column and its row. */
export const invaderAt = (s: Pick<Invaders, 'ox' | 'oy'>, row: number, col: number): { x: number; y: number } => ({
  x: s.ox + col * PITCH,
  y: s.oy + row,
})

// Which invader, if any, covers cell (x, y).
const invaderIn = (s: Invaders, x: number, y: number): number => {
  const row = y - s.oy
  const col = Math.floor((x - s.ox) / PITCH)
  if (row < 0 || row >= ROWS || col < 0 || col >= COLS || x - s.ox - col * PITCH > 1) return -1

  return s.alive[row * COLS + col] ? row * COLS + col : -1
}

const random = (seed: number): number => (Math.imul(seed, 1664525) + 1013904223) >>> 0

// The invaders' move: a step sideways, or down and back at an edge; one of the lowest drops a bomb.
const march = (s: Invaders): Invaders => {
  const cols = Array.from({ length: COLS }, (_, c) => c).filter(c => [0, 1, 2].some(r => s.alive[r * COLS + c]))
  const first = Math.min(...cols)
  const last = Math.max(...cols)
  const atEdge = s.dir === 1 ? s.ox + last * PITCH + 2 >= s.w : s.ox + first * PITCH <= 0
  const moved = atEdge ? { ...s, oy: s.oy + 1, dir: (s.dir === 1 ? -1 : 1) as 1 | -1 } : { ...s, ox: s.ox + s.dir }
  const seed = random(s.seed)
  const column = cols[seed % cols.length] as number
  const lowest = [2, 1, 0].find(r => s.alive[r * COLS + column]) as number
  const from = invaderAt(moved, lowest, column)
  const bombs = moved.bombs.length < 2 + s.wave && seed % 3 !== 0 ? [...moved.bombs, { x: from.x, y: from.y + 1 }] : moved.bombs

  return { ...moved, bombs, seed, pose: s.pose === 0 ? 1 : 0, wait: pace(moved) }
}

/** The game `dt` seconds later; one that is not being played stays as it is. */
export const stepInvaders = (s: Invaders, dt: number): Invaders => {
  if (s.phase !== 'playing') return s

  let now: Invaders = {
    ...s,
    ship: s.ship + clamp(s.aim - s.ship, -SHIP_SPEED * dt, SHIP_SPEED * dt),
    wait: s.wait - dt * 1000,
    blasts: s.blasts.map(b => ({ ...b, ttl: b.ttl - dt * 1000 })).filter(b => b.ttl > 0),
  }
  while (now.wait <= 0) now = { ...march(now), wait: now.wait + pace(now) }

  let shields = now.shields
  const wear = (x: number, y: number): boolean => {
    const at = shields.findIndex(cell => cell.x === Math.round(x) && cell.y === Math.round(y))
    if (at < 0) return false

    shields = shields.flatMap((cell, i) => (i !== at ? [cell] : cell.hp > 1 ? [{ ...cell, hp: cell.hp - 1 }] : []))

    return true
  }

  // The player's shot rises a cell at a time, so it cannot skip a row of invaders.
  let shot = now.shot
  let { alive, score, blasts } = now
  if (shot !== null) {
    const to = shot.y - SHOT_SPEED * dt

    for (let y = Math.round(shot.y); shot !== null && y >= Math.round(to); y -= 1) {
      const hit = invaderIn(now, shot.x, y)

      if (hit >= 0) {
        alive = alive.map((is, i) => is && i !== hit)
        score += POINTS[Math.floor(hit / COLS)] ?? 0
        blasts = [...blasts, { x: shot.x, y, ttl: BLAST_MS }]
        shot = null
      } else if (wear(shot.x, y)) {
        shot = null
      }
    }
    if (shot !== null) shot = to < 0 ? null : { x: shot.x, y: to }
  }

  let lives = now.lives
  const bombs = now.bombs
    .map(bomb => ({ x: bomb.x, y: bomb.y + BOMB_SPEED * dt }))
    .filter(bomb => {
      if (wear(bomb.x, bomb.y)) return false
      if (Math.round(bomb.y) >= shipRow(now) && Math.abs(bomb.x - now.ship) <= 1.5) {
        lives -= 1
        blasts = [...blasts, { x: Math.round(now.ship), y: shipRow(now), ttl: BLAST_MS }]

        return false
      }

      return bomb.y < now.h
    })

  const next: Invaders = { ...now, shot, bombs, shields, alive, score, blasts, lives }
  const landed = alive.some((is, i) => is && now.oy + Math.floor(i / COLS) >= shipRow(now) - 1)

  if (lives <= 0 || landed) return { ...next, lives: Math.max(0, lives), phase: 'over' }
  if (!alive.some(Boolean)) return wave(next, next.wave + 1)

  return next
}
