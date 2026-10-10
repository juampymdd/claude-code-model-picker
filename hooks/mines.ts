// Minesweeper: the first cell opened is never a mine.

import { below, clamp, lcg } from './arcade'
import type { GameDef, Phase } from './arcade'
import type { Seg } from './rows'

export type Mines = {
  w: number
  rows: number
  // The board: cells across and down, and how many mines.
  cols: number
  lines: number
  count: number
  // Per cell, row-major. The mines are laid at the first cell opened.
  mines: boolean[]
  open: boolean[]
  flags: boolean[]
  isLaid: boolean
  cursor: number
  ms: number
  isWon: boolean
  seed: number
  phase: Phase
}

// The board the field has room for: each cell is two columns wide.
const boardFor = (w: number, rows: number): { cols: number; lines: number; count: number } => {
  if (w >= 60 && rows >= 16) return { cols: 30, lines: 16, count: 99 }
  if (w >= 32 && rows >= 16) return { cols: 16, lines: 16, count: 40 }

  return { cols: 9, lines: 9, count: 10 }
}

const around = (s: Pick<Mines, 'cols' | 'lines'>, at: number): number[] => {
  const x = at % s.cols
  const y = Math.floor(at / s.cols)
  const out: number[] = []

  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      const nx = x + dx
      const ny = y + dy
      if ((dx !== 0 || dy !== 0) && nx >= 0 && ny >= 0 && nx < s.cols && ny < s.lines) out.push(ny * s.cols + nx)
    }
  }

  return out
}

/** How many mines touch a cell. */
export const near = (s: Mines, at: number): number => around(s, at).filter(i => s.mines[i]).length

export const newMines = (w: number, rows: number, seed: number): Mines => {
  const board = boardFor(w, rows)
  const cells = board.cols * board.lines
  const none = (): boolean[] => Array.from({ length: cells }, () => false)

  return { w, rows, ...board, mines: none(), open: none(), flags: none(), isLaid: false, cursor: 0, ms: 0, isWon: false, seed, phase: 'ready' }
}

// The mines, anywhere but the first cell opened and the ones around it.
const lay = (s: Mines, first: number): Mines => {
  const safe = new Set([first, ...around(s, first)])
  const mines = [...s.mines]
  let seed = s.seed
  let left = Math.min(s.count, mines.length - safe.size)

  while (left > 0) {
    seed = lcg(seed)
    const at = below(seed, mines.length)
    if (!mines[at] && !safe.has(at)) {
      mines[at] = true
      left -= 1
    }
  }

  return { ...s, mines, seed, isLaid: true }
}

/** Opens a cell: a mine ends the game, a cell with none around opens its neighbors, and the last safe cell wins it. */
export const openCell = (s: Mines, at: number): Mines => {
  if (at < 0 || at >= s.open.length || s.open[at] || s.flags[at]) return s

  const laid = s.isLaid ? s : lay(s, at)
  if (laid.mines[at]) return { ...laid, open: laid.open.map((is, i) => is || i === at), phase: 'over' }

  const open = [...laid.open]
  const queue = [at]
  while (queue.length > 0) {
    const cell = queue.pop() as number
    if (open[cell] || laid.flags[cell]) continue

    open[cell] = true
    if (near(laid, cell) === 0) queue.push(...around(laid, cell))
  }

  const isWon = open.every((is, i) => is || laid.mines[i])

  return { ...laid, open, isWon, phase: isWon ? 'over' : laid.phase }
}

export const flagCell = (s: Mines, at: number): Mines =>
  s.open[at] ? s : { ...s, flags: s.flags.map((is, i) => (i === at ? !is : is)) }

/** On an open number with that many flags around it, opens the rest around it. */
export const chord = (s: Mines, at: number): Mines => {
  if (!s.open[at] || around(s, at).filter(i => s.flags[i]).length !== near(s, at)) return s

  return around(s, at).reduce((now, i) => (now.phase === 'over' ? now : openCell(now, i)), s)
}

const DIGITS: readonly string[] = ['', '#38BDF8', '#34D399', '#F87171', '#C084FC', '#FB923C', '#22D3EE', '#E4E4E7', '#A1A1AA']
const MOVES: Readonly<Record<string, [number, number]>> = { left: [-1, 0], a: [-1, 0], right: [1, 0], d: [1, 0], up: [0, -1], w: [0, -1], down: [0, 1], s: [0, 1] }

export const mines: GameDef<Mines> = {
  id: 'mines',
  label: 'Buscaminas',
  glyph: '✸',
  hint: 'clic abre · clic derecho marca · flechas + espacio abre · f marca · r reinicia',
  minW: 20,
  maxW: 62,
  minRows: 9,
  maxRows: 16,
  every: 250,
  create: newMines,
  // Only the clock moves by itself.
  step: (s, dt) => (s.isLaid ? { ...s, ms: s.ms + dt * 1000 } : s),
  key: (s, key) => {
    const move = MOVES[key]
    if (move !== undefined) {
      const x = clamp((s.cursor % s.cols) + move[0], 0, s.cols - 1)
      const y = clamp(Math.floor(s.cursor / s.cols) + move[1], 0, s.lines - 1)

      return { ...s, cursor: y * s.cols + x }
    }
    if (key === ' ') return s.open[s.cursor] ? chord(s, s.cursor) : openCell(s, s.cursor)
    if (key === 'f') return flagCell(s, s.cursor)

    return s
  },
  pointer: (s, e) => {
    const x = Math.floor(e.x / 2)
    if (e.type !== 'down' || x < 0 || x >= s.cols || e.y < 0 || e.y >= s.lines) return s

    const at = e.y * s.cols + x
    const here = { ...s, cursor: at }
    if (e.button === 'right') return flagCell(here, at)

    return s.open[at] ? chord(here, at) : openCell(here, at)
  },
  // A board cleared scores more the sooner it was.
  score: s => (s.isWon ? Math.max(1, 999 - Math.floor(s.ms / 1000)) : 0),
  hud: s => [
    { text: 'MINAS ', dim: true },
    { text: String(s.count - s.flags.filter(Boolean).length), bold: true },
    { text: `   ${Math.floor(s.ms / 1000)}s`, dim: true },
  ],
  over: s => (s.isWon ? 'DESPEJADO' : 'BOOM'),
  draw: s =>
    Array.from({ length: s.lines }, (_, y): Seg[] =>
      Array.from({ length: s.cols }, (_, x): Seg => {
        const at = y * s.cols + x
        const fill = at === s.cursor ? { fill: '#3F3F46' } : {}

        if (s.phase === 'over' && s.mines[at] && !s.isWon) return { text: '✸ ', color: 'error', ...fill }
        if (s.flags[at]) return { text: '⚑ ', color: 'warning', ...fill }
        if (!s.open[at]) return { text: '▒▒', color: 'subtle', ...fill }

        const n = near(s, at)

        return n === 0 ? { text: '  ', ...fill } : { text: `${n} `, color: DIGITS[n] ?? 'text', bold: true, ...fill }
      }),
    ),
}
