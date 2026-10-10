// Asteroids, in pixels, on a field that wraps at its edges.

import { below, lcg, unit } from './arcade'
import type { GameDef, Phase } from './arcade'
import { blank, line, plot, toRows } from './pixels'

type Body = { x: number; y: number; vx: number; vy: number }

export type Asteroids = {
  w: number
  h: number
  // The ship, and the way it points, in sixteenths of a turn.
  ship: Body
  heading: number
  // Milliseconds the ship cannot be hit for, after it appears.
  safe: number
  shots: (Body & { ttl: number })[]
  // Rocks of three sizes; a hit one breaks into two of the next size down.
  rocks: (Body & { size: 1 | 2 | 3 })[]
  score: number
  lives: number
  wave: number
  seed: number
  phase: Phase
}

const TURNS = 16
const THRUST = 14
const DRAG = 0.6
const SHOT_SPEED = 46
const SHOT_MS = 900
export const MAX_SHOTS = 4
const SAFE_MS = 2000
const RADIUS: Readonly<Record<number, number>> = { 1: 1.5, 2: 3, 3: 5 }
const POINTS: Readonly<Record<number, number>> = { 1: 100, 2: 50, 3: 20 }

const angleOf = (heading: number): number => (heading / TURNS) * Math.PI * 2
const wrap = (n: number, size: number): number => ((n % size) + size) % size

// A body moved on, around the edges.
const drift = <B extends Body>(s: Pick<Asteroids, 'w' | 'h'>, b: B, dt: number): B => ({
  ...b,
  x: wrap(b.x + b.vx * dt, s.w),
  y: wrap(b.y + b.vy * dt, s.h),
})

// The shortest way between two points on a field that wraps.
const apart = (s: Pick<Asteroids, 'w' | 'h'>, a: Body, b: Body): number => {
  const dx = Math.min(Math.abs(a.x - b.x), s.w - Math.abs(a.x - b.x))
  const dy = Math.min(Math.abs(a.y - b.y), s.h - Math.abs(a.y - b.y))

  return Math.hypot(dx, dy)
}

// A wave's rocks, big ones, in from the edges and away from the middle.
const rocksFor = (s: Pick<Asteroids, 'w' | 'h'>, wave: number, seed: number): { rocks: Asteroids['rocks']; seed: number } => {
  let next = seed
  const rocks = Array.from({ length: Math.min(8, 2 + wave) }, (): Asteroids['rocks'][number] => {
    next = lcg(next)
    const edge = unit(next)
    next = lcg(next)
    const turn = unit(next) * Math.PI * 2
    next = lcg(next)
    const speed = 5 + unit(next) * 6

    return { x: edge < 0.5 ? edge * 2 * s.w : 0, y: edge < 0.5 ? 0 : (edge - 0.5) * 2 * s.h, vx: Math.cos(turn) * speed, vy: Math.sin(turn) * speed, size: 3 }
  })

  return { rocks, seed: next }
}

export const newAsteroids = (w: number, rows: number, seed: number): Asteroids => {
  const field = { w, h: rows * 2 }

  return {
    ...field,
    ship: { x: w / 2, y: rows, vx: 0, vy: 0 },
    heading: 12,
    safe: SAFE_MS,
    shots: [],
    ...rocksFor(field, 1, seed),
    score: 0,
    lives: 3,
    wave: 1,
    phase: 'ready',
  }
}

export const turnShip = (s: Asteroids, by: number): Asteroids => ({ ...s, heading: wrap(s.heading + by, TURNS) })

/** A push the way the ship points. */
export const thrust = (s: Asteroids): Asteroids => {
  const a = angleOf(s.heading)

  return { ...s, ship: { ...s.ship, vx: s.ship.vx + Math.cos(a) * THRUST, vy: s.ship.vy + Math.sin(a) * THRUST } }
}

/** A shot the way the ship points; no more than four at once. */
export const fire = (s: Asteroids): Asteroids => {
  if (s.shots.length >= MAX_SHOTS) return s

  const a = angleOf(s.heading)

  return {
    ...s,
    shots: [...s.shots, { x: s.ship.x + Math.cos(a) * 2, y: s.ship.y + Math.sin(a) * 2, vx: Math.cos(a) * SHOT_SPEED, vy: Math.sin(a) * SHOT_SPEED, ttl: SHOT_MS }],
  }
}

