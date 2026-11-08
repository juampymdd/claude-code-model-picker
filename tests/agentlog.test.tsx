import type { On } from 'claude-code'
import type { Engine } from 'claude-code/testing'
import { expect, mock, test } from 'claude-code/testing'

const PANE = 'model-picker-stats'
const IN = { in: 'live' } as const
const ID = 'agent-x'

const pane = (bodyColumns: number) =>
  ({
    plugin: 'model-picker',
    component: 'Pane',
    requestId: PANE,
    surface: 'terminal',
    props: {
      title: 'Estadísticas',
      isFocused: true,
      bodyColumns,
      placement: 'dock',
      scroll: { offset: 0, bodyRows: 40 },
      view: {},
    },
  }) as const

// A session whose subagents think, write and call a tool as their response streams.
const world = (on: On) => {
  const clock = mock.clock(on)
  on('session.model', () => ({ value: 'claude-opus-5-5' }))
  on('session.usage', () => ({ value: { startedAt: 0, context: { window: 1_000_000, percent: 38 }, rateLimits: [] } }))
  on('turn.start', (_$, e) => ({ turnId: e.turnId }))
  on('turn.complete', () => ({ text: '' }))
  on('session.end', (_$, e) => ({ sessionId: e.sessionId }))
  on('agent.list', () => ({ value: [] }))
  on('agent.spawn', (_$, e) => ({ model: e.model ?? e.parentModel, agentId: `agent-${e.tool_use_id}` }))
  on('tool.call', () => ({ result: {} }))
  on('turn.step', async function* (_$, e) {
    if (e.agentId !== undefined) {
      yield { kind: 'thinking', index: 0, text: 'Busco dónde se define FAMILIES.' } as never
      yield { kind: 'text', index: 1, text: 'Voy a buscar ' } as never
      yield { kind: 'text', index: 1, text: 'en hooks/.' } as never
      yield { kind: 'tool', index: 2, id: 'tu1', name: 'Grep' } as never
    }

    return {
      turnId: e.turnId,
      index: e.index,
      answer: e.agentId === undefined ? '' : 'Voy a buscar en hooks/.',
      toolUses: [],
      stopReason: null,
      usage: { input_tokens: 1000, output_tokens: 100, cache_read_input_tokens: 0, cache_creation_input_tokens: 0, model: e.model },
    }
  })

  return clock
}

const spawn = ($: Engine) =>
  $.agent.spawn({
    tool_use_id: 'x',
    prompt: 'go',
    description: 'buscar FAMILIES',
    subagentType: 'Explore',
    provider: { plugin: 'engine', tier: 'core' },
    parentModel: 'claude-opus-5-5',
    permissionMode: 'default',
    isFork: false,
  } as unknown as Parameters<Engine['agent']['spawn']>[0])

const step = async ($: Engine, agentId?: string, turnId = 'sub') => {
  const input = { turnId, index: 0, model: 'claude-haiku-5-5', messageCount: 1, ...(agentId === undefined ? {} : { agentId }) }
  for await (const _ of $.turn.step(input)) void _
}

const grep = ($: Engine, agentId?: string) =>
  $.tool.call({ tool: 'Grep', pattern: 'FAMILIES', path: 'hooks', tool_use_id: 'tu1', ...(agentId === undefined ? {} : { agentId }) } as unknown as Parameters<
    Engine['tool']['call']
  >[0])

test("a press on an agent shows its log: what it wrote, the tool it called with what for, and its answer", async ($, on) => {
  world(on)
  const ui = await $.ui.mount(pane(80))
  await ui.press({ key: 'agentes' })

  await spawn($)
  await step($, ID)
  await grep($, ID)

  await ui.press({ key: `w:${ID}` })
  expect(await ui.find({ type: 'Text', text: /todos los agentes/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /Voy a buscar en hooks\// , ...IN })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /Grep/, ...IN })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /"FAMILIES" hooks/, ...IN })).toBeDefined()

  // Its thinking shows only when asked for.
  expect(await ui.find({ type: 'Text', text: /Busco dónde/, ...IN })).toBeUndefined()
  await ui.press({ key: 'thinking' })
  expect(await ui.find({ type: 'Text', text: /Busco dónde/, ...IN })).toBeDefined()

  await $.turn.complete({ answer: 'Está en hooks/models.ts.', durationMs: 900, isAborted: false, turnId: 'sub', agentId: ID, reason: 'answer' })
  expect(await ui.find({ type: 'Text', text: /RESPUESTA/, ...IN })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /Está en hooks\/models\.ts\./, ...IN })).toBeDefined()

  await ui.press({ key: 'back' })
  expect(await ui.find({ type: 'Text', text: /ver:/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /RESPUESTA/, ...IN })).toBeUndefined()

  await ui.unmount()
})

test('a /clear forgets the logs and goes back to the list', async ($, on) => {
  world(on)
  const ui = await $.ui.mount(pane(80))
  await ui.press({ key: 'agentes' })
  await spawn($)
  await step($, ID)
  await ui.press({ key: `w:${ID}` })
  expect(await ui.find({ type: 'Text', text: /todos los agentes/ })).toBeDefined()

  await $.session.end({ reason: 'clear', sessionId: 's' } as unknown as Parameters<Engine['session']['end']>[0])
  expect(await ui.find({ type: 'Text', text: /todos los agentes/ })).toBeUndefined()

  await ui.unmount()
})

// The band's data row is drawn by its own client.
const ROW = { in: 'datos' } as const

const BAND = {
  plugin: 'model-picker',
  component: 'AbovePrompt',
  surface: 'terminal',
  props: { hasSurvey: false, isWorking: false, maxRows: 10, bodyColumns: 160, scroll: { offset: 0, bodyRows: 10 }, view: {} },
} as const

test('while Claude works, the band leads with what it is doing, and says who answered once done', async ($, on) => {
  world(on)
  const ui = await $.ui.mount(BAND)

  await $.turn.start({ text: 'hola', turnId: 'main' })
  await step($, undefined, 'main')
  expect(await ui.find({ type: 'Text', text: /pensando/, ...ROW })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /respondió/, ...ROW })).toBeUndefined()

  await spawn($)
  await step($, ID)
  expect(await ui.find({ type: 'Text', text: /Explore ▸ pensando/, ...ROW })).toBeDefined()

  await $.turn.complete({ answer: '', durationMs: 900, isAborted: false, turnId: 'sub', agentId: ID, reason: 'answer' })
  await $.turn.complete({ answer: '', durationMs: 900, isAborted: false, turnId: 'main', reason: 'answer' })
  expect(await ui.find({ type: 'Text', text: /respondió/, ...ROW })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /pensando/, ...ROW })).toBeUndefined()

  await ui.unmount()
})
