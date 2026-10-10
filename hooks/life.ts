// Conway's Game of Life, on a board that wraps at its edges. Drawn on with the pointer.

import { below, clamp, lcg } from './arcade'
import type { GameDef, Phase } from './arcade'
import { blank, plot, toRows } from './pixels'

export type Life = {
  w: number
  h: number
  // Row-major: 1 where a cell lives.
  cells: number[]
  generation: number
  // Generations a second.
  speed: number
  wait: number
  // What the pointer is painting while held: cells, or their absence.
  brush: 0 | 1 | null
  seed: number
  phase: Phase
}

const SPEEDS: readonly number[] = [2, 5, 10, 20, 40]

const soup = (w: number, h: number, seed: number): { cells: number[]; seed: number } => {
  let next = seed
  const cells = Array.from({ length: w * h }, () => {
    next = lcg(next)

    return below(next, 4) === 0 ? 1 : 0
  })

  return { cells, seed: next }
}

export const newLife = (w: number, rows: number, seed: number): Life => ({
  w,
  h: rows * 2,
  ...soup(w, rows * 2, seed),
  generation: 0,
  speed: 10,
  wait: 100,
  brush: null,
  phase: 'ready',
})

/** The next generation: a live cell with two or three neighbors lives on, a dead one with three is born. */
export const evolve = (s: Pick<Life, 'w' | 'h' | 'cells'>): number[] =>
  s.cells.map((alive, i) => {
    const x = i % s.w
    const y = Math.floor(i / s.w)
    let around = 0

    for (let dy = -1; dy <= 1; dy += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        if (dx !== 0 || dy !== 0) around += s.cells[((y + dy + s.h) % s.h) * s.w + ((x + dx + s.w) % s.w)] as number
      }
    }

    return around === 3 || (alive === 1 && around === 2) ? 1 : 0
  })

const stamp = (s: Life, points: readonly [number, number][]): Life => {
  const cells = [...s.cells]
  const ox = Math.floor(s.w / 2)
  const oy = Math.floor(s.h / 2)
  for (const [x, y] of points) cells[((oy + y + s.h) % s.h) * s.w + ((ox + x + s.w) % s.w)] = 1

  return { ...s, cells }
}

const GLIDER: readonly [number, number][] = [[1, 0], [2, 1], [0, 2], [1, 2], [2, 2]]

export const life: GameDef<Life> = {
  id: 'life',
  label: 'Juego de la vida',
  glyph: '░',
  hint: 'mouse dibuja (derecho borra) · espacio pausa · c limpia · g planeador · 1-5 velocidad · r siembra',
  minW: 30,
  maxW: 60,
  minRows: 10,
  maxRows: 20,
  noRecord: true,
  create: newLife,
  step: (s, dt) => {
    let wait = s.wait - dt * 1000
    let { cells, generation } = s

    while (wait <= 0) {
      cells = evolve({ w: s.w, h: s.h, cells })
      generation += 1
      wait += 1000 / s.speed
    }

    return { ...s, cells, generation, wait }
  },
  key: (s, key) => {
    if (key === ' ') return { ...s, phase: 'paused' }
    if (key === 'c') return { ...s, cells: s.cells.map(() => 0), generation: 0 }
    if (key === 'g') return stamp(s, GLIDER)

    const speed = SPEEDS[Number(key) - 1]

    return speed === undefined ? s : { ...s, speed }
  },
  // While held, the pointer paints what its first press set: a left one cells, a right one none.
  pointer: (s, e) => {
    if (e.type === 'up') return { ...s, brush: null }

    const brush = e.type === 'down' ? (e.button === 'right' ? 0 : 1) : s.brush
    if (brush === null) return s

    const x = clamp(Math.floor(e.x), 0, s.w - 1)
    const y = clamp(e.y * 2, 0, s.h - 2)
    const cells = [...s.cells]
    cells[y * s.w + x] = brush
    cells[(y + 1) * s.w + x] = brush

    return { ...s, cells, brush }
  },
  score: s => s.generation,
  hud: s => [
    { text: 'VIDA  ', dim: true },
    { text: `generación ${s.generation}`, bold: true },
    { text: `  ${s.cells.reduce((n, c) => n + c, 0)} vivas · ${s.speed}/s`, dim: true },
  ],
  draw: (s, color) => {
    const f = blank(s.w, s.h / 2)
    s.cells.forEach((alive, i) => {
      if (alive === 1) plot(f, i % s.w, Math.floor(i / s.w), color)
    })

    return toRows(f)
  },
}
