import type { On } from 'claude-code'
import type { Engine } from 'claude-code/testing'
import { expect, mock, test } from 'claude-code/testing'

const PANE = 'model-picker-stats'

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

// A session with a clock that stands still, a model, and a toolbox that answers.
const world = (on: On, tool: { isError?: boolean } = {}) => {
  mock.clock(on)
  on('session.model', () => ({ value: 'claude-opus-5-5' }))
  on('session.usage', () => ({ value: { startedAt: 0, context: { window: 1_000_000, percent: 38 }, rateLimits: [] } }))
  on('turn.start', (_$, e) => ({ turnId: e.turnId }))
  on('turn.complete', () => ({ text: '' }))
  on('session.end', (_$, e) => ({ sessionId: e.sessionId }))
  on('tool.call', () => (tool.isError ? { isError: true, result: {}, text: 'boom' } : { result: {} }))
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
}

// One finished main-loop turn: a start, `steps` requests as `model`, a complete.
const turn = async ($: Engine, turnId: string, model = 'claude-haiku-5-5', steps = 1) => {
  await $.turn.start({ text: 'hola', turnId })
  for (let i = 0; i < steps; i += 1) {
    for await (const _ of $.turn.step({ turnId, index: i, model, messageCount: 1 })) void _
  }
  await $.turn.complete({ answer: '', durationMs: 5000, isAborted: false, turnId, reason: 'answer' })
}

test('an empty session says the data is coming, and still offers its tabs', async ($, on) => {
  world(on)

  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ ...pane(60), surface })

    expect(await ui.find({ type: 'Text', text: /Todavía no hay datos/ })).toBeDefined()
    for (const tab of ['costo', 'modelos', 'tools', 'ritmo']) {
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
    expect(await ui.find({ type: 'Text', text: /\$0\.029/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /1\.0M→20k/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /90%/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /COSTO POR TURNO/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /contexto 38%/ })).toBeDefined()

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
  expect(await ui.find({ type: 'Text', text: /USO POR MODELO/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /Haiku 5\.5/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /Opus 5\.5/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /COSTO POR TURNO/ })).toBeUndefined()

  await ui.press({ key: 'tools' })
  expect(await ui.find({ type: 'Text', text: /TOOLS · 3 llamadas · 0 errores/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /Bash/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /Read/ })).toBeDefined()

  await ui.press({ key: 'ritmo' })
  expect(await ui.find({ type: 'Text', text: /RITMO/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /3 pasos/ })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: /2 pasos/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /respuesta/ })).toBeDefined()

  await ui.unmount()
})

test('a failed tool call counts as an error, and a denied one too', async ($, on) => {
  world(on, { isError: true })
  const ui = await $.ui.mount({ ...pane(70), surface: 'terminal' })

  await $.tool.call({ tool: 'Bash', command: 'false' })
  await ui.press({ key: 'tools' })

  expect(await ui.find({ type: 'Text', text: /1 errores/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /1 err/ })).toBeDefined()

  await ui.unmount()
})

test('a narrow pane still draws its header and tabs', async ($, on) => {
  world(on)
  const ui = await $.ui.mount({ ...pane(36), surface: 'terminal' })
  await turn($, 'n')

  expect(await ui.find({ type: 'Text', text: /sesión/ })).toBeDefined()
  expect(await ui.find({ key: 'ritmo' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /COSTO POR TURNO/ })).toBeDefined()

  await ui.unmount()
})

test("a /clear starts the session's numbers over", async ($, on) => {
  world(on)
  const ui = await $.ui.mount({ ...pane(60), surface: 'terminal' })
  await turn($, 'x')
  expect(await ui.find({ type: 'Text', text: /COSTO POR TURNO/ })).toBeDefined()

  await $.session.end({ reason: 'clear', sessionId: 's', resume: { id: 's' } })
  expect(await ui.find({ type: 'Text', text: /Todavía no hay datos/ })).toBeDefined()

  await ui.unmount()
})
