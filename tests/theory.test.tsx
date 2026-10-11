import type { On } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'

import { wrap } from '../hooks/charts'
import { addNote, NOTE_CAP, noteOf, SECTION_ID, sectionFor, TOOL } from '../hooks/theory'

const PANE = 'model-picker-stats'
const IN = { in: 'live' } as const

const pane = {
  plugin: 'model-picker',
  component: 'Pane',
  requestId: PANE,
  surface: 'terminal',
  props: { title: 'Estadísticas', isFocused: true, bodyColumns: 60, placement: 'dock', scroll: { offset: 0, bodyRows: 30 }, view: {} },
} as const

const run = (args: string) => ({ command: 'modelo', args, source: 'user' }) as never

// A session with a clock, a model and a system prompt of one section.
const world = (on: On) => {
  const clock = mock.clock(on)
  mock.store(on)
  on('session.model', () => ({ value: 'claude-opus-5-5' }))
  on('session.usage', () => ({ value: { startedAt: 0, context: { window: 1_000_000, percent: 38 }, rateLimits: [] } }))
  on('prompt.compose', () => ({ sections: [{ id: 'intro', text: 'Hola.', scope: 'shared' as const }] }))

  return clock
}

const note = (title: string, explanation: string, where?: string) =>
  ({ tool: TOOL, title, explanation, ...(where === undefined ? {} : { where }) }) as never

test('a text wraps at its spaces, and a word longer than the line is cut', () => {
  expect(wrap('uno dos tres', 7)).toEqual(['uno dos', 'tres'])
  expect(wrap('abcdefgh ij', 3)).toEqual(['abc', 'def', 'gh', 'ij'])
  expect(wrap('   ', 5)).toEqual([])
})

test('a note needs a title and an explanation, and is kept trimmed', () => {
  expect(noteOf({ title: '  Debounce ', explanation: 'Espera\n  antes de correr.' })).toEqual({ title: 'Debounce', text: 'Espera antes de correr.' })
  expect(noteOf({ title: 'A', explanation: 'b', where: 'x.ts' })).toEqual({ title: 'A', text: 'b', where: 'x.ts' })
  expect(noteOf({ title: 'A' })).toBeUndefined()
  expect(noteOf({ title: ' ', explanation: 'b' })).toBeUndefined()
})

test('the notes keep the latest ones, each with an id of its own', () => {
  let notes = addNote([], { title: 'a', text: 'b' }, 1)
  for (let i = 0; i < NOTE_CAP + 5; i += 1) notes = addNote(notes, { title: `t${i}`, text: 'x' }, i)

  expect(notes.length).toBe(NOTE_CAP)
  expect(new Set(notes.map(n => n.id)).size).toBe(NOTE_CAP)
  expect(notes[notes.length - 1]?.title).toBe(`t${NOTE_CAP + 4}`)
})

test('each level asks for a different depth', () => {
  expect(sectionFor('aprender')).toMatch(/desde cero/)
  expect(sectionFor('experto')).toMatch(/trade-off/)
  expect(sectionFor('aprender')).toMatch(new RegExp(TOOL))
})

test('a note the agent tells shows in the theory tab, and is no tool call of the session', async ($, on) => {
  world(on)
  const ui = await $.ui.mount(pane)

  await ui.press({ key: 'teoria' })
  expect(await ui.find({ type: 'Text', text: /Sin notas todavía/, ...IN })).toBeDefined()

  const told = await $.tool.call(note('Debounce', 'Espera a que el usuario deje de escribir antes de buscar.', 'src/search.ts'))
  expect(told.deny).toBeUndefined()
  // The engine takes text for a tool's result, never an object.
  expect(told.result).toBe('Anotado en el panel: Debounce')

  expect(await ui.find({ type: 'Text', text: /TEORÍA · 1 nota · nivel aprendiendo/, ...IN })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /Debounce/, ...IN })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /src\/search\.ts/, ...IN })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /deje de escribir/, ...IN })).toBeDefined()

  await ui.press({ key: 'tools' })
  expect(await ui.find({ type: 'Text', text: /teoria/, ...IN })).toBeUndefined()

  await ui.press({ key: 'teoria' })
  await ui.press({ key: 'forget' })
  expect(await ui.find({ type: 'Text', text: /Debounce/, ...IN })).toBeUndefined()
})

test('a note with nothing in it is refused', async ($, on) => {
  world(on)

  expect((await $.tool.call(note('', 'x'))).deny).toMatch(/title/)
})

test('the system prompt asks for notes while they are on, at the level set', async ($, on) => {
  world(on)
  const facts = (tools: string[]) => ({ model: 'claude-opus-5-5', promptModel: 'claude-opus-5-5', surfaces: ['terminal' as const], tools, outputStyle: null, traits: [] })
  const compose = async () => (await $.prompt.compose(facts([TOOL]))).sections.find(section => section.id === SECTION_ID)

  expect((await compose())?.text).toMatch(/desde cero/)
  expect((await $.prompt.compose(facts(['Read']))).sections.some(section => section.id === SECTION_ID)).toBe(false)

  expect((await $.command.run(run('teoria experto'))).text).toMatch(/nivel experto/)
  expect((await compose())?.text).toMatch(/trade-off/)

  expect((await $.command.run(run('teoria off'))).text).toBe('Notas de teoría: apagadas')
  expect(await compose()).toBeUndefined()

  expect((await $.command.run(run('teoria'))).text).toMatch(/encendidas/)
  expect(await compose()).toBeDefined()
})

test('the tab turns the notes off and changes their level', async ($, on) => {
  world(on)
  const ui = await $.ui.mount(pane)
  await ui.press({ key: 'teoria' })

  await ui.press({ key: 'level' })
  expect(await ui.find({ type: 'Text', text: /nivel experto/, ...IN })).toBeDefined()

  await ui.press({ key: 'theory' })
  expect(await ui.find({ type: 'Text', text: /Notas apagadas/, ...IN })).toBeDefined()
})
