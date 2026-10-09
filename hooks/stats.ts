import type { Stats } from '../types'
import { nameOfId, pickOfId } from './models'
import type { Seg } from './rows'

// What a response reports of itself: the API's token counts and model id.
export type Usage = {
  model: string
  input_tokens: number
  output_tokens: number
  cache_read_input_tokens: number
  cache_creation_input_tokens: number
}

const MILLION = 1_000_000
// Where a list price names no cache rate: a read at a tenth of the input
// price, a write at a quarter over it.
const CACHE_READ = 0.1
const CACHE_WRITE = 1.25

const EMPTY: Stats = {
  answeredBy: '',
  effort: '',
  turnId: '',
  input: 0,
  output: 0,
  cacheRead: 0,
  turnCost: 0,
  sessionCost: 0,
}

/** What a response cost in dollars at list price, by kind of token; all 0 for a model with none listed. */
export const costParts = (usage: Usage): { input: number; output: number; cacheRead: number; cacheWrite: number } => {
  const version = pickOfId(usage.model)?.version
  if (version === undefined) return { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }

  const [input, output] = version.price
  const cacheRead = version.cacheRead ?? input * CACHE_READ

  return {
    input: (usage.input_tokens * input) / MILLION,
    output: (usage.output_tokens * output) / MILLION,
    cacheRead: (usage.cache_read_input_tokens * cacheRead) / MILLION,
    cacheWrite: (usage.cache_creation_input_tokens * input * CACHE_WRITE) / MILLION,
  }
}

/** A response's cost in dollars at list price; 0 for a model with none listed. */
export const costOf = (usage: Usage): number => {
  const parts = costParts(usage)

  return parts.input + parts.output + parts.cacheRead + parts.cacheWrite
}

/**
 * The stats after one more response. Every loop's response adds to the
 * session's cost; the main loop's also becomes the latest one shown, and adds
 * to its turn's cost.
 */
export const tally = (
  was: Stats | null,
  step: { turnId: string; effort?: string | number },
  usage: Usage,
  isMain: boolean,
): Stats => {
  const before = was ?? EMPTY
  const cost = costOf(usage)
  const sessionCost = before.sessionCost + cost

  if (!isMain) return { ...before, sessionCost }

  return {
    answeredBy: usage.model,
    effort: step.effort === undefined ? '' : String(step.effort),
    turnId: step.turnId,
    input: usage.input_tokens + usage.cache_read_input_tokens + usage.cache_creation_input_tokens,
    output: usage.output_tokens,
    cacheRead: usage.cache_read_input_tokens,
    turnCost: (before.turnId === step.turnId ? before.turnCost : 0) + cost,
    sessionCost,
  }
}

export const money = (dollars: number): string => `$${dollars.toFixed(dollars < 0.1 ? 3 : 2)}`

export const count = (tokens: number): string => {
  if (tokens >= MILLION) return `${(tokens / MILLION).toFixed(1)}M`
  if (tokens >= 1000) return `${(tokens / 1000).toFixed(tokens < 10_000 ? 1 : 0)}k`

  return String(tokens)
}

/** A version's list price as its dropdown row shows it (`$4/$20`). */
export const priceLabel = ([input, output]: readonly [number, number]): string => {
  const one = (n: number) => `$${Number.isInteger(n) ? n : n.toFixed(2)}`

  return `${one(input)}/${one(output)}`
}

const METER_CELLS = 6
const SEPARATOR = ' · '

const widthOf = (segs: readonly Seg[]): number =>
  segs.reduce((all, seg) => all + (seg.fx === 'meter' ? (seg.width ?? 0) : [...seg.text].length), 0)

const meterText = (seg: Seg): string => {
  const width = seg.width ?? 0
  const filled = Math.max(0, Math.min(width, Math.round(((seg.value ?? 0) / 100) * width)))

  return '▰'.repeat(filled) + '▱'.repeat(width - filled)
}

/**
 * The stats row as runs of text, the most useful part first, as many parts as
 * fit `columns` with ` · ` between them: the model that answered, the costs,
 * the effort, the tokens, then a meter of the cache's share and one of how
 * full the context is (`context`, a percent, when known). Empty with nothing to show.
 */
export const statsSegs = (stats: Stats | null, isManual: boolean, columns: number, context?: number): Seg[] => {
  const word = (text: string): Seg => ({ text, dim: true })
  const parts: Seg[][] = []

  if (stats !== null) {
    if (stats.answeredBy !== '') parts.push([word(`respondió ${nameOfId(stats.answeredBy)}`)])
    if (stats.sessionCost > 0) parts.push([word(`sesión ~${money(stats.sessionCost)}`)])
    if (stats.turnCost > 0) parts.push([word(`turno ~${money(stats.turnCost)}`)])
    if (stats.effort !== '') parts.push([word(`effort ${stats.effort}`)])
    if (stats.answeredBy !== '') parts.push([word(`${count(stats.input)}→${count(stats.output)} tok`)])
    if (stats.input > 0) {
      const share = Math.round((stats.cacheRead / stats.input) * 100)
      parts.push([
        word('cache '),
        { text: '', fx: 'meter', key: 'cache', value: share, width: METER_CELLS, isGoodHigh: true },
        word(` ${share}%`),
      ])
    }
  }
  if (context !== undefined) {
    const full = Math.round(context)
    parts.push([word('contexto '), { text: '', fx: 'meter', key: 'context', value: full, width: METER_CELLS }, word(` ${full}%`)])
  }
  if (isManual) parts.push([word('manual')])

  const total = () => parts.reduce((all, part) => all + widthOf(part), 0) + Math.max(0, parts.length - 1) * SEPARATOR.length
  while (parts.length > 1 && total() > columns) parts.pop()

  return parts.flatMap((part, index) => (index === 0 ? part : [word(SEPARATOR), ...part]))
}

/** The stats row as plain text, its meters drawn full. */
export const statsLine = (stats: Stats | null, isManual: boolean, columns: number, context?: number): string =>
  statsSegs(stats, isManual, columns, context)
    .map(seg => (seg.fx === 'meter' ? meterText(seg) : seg.text))
    .join('')
