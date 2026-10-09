import type { On } from 'claude-code'
import type { Engine } from 'claude-code/testing'
import { expect, mock, test } from 'claude-code/testing'

const PANE = 'model-picker-stats'
const IN = { in: 'live' } as const

const pane = (bodyColumns: number) =>
  ({
    plugin: 'model-picker',
    component: 'Pane',
    requestId: PANE,
    props: {
      title: 'Estadísticas',
      isFocused: true,
      bodyColumns,
      placement: 'dock',
      scroll: { offset: 0, bodyRows: 30 },
      view: {},
    },
  }) as const

const SURFACES = ['terminal', 'desktop'] as const

type Listed = { id: string; description: string; type: string; status: 'running' | 'completed' | 'failed' }

// A session with a clock the test moves, a model, a toolbox that answers and a list of agents.
const world = (on: On, over: { isError?: boolean; agents?: Listed[] } = {}) => {
  const clock = mock.clock(on)
  on('session.model', () => ({ value: 'claude-opus-5-5' }))
  on('session.usage', () => ({ value: { startedAt: 0, context: { window: 1_000_000, percent: 38 }, rateLimits: [] } }))
  on('turn.start', (_$, e) => ({ turnId: e.turnId }))
  on('turn.complete', () => ({ text: '' }))
  on('session.end', (_$, e) => ({ sessionId: e.sessionId }))
  on('agent.list', () => ({ value: over.agents ?? [] }))
  on('agent.spawn', (_$, e) => ({ model: e.model ?? e.parentModel, agentId: `agent-${e.tool_use_id}` }))
  on('tool.call', () => (over.isError ? { isError: true, result: {}, text: 'boom' } : { result: {} }))
  on('turn.step', async function* (_$, e) {
    return {
      turnId: e.turnId,
      index: e.index,
      answer: '',
      toolUses: [],
      stopReason: null,
      usage: {
        input_tokens: 100_000,
        output_tokens: 20_000,
        cache_read_input_tokens: 900_000,
        cache_creation_input_tokens: 0,
        model: e.model,
      },
    }
  })

  return clock
}

const step = async ($: Engine, turnId: string, model: string, index = 0, agentId?: string) => {
  const input = { turnId, index, model, messageCount: 1, ...(agentId === undefined ? {} : { agentId }) }
  for await (const _ of $.turn.step(input)) void _
}

// One finished main-loop turn: a start, `steps` requests as `model`, a complete.
const turn = async ($: Engine, turnId: string, model = 'claude-haiku-5-5', steps = 1) => {
  await $.turn.start({ text: 'hola', turnId })
  for (let i = 0; i < steps; i += 1) await step($, turnId, model, i)
  await $.turn.complete({ answer: '', durationMs: 5000, isAborted: false, turnId, reason: 'answer' })
}

const spawn = ($: Engine, id: string, subagentType: string, description: string) =>
  $.agent.spawn({
    tool_use_id: id,
    prompt: 'go',
    description,
    subagentType,
    provider: { plugin: 'engine', tier: 'core' },
    parentModel: 'claude-opus-5-5',
    permissionMode: 'default',
    isFork: false,
  } as unknown as Parameters<Engine['agent']['spawn']>[0])

const toolAs = ($: Engine, agentId: string, tool: string) =>
  $.tool.call({ tool, command: 'x', agentId } as unknown as Parameters<Engine['tool']['call']>[0])

test('an empty session says the data is coming, and still offers its tabs', async ($, on) => {
  world(on)

  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ ...pane(60), surface })

    expect(await ui.find({ type: 'Text', text: /Todavía no hay datos/, ...IN })).toBeDefined()
    for (const tab of ['costo', 'modelos', 'tools', 'ritmo', 'agentes']) {
      expect(await ui.find({ key: tab })).toBeDefined()
    }

    await ui.unmount()
  }
})

test("the cost tab lists a turn's cost, tokens and cache share", async ($, on) => {
  world(on)

  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ ...pane(70), surface })
    await turn($, `cost-${surface}`)

    // Haiku 5.5: 0.1M in at $0.10 + 0.02M out at $0.50 + 0.9M cached at $0.01.
    expect(await ui.find({ type: 'Text', text: /\$0\.029/, ...IN })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /1\.0M→20k/, ...IN })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /90%/, ...IN })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /COSTO POR TURNO/, ...IN })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /contexto/, ...IN })).toBeDefined()

    await ui.unmount()
  }
})

test('a tab press switches the chart', async ($, on) => {
  world(on)
  const ui = await $.ui.mount({ ...pane(70), surface: 'terminal' })

  await turn($, 'a', 'claude-haiku-5-5', 2)
  await turn($, 'b', 'claude-opus-5-5')
  await $.tool.call({ tool: 'Bash', command: 'ls' })
  await $.tool.call({ tool: 'Bash', command: 'pwd' })
  await $.tool.call({ tool: 'Read', file_path: '/x' })

  await ui.press({ key: 'modelos' })
  expect(await ui.find({ type: 'Text', text: /USO POR MODELO/, ...IN })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /Haiku 5\.5/, ...IN })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /Opus 5\.5/, ...IN })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /COSTO POR TURNO/, ...IN })).toBeUndefined()

  await ui.press({ key: 'tools' })
  expect(await ui.find({ type: 'Text', text: /TOOLS · 3 llamadas · 0 errores/, ...IN })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /Bash/, ...IN })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /Read/, ...IN })).toBeDefined()

  await ui.press({ key: 'ritmo' })
  expect(await ui.find({ type: 'Text', text: /RITMO/, ...IN })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /2 pasos/, ...IN })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /respuesta/, ...IN })).toBeDefined()

  await ui.unmount()
})

