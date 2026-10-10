// Tetris: seven pieces from a shuffled bag, a held one, and a shadow of where the piece would land.

import { below, lcg } from './arcade'
import type { GameDef, Phase } from './arcade'
import type { Seg } from './rows'

export const COLS = 10

// Each piece as its cells in a square of its size, and its color. Index 0 is "no piece".
const PIECES: readonly { cells: readonly [number, number][]; size: number; color: string }[] = [
  { cells: [], size: 0, color: 'subtle' },
  { cells: [[0, 1], [1, 1], [2, 1], [3, 1]], size: 4, color: '#22D3EE' },
  { cells: [[0, 0], [1, 0], [0, 1], [1, 1]], size: 2, color: '#FACC15' },
  { cells: [[1, 0], [0, 1], [1, 1], [2, 1]], size: 3, color: '#C084FC' },
  { cells: [[1, 0], [2, 0], [0, 1], [1, 1]], size: 3, color: '#34D399' },
  { cells: [[0, 0], [1, 0], [1, 1], [2, 1]], size: 3, color: '#F87171' },
  { cells: [[0, 0], [0, 1], [1, 1], [2, 1]], size: 3, color: '#60A5FA' },
  { cells: [[2, 0], [0, 1], [1, 1], [2, 1]], size: 3, color: '#FB923C' },
]

export type Piece = { kind: number; turn: number; x: number; y: number }

export type Tetris = {
  w: number
  rows: number
  // The well, `COLS` across and `rows` down: 0 where empty, else the kind of piece that landed there.
  well: number[]
  piece: Piece
  // What comes next, the nearest first.
  queue: number[]
  hold: number
  canHold: boolean
  wait: number
  lines: number
  score: number
  seed: number
  phase: Phase
}

/** The cells a piece covers in the well. */
export const cellsOf = (p: Piece): [number, number][] => {
  const { cells, size } = PIECES[p.kind] as (typeof PIECES)[number]

  return cells.map(([x, y]) => {
    let cx = x
    let cy = y
    // A quarter turn clockwise, `turn` times, within the piece's square.
    for (let i = 0; i < ((p.turn % 4) + 4) % 4; i += 1) [cx, cy] = [size - 1 - cy, cx]

    return [p.x + cx, p.y + cy]
  })
}

const fits = (s: Pick<Tetris, 'well' | 'rows'>, p: Piece): boolean =>
  cellsOf(p).every(([x, y]) => x >= 0 && x < COLS && y < s.rows && (y < 0 || s.well[y * COLS + x] === 0))

/** How long a piece takes to fall a row: shorter each ten lines. */
export const levelOf = (lines: number): number => 1 + Math.floor(lines / 10)
const paceOf = (lines: number): number => Math.max(60, 520 - (levelOf(lines) - 1) * 45)

// The seven kinds in a shuffled order.
const bag = (seed: number): { kinds: number[]; seed: number } => {
  const kinds = [1, 2, 3, 4, 5, 6, 7]
  let next = seed

  for (let i = kinds.length - 1; i > 0; i -= 1) {
    next = lcg(next)
    const j = below(next, i + 1)
    ;[kinds[i], kinds[j]] = [kinds[j] as number, kinds[i] as number]
  }

  return { kinds, seed: next }
}

const enter = (kind: number): Piece => ({ kind, turn: 0, x: Math.floor((COLS - (PIECES[kind]?.size ?? 0)) / 2), y: 0 })

// The next piece from the queue, the queue topped up from a new bag; no room for it ends the game.
const deal = (s: Tetris): Tetris => {
  let { queue, seed } = s
  if (queue.length < 8) {
    const more = bag(seed)
    queue = [...queue, ...more.kinds]
    seed = more.seed
  }

  const piece = enter(queue[0] as number)
  const next: Tetris = { ...s, piece, queue: queue.slice(1), seed, canHold: true, wait: paceOf(s.lines) }

  return fits(next, piece) ? next : { ...next, phase: 'over' }
}

export const newTetris = (w: number, rows: number, seed: number): Tetris =>
  deal({
    w,
    rows,
    well: Array.from({ length: COLS * rows }, () => 0),
    piece: enter(1),
    queue: [],
    hold: 0,
    canHold: true,
    wait: 0,
    lines: 0,
    score: 0,
    seed,
    phase: 'ready',
  })

const POINTS: readonly number[] = [0, 100, 300, 500, 800]

// The piece set into the well, full rows cleared and scored, and the next one dealt.
const land = (s: Tetris): Tetris => {
  const well = [...s.well]
  for (const [x, y] of cellsOf(s.piece)) if (y >= 0) well[y * COLS + x] = s.piece.kind

  const kept = Array.from({ length: s.rows }, (_, y) => well.slice(y * COLS, (y + 1) * COLS)).filter(row => row.some(n => n === 0))
  const cleared = s.rows - kept.length
  const empty = Array.from({ length: cleared * COLS }, () => 0)

  return deal({
    ...s,
    well: [...empty, ...kept.flat()],
    lines: s.lines + cleared,
    score: s.score + (POINTS[cleared] ?? 0) * levelOf(s.lines),
  })
}

/** The piece moved by (dx, dy) if it fits there. */
export const shift = (s: Tetris, dx: number, dy: number): Tetris => {
  const piece = { ...s.piece, x: s.piece.x + dx, y: s.piece.y + dy }

  return fits(s, piece) ? { ...s, piece } : s
}

