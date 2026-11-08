import { expect, test } from 'claude-code/testing'

import { activityParts } from '../hooks/activity'
import { EMPTY, openAgent, openTurn, startTool } from '../hooks/history'
import { argsOf, EMPTY_LOG, endCall, ENTRY_CAP, LOG_CAP, setAnswer, settleText, startCall, streamText, withLog } from '../hooks/log'
import { statsSegs } from '../hooks/stats'

const textOf = (parts: readonly { text: string }[][]): string => parts.map(part => part.map(seg => seg.text).join('')).join(' | ')

test('a call reads by the arguments that say what it is about', () => {
  expect(argsOf('Bash', { command: 'npm   test', description: 'run' })).toBe('npm test')
  expect(argsOf('Grep', { pattern: 'FAMILIES', path: 'hooks', output_mode: 'content' })).toBe('"FAMILIES" hooks')
  expect(argsOf('Read', { file_path: 'hooks/models.ts', limit: 20 })).toBe('hooks/models.ts')
  expect(argsOf('mcp__x__y', { count: 3, query: 'tabs' })).toBe('tabs')
  expect(argsOf('Read', {})).toBe('')
  expect([...argsOf('Bash', { command: 'x'.repeat(500) })].length).toBe(160)
})

test('streamed text joins the live entry, and settles whole', () => {
  let log = streamText(EMPTY_LOG, 'text', 'Voy a ', 1)
  log = streamText(log, 'text', 'buscar', 2)
  expect(log.entries).toEqual([{ kind: 'text', at: 1, text: 'Voy a buscar', isLive: true }])

  log = settleText(log, 'text', 'Voy a buscar en hooks/.', 3)
  expect(log.entries).toEqual([{ kind: 'text', at: 1, text: 'Voy a buscar en hooks/.' }])

  // With nothing live, a settled text is added; a blank one adds nothing.
  expect(settleText(EMPTY_LOG, 'text', 'listo', 5).entries).toHaveLength(1)
  expect(settleText(EMPTY_LOG, 'text', '', 5).entries).toHaveLength(0)
})

test('a new entry ends the live one before it', () => {
  let log = streamText(EMPTY_LOG, 'thinking', 'pienso', 1)
  log = streamText(log, 'text', 'escribo', 2)
  log = startCall(log, { id: 't1', name: 'Grep', args: '"x"' }, 3)

  expect(log.entries.map(entry => (entry.kind === 'tool' ? 'tool' : `${entry.kind}:${entry.isLive === true}`))).toEqual([
    'thinking:false',
    'text:false',
    'tool',
  ])
})

test('a call ends with its time and whether it failed; an unknown id is ignored', () => {
  const log = startCall(EMPTY_LOG, { id: 't1', name: 'Bash', args: 'npm test' }, 10)
  const done = endCall(log, 't1', 1200, true)

  expect(done.entries[0]).toEqual({ kind: 'tool', at: 10, id: 't1', name: 'Bash', args: 'npm test', ms: 1200, isError: true })
  expect(endCall(log, 'ghost', 5, false)).toEqual(log)
})

test('a log keeps its latest entries and counts the ones cut; only the latest logs are kept', () => {
  let log = EMPTY_LOG
  for (let i = 0; i < ENTRY_CAP + 7; i += 1) log = startCall(log, { id: `t${i}`, name: 'Read', args: '' }, i)
  expect(log.entries).toHaveLength(ENTRY_CAP)
  expect(log.dropped).toBe(7)

  let logs = {}
  for (let i = 0; i < LOG_CAP + 2; i += 1) logs = withLog(logs, `a${i}`, was => was)
  expect(Object.keys(logs)).toHaveLength(LOG_CAP)
  expect(Object.keys(logs)).not.toContain('a0')
})

test('the answer is kept whole; a blank one changes nothing', () => {
  expect(setAnswer(EMPTY_LOG, '  Está en hooks/models.ts.  ').answer).toBe('Está en hooks/models.ts.')
  expect(setAnswer(EMPTY_LOG, '   ')).toEqual(EMPTY_LOG)
})

test('the band leads with the tool at work, or with thinking while a turn is open', () => {
  expect(activityParts(EMPTY, null)).toEqual([])

  const open = openTurn(EMPTY, 't', 0)
  expect(textOf(activityParts(open, null))).toBe('pensando')
  expect(textOf(activityParts(open, { tool: 'Bash', args: 'npm test', since: 5 }))).toBe('⠋ Bash npm test ')

  const closed = { ...open, turns: open.turns.map(turn => ({ ...turn, durationMs: 10 })) }
  expect(activityParts(closed, null)).toEqual([])
})

test('the band names the newest agent at work and what it is doing', () => {
  let h = openAgent(EMPTY, { id: 'a', type: 'Plan', description: 'diseñar' }, 1)
  h = openAgent(h, { id: 'b', type: 'Explore', description: 'buscar' }, 2)
  expect(textOf(activityParts(h, null))).toBe('● Explore ▸ pensando +1')

  h = startTool(h, 'b', 'Grep', 3, '"FAMILIES" hooks')
  expect(textOf(activityParts(h, null))).toBe('● Explore ▸ Grep "FAMILIES" hooks +1')
})

test('with a lead, the stats row drops who answered and keeps the rest that fits', () => {
  const stats = { answeredBy: 'claude-opus-5-5', sessionCost: 0.42, turnCost: 0.03, effort: 'medium', input: 1000, output: 10, cacheRead: 900 }
  const lead = [[{ text: 'pensando', fx: 'dots' as const }]]
  const row = statsSegs(stats as Parameters<typeof statsSegs>[0], false, 200, undefined, lead)
    .map(seg => seg.text)
    .join('')

  expect(row.startsWith('pensando · sesión ~$0.42')).toBe(true)
  expect(row).not.toContain('respondió')

  const narrow = statsSegs(stats as Parameters<typeof statsSegs>[0], false, 12, undefined, lead)
  expect(narrow.map(seg => seg.text).join('')).toBe('pensando')
})
