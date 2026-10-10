// 2048: slide the tiles, like ones merge.

import { below, lcg } from './arcade'
import type { GameDef, Phase, Pointer } from './arcade'
import type { Seg } from './rows'

export type G2048 = {
  w: number
  rows: number
  // Sixteen cells, row-major; 0 is an empty one.
  cells: number[]
  score: number
  seed: number
  // Where a drag of the pointer began.
  from: { x: number; y: number } | null
  phase: Phase
}

type Dir = 'left' | 'right' | 'up' | 'down'

const SIZE = 4
const TILE_W = 6

/** A row slid to the left: tiles close up and like neighbors merge once; with what the merges are worth. */
export const slide = (line: readonly number[]): { line: number[]; gained: number } => {
  const tiles = line.filter(n => n !== 0)
  const out: number[] = []
  let gained = 0

  for (let i = 0; i < tiles.length; i += 1) {
    if (tiles[i] === tiles[i + 1]) {
      out.push((tiles[i] as number) * 2)
      gained += (tiles[i] as number) * 2
      i += 1
    } else {
      out.push(tiles[i] as number)
    }
  }

  return { line: [...out, ...Array.from({ length: line.length - out.length }, () => 0)], gained }
}

// The cells of each row or column, in the order a slide toward `dir` reads them.
const lanes = (dir: Dir): number[][] =>
  Array.from({ length: SIZE }, (_, i) =>
    Array.from({ length: SIZE }, (_, j) => {
      const k = dir === 'left' || dir === 'up' ? j : SIZE - 1 - j

      return dir === 'left' || dir === 'right' ? i * SIZE + k : k * SIZE + i
    }),
  )

const shift = (cells: readonly number[], dir: Dir): { cells: number[]; gained: number } => {
  const next = [...cells]
  let gained = 0

  for (const lane of lanes(dir)) {
    const slid = slide(lane.map(i => cells[i] as number))
    gained += slid.gained
    lane.forEach((at, i) => (next[at] = slid.line[i] as number))
  }

  return { cells: next, gained }
}

// A 2 (or, one time in ten, a 4) on a free cell.
const drop = (cells: readonly number[], seed: number): { cells: number[]; seed: number } => {
  const free = cells.flatMap((n, i) => (n === 0 ? [i] : []))
  if (free.length === 0) return { cells: [...cells], seed }

  const a = lcg(seed)
  const b = lcg(a)
  const next = [...cells]
  next[free[below(a, free.length)] as number] = below(b, 10) === 0 ? 4 : 2

  return { cells: next, seed: b }
}

const canMove = (cells: readonly number[]): boolean =>
  (['left', 'right', 'up', 'down'] as const).some(dir => shift(cells, dir).cells.some((n, i) => n !== cells[i]))

export const new2048 = (w: number, rows: number, seed: number): G2048 => {
  const one = drop(Array.from({ length: SIZE * SIZE }, () => 0), seed)
  const two = drop(one.cells, one.seed)

  return { w, rows, cells: two.cells, score: 0, seed: two.seed, from: null, phase: 'ready' }
}

/** A slide toward `dir`; one that moves nothing changes nothing. */
export const move2048 = (s: G2048, dir: Dir): G2048 => {
  const slid = shift(s.cells, dir)
  if (!slid.cells.some((n, i) => n !== s.cells[i])) return s

  const dropped = drop(slid.cells, s.seed)

  return { ...s, ...dropped, score: s.score + slid.gained, phase: canMove(dropped.cells) ? s.phase : 'over' }
}

const KEYS: Readonly<Record<string, Dir>> = { left: 'left', a: 'left', right: 'right', d: 'right', up: 'up', w: 'up', down: 'down', s: 'down' }

// A tile's fill and ink by its value.
const tint = (n: number): { fill: string; ink: string } => {
  if (n === 0) return { fill: '#27272A', ink: '#52525B' }
  if (n <= 4) return { fill: '#E4E4E7', ink: '#18181B' }
  if (n <= 16) return { fill: '#FDBA74', ink: '#18181B' }
  if (n <= 64) return { fill: '#FB923C', ink: '#18181B' }
  if (n <= 512) return { fill: '#F87171', ink: '#18181B' }

  return { fill: '#FACC15', ink: '#18181B' }
}

const drag = (s: G2048, e: Pointer): G2048 => {
  if (e.type === 'down') return { ...s, from: { x: e.x, y: e.y } }
  if (e.type !== 'up' || s.from === null) return s

  const dx = e.x - s.from.x
  const dy = (e.y - s.from.y) * 2
  const still = { ...s, from: null }
  if (Math.abs(dx) < 2 && Math.abs(dy) < 2) return still

  return move2048(still, Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up')
}

export const g2048: GameDef<G2048> = {
  id: '2048',
  label: '2048',
  glyph: '▦',
  hint: 'flechas o wasd deslizan · arrastrar con el mouse · r reinicia',
  minW: 26,
  maxW: 26,
  minRows: 8,
  maxRows: 8,
  create: new2048,
  key: (s, key) => (KEYS[key] === undefined ? s : move2048(s, KEYS[key] as Dir)),
  pointer: drag,
  score: s => s.score,
  hud: s => [
    { text: '2048  ', dim: true },
    { text: String(s.score), bold: true },
    { text: `  mayor ${Math.max(...s.cells)}`, dim: true },
  ],
  over: () => 'SIN MOVIMIENTOS',
  // Each tile is two rows of text: a blank one over the one with its number.
  draw: s =>
    Array.from({ length: SIZE * 2 }, (_, line): Seg[] => {
      const row = Math.floor(line / 2)

      return [
        { text: ' ' },
        ...Array.from({ length: SIZE }, (_, col): Seg => {
          const n = s.cells[row * SIZE + col] as number
          const { fill, ink } = tint(n)
          const label = line % 2 === 0 || n === 0 ? '' : String(n)
          const left = Math.floor((TILE_W - label.length) / 2)

          return { text: ' '.repeat(left) + label + ' '.repeat(TILE_W - left - label.length), fill, color: ink, bold: true }
        }),
        { text: ' ' },
      ]
    }),
}
