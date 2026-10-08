import type { Stats } from '../types'
import { nameOfId, pickOfId } from './models'

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

/** A response's cost in dollars at list price; 0 for a model with none listed. */
export const costOf = (usage: Usage): number => {
  const version = pickOfId(usage.model)?.version
  if (version === undefined) return 0

  const [input, output] = version.price
  const cacheRead = version.cacheRead ?? input * CACHE_READ

  return (
    (usage.input_tokens * input +
      usage.output_tokens * output +
      usage.cache_read_input_tokens * cacheRead +
      usage.cache_creation_input_tokens * input * CACHE_WRITE) /
    MILLION
  )
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

/**
 * The stats row's parts, the most useful first, as many as fit `columns`
 * joined by ` · `; '' when there is nothing to show.
 */
export const statsLine = (stats: Stats | null, isManual: boolean, columns: number): string => {
  const parts: string[] = []

  if (stats !== null) {
    if (stats.answeredBy !== '') parts.push(`respondió ${nameOfId(stats.answeredBy)}`)
    if (stats.sessionCost > 0) parts.push(`sesión ~${money(stats.sessionCost)}`)
    if (stats.turnCost > 0) parts.push(`turno ~${money(stats.turnCost)}`)
    if (stats.effort !== '') parts.push(`effort ${stats.effort}`)
    if (stats.answeredBy !== '') parts.push(`${count(stats.input)}→${count(stats.output)} tok`)
    if (stats.input > 0) parts.push(`cache ${Math.round((stats.cacheRead / stats.input) * 100)}%`)
  }
  if (isManual) parts.push('manual')

  while (parts.length > 1 && [...parts.join(' · ')].length > columns) parts.pop()

  return parts.join(' · ')
}