/** The piece turned a quarter, nudged sideways (or up) off a wall or the pile if it has to be. */
export const rotate = (s: Tetris, by: 1 | -1): Tetris => {
  for (const [dx, dy] of [[0, 0], [-1, 0], [1, 0], [-2, 0], [2, 0], [0, -1]] as const) {
    const piece = { ...s.piece, turn: s.piece.turn + by, x: s.piece.x + dx, y: s.piece.y + dy }
    if (fits(s, piece)) return { ...s, piece }
  }

  return s
}

/** Where the piece would land if dropped. */
export const shadow = (s: Tetris): Piece => {
  let piece = s.piece
  while (fits(s, { ...piece, y: piece.y + 1 })) piece = { ...piece, y: piece.y + 1 }

  return piece
}

export const drop = (s: Tetris): Tetris => {
  const piece = shadow(s)

  return land({ ...s, piece, score: s.score + (piece.y - s.piece.y) * 2 })
}

// A row down, or the piece lands when it cannot fall.
const fall = (s: Tetris): Tetris => {
  const down = shift(s, 0, 1)

  return down === s ? land(s) : { ...down, wait: paceOf(s.lines) }
}

/** Sets the piece aside and brings in the one set aside before (or the next); once per piece. */
export const holdPiece = (s: Tetris): Tetris => {
  if (!s.canHold) return s
  if (s.hold === 0) return { ...deal({ ...s, hold: s.piece.kind }), canHold: false }

  const piece = enter(s.hold)

  return fits(s, piece) ? { ...s, piece, hold: s.piece.kind, canHold: false } : s
}

export const stepTetris = (s: Tetris, dt: number): Tetris => {
  let now = { ...s, wait: s.wait - dt * 1000 }
  while (now.wait <= 0 && now.phase === 'playing') now = fall(now)

  return now
}

const small = (kind: number): string[] => {
  const cells = cellsOf({ kind, turn: 0, x: 0, y: 0 })

  return [0, 1].map(y => [0, 1, 2, 3].map(x => (cells.some(([cx, cy]) => cx === x && cy === y) ? '██' : '  ')).join(''))
}

export const tetris: GameDef<Tetris> = {
  id: 'tetris',
  label: 'Tetris',
  glyph: '▟',
  hint: '←→ mueven · ↑/x giran · z al revés · ↓ baja · espacio cae · c guarda',
  minW: 34,
  maxW: 34,
  minRows: 14,
  maxRows: 20,
  create: newTetris,
  step: stepTetris,
  key: (s, key) => {
    if (key === 'left' || key === 'a') return shift(s, -1, 0)
    if (key === 'right' || key === 'd') return shift(s, 1, 0)
    if (key === 'down' || key === 's') return fall(s)
    if (key === 'up' || key === 'x' || key === 'w') return rotate(s, 1)
    if (key === 'z') return rotate(s, -1)
    if (key === ' ') return drop(s)
    if (key === 'c') return holdPiece(s)

    return s
  },
  // A press beside the well's middle moves the piece that way, one on the middle turns it; a right press drops it.
  pointer: (s, e) => {
    if (e.type !== 'down') return s
    if (e.button === 'right') return drop(s)

    const col = Math.floor(e.x / 2)

    return col < 3 ? shift(s, -1, 0) : col > 6 ? shift(s, 1, 0) : rotate(s, 1)
  },
  score: s => s.score,
  hud: s => [
    { text: 'TETRIS  ', dim: true },
    { text: String(s.score), bold: true },
    { text: `  nivel ${levelOf(s.lines)} · ${s.lines} líneas`, dim: true },
  ],
  draw: s => {
    const falling = cellsOf(s.piece)
    const ghost = cellsOf(shadow(s))
    const next = small(s.queue[0] ?? 0)
    const held = small(s.hold)
    // The panel beside the well: what comes next, and what is held.
    const side: Readonly<Record<number, Seg>> = {
      0: { text: '  sigue', dim: true },
      1: { text: `  ${next[0]}`, color: PIECES[s.queue[0] ?? 0]?.color },
      2: { text: `  ${next[1]}`, color: PIECES[s.queue[0] ?? 0]?.color },
      4: { text: '  guardada', dim: true },
      5: { text: `  ${held[0]}`, color: PIECES[s.hold]?.color },
      6: { text: `  ${held[1]}`, color: PIECES[s.hold]?.color },
    }

    return Array.from({ length: s.rows }, (_, y): Seg[] => [
      { text: '│', color: 'subtle' },
      ...Array.from({ length: COLS }, (_, x): Seg => {
        if (falling.some(([cx, cy]) => cx === x && cy === y)) return { text: '██', color: PIECES[s.piece.kind]?.color }

        const set = s.well[y * COLS + x] as number
        if (set !== 0) return { text: '██', color: PIECES[set]?.color, dim: s.phase === 'over' }
        if (ghost.some(([cx, cy]) => cx === x && cy === y)) return { text: '░░', color: PIECES[s.piece.kind]?.color, dim: true }

        return { text: ' ·', color: 'subtle', dim: true }
      }),
      { text: '│', color: 'subtle' },
      side[y] ?? { text: '' },
    ])
  },
}
