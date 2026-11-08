import type { On } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'

import { ALERT_AT, alertsFor, labelOf, limitSegs, resetsIn, sortLimits } from '../hooks/limits'
import type { Limit } from '../hooks/limits'
import { limitsRow } from '../hooks/rows'
import type { View } from '../hooks/rows'
import { EMPTY } from '../hooks/history'
import { statsLine } from '../hooks/stats'

const NOW = Date.parse('2026-11-08T12:00:00Z')
const at = (ms: number): string => new Date(NOW + ms).toISOString()
const HOUR = 3_600_000

const FIVE: Limit = { kind: 'five_hour', percentUsed: 42.4, resetsAt: at(2 * HOUR + 10 * 60_000) }
const WEEK: Limit = { kind: 'seven_day', percentUsed: 18, resetsAt: at(3 * 24 * HOUR + 4 * HOUR) }
const FABLE: Limit = { kind: 'seven_day_fable', percentUsed: 71 }

test('each window has a short name, an unknown one its own kind', () => {
  expect(labelOf('five_hour')).toBe('5h')
  expect(labelOf('seven_day')).toBe('semana')
  expect(labelOf('seven_day_fable')).toBe('fable')
  expect(labelOf('spend_limit')).toBe('gasto')
  expect(labelOf('seven_day_opus')).toBe('seven day opus')
})

test('the windows go 5 hours, the week, Fable, then the rest', () => {
  const other: Limit = { kind: 'seven_day_opus', percentUsed: 5 }

  expect(sortLimits([other, FABLE, WEEK, FIVE]).map(limit => limit.kind)).toEqual(['five_hour', 'seven_day', 'seven_day_fable', 'seven_day_opus'])
  expect(sortLimits([{ kind: 'five_hour', percentUsed: Number.NaN }])).toEqual([])
})

test('the time to a reset reads in days, hours or minutes', () => {
  expect(resetsIn(FIVE.resetsAt, NOW)).toBe('2h 10m')
  expect(resetsIn(WEEK.resetsAt, NOW)).toBe('3d 4h')
  expect(resetsIn(at(30_000), NOW)).toBe('1m')
  expect(resetsIn(at(-1), NOW)).toBeUndefined()
  expect(resetsIn(undefined, NOW)).toBeUndefined()
  expect(resetsIn('not a date', NOW)).toBeUndefined()
})

test('a window is its name, a meter and the percent, and the reset when asked', () => {
  const segs = limitSegs(FIVE, 6, NOW)

  expect(segs.map(seg => seg.text).join('')).toBe('5h  42% ↻ 2h 10m')
  expect(segs.find(seg => seg.fx === 'meter')).toMatchObject({ key: 'limit:five_hour', value: 42, width: 6 })
  expect(limitSegs(FIVE, 6).some(seg => seg.text.includes('↻'))).toBe(false)
  // Past 100 (an exceeded spend limit) the meter stays full and the percent says how far.
  const over = limitSegs({ kind: 'spend_limit', percentUsed: 130 }, 6)
  expect(over.find(seg => seg.fx === 'meter')?.value).toBe(100)
  expect(over.at(-1)?.text).toBe(' 130%')
})

test('the band shows the windows after the costs, and drops them when narrow', () => {
  const stats = { answeredBy: 'claude-opus-5-5', effort: '', turnId: 't', input: 0, output: 0, cacheRead: 0, turnCost: 0, sessionCost: 0.02 }

  expect(statsLine(stats, false, 200, undefined, [WEEK, FIVE])).toBe('respondió Opus 5.5 · sesión ~$0.020 · 5h ▰▰▰▱▱▱ 42% · semana ▰▱▱▱▱▱ 18% · 0→0 tok')
  expect(statsLine(stats, false, 40, undefined, [FIVE])).toBe('respondió Opus 5.5 · sesión ~$0.020')
  expect(statsLine(null, false, 200, undefined, [FABLE])).toBe('fable ▰▰▰▰▱▱ 71%')
  expect(statsLine(stats, false, 200, undefined, [])).not.toMatch(/5h|semana/)
})

const view = (limits: readonly Limit[] | undefined, columns: number): View => ({
  columns,
  tab: 'costo',
  history: EMPTY,
  now: NOW,
  showDone: true,
  usage: { limits },
})

test('the pane lists the windows under its header, with resets while they fit', () => {
  const text = (columns: number) => limitsRow(view([FIVE, WEEK, FABLE], columns))?.segs.map(seg => seg.text).join('')

  expect(text(200)).toBe('límites 5h  42% ↻ 2h 10m · semana  18% ↻ 3d 4h · fable  71%')
  expect(text(60)).toBe('límites 5h  42% · semana  18% · fable  71%')
  expect(limitsRow(view([], 200))).toBeNull()
  expect(limitsRow(view(undefined, 200))).toBeNull()
})

test('a window past 90% warns once, and again after it drops back under', () => {
  const full: Limit = { ...FIVE, percentUsed: 92 }

  const first = alertsFor([full, WEEK], {}, NOW)
  expect(first.texts).toEqual(['Límite 5h al 92% · se renueva en 2h 10m'])
  expect(first.alerted).toEqual({ five_hour: true })

  expect(alertsFor([{ ...full, percentUsed: 95 }], first.alerted, NOW).texts).toEqual([])

  const reset = alertsFor([{ ...full, percentUsed: 3 }], first.alerted, NOW)
  expect(reset.alerted).toEqual({})
  expect(alertsFor([{ kind: 'five_hour', percentUsed: ALERT_AT }], reset.alerted, NOW).texts).toEqual(['Límite 5h al 90%'])
})

const pane = {
  plugin: 'model-picker',
  component: 'Pane',
  requestId: 'model-picker-stats',
  surface: 'terminal',
  props: { title: 'Estadísticas', isFocused: true, bodyColumns: 72, placement: 'dock', scroll: { offset: 0, bodyRows: 30 }, view: {} },
} as const

// A session on a subscription whose windows the test sets, and the toasts it raised.
const world = (on: On) => {
  const clock = mock.clock(on)
  mock.store(on)
  const toasts: string[] = []
  let limits: Limit[] = [FIVE, WEEK]
  on('session.model', () => ({ value: 'claude-opus-5-5' }))
  on('session.usage', () => ({ value: { startedAt: 0, context: { window: 1_000_000, percent: 38 }, rateLimits: limits } }))
  on('ui.toast', ($, e) => (toasts.push(e.text), { value: undefined }))
  on('session.measure', ($, e) => ({ changed: e.changed }))

  return { clock, toasts, set: (next: Limit[]) => void (limits = next) }
}

const measure = (rateLimits: Limit[]) => ({ context: { window: 1_000_000, percent: 38 }, rateLimits, changed: ['rateLimits' as const] })

test('the pane shows the windows, and a window past 90% raises one toast', async ($, on) => {
  const { toasts, set } = world(on)
  const ui = await $.ui.mount(pane)

  expect(await ui.find({ type: 'Text', text: /límites 5h/, in: 'live' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /semana/, in: 'live' })).toBeDefined()

  const full: Limit[] = [{ kind: 'five_hour', percentUsed: 93 }, WEEK]
  set(full)
  await $.session.measure(measure(full))
  await $.session.measure(measure(full))
  expect(toasts).toEqual(['Límite 5h al 93%'])

  // A measurement that is not about the windows warns about nothing.
  await $.session.measure({ ...measure([]), changed: ['cost'] })
  expect(toasts.length).toBe(1)
})
