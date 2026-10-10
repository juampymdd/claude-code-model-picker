// The runner: jump the cactuses, duck under the birds. In pixels.

import { below, lcg } from './arcade'
import type { GameDef, Phase } from './arcade'
import { blank, rect, toRows } from './pixels'

export type Dino = {
  w: number
  h: number
  // How high the runner's feet are off the ground, and how fast it rises.
  lift: number
  vy: number
  // Milliseconds left of a duck (a terminal sends no key release).
  duck: number
  // What is coming: where, how wide and tall, and how far off the ground.
  things: { x: number; w: number; h: number; lift: number }[]
  run: number
  seed: number
  phase: Phase
}

export const DINO_X = 6
const DINO_W = 3
const TALL = 4
const LOW = 2
const GRAVITY = 150
const JUMP = 52
const DUCK_MS = 600
const GROUND = 2

/** How fast the ground runs: faster the further the runner got. */
export const speedOf = (run: number): number => Math.min(70, 28 + run / 45)

// What comes next, `gap` pixels on: a cactus on the ground, or (later on) a bird to duck under.
const spawn = (s: Pick<Dino, 'run'>, from: number, seed: number): Dino['things'][number] => {
  const x = from + 26 + below(seed, 22) + speedOf(s.run) * 0.4

  return s.run > 120 && below(lcg(seed), 4) === 0
    ? { x, w: 4, h: 2, lift: 3 }
    : { x, w: 2 + below(lcg(seed), 2), h: 3 + below(lcg(lcg(seed)), 2), lift: 0 }
}

export const newDino = (w: number, rows: number, seed: number): Dino => ({
  w,
  h: rows * 2,
  lift: 0,
  vy: 0,
  duck: 0,
  things: [spawn({ run: 0 }, w, seed)],
  run: 0,
  seed: lcg(seed),
  phase: 'ready',
})

/** Jumps, from the ground only. */
export const jump = (s: Dino): Dino => (s.lift > 0 ? s : { ...s, vy: JUMP, duck: 0 })
export const duck = (s: Dino): Dino => (s.lift > 0 ? { ...s, vy: Math.min(s.vy, -JUMP) } : { ...s, duck: DUCK_MS })

export const stepDino = (s: Dino, dt: number): Dino => {
  const speed = speedOf(s.run)
  const vy = s.lift > 0 || s.vy > 0 ? s.vy - GRAVITY * dt : 0
  const lift = Math.max(0, s.lift + vy * dt)
  let seed = s.seed

  let things = s.things.map(thing => ({ ...thing, x: thing.x - speed * dt })).filter(thing => thing.x + thing.w > 0)
  const last = things[things.length - 1]
  if (last === undefined || last.x < s.w) {
    seed = lcg(seed)
    things = [...things, spawn(s, Math.max(s.w, last?.x ?? s.w), seed)]
  }

  const tall = s.duck > 0 && lift === 0 ? LOW : TALL
  const hits = things.some(
    thing => thing.x < DINO_X + DINO_W && thing.x + thing.w > DINO_X && lift < thing.lift + thing.h && lift + tall > thing.lift,
  )
  const moved: Dino = { ...s, lift, vy: lift === 0 ? 0 : vy, duck: Math.max(0, s.duck - dt * 1000), things, run: s.run + speed * dt, seed }

  return hits ? { ...moved, phase: 'over' } : moved
}

export const dino: GameDef<Dino> = {
  id: 'dino',
  label: 'Dino',
  glyph: '▙',
  hint: 'espacio o ↑ salta · ↓ se agacha · clic salta · p pausa · r reinicia',
  minW: 30,
  maxW: 60,
  minRows: 7,
  maxRows: 10,
  create: newDino,
  step: stepDino,
  key: (s, key) => {
    if (key === ' ' || key === 'up' || key === 'w') return jump(s)
    if (key === 'down' || key === 's') return duck(s)

    return s
  },
  pointer: (s, e) => (e.type === 'down' ? jump(s) : s),
  score: s => Math.floor(s.run / 4),
  hud: s => [
    { text: 'DINO  ', dim: true },
    { text: String(Math.floor(s.run / 4)), bold: true },
  ],
  draw: (s, color) => {
    const f = blank(s.w, s.h / 2)
    const floor = s.h - GROUND
    const tall = s.duck > 0 && s.lift === 0 ? LOW : TALL

    rect(f, 0, floor, s.w, 1, 'subtle')
    for (const thing of s.things) {
      rect(f, Math.round(thing.x), floor - thing.lift - thing.h, thing.w, thing.h, thing.lift > 0 ? 'warning' : 'success')
    }
    rect(f, DINO_X, floor - Math.round(s.lift) - tall, DINO_W, tall, s.phase === 'over' ? 'error' : color)

    return toRows(f)
  },
}
