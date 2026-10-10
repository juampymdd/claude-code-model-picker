// Frogger, in cells: across five lanes of traffic and a river of logs to five homes.

import { clamp } from './arcade'
import type { GameDef, Phase } from './arcade'
import type { Seg } from './rows'

// What runs along each row: its pattern (repeated end to end) and how many cells a second, leftward when negative.
type Lane = { pattern: string; speed: number }

// Top to bottom: the homes, the river (a frog must be on a log), the bank,
// the road (a frog must not be on a car), and the start.
const RIVER: readonly Lane[] = [
  { pattern: '▬▬▬▬▬      ▬▬▬▬       ', speed: 5 },
  { pattern: '▬▬▬     ▬▬▬▬     ▬▬▬   ', speed: -4 },
  { pattern: '▬▬▬▬▬▬        ▬▬▬▬▬    ', speed: 7 },
  { pattern: '▬▬▬▬    ▬▬▬      ▬▬▬▬  ', speed: -5 },
  { pattern: '▬▬▬▬▬     ▬▬▬▬▬▬       ', speed: 4 },
]
const ROAD: readonly Lane[] = [
  { pattern: '▄▄          ▄▄        ', speed: -8 },
  { pattern: '▄▄▄       ▄▄▄         ', speed: 6 },
  { pattern: '▄▄      ▄▄       ▄▄   ', speed: -10 },
  { pattern: '▄▄▄▄            ▄▄▄▄  ', speed: 5 },
  { pattern: '▄▄        ▄▄          ', speed: -6 },
]

export const HOMES = 5
export const HOME_ROW = 0
const RIVER_TOP = 1
export const BANK_ROW = RIVER_TOP + RIVER.length
const ROAD_TOP = BANK_ROW + 1
export const START_ROW = ROAD_TOP + ROAD.length
export const FROG_ROWS = START_ROW + 1
const TIME_MS = 30_000
const CARS: readonly string[] = ['#F87171', '#FBBF24', '#C084FC', '#38BDF8', '#FB923C']

export type Frogger = {
  w: number
  rows: number
  frog: { x: number; y: number }
  // Seconds the lanes have run.
  t: number
  homes: boolean[]
  lives: number
  score: number
  left: number
  level: number
  // The highest row this frog reached, which a hop past scores.
  reached: number
  phase: Phase
}

const laneAt = (y: number): Lane | undefined => (y >= RIVER_TOP && y < BANK_ROW ? RIVER[y - RIVER_TOP] : ROAD[y - ROAD_TOP])
const pace = (s: Pick<Frogger, 'level'>): number => 1 + (s.level - 1) * 0.15

/** What a lane holds at column `x` now: a glyph, or a space. */
export const lookAt = (s: Pick<Frogger, 't' | 'level'>, y: number, x: number): string => {
  const lane = laneAt(y)
  if (lane === undefined) return ' '

  const size = lane.pattern.length
  const at = Math.floor(x - lane.speed * pace(s) * s.t)

  return lane.pattern[((at % size) + size) % size] ?? ' '
}

/** The column of each home. */
export const homeAt = (s: Pick<Frogger, 'w'>, i: number): number => Math.round(((i + 0.5) * s.w) / HOMES)

const start = (s: Pick<Frogger, 'w'>): Pick<Frogger, 'frog' | 'left' | 'reached'> => ({
  frog: { x: Math.floor(s.w / 2), y: START_ROW },
  left: TIME_MS,
  reached: START_ROW,
})

export const newFrogger = (w: number, rows: number): Frogger => ({
  w,
  rows,
  ...start({ w }),
  t: 0,
  homes: Array.from({ length: HOMES }, () => false),
  lives: 3,
  score: 0,
  level: 1,
  phase: 'ready',
})

const die = (s: Frogger): Frogger => {
  const lives = s.lives - 1

  return lives <= 0 ? { ...s, lives: 0, phase: 'over' } : { ...s, lives, ...start(s) }
}

// A frog on the homes' row: into a free home, or lost.
const arrive = (s: Frogger): Frogger => {
  const i = Array.from({ length: HOMES }, (_, n) => n).find(n => Math.abs(homeAt(s, n) - s.frog.x) <= 1 && !s.homes[n])
  if (i === undefined) return die(s)

  const homes = s.homes.map((is, n) => is || n === i)
  const score = s.score + 200 + Math.floor(s.left / 1000) * 5

  return homes.every(Boolean)
    ? { ...s, ...start(s), homes: homes.map(() => false), score: score + 1000, level: s.level + 1 }
    : { ...s, ...start(s), homes, score }
}

