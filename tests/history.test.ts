import { expect, test } from 'claude-code/testing'

import {
  activity,
  addStep,
  addTool,
  AGENT_CAP,
  closeAgent,
  closeTurn,
  COSTS_KEPT,
  EMPTY,
  isDone,
  openAgent,
  openTurn,
  pace,
  startTool,
  syncAgents,
  TOOL_CAP,
  TURN_CAP,
} from '../hooks/history'
import { costOf, costParts } from '../hooks/stats'
import type { Usage } from '../hooks/stats'

const usage = (model: string, over: Partial<Usage> = {}): Usage => ({
  model,
  input_tokens: 0,
  output_tokens: 0,
  cache_read_input_tokens: 0,
  cache_creation_input_tokens: 0,
  ...over,
})

// The kit has no toBeCloseTo: round to a few decimals instead.
const near = (n: number | undefined, digits = 6): number | undefined =>
  n === undefined ? undefined : Math.round(n * 10 ** digits) / 10 ** digits

const MAIN = (turnId: string) => ({ turnId, isMain: true })
const AGENT = (turnId: string) => ({ turnId, isMain: false })

test('a turn opens once, and a step it missed opens it', () => {
  const opened = openTurn(EMPTY, 'a', 100)
  expect(openTurn(opened, 'a', 999).turns).toHaveLength(1)
  expect(opened.turns[0]?.startedAt).toBe(100)

  const lazy = addStep(EMPTY, MAIN('b'), usage('claude-opus-5-5', { input_tokens: 1 }), 50)
  expect(lazy.turns.map(turn => [turn.turnId, turn.startedAt, turn.steps])).toEqual([['b', 50, 1]])
})

test("main steps add to their turn, the models and the total; a subagent's only to the session and the open turn's agent cost", () => {
  const million = { input_tokens: 1_000_000, output_tokens: 1_000_000 }
  let h = openTurn(EMPTY, 't1', 0)
  h = addStep(h, MAIN('t1'), usage('claude-opus-5-5', million), 1)
  h = addStep(h, AGENT('sub'), usage('claude-haiku-5-5', million), 2)

  // Opus 5.5: $4 in + $20 out per million; Haiku 5.5: $0.10 + $0.50.
  expect(h.turns[0]).toMatchObject({ steps: 1, model: 'claude-opus-5-5', input: 1_000_000, output: 1_000_000 })
  expect(near(h.turns[0]?.cost)).toBe(24)
  expect(near(h.turns[0]?.costOut)).toBe(20)
  expect(near(h.turns[0]?.agentCost)).toBe(0.6)
  expect(h.total.steps).toBe(2)
  expect(near(h.total.cost)).toBe(24.6)
  expect(near(h.total.agentCost)).toBe(0.6)
  expect(Object.keys(h.models).sort()).toEqual(['claude-haiku-5-5', 'claude-opus-5-5'])
  expect(h.models['claude-haiku-5-5']).toMatchObject({ steps: 1, input: 1_000_000, output: 1_000_000 })
})

test('a step with no usage counts as a step at no cost', () => {
  const h = addStep(openTurn(EMPTY, 't', 0), MAIN('t'), null, 1)

  expect(h.turns[0]).toMatchObject({ steps: 1, cost: 0, model: '' })
  expect(h.total).toMatchObject({ steps: 1, cost: 0 })
  expect(h.models).toEqual({})
})

test('a suffixed model id is tallied under its listed id', () => {
  const h = addStep(EMPTY, MAIN('t'), usage('claude-opus-5-5-20260101', { input_tokens: 10 }), 0)

  expect(Object.keys(h.models)).toEqual(['claude-opus-5-5'])
  expect(h.turns[0]?.model).toBe('claude-opus-5-5')
})

test('closing sets the duration and reason, and an unknown turn is left alone', () => {
  const opened = openTurn(EMPTY, 't', 0)
  const closed = closeTurn(opened, { turnId: 't', durationMs: 1234, reason: 'aborted' })

  expect(closed.turns[0]).toMatchObject({ durationMs: 1234, reason: 'aborted' })
  expect(closeTurn(opened, { turnId: 'nope', durationMs: 1, reason: 'answer' })).toBe(opened)
})

