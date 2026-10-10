import { expect, test } from 'claude-code/testing'

import { animFor, paceOf, stepAnim } from '../hooks/paint'
import type { Anim } from '../hooks/paint'
import { liveProps } from '../hooks/pane'
import { liveAgents, listedAgents, plainData } from '../hooks/rows'
import type { LiveProps, Row } from '../hooks/rows'
import { addStep, closeAgent, EMPTY, openAgent, startTool } from '../hooks/history'

const props = (rows: Row[], over: Partial<LiveProps> = {}): LiveProps => ({ tab: 'agentes', now: 1000, rows, ...over })

// The motion after `ticks` steps of 120 ms from a start.
const run = (rows: LiveProps, ticks: number, from?: Anim): Anim => {
  let anim = from ?? stepAnim(undefined, rows, 0)
  for (let i = 0; i < ticks; i += 1) anim = stepAnim(anim, rows, 120)

  return anim
}

test('a tab starts with its rows in place and its bars empty', () => {
  const rows = props([
    { key: 'a', segs: [{ text: '████', fx: 'grow', key: 'bar', width: 6 }] },
    { key: 'b', isDone: true, segs: [{ text: 'x' }] },
  ])
  const start = stepAnim(undefined, rows, 0)

  expect(start.frame).toBe(0)
  expect(start.shown).toEqual({})
  // Nothing slides in or fades on arrival: both were there "long ago".
  expect(start.seen.a).toBeLessThan(-100)
  expect(start.over.b).toBeLessThan(-100)
})

test('a bar grows to its length and a meter to its value, then both rest', () => {
  const rows = props([
    {
      segs: [
        { text: '██████', fx: 'grow', key: 'bar' },
        { text: '', fx: 'meter', key: 'ctx', value: 38, width: 8 },
      ],
    },
  ])

  expect(paceOf(rows, stepAnim(undefined, rows, 0))).toBe('fast')

  const one = run(rows, 1)
  expect(one.shown.bar).toBeGreaterThan(0)
  expect(one.shown.bar).toBeLessThan(6)

  const settled = run(rows, 30)
  expect(settled.shown).toEqual({ bar: 6, ctx: 38 })
  expect(paceOf(rows, settled)).toBe('still')
})

test('a row that appears later slides in, and one that ends fades, for a few frames', () => {
  const first = props([{ key: 'a', segs: [{ text: 'a' }] }])
  const settled = run(first, 10)

  const more = props([
    { key: 'a', isDone: true, segs: [{ text: 'a' }] },
    { key: 'b', segs: [{ text: 'b' }] },
  ])
  const next = stepAnim(settled, more, 120)

  expect(next.seen.b).toBe(next.frame)
  expect(next.over.a).toBe(next.frame)
  expect(paceOf(more, next)).toBe('fast')
  expect(paceOf(more, run(more, 12, next))).toBe('still')
})

test('clocks alone ask for a slow pace; a spinner, a pulse or dots for a fast one', () => {
  const clock = props([{ segs: [{ text: '', fx: 'clock', since: 0 }] }])
  expect(paceOf(clock, run(clock, 10))).toBe('slow')

  for (const fx of ['spin', 'pulse', 'dots'] as const) {
    const moving = props([{ segs: [{ text: '●', alt: '◉', fx }] }])
    expect(paceOf(moving, run(moving, 10))).toBe('fast')
  }

  const still = props([{ segs: [{ text: 'quieto' }] }])
  expect(paceOf(still, run(still, 10))).toBe('still')
})

test('time adds up between steps and starts over when newer props arrive', () => {
  const rows = props([{ segs: [{ text: '', fx: 'clock', since: 0 }] }])
  const anim = run(rows, 5)
  expect(anim.ms).toBe(600)

  const newer = props(rows.rows, { now: 5000 })
  expect(animFor(anim, newer).ms).toBe(0)
  expect(stepAnim(anim, newer, 120).ms).toBe(0)
  expect(animFor(anim, rows)).toBe(anim)
})

test('another tab starts its motion over, with its charts rising again', () => {
  const agents = props([{ key: 'a', segs: [{ text: 'a' }] }])
  const settled = run(agents, 20)
  const cost = props([{ key: 'cost', chart: [1, 2, 3], height: 3 }], { tab: 'costo' })

  const swapped = animFor(settled, cost)
  expect(swapped.tab).toBe('costo')
  expect(swapped.tabFrame).toBe(settled.frame)
  expect(paceOf(cost, swapped)).toBe('fast')
  expect(paceOf(cost, run(cost, 12, swapped))).toBe('still')
})

test('the agents are listed live first, then the latest finished, and counted while at work', () => {
  let h = openAgent(EMPTY, { id: 'old', type: 'Explore', description: 'viejo' }, 10)
  h = closeAgent(h, { id: 'old', reason: 'answer' }, 20)
  h = openAgent(h, { id: 'new', type: 'Plan', description: 'nuevo' }, 30)
  h = openAgent(h, { id: 'mid', type: 'Explore', description: 'medio' }, 25)

  expect(listedAgents(h, true).map(agent => agent.id)).toEqual(['new', 'mid', 'old'])
  expect(listedAgents(h, false).map(agent => agent.id)).toEqual(['new', 'mid'])
  expect(liveAgents(h)).toBe(2)

  // One that works again after ending (a teammate's next turn) is live again.
  const back = startTool(h, 'old', 'Bash', 40)
  expect(liveAgents(back)).toBe(3)
  expect(liveAgents(addStep(closeAgent(back, { id: 'new', reason: 'error' }, 50), { turnId: 't', isMain: false, agentId: 'mid' }, null, 60))).toBe(2)
})

// Whether `undefined` sits anywhere in a value (the engine refuses it in a surface module's props).
const hasUndefined = (value: unknown): boolean => {
  if (value === undefined) return true
  if (value === null || typeof value !== 'object') return false

  return Object.values(value).some(hasUndefined)
}

test('what is handed to the moving drawing holds nothing undefined, whatever the session held', () => {
  // A model the list lacks has no color, an agent no model, a turn no reason yet.
  let h = addStep(EMPTY, { turnId: 't', isMain: true }, { model: 'some-other-model', input_tokens: 5, output_tokens: 5, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 }, 10)
  h = openAgent(h, { id: 'a', type: 'Explore', description: 'x' }, 20)
  h = startTool(h, 'a', 'Bash', 30)

  for (const tab of ['costo', 'modelos', 'tools', 'ritmo', 'agentes', 'juegos'] as const) {
    const props = liveProps({ columns: 64, tab, history: h, now: 100, showDone: true, usage: { startedAt: undefined, percent: undefined } })

    expect(hasUndefined(plainData(props))).toBe(false)
    expect(plainData(props).rows.length).toBe(props.rows.length)
  }

  expect(hasUndefined(plainData({ color: undefined, rows: [{ segs: [{ text: 'a', color: undefined }] }] }))).toBe(false)
})
