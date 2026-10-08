import type { History, ModelStat, Turn } from '../types'
import { pickOfId } from './models'
import { costParts } from './stats'
import type { Usage } from './stats'

export const TURN_CAP = 200
export const TOOL_CAP = 40
const OTHERS = 'otros'

export const EMPTY: History = {
  turns: [],
  dropped: 0,
  models: {},
  tools: [],
  total: { cost: 0, agentCost: 0, input: 0, output: 0, cacheRead: 0, cacheWrite: 0, steps: 0 },
}

const blank = (turnId: string, startedAt: number): Turn => ({
  turnId,
  startedAt,
  steps: 0,
  model: '',
  cost: 0,
  costOut: 0,
  agentCost: 0,
  input: 0,
  output: 0,
  cacheRead: 0,
  cacheWrite: 0,
})

// The turn list with `turnId` last, opened if it was not there; the oldest go past the cap.
const withTurn = (h: History, turnId: string, startedAt: number): History => {
  if (h.turns.some(turn => turn.turnId === turnId)) return h

  const turns = [...h.turns, blank(turnId, startedAt)]
  const cut = Math.max(0, turns.length - TURN_CAP)

  return { ...h, turns: turns.slice(cut), dropped: h.dropped + cut }
}

const mapTurn = (h: History, turnId: string, change: (turn: Turn) => Turn): History => ({
  ...h,
  turns: h.turns.map(turn => (turn.turnId === turnId ? change(turn) : turn)),
})

/** A model id as the model list names it, else as the API wrote it. */
const keyOf = (id: string): string => pickOfId(id)?.version.model ?? id

/** The history with turn `turnId` open; a turn already open is left as it is. */
export const openTurn = (h: History, turnId: string, now: number): History => withTurn(h, turnId, now)

/**
 * The history after one more response. A main-loop response adds to its turn
 * (opening it if `turn.start` never came), to its model and to the session; a
 * subagent's adds to its model and the session, and to the latest turn's
 * `agentCost`. A response with no usage still counts as a step.
 */
export const addStep = (
  h: History,
  step: { turnId: string; isMain: boolean },
  usage: Usage | null,
  now: number,
): History => {
  const parts = usage === null ? null : costParts(usage)
  const cost = parts === null ? 0 : parts.input + parts.output + parts.cacheRead + parts.cacheWrite
  const prompt = usage === null ? 0 : usage.input_tokens + usage.cache_read_input_tokens + usage.cache_creation_input_tokens

  const next = step.isMain ? withTurn(h, step.turnId, now) : h

  const models = { ...next.models }
  if (usage !== null) {
    const key = keyOf(usage.model)
    const was: ModelStat = models[key] ?? { cost: 0, input: 0, output: 0, steps: 0 }
    models[key] = { cost: was.cost + cost, input: was.input + prompt, output: was.output + usage.output_tokens, steps: was.steps + 1 }
  }

  const total = {
    ...next.total,
    cost: next.total.cost + cost,
    agentCost: next.total.agentCost + (step.isMain ? 0 : cost),
    input: next.total.input + (usage?.input_tokens ?? 0),
    output: next.total.output + (usage?.output_tokens ?? 0),
    cacheRead: next.total.cacheRead + (usage?.cache_read_input_tokens ?? 0),
    cacheWrite: next.total.cacheWrite + (usage?.cache_creation_input_tokens ?? 0),
    steps: next.total.steps + 1,
  }

  const base = { ...next, models, total }

  if (step.isMain) {
    return mapTurn(base, step.turnId, turn => ({
      ...turn,
      steps: turn.steps + 1,
      model: usage === null ? turn.model : keyOf(usage.model),
      cost: turn.cost + cost,
      costOut: turn.costOut + (parts?.output ?? 0),
      input: turn.input + (usage?.input_tokens ?? 0),
      output: turn.output + (usage?.output_tokens ?? 0),
      cacheRead: turn.cacheRead + (usage?.cache_read_input_tokens ?? 0),
      cacheWrite: turn.cacheWrite + (usage?.cache_creation_input_tokens ?? 0),
    }))
  }

  const last = base.turns[base.turns.length - 1]

  return last === undefined ? base : mapTurn(base, last.turnId, turn => ({ ...turn, agentCost: turn.agentCost + cost }))
}

/** The history with turn `done.turnId` finished; an id it never opened is ignored. */
export const closeTurn = (
  h: History,
  done: { turnId: string; durationMs: number; reason: NonNullable<Turn['reason']> },
): History =>
  h.turns.some(turn => turn.turnId === done.turnId)
    ? mapTurn(h, done.turnId, turn => ({ ...turn, durationMs: done.durationMs, reason: done.reason }))
    : h

/** The history after one more tool call; names past the cap are counted under `otros`. */
export const addTool = (h: History, call: { name: string; ms: number; isError: boolean }): History => {
  const named = h.tools.some(tool => tool.name === call.name)
  const name = named || h.tools.filter(tool => tool.name !== OTHERS).length < TOOL_CAP ? call.name : OTHERS
  const known = h.tools.some(tool => tool.name === name)

  const bump = (tool: { name: string; count: number; errors: number; totalMs: number }) => ({
    ...tool,
    count: tool.count + 1,
    errors: tool.errors + (call.isError ? 1 : 0),
    totalMs: tool.totalMs + Math.max(0, call.ms),
  })

  return {
    ...h,
    tools: known
      ? h.tools.map(tool => (tool.name === name ? bump(tool) : tool))
      : [...h.tools, bump({ name, count: 0, errors: 0, totalMs: 0 })],
  }
}

/**
 * The main loop's steps per time bucket between `from` and `to`: each turn's
 * steps are spread evenly over the time it ran (up to `to` while it still runs).
 */
export const activity = (turns: readonly Turn[], from: number, to: number, buckets: number): number[] => {
  const out: number[] = Array.from({ length: Math.max(0, buckets) }, () => 0)
  const span = to - from
  if (buckets <= 0 || span <= 0) return out

  const size = span / buckets

  for (const turn of turns) {
    const start = turn.startedAt
    const end = Math.max(start + 1, turn.startedAt + (turn.durationMs ?? to - turn.startedAt))
    const perMs = turn.steps / (end - start)

    for (let i = 0; i < buckets; i += 1) {
      const low = Math.max(start, from + i * size)
      const high = Math.min(end, from + (i + 1) * size)
      if (high > low) out[i] = (out[i] ?? 0) + (high - low) * perMs
    }
  }

  return out
}

/** Pace over the turns that finished: how many, their total and mean duration, and mean steps. */
export const pace = (h: History): { turns: number; activeMs: number; avgMs: number; avgSteps: number } => {
  const done = h.turns.filter(turn => turn.durationMs !== undefined)
  const activeMs = done.reduce((all, turn) => all + (turn.durationMs ?? 0), 0)
  const steps = done.reduce((all, turn) => all + turn.steps, 0)

  return {
    turns: done.length,
    activeMs,
    avgMs: done.length === 0 ? 0 : activeMs / done.length,
    avgSteps: done.length === 0 ? 0 : steps / done.length,
  }
}
