// What every game of the stats pane is, so the module that runs them knows
// none of them: a state, and the functions that make, move and draw it.

import type { Phase } from './pong'
import type { Seg } from './rows'

export type { Phase } from './pong'

export type Pointer = { type: 'down' | 'move' | 'up'; x: number; y: number; button?: 'left' | 'middle' | 'right' }

// What the mod knows of the session, for the games made of it.
export type GameData = {
  cost: number
  tools: { name: string; count: number; errors: number }[]
  agents: { id: string; type: string; model: string; steps: number; cost: number; state: 'live' | 'done' | 'failed' }[]
}

export const NO_DATA: GameData = { cost: 0, tools: [], agents: [] }

export type Playable = { phase: Phase }

export type GameDef<S extends Playable> = {
  id: string
  label: string
  glyph: string
  // The line of keys under the field.
  hint: string
  // The field it can be played in: cells across and rows of text down.
  minW: number
  maxW: number
  minRows: number
  maxRows: number
  // A game with no score worth keeping.
  noRecord?: boolean
  // Milliseconds between its steps, when it needs fewer than the module's own twenty a second.
  every?: number
  // It draws its own notices (waiting, paused, over).
  ownNotice?: boolean
  create: (w: number, rows: number, seed: number, data: GameData) => S
  // Absent for a game that only moves when played.
  step?: (s: S, dt: number, data: GameData) => S
  key: (s: S, key: string) => S
  // The pointer over the field, in its cells.
  pointer: (s: S, e: Pointer) => S
  score: (s: S) => number
  // The line above the field, and the field itself: `w` cells by `rows` rows.
  hud?: (s: S, color: string, data: GameData) => Seg[]
  draw: (s: S, color: string, data: GameData) => Seg[][]
  // What a finished game says, when not just that it is over.
  over?: (s: S) => string
}

export const clamp = (n: number, low: number, high: number): number => Math.min(high, Math.max(low, n))

/** The next number of a seeded sequence, and that number as a fraction of one. */
export const lcg = (seed: number): number => (Math.imul(seed, 1664525) + 1013904223) >>> 0
export const unit = (seed: number): number => seed / 4294967296
/** A whole number below `n` from a seed. */
export const below = (seed: number, n: number): number => Math.floor(unit(seed) * n)

const SPACE = ' '
const normal = (key: string): string => (key === 'space' ? SPACE : key.length === 1 ? key.toLowerCase() : key)

/**
 * A key, as every game takes it: `r` starts over, `p` or Enter pause and
 * resume, space starts a game that waits and resumes a paused one, and
 * anything else is the game's own (starting it if it waited).
 */
export const pressKey = <S extends Playable>(def: GameDef<S>, s: S, key: string, fresh: () => S): S => {
  const k = normal(key)

  if (k === 'r') return { ...fresh(), phase: 'playing' }
  if (s.phase === 'over') return k === SPACE || k === 'return' ? { ...fresh(), phase: 'playing' } : s
  if (k === 'p' || k === 'return') return { ...s, phase: s.phase === 'playing' ? 'paused' : 'playing' }
  if (s.phase === 'paused') return k === SPACE ? { ...s, phase: 'playing' } : s
  if (s.phase === 'ready') return k === SPACE ? { ...s, phase: 'playing' } : def.key({ ...s, phase: 'playing' }, k)

  return def.key(s, k)
}

/** The pointer, as every game takes it: a press starts, resumes or restarts; the rest is the game's own while it runs. */
export const pressPointer = <S extends Playable>(def: GameDef<S>, s: S, e: Pointer, fresh: () => S): S => {
  if (e.type === 'down') {
    if (s.phase === 'over') return { ...fresh(), phase: 'playing' }
    if (s.phase === 'paused') return { ...s, phase: 'playing' }
    if (s.phase === 'ready') return def.pointer({ ...s, phase: 'playing' }, e)
  }

  return s.phase === 'playing' ? def.pointer(s, e) : s
}

const centered = (text: string, w: number, color?: string): Seg[] => {
  const glyphs = [...text].slice(0, w)
  const left = Math.floor((w - glyphs.length) / 2)

  return [
    { text: ' '.repeat(left) },
    { text: glyphs.join(''), bold: true, ...(color === undefined ? {} : { color }) },
    { text: ' '.repeat(Math.max(0, w - left - glyphs.length)) },
  ]
}

const NOTICE: Readonly<Record<Exclude<Phase, 'playing' | 'over'>, string>> = {
  ready: 'clic o espacio para jugar',
  paused: 'PAUSA · espacio sigue',
}

/** A game as it is shown: its line above, its field with a notice over it while it is not played, and its keys. */
export const screenOf = <S extends Playable>(def: GameDef<S>, s: S, w: number, color: string, data: GameData): Seg[][] => {
  const field = def.draw(s, color, data)
  const middle = Math.max(0, Math.floor(field.length / 2) - 1)

  if (def.ownNotice !== true && s.phase !== 'playing') {
    if (s.phase === 'over') {
      field[middle] = centered(def.over?.(s) ?? 'GAME OVER', w, 'error')
      if (field[middle + 1] !== undefined) field[middle + 1] = centered('r para otra', w)
    } else {
      field[middle] = centered(NOTICE[s.phase], w)
    }
  }

  return [...(def.hud === undefined ? [] : [def.hud(s, color, data)]), ...field, [{ text: def.hint, dim: true }]]
}
