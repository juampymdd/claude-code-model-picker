// Charts drawn as text, one glyph per cell, so they read the same on every
// surface and need no library.

const LEVELS = '▁▂▃▄▅▆▇█'
const EIGHTHS = ' ▏▎▍▌▋▊▉█'
const ZERO = '·'

const clamp = (n: number, low: number, high: number): number => Math.min(high, Math.max(low, n))

const peak = (values: readonly number[], max?: number): number =>
  max ?? values.reduce((most, value) => Math.max(most, value), 0)

/** One glyph per value, `▁` to `█` against `max` (the largest value when absent); `·` for zero. */
export const sparkline = (values: readonly number[], max?: number): string => {
  const top = peak(values, max)

  return values
    .map(value => {
      if (value <= 0 || top <= 0) return ZERO

      return LEVELS[clamp(Math.ceil((value / top) * LEVELS.length) - 1, 0, LEVELS.length - 1)] as string
    })
    .join('')
}

/**
 * A column chart `rows` tall, one column per value, top row first; the cell
 * under a column's top is partly filled. Every row is as long as `values`.
 */
export const columns = (values: readonly number[], rows: number, max?: number): string[] => {
  const top = peak(values, max)

  return Array.from({ length: rows }, (_, row) => {
    const below = rows - 1 - row

    return values
      .map(value => {
        if (value <= 0 || top <= 0) return ' '

        const eighths = clamp(Math.round((value / top) * rows * 8), 1, rows * 8)
        const here = eighths - below * 8
        if (here <= 0) return ' '
        if (here >= 8) return '█'

        return LEVELS[here - 1] as string
      })
      .join('')
  })
}

/** A horizontal bar of `value` against `max`, in eighths of a cell, at most `width` cells. */
export const hbar = (value: number, max: number, width: number): string => {
  if (value <= 0 || max <= 0 || width <= 0) return ''

  const eighths = clamp(Math.round((value / max) * width * 8), 1, width * 8)
  const full = Math.floor(eighths / 8)
  const part = eighths % 8

  return '█'.repeat(full) + (part === 0 ? '' : (EIGHTHS[part] as string))
}

/**
 * How many cells each part of a stacked bar takes: the parts together are
 * `sum / max` of `width`, split by largest remainder so they add up exactly.
 */
export const stack = (parts: readonly number[], max: number, width: number): number[] => {
  const sum = parts.reduce((all, part) => all + Math.max(0, part), 0)
  if (sum <= 0 || max <= 0 || width <= 0) return parts.map(() => 0)

  const wanted = Math.min(width, Math.max(1, Math.round((sum / max) * width)))
  const exact = parts.map(part => (Math.max(0, part) / sum) * wanted)
  const cells = exact.map(Math.floor)
  let left = wanted - cells.reduce((all, cell) => all + cell, 0)

  const byRemainder = exact
    .map((value, index) => ({ index, rest: value - Math.floor(value) }))
    .filter(({ index }) => (parts[index] ?? 0) > 0)
    .sort((a, b) => b.rest - a.rest)

  for (const { index } of byRemainder) {
    if (left <= 0) break
    cells[index] = (cells[index] ?? 0) + 1
    left -= 1
  }

  return cells
}

/** `part` as a whole-number percent of `whole`; `–` when `whole` is none. */
export const pct = (part: number, whole: number): string =>
  whole <= 0 ? '–' : `${Math.round((part / whole) * 100)}%`

/** A length of time as short as it reads: `850ms`, `12s`, `3m12s`, `1h04m`. */
export const duration = (ms: number): string => {
  if (ms < 1000) return `${Math.round(ms)}ms`

  const seconds = Math.round(ms / 1000)
  if (seconds < 60) return `${seconds}s`

  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m${String(seconds % 60).padStart(2, '0')}s`

  return `${Math.floor(minutes / 60)}h${String(minutes % 60).padStart(2, '0')}m`
}

/** `text` padded to `width` code points, or cut to it with `…`. */
export const cell = (text: string, width: number, align: 'left' | 'right' = 'left'): string => {
  const glyphs = [...text]
  if (glyphs.length > width) return width <= 1 ? glyphs.slice(0, width).join('') : `${glyphs.slice(0, width - 1).join('')}…`

  const pad = ' '.repeat(width - glyphs.length)

  return align === 'left' ? text + pad : pad + text
}