/** A hop: two cells sideways, a row up or down. A row not reached before scores. */
export const hop = (s: Frogger, dx: number, dy: number): Frogger => {
  const frog = { x: clamp(s.frog.x + dx * 2, 0, s.w - 1), y: clamp(s.frog.y + dy, HOME_ROW, START_ROW) }
  const reached = Math.min(s.reached, frog.y)
  const hopped: Frogger = { ...s, frog, reached, score: s.score + (reached < s.reached ? 10 : 0) }

  return frog.y === HOME_ROW ? arrive(hopped) : hopped
}

export const stepFrogger = (s: Frogger, dt: number): Frogger => {
  const lane = laneAt(s.frog.y)
  const onRiver = s.frog.y >= RIVER_TOP && s.frog.y < BANK_ROW
  // A frog on the river rides what it stands on.
  const x = onRiver && lane !== undefined ? s.frog.x + lane.speed * pace(s) * dt : s.frog.x
  const now: Frogger = { ...s, t: s.t + dt, left: s.left - dt * 1000, frog: { x, y: s.frog.y } }

  if (now.left <= 0 || x < 0 || x > s.w - 1) return die(now)

  const under = lookAt(now, now.frog.y, x)
  if (onRiver ? under === ' ' : lane !== undefined && under !== ' ') return die(now)

  return now
}

const MOVES: Readonly<Record<string, [number, number]>> = { left: [-1, 0], a: [-1, 0], right: [1, 0], d: [1, 0], up: [0, -1], w: [0, -1], down: [0, 1], s: [0, 1] }

export const frogger: GameDef<Frogger> = {
  id: 'frogger',
  label: 'Frogger',
  glyph: '☻',
  hint: 'flechas o wasd saltan · clic salta hacia ahí · p pausa · r reinicia',
  minW: 30,
  maxW: 60,
  minRows: FROG_ROWS,
  maxRows: FROG_ROWS,
  create: newFrogger,
  step: stepFrogger,
  key: (s, key) => (MOVES[key] === undefined ? s : hop(s, MOVES[key]?.[0] ?? 0, MOVES[key]?.[1] ?? 0)),
  // A press hops toward it, along the axis it is furthest on.
  pointer: (s, e) => {
    if (e.type !== 'down') return s

    const dx = e.x - s.frog.x
    const dy = e.y - s.frog.y

    return Math.abs(dy) >= Math.abs(dx) / 2 ? hop(s, 0, Math.sign(dy)) : hop(s, Math.sign(dx), 0)
  },
  score: s => s.score,
  hud: (s, color) => [
    { text: 'PUNTOS ', dim: true },
    { text: String(s.score), bold: true },
    { text: `   ${'◆'.repeat(s.lives)}${' '.repeat(Math.max(0, 3 - s.lives))}   `, color },
    { text: `tiempo ${Math.max(0, Math.ceil(s.left / 1000))}s`, ...(s.left < 8000 ? { color: 'error' } : { dim: true }) },
    { text: `   nivel ${s.level}`, dim: true },
  ],
  draw: s => {
    const frogX = Math.round(s.frog.x)

    return Array.from({ length: FROG_ROWS }, (_, y): Seg[] => {
      const isRiver = y >= RIVER_TOP && y < BANK_ROW
      const isRoad = y >= ROAD_TOP && y < START_ROW
      let text = ''

      for (let x = 0; x < s.w; x += 1) {
        if (y === HOME_ROW) {
          const home = Array.from({ length: HOMES }, (_, n) => n).find(n => homeAt(s, n) === x)
          text += home === undefined ? '▀' : s.homes[home] ? '☻' : ' '
        } else {
          text += isRiver || isRoad ? lookAt(s, y, x) : y === BANK_ROW || y === START_ROW ? '░' : ' '
        }
      }

      const look: Seg = isRiver
        ? { text, color: '#B45309', fill: '#1E3A5F' }
        : isRoad
          ? { text, color: CARS[y - ROAD_TOP] ?? 'text' }
          : { text, color: y === HOME_ROW ? 'success' : 'subtle' }
      if (y !== s.frog.y) return [look]

      const glyphs = [...text]

      // The frog over whatever its row holds.
      return [
        { ...look, text: glyphs.slice(0, frogX).join('') },
        { text: '☻', color: 'success', bold: true, ...(isRiver ? { fill: '#1E3A5F' } : {}) },
        { ...look, text: glyphs.slice(frogX + 1).join('') },
      ]
    })
  },
}