test('the turn list keeps the newest ones and the totals keep everything', () => {
  let h = EMPTY
  for (let i = 0; i < TURN_CAP + 5; i += 1) {
    h = addStep(h, MAIN(`t${i}`), usage('claude-haiku-5-5', { input_tokens: 1_000_000 }), i)
  }

  expect(h.turns).toHaveLength(TURN_CAP)
  expect(h.dropped).toBe(5)
  expect(h.turns[0]?.turnId).toBe('t5')
  expect(h.total.steps).toBe(TURN_CAP + 5)
  expect(h.total.input).toBe((TURN_CAP + 5) * 1_000_000)
})

test('tools count calls, errors and time, and names past the cap fold into otros', () => {
  let h = addTool(EMPTY, { name: 'Bash', ms: 1000, isError: false })
  h = addTool(h, { name: 'Bash', ms: 500, isError: true })
  h = addTool(h, { name: 'Read', ms: 10, isError: false })

  expect(h.tools.find(tool => tool.name === 'Bash')).toEqual({ name: 'Bash', count: 2, errors: 1, totalMs: 1500 })

  for (let i = 0; i < TOOL_CAP + 3; i += 1) h = addTool(h, { name: `mcp__${i}`, ms: 1, isError: false })

  expect(h.tools.filter(tool => tool.name !== 'otros')).toHaveLength(TOOL_CAP)
  expect(h.tools.find(tool => tool.name === 'otros')?.count).toBeGreaterThan(0)
  expect(h.tools.reduce((all, tool) => all + tool.count, 0)).toBe(3 + TOOL_CAP + 3)
})

test("activity spreads a turn's steps over its span, and pace averages the finished turns", () => {
  let h = openTurn(EMPTY, 'a', 0)
  h = addStep(h, MAIN('a'), usage('claude-haiku-5-5'), 1)
  h = addStep(h, MAIN('a'), usage('claude-haiku-5-5'), 2)
  h = closeTurn(h, { turnId: 'a', durationMs: 100, reason: 'answer' })
  h = openTurn(h, 'b', 150)

  const buckets = activity(h.turns, 0, 200, 4)
  expect(buckets.map(n => Math.round(n * 100) / 100)).toEqual([1, 1, 0, 0])
  expect(activity(h.turns, 0, 0, 4)).toEqual([0, 0, 0, 0])

  expect(pace(h)).toEqual({ turns: 1, activeMs: 100, avgMs: 100, avgSteps: 2 })
  expect(pace(EMPTY)).toEqual({ turns: 0, activeMs: 0, avgMs: 0, avgSteps: 0 })
})

test('the cost parts add up to the cost of a response', () => {
  const u = usage('claude-opus-5', {
    input_tokens: 1000,
    output_tokens: 500,
    cache_read_input_tokens: 9000,
    cache_creation_input_tokens: 2000,
  })
  const parts = costParts(u)

  expect(near(parts.input + parts.output + parts.cacheRead + parts.cacheWrite, 12)).toBe(near(costOf(u), 12))
  expect(costParts(usage('some-other-model', { input_tokens: 1 }))).toEqual({ input: 0, output: 0, cacheRead: 0, cacheWrite: 0 })
})

test('an agent opens once under the name its spawn gave it, and a step it missed opens it unnamed', () => {
  const seed = { id: 'a', type: 'Explore', description: 'buscar', parentId: 'p', model: 'claude-haiku-5-5-20260101' }
  const opened = openAgent(EMPTY, seed, 100)

  expect(opened.agents).toHaveLength(1)
  expect(opened.agents[0]).toMatchObject({ type: 'Explore', description: 'buscar', parentId: 'p', model: 'claude-haiku-5-5', startedAt: 100, status: 'running' })
  expect(openAgent(opened, { id: 'a' }, 999).agents[0]).toMatchObject({ type: 'Explore', startedAt: 100 })

  const lazy = addStep(EMPTY, { turnId: 't', isMain: false, agentId: 'z' }, usage('claude-opus-5-5', { input_tokens: 1 }), 50)
  expect(lazy.agents[0]).toMatchObject({ id: 'z', type: 'agente', description: '', steps: 1, startedAt: 50 })
})

test("an agent's steps add to its cost, tokens and model, and its sparkline keeps the latest", () => {
  let h = openAgent(EMPTY, { id: 'a' }, 0)
  for (let i = 0; i < COSTS_KEPT + 3; i += 1) {
    h = addStep(h, { turnId: 't', isMain: false, agentId: 'a' }, usage('claude-haiku-5-5', { input_tokens: 1_000_000, output_tokens: 1000 }), i)
  }
  const agent = h.agents[0]

  expect(agent).toMatchObject({ steps: COSTS_KEPT + 3, model: 'claude-haiku-5-5', input: (COSTS_KEPT + 3) * 1_000_000 })
  expect(agent?.costs).toHaveLength(COSTS_KEPT)
  expect(near(agent?.cost)).toBe(near((COSTS_KEPT + 3) * (0.1 + 0.0005)))
  // The session's totals count them too.
  expect(near(h.total.agentCost)).toBe(near(agent?.cost))
})

