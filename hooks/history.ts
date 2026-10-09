import type { AgentStat, AgentStatus, History, ModelStat, ToolStat, Turn } from '../types'
import { pickOfId } from './models'
import { costParts } from './stats'
import type { Usage } from './stats'

export const TURN_CAP = 200
export const TOOL_CAP = 40
export const AGENT_CAP = 100
// How many of an agent's latest requests its sparkline keeps.
export const COSTS_KEPT = 12
const OTHERS = 'otros'

export const EMPTY: History = {
  turns: [],
  dropped: 0,
  models: {},
  tools: [],
  agents: [],
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

const OVER: readonly AgentStatus[] = ['completed', 'failed', 'killed']

/** Whether an agent's loop is over. */
export const isDone = (agent: AgentStat): boolean => agent.endedAt !== undefined || OVER.includes(agent.status)

const blankAgent = (id: string, startedAt: number): AgentStat => ({
  id,
  type: 'agente',
  description: '',
  model: '',
  startedAt,
  status: 'running',
  steps: 0,
  cost: 0,
  costs: [],
  input: 0,
  output: 0,
  tools: [],
})

// The agent list with `id` in it, added if it was not; past the cap the finished ones longest gone go first.
const withAgent = (h: History, id: string, now: number): History => {
  if (h.agents.some(agent => agent.id === id)) return h

  const agents = [...h.agents, blankAgent(id, now)]
  if (agents.length <= AGENT_CAP) return { ...h, agents }

  const oldest = agents
    .filter(isDone)
    .sort((a, b) => (a.endedAt ?? a.startedAt) - (b.endedAt ?? b.startedAt))
    .slice(0, agents.length - AGENT_CAP)

  return { ...h, agents: agents.filter(agent => !oldest.includes(agent)).slice(-AGENT_CAP) }
}

const mapAgent = (h: History, id: string, change: (agent: AgentStat) => AgentStat): History => ({
  ...h,
  agents: h.agents.map(agent => (agent.id === id ? change(agent) : agent)),
})

// An agent seen working again after it had ended (a teammate's next turn) runs again.
const revived = (agent: AgentStat): AgentStat => {
  if (agent.endedAt === undefined) return agent

  const { endedAt: _, ...rest } = agent

  return { ...rest, status: 'running' }
}

/** The history with agent `seed.id` in it, named as its spawn named it; one already there keeps its numbers. */
export const openAgent = (
  h: History,
  seed: { id: string; type?: string; description?: string; parentId?: string; model?: string },
  now: number,
): History =>
  mapAgent(withAgent(h, seed.id, now), seed.id, agent => ({
    ...agent,
    type: seed.type ?? agent.type,
    description: seed.description ?? agent.description,
    ...(seed.parentId === undefined ? {} : { parentId: seed.parentId }),
    model: agent.model === '' && seed.model !== undefined ? keyOf(seed.model) : agent.model,
  }))

/** The history with agent `agentId` inside a call of `tool` since `now`. */
export const startTool = (h: History, agentId: string, tool: string, now: number): History =>
  mapAgent(withAgent(h, agentId, now), agentId, agent => ({ ...revived(agent), busy: { tool, since: now } }))

/** The history with agent `done.id` finished at `now`; an id it never saw is ignored. */
export const closeAgent = (
  h: History,
  done: { id: string; reason: NonNullable<Turn['reason']> },
  now: number,
): History =>
  h.agents.some(agent => agent.id === done.id)
    ? mapAgent(h, done.id, agent => {
        const { busy: _, ...idle } = agent
        const status: AgentStatus = done.reason === 'answer' ? 'completed' : done.reason === 'aborted' ? 'killed' : 'failed'

        return { ...idle, endedAt: now, status }
      })
    : h

/**
 * The history brought up to Claude Code's own list of agents: each one listed
 * takes its type, description, parent and status from it, and one it reports
 * over is ended. The same history when nothing differs.
 */
export const syncAgents = (
  h: History,
  list: readonly { id: string; type: string; description: string; status: AgentStatus; parentId?: string }[],
  now: number,
): History => {
  let next = h

  for (const info of list) {
    const was = next.agents.find(agent => agent.id === info.id)
    const isOver = OVER.includes(info.status)
    const isSame =
      was !== undefined &&
      was.type === info.type &&
      was.description === info.description &&
      was.parentId === info.parentId &&
      was.status === info.status &&
      (was.endedAt !== undefined) === isOver

    if (isSame) continue

    next = mapAgent(withAgent(next, info.id, now), info.id, agent => {
      const { busy, endedAt, parentId: _, ...rest } = agent

      return {
        ...rest,
        type: info.type,
        description: info.description,
        status: info.status,
        ...(info.parentId === undefined ? {} : { parentId: info.parentId }),
        ...(isOver ? { endedAt: endedAt ?? now } : busy === undefined ? {} : { busy }),
      }
    })
  }

  return next
}

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
  step: { turnId: string; isMain: boolean; agentId?: string },
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
  const charged = last === undefined ? base : mapTurn(base, last.turnId, turn => ({ ...turn, agentCost: turn.agentCost + cost }))

  if (step.agentId === undefined) return charged

  return mapAgent(withAgent(charged, step.agentId, now), step.agentId, agent => ({
    ...revived(agent),
    steps: agent.steps + 1,
    model: usage === null ? agent.model : keyOf(usage.model),
    cost: agent.cost + cost,
    costs: [...agent.costs, cost].slice(-COSTS_KEPT),
    input: agent.input + prompt,
    output: agent.output + (usage?.output_tokens ?? 0),
  }))
}

/** The history with turn `done.turnId` finished; an id it never opened is ignored. */
export const closeTurn = (
  h: History,
  done: { turnId: string; durationMs: number; reason: NonNullable<Turn['reason']> },
): History =>
  h.turns.some(turn => turn.turnId === done.turnId)
    ? mapTurn(h, done.turnId, turn => ({ ...turn, durationMs: done.durationMs, reason: done.reason }))
    : h

/** The history after one more tool call, counted for the session and for the agent that made it. */
export const addTool = (
  h: History,
  call: { name: string; ms: number; isError: boolean; agentId?: string },
): History => {
  const counted = { ...h, tools: counting(h.tools, call) }
  if (call.agentId === undefined || !counted.agents.some(agent => agent.id === call.agentId)) return counted

  // The agent's own count, and its call is over.
  return mapAgent(counted, call.agentId, agent => {
    const { busy: _, ...idle } = agent

    return { ...idle, tools: counting(agent.tools, call) }
  })
}

// A tool list after one more call; names past the cap are counted under `otros`.
const counting = (tools: readonly ToolStat[], call: { name: string; ms: number; isError: boolean }): ToolStat[] => {
  const named = tools.some(tool => tool.name === call.name)
  const name = named || tools.filter(tool => tool.name !== OTHERS).length < TOOL_CAP ? call.name : OTHERS
  const known = tools.some(tool => tool.name === name)

  const bump = (tool: ToolStat): ToolStat => ({
    ...tool,
    count: tool.count + 1,
    errors: tool.errors + (call.isError ? 1 : 0),
    totalMs: tool.totalMs + Math.max(0, call.ms),
  })

  return known
    ? tools.map(tool => (tool.name === name ? bump(tool) : tool))
    : [...tools, bump({ name, count: 0, errors: 0, totalMs: 0 })]
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
