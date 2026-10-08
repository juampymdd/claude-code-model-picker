import type { On } from 'claude-code'
import type { Engine } from 'claude-code/testing'
import { expect, test } from 'claude-code/testing'

const BAND = {
  plugin: 'model-picker',
  component: 'AbovePrompt',
  props: {
    hasSurvey: false,
    isWorking: false,
    maxRows: 10,
    bodyColumns: 120,
    scroll: { offset: 0, bodyRows: 10 },
    view: {},
  },
} as const

const run = (args: string) =>
  ({
    command: 'modelo',
    args,
    origin: { kind: 'composer' },
    presentation: { isFullscreen: true, columns: 80 },
  }) as const

const STEP = { turnId: 't', index: 0, model: 'session-model', messageCount: 1 }
const DONE = { answer: '', toolUses: [], stopReason: null, usage: null } as const

const stubSession = (on: On, name: string) => on('session.model', () => ({ value: name }))

// A step that answers as the model it was asked for, recording what it was asked.
const stubStep = (on: On, sent: string[]) =>
  on('turn.step', async function* (_$, e) {
    sent.push(e.model)

    return {
      turnId: e.turnId,
      index: e.index,
      ...DONE,
      usage: { input_tokens: 1, output_tokens: 1, cache_read_input_tokens: 0, cache_creation_input_tokens: 0, model: e.model },
    }
  })

const step = async ($: Engine, extra = {}) => {
  for await (const _ of $.turn.step({ ...STEP, ...extra })) void _
}

test('a press sends the main loop to that model at once, and the session model drops it', async ($, on) => {
  stubSession(on, 'claude-opus-5-5')
  const sent: string[] = []
  stubStep(on, sent)

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...BAND, surface })

    await ui.press({ key: 'haiku' })
    expect(await ui.find({ type: 'Text', text: /● Haiku 5\.5 ▾/ })).toBeDefined()
    await step($)
    await step($, { agentId: 'sub' })
    await ui.press({ key: 'opus' })
    await ui.press({ key: 'opus' })
    await ui.press({ key: 'opus-5.5' })
    await step($)

    await ui.unmount()
  }

  expect(sent).toEqual([
    'claude-haiku-5-5', 'session-model', 'session-model',
    'claude-haiku-5-5', 'session-model', 'session-model',
  ])
})

test('the active chip opens its versions, and a pick there switches and closes', async ($, on) => {
  stubSession(on, 'claude-opus-5-5')
  const sent: string[] = []
  stubStep(on, sent)

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...BAND, surface })

    expect(await ui.find({ key: 'opus-4.8' })).toBeUndefined()
    await ui.press({ key: 'opus' })
    expect(await ui.find({ key: 'opus-5.5' })).toBeDefined()
    expect(await ui.find({ key: 'opus-4.8' })).toBeDefined()

    await ui.press({ key: 'opus-4.8' })
    expect(await ui.find({ key: 'opus-4.8' })).toBeUndefined()
    expect(await ui.find({ type: 'Text', text: /◆ Opus 4\.8 ▾/ })).toBeDefined()
    await step($)

    await ui.press({ key: 'opus' })
    await ui.press({ key: 'opus' })
    expect(await ui.find({ key: 'opus-5.5' })).toBeUndefined()

    await ui.unmount()
  }

  expect(sent).toEqual(['claude-opus-4-8', 'claude-opus-4-8'])
})

test('the stats row reports what the API said of the responses', async ($, on) => {
  stubSession(on, 'claude-opus-5-5')
  on('turn.step', async function* (_$, e) {
    return {
      turnId: e.turnId,
      index: e.index,
      ...DONE,
      usage: {
        input_tokens: 100_000,
        output_tokens: 20_000,
        cache_read_input_tokens: 900_000,
        cache_creation_input_tokens: 0,
        model: e.model,
      },
    }
  })

  for (const surface of ['terminal', 'desktop'] as const) {
    await $.command.run(run('auto'))
    const ui = await $.ui.mount({ ...BAND, surface })

    await ui.press({ key: 'haiku' })
    await step($, { effort: 'medium', turnId: surface })

    // Haiku 5.5: 0.1M in at $0.10 + 0.02M out at $0.50 + 0.9M cached at $0.01.
    const row = await ui.find({ type: 'Text', text: /respondió Haiku 5\.5/ })
    expect(row?.text).toMatch(/turno ~\$0\.029/)
    expect(row?.text).toMatch(/effort medium/)
    expect(row?.text).toMatch(/1\.0M→20k tok/)
    expect(row?.text).toMatch(/cache 90%/)
    expect(row?.text).toMatch(/manual$/)

    await ui.press({ key: 'haiku' })
    expect(await ui.find({ type: 'Text', text: /respondió/ })).toBeUndefined()
    expect(await ui.find({ type: 'Text', text: /\$0\.10\/\$0\.50 por MTok/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /\$1\/\$5 por MTok/ })).toBeDefined()
    await ui.press({ key: 'haiku' })

    await ui.unmount()
  }
})

test('the command picks a family and a version, and refuses an unknown name', async ($, on) => {
  stubSession(on, 'claude-opus-5-5')
  const sent: string[] = []
  stubStep(on, sent)

  expect((await $.command.run(run('haiku 4.5'))).text).toBe('Modelo: Haiku 4.5')
  await step($)
  expect((await $.command.run(run(''))).text).toMatch(/^Modelo: Opus 5\.5/)
  expect((await $.command.run(run('auto'))).text).toBe('Modelo: el de la sesión')
  await step($)
  expect((await $.command.run(run('gpt'))).text).toMatch(/desconocido/)
  expect((await $.command.run(run('opus 9'))).text).toMatch(/desconocido/)
  expect(sent).toEqual(['claude-haiku-4-5', 'session-model'])
})