test('a tool call marks its agent busy, then counts for it and for the session', () => {
  let h = openAgent(EMPTY, { id: 'a' }, 0)
  h = startTool(h, 'a', 'Bash', 10)
  expect(h.agents[0]?.busy).toEqual({ tool: 'Bash', since: 10 })

  h = addTool(h, { name: 'Bash', ms: 500, isError: true, agentId: 'a' })
  expect(h.agents[0]?.busy).toBeUndefined()
  expect(h.agents[0]?.tools).toEqual([{ name: 'Bash', count: 1, errors: 1, totalMs: 500 }])
  expect(h.tools).toEqual([{ name: 'Bash', count: 1, errors: 1, totalMs: 500 }])

  // A call of the main loop, or of an agent never seen, only counts for the session.
  const main = addTool(h, { name: 'Read', ms: 1, isError: false })
  expect(main.agents[0]?.tools).toHaveLength(1)
  expect(addTool(h, { name: 'Read', ms: 1, isError: false, agentId: 'ghost' }).agents).toHaveLength(1)
})

test('an agent ends as its turn did, stops being busy, and runs again if it works again', () => {
  const busy = startTool(openAgent(EMPTY, { id: 'a' }, 0), 'a', 'Bash', 5)

  const done = closeAgent(busy, { id: 'a', reason: 'answer' }, 90)
  expect(done.agents[0]).toMatchObject({ status: 'completed', endedAt: 90 })
  expect(done.agents[0]?.busy).toBeUndefined()
  expect(isDone(done.agents[0]!)).toBe(true)

  expect(closeAgent(busy, { id: 'a', reason: 'aborted' }, 1).agents[0]?.status).toBe('killed')
  expect(closeAgent(busy, { id: 'a', reason: 'error' }, 1).agents[0]?.status).toBe('failed')
  expect(closeAgent(busy, { id: 'nope', reason: 'answer' }, 1)).toBe(busy)

  const again = addStep(done, { turnId: 't2', isMain: false, agentId: 'a' }, null, 100)
  expect(again.agents[0]?.status).toBe('running')
  expect(again.agents[0]?.endedAt).toBeUndefined()
})

test("Claude Code's own list names, updates and ends the agents, and changes nothing when it agrees", () => {
  const h = addStep(EMPTY, { turnId: 't', isMain: false, agentId: 'a' }, null, 10)
  const listed = [{ id: 'a', type: 'Plan', description: 'diseñar', status: 'running' as const, parentId: 'root' }]

  const named = syncAgents(h, listed, 20)
  expect(named.agents[0]).toMatchObject({ type: 'Plan', description: 'diseñar', parentId: 'root', status: 'running', steps: 1 })
  expect(syncAgents(named, listed, 30)).toBe(named)

  const over = syncAgents(named, [{ ...listed[0]!, status: 'failed' as const }], 40)
  expect(over.agents[0]).toMatchObject({ status: 'failed', endedAt: 40 })
  expect(syncAgents(over, [{ ...listed[0]!, status: 'failed' as const }], 99)).toBe(over)

  // One the list has and the hooks never saw is added; one the list lacks is left as it was.
  const more = syncAgents(named, [{ id: 'b', type: 'Explore', description: 'x', status: 'waiting' as const }], 50)
  expect(more.agents.map(agent => agent.id)).toEqual(['a', 'b'])
  expect(more.agents[0]).toBe(named.agents[0])
})

test('past the cap the agents finished longest ago go first', () => {
  let h = EMPTY
  for (let i = 0; i < AGENT_CAP; i += 1) {
    h = closeAgent(openAgent(h, { id: `done${i}` }, i), { id: `done${i}`, reason: 'answer' }, 1000 + i)
  }
  h = openAgent(h, { id: 'live' }, 5000)

  expect(h.agents).toHaveLength(AGENT_CAP)
  expect(h.agents.some(agent => agent.id === 'done0')).toBe(false)
  expect(h.agents.some(agent => agent.id === 'done1')).toBe(true)
  expect(h.agents.some(agent => agent.id === 'live')).toBe(true)
})