export const stepAsteroids = (s: Asteroids, dt: number): Asteroids => {
  const slow = Math.max(0, 1 - DRAG * dt)
  const ship = drift(s, { ...s.ship, vx: s.ship.vx * slow, vy: s.ship.vy * slow }, dt)
  let shots = s.shots.map(shot => ({ ...drift(s, shot, dt), ttl: shot.ttl - dt * 1000 })).filter(shot => shot.ttl > 0)
  let rocks = s.rocks.map(rock => drift(s, rock, dt))
  let { score, seed } = s

  // A shot breaks the rock it reaches into two smaller ones, flying apart.
  for (const shot of shots) {
    const hit = rocks.findIndex(rock => apart(s, shot, rock) <= (RADIUS[rock.size] ?? 1) + 0.5)
    if (hit < 0) continue

    const rock = rocks[hit] as Asteroids['rocks'][number]
    score += POINTS[rock.size] ?? 0
    shots = shots.filter(other => other !== shot)
    seed = lcg(seed)
    const turn = unit(seed) * Math.PI * 2
    const speed = 8 + below(seed, 6)
    const halves: Asteroids['rocks'] =
      rock.size === 1
        ? []
        : [1, -1].map(side => ({
            x: rock.x,
            y: rock.y,
            vx: rock.vx + Math.cos(turn) * speed * side,
            vy: rock.vy + Math.sin(turn) * speed * side,
            size: (rock.size - 1) as 1 | 2,
          }))
    rocks = [...rocks.filter((_, i) => i !== hit), ...halves]
  }

  const safe = Math.max(0, s.safe - dt * 1000)
  const moved: Asteroids = { ...s, ship, shots, rocks, score, seed, safe }

  if (safe === 0 && rocks.some(rock => apart(s, ship, rock) <= (RADIUS[rock.size] ?? 1) + 1)) {
    const lives = s.lives - 1

    return lives <= 0
      ? { ...moved, lives: 0, phase: 'over' }
      : { ...moved, lives, safe: SAFE_MS, ship: { x: s.w / 2, y: s.h / 2, vx: 0, vy: 0 } }
  }
  if (rocks.length === 0) return { ...moved, ...rocksFor(s, s.wave + 1, seed), wave: s.wave + 1, safe: SAFE_MS }

  return moved
}

export const asteroids: GameDef<Asteroids> = {
  id: 'asteroids',
  label: 'Asteroids',
  glyph: '◇',
  hint: '←→ giran · ↑ empuja · espacio dispara · mouse apunta, clic dispara, derecho empuja',
  minW: 34,
  maxW: 60,
  minRows: 12,
  maxRows: 20,
  create: newAsteroids,
  step: stepAsteroids,
  key: (s, key) => {
    if (key === 'left' || key === 'a') return turnShip(s, -1)
    if (key === 'right' || key === 'd') return turnShip(s, 1)
    if (key === 'up' || key === 'w') return thrust(s)
    if (key === ' ') return fire(s)

    return s
  },
  // The ship points at the pointer; a press fires, a right press pushes.
  pointer: (s, e) => {
    const turn = Math.atan2(e.y * 2 + 1 - s.ship.y, e.x - s.ship.x)
    const aimed = { ...s, heading: wrap(Math.round((turn / (Math.PI * 2)) * TURNS), TURNS) }
    if (e.type !== 'down') return aimed

    return e.button === 'right' ? thrust(aimed) : fire(aimed)
  },
  score: s => s.score,
  hud: (s, color) => [
    { text: 'PUNTOS ', dim: true },
    { text: String(s.score), bold: true },
    { text: `   ${'◆'.repeat(s.lives)}${' '.repeat(Math.max(0, 3 - s.lives))}   `, color },
    { text: `OLEADA ${s.wave}`, dim: true },
  ],
  draw: (s, color) => {
    const f = blank(s.w, s.h / 2)

    // A rock is the outline of a rough circle.
    for (const rock of s.rocks) {
      const r = RADIUS[rock.size] ?? 1
      const corners = rock.size === 1 ? 4 : 8

      for (let i = 0; i < corners; i += 1) {
        const a = (i / corners) * Math.PI * 2
        const b = ((i + 1) / corners) * Math.PI * 2
        // Drawn where it is, not wrapped: a rock on an edge is cut by it rather than smeared across the field.
        line(f, rock.x + Math.cos(a) * r, rock.y + Math.sin(a) * r, rock.x + Math.cos(b) * r, rock.y + Math.sin(b) * r, 'subtle')
      }
    }
    for (const shot of s.shots) plot(f, shot.x, shot.y, 'warning')

    // The ship is a nose and two tails; it blinks while it cannot be hit.
    if (s.phase !== 'over' && (s.safe === 0 || Math.floor(s.safe / 150) % 2 === 0)) {
      const a = angleOf(s.heading)
      const nose = { x: s.ship.x + Math.cos(a) * 2.5, y: s.ship.y + Math.sin(a) * 2.5 }

      for (const side of [2.5, -2.5]) {
        line(f, nose.x, nose.y, s.ship.x + Math.cos(a + side) * 2, s.ship.y + Math.sin(a + side) * 2, color)
      }
      plot(f, nose.x, nose.y, 'text')
    }

    return toRows(f)
  },
}