test('a failed tool call counts as an error', async ($, on) => {
  world(on, { isError: true })
  const ui = await $.ui.mount({ ...pane(70), surface: 'terminal' })

  await $.tool.call({ tool: 'Bash', command: 'false' })
  await ui.press({ key: 'tools' })

  expect(await ui.find({ type: 'Text', text: /1 errores/, ...IN })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /1 err/, ...IN })).toBeDefined()

  await ui.unmount()
})

test('a narrow pane still draws its header and tabs', async ($, on) => {
  world(on)
  const ui = await $.ui.mount({ ...pane(36), surface: 'terminal' })
  await turn($, 'n')

  expect(await ui.find({ type: 'Text', text: /sesión/, ...IN })).toBeDefined()
  expect(await ui.find({ key: 'agentes' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /COSTO POR TURNO/, ...IN })).toBeDefined()

  await ui.unmount()
})

test("a /clear starts the session's numbers over", async ($, on) => {
  world(on)
  const ui = await $.ui.mount({ ...pane(60), surface: 'terminal' })
  await turn($, 'x')
  expect(await ui.find({ type: 'Text', text: /COSTO POR TURNO/, ...IN })).toBeDefined()

  await $.session.end({ reason: 'clear', sessionId: 's', resume: { id: 's' } })
  expect(await ui.find({ type: 'Text', text: /Todavía no hay datos/, ...IN })).toBeDefined()

  await ui.unmount()
})

test('the agents tab lists each agent with its model, cost, tools and what it is doing', async ($, on) => {
  world(on)

  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ ...pane(80), surface })
    await ui.press({ key: 'agentes' })

    const id = `agent-${surface}`
    await spawn($, surface, 'Explore', `buscar ${surface}`)
    await step($, 'sub', 'claude-haiku-5-5', 0, id)
    await step($, 'sub', 'claude-haiku-5-5', 1, id)
    await toolAs($, id, 'Grep')

    expect(await ui.find({ type: 'Text', text: /Explore/, ...IN })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: new RegExp(`buscar ${surface}`), ...IN })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /Haiku 5\.5/, ...IN })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /2 req/, ...IN })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /Grep ×1/, ...IN })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /\$0\.058/, ...IN })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /pensando/, ...IN })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /corriendo/, ...IN })).toBeDefined()

    await $.turn.complete({ answer: '', durationMs: 900, isAborted: false, turnId: 'sub', agentId: id, reason: 'answer' })
    expect(await ui.find({ type: 'Text', text: /terminados/, ...IN })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /pensando/, ...IN })).toBeUndefined()

    await ui.press({ key: 'done' })
    expect(await ui.find({ type: 'Text', text: new RegExp(`buscar ${surface}`), ...IN })).toBeUndefined()
    await ui.press({ key: 'done' })
    expect(await ui.find({ type: 'Text', text: new RegExp(`buscar ${surface}`), ...IN })).toBeDefined()

    await ui.press({ key: 'costo' })
    await ui.unmount()
  }
})

test('with no agents the tab says so', async ($, on) => {
  world(on)
  const ui = await $.ui.mount({ ...pane(80), surface: 'terminal' })
  await $.session.end({ reason: 'clear', sessionId: 's', resume: { id: 's' } })
  await ui.press({ key: 'agentes' })

  expect(await ui.find({ type: 'Text', text: /Sin agentes en esta sesión/, ...IN })).toBeDefined()

  await ui.press({ key: 'costo' })
  await ui.unmount()
})

test('an agent that fails is marked, and its failed tools too', async ($, on) => {
  world(on, { isError: true })
  const ui = await $.ui.mount({ ...pane(80), surface: 'terminal' })
  await ui.press({ key: 'agentes' })

  await spawn($, 'bad', 'general', 'correr los tests')
  await toolAs($, 'agent-bad', 'Bash')
  expect(await ui.find({ type: 'Text', text: /✕1/, ...IN })).toBeDefined()

  await $.turn.complete({ answer: '', durationMs: 3, isAborted: false, turnId: 'q', agentId: 'agent-bad', reason: 'error' })
  expect(await ui.find({ type: 'Text', text: / error/, ...IN })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /fallaron/, ...IN })).toBeDefined()

  await ui.press({ key: 'costo' })
  await ui.unmount()
})

test('the drawing moves: clocks run and the dots turn while an agent works', async ($, on) => {
  world(on)
  const ui = await $.ui.mount({ ...pane(80), surface: 'terminal' })
  await ui.press({ key: 'agentes' })

  await spawn($, 'live', 'Plan', 'diseñar')
  await ui.advance(240)
  const early = (await ui.findAll({ type: 'Text', ...IN })).map(node => node.text).join('|')

  await ui.advance(3000)
  const later = (await ui.findAll({ type: 'Text', ...IN })).map(node => node.text).join('|')

  // Three seconds on, the drawing's own clock has moved the agent's time on.
  expect(later).not.toBe(early)
  expect(later).toMatch(/3s/)

  await ui.press({ key: 'costo' })
  await ui.unmount()
})
