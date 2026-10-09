// A screen for the games: every cell of text is two pixels, one over the
// other, drawn with half blocks. Glyphs can be written over the pixels.

import type { Seg } from './rows'

export type Frame = {
  // Cells across, and pixels down (two per row of cells).
  w: number
  h: number
  // A color per pixel, row-major; null where nothing is drawn.
  px: (string | null)[]
  // A glyph per cell, drawn in place of its two pixels.
  glyphs: ({ ch: string; color?: string } | null)[]
}

export const blank = (w: number, rows: number): Frame => ({
  w,
  h: rows * 2,
  px: Array.from({ length: w * rows * 2 }, () => null),
  glyphs: Array.from({ length: w * rows }, () => null),
})

/** Colors the pixel at (x, y); a point off the screen is ignored. */
export const plot = (f: Frame, x: number, y: number, color: string): void => {
  const col = Math.floor(x)
  const row = Math.floor(y)
  if (col < 0 || col >= f.w || row < 0 || row >= f.h) return

  f.px[row * f.w + col] = color
}

/** Colors a rectangle of pixels, its corner at (x, y). */
export const rect = (f: Frame, x: number, y: number, w: number, h: number, color: string): void => {
  for (let dy = 0; dy < h; dy += 1) {
    for (let dx = 0; dx < w; dx += 1) plot(f, x + dx, y + dy, color)
  }
}

/** Writes `text` from cell (col, row), one glyph per cell, over what is there. */
export const write = (f: Frame, col: number, row: number, text: string, color?: string): void => {
  const start = Math.floor(col)
  const line = Math.floor(row)
  if (line < 0 || line >= f.h / 2) return

  ;[...text].forEach((ch, i) => {
    const at = start + i
    if (at >= 0 && at < f.w) f.glyphs[line * f.w + at] = color === undefined ? { ch } : { ch, color }
  })
}

// One cell as it is drawn: a glyph, or the half block its two pixels make.
const cellOf = (f: Frame, col: number, row: number): { ch: string; color?: string; fill?: string } => {
  const glyph = f.glyphs[row * f.w + col]
  if (glyph != null) return glyph

  const top = f.px[row * 2 * f.w + col] ?? null
  const bottom = f.px[(row * 2 + 1) * f.w + col] ?? null

  if (top === null && bottom === null) return { ch: ' ' }
  if (top === bottom) return { ch: '█', color: top as string }
  if (bottom === null) return { ch: '▀', color: top as string }
  if (top === null) return { ch: '▄', color: bottom }

  return { ch: '▀', color: top, fill: bottom }
}

/** The screen as rows of runs of text, cells of one color joined into one run. */
export const toRows = (f: Frame): Seg[][] =>
  Array.from({ length: f.h / 2 }, (_, row) => {
    const runs: Seg[] = []

    for (let col = 0; col < f.w; col += 1) {
      const cell = cellOf(f, col, row)
      const last = runs[runs.length - 1]

      if (last !== undefined && last.color === cell.color && last.fill === cell.fill) {
        last.text += cell.ch
      } else {
        runs.push({
          text: cell.ch,
          ...(cell.color === undefined ? {} : { color: cell.color }),
          ...(cell.fill === undefined ? {} : { fill: cell.fill }),
        })
      }
    }

    return runs
  })
