import type { On } from 'claude-code'
import type { Engine } from 'claude-code/testing'
import { expect, mock, test } from 'claude-code/testing'

const GAME = { in: 'game' } as const

const pane = (bodyColumns: number) =>
  ({
    plugin: 'model-picker',
    component: 'Pane',
    requestId: 'model-picker-stats',
    props: {
      title: 'Estadísticas',
      isFocused: true,
      bodyColumns,
      placement: 'dock',
      scroll: { offset: 0, bodyRows: 30 },
      view: {},
    },
  }) as const

const run = (args: string) =>
  ({
    command: 'modelo',
    args,
    origin: { kind: 'composer' },
    presentation: { isFullscreen: true, columns: 80 },
  }) as const

const world = (on: On) => {
  mock.clock(on)
  mock.store(on)
  on('session.model', () => ({ value: 'claude-opus-5-5' }))
  on('session.usage', () => ({ value: { startedAt: 0, context: { window: 1_000_000 }, rateLimits: [] } }))
}

type Mounted = Pick<Awaited<ReturnType<Engine['ui']['mount']>>, 'find' | 'findAll' | 'press'>

// Opens the list of games and picks one (which closes the list).
const pick = async (ui: Mounted, game: string) => {
  await ui.press({ key: 'menu' })
  await ui.press({ key: game })
}

// The games tab on or off, whatever an earlier test left.
const setGames = async ($: Engine, ui: Mounted, isOn: boolean) => {
  if (((await ui.find({ key: 'juegos' })) !== undefined) !== isOn) await $.command.run(run('juegos'))
}

// Everything the game draws, as one text.
const screen = async (ui: Mounted): Promise<string> =>
  (await ui.findAll({ type: 'Text', ...GAME }))
    .map(node => node.text)
    .join('\n')

test('the play tab is there from the start, and /modelo juegos hides it and brings it back', async ($, on) => {
  world(on)
  const ui = await $.ui.mount({ ...pane(70), surface: 'terminal' })
  await setGames($, ui, false)

  expect(await ui.find({ key: 'juegos' })).toBeUndefined()
  expect((await $.command.run(run('juegos'))).text).toMatch(/^Juegos: habilitados/)
  expect(await ui.find({ key: 'juegos' })).toBeDefined()

  await ui.press({ key: 'juegos' })
  expect(await ui.find({ key: 'game' })).toBeDefined()

  // Turned off while it is shown, the pane goes back to its first tab.
  expect((await $.command.run(run('juegos'))).text).toBe('Juegos: deshabilitados')
  expect(await ui.find({ key: 'juegos' })).toBeUndefined()
  expect(await ui.find({ key: 'game' })).toBeUndefined()

  await ui.unmount()
})

test('pong waits for a click, then plays: the ball moves and a key moves the paddle', async ($, on) => {
  world(on)

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...pane(70), surface })
    await setGames($, ui, true)
    await ui.press({ key: 'juegos' })
    await pick(ui, 'pong')

    expect(await screen(ui)).toMatch(/clic o espacio para jugar/)
    const waiting = await screen(ui)
    await ui.advance(500)
    expect(await screen(ui)).toBe(waiting)

    await ui.pointer({ type: 'down', x: 10, y: 5, button: 'left', ...GAME })
    await ui.advance(400)
    const playing = await screen(ui)
    expect(playing).not.toMatch(/para jugar/)
    expect(playing).not.toBe(waiting)

    await ui.key({ key: 'up', ...GAME })
    await ui.key({ key: 'up', ...GAME })
    await ui.advance(400)
    expect(await screen(ui)).not.toBe(playing)

    await ui.key({ key: ' ', ...GAME })
    expect(await screen(ui)).toMatch(/PAUSA/)
    const paused = await screen(ui)
    await ui.advance(500)
    expect(await screen(ui)).toBe(paused)

    await ui.key({ key: 'r', ...GAME })
    expect(await screen(ui)).not.toMatch(/PAUSA/)

    await ui.key({ key: 'p', ...GAME })
    await ui.press({ key: 'costo' })
    await ui.unmount()
  }
})

test('the other game is one press away: invaders march, and space fires', async ($, on) => {
  world(on)
  const ui = await $.ui.mount({ ...pane(70), surface: 'terminal' })
  await setGames($, ui, true)
  await ui.press({ key: 'juegos' })
  await pick(ui, 'invaders')

  expect(await screen(ui)).toMatch(/PUNTOS/)
  expect(await screen(ui)).toMatch(/▚▞/)

  await ui.key({ key: ' ', ...GAME })
  await ui.advance(200)
  const before = await screen(ui)
  expect(before).not.toMatch(/para jugar/)

  await ui.key({ key: ' ', ...GAME })
  await ui.advance(100)
  expect(await screen(ui)).toMatch(/│/)

  await ui.advance(2000)
  expect(await screen(ui)).not.toBe(before)

  await ui.key({ key: 'p', ...GAME })
  await pick(ui, 'pong')
  await ui.press({ key: 'costo' })
  await ui.unmount()
})

test('a finished game posts its score, and the best one is kept and shown', async ($, on) => {
  world(on)
  const ui = await $.ui.mount({ ...pane(70), surface: 'terminal' })
  await setGames($, ui, true)
  await ui.press({ key: 'juegos' })
  await pick(ui, 'invaders')

  await ui.post({ game: 'invaders', score: 500 }, GAME)
  expect(await ui.find({ type: 'Text', text: /Space Invaders · récord 500/ })).toBeDefined()

  // A lower score does not replace it; something that is not a score, or not a game, is ignored.
  await ui.post({ game: 'invaders', score: 120 }, GAME)
  await ui.post({ game: 'ajedrez', score: 9999 }, GAME)
  await ui.post({ game: 'pong', score: 'mucho' }, GAME)
  expect(await ui.find({ type: 'Text', text: /Space Invaders · récord 500/ })).toBeDefined()

  await ui.post({ game: 'pong', score: 7 }, GAME)
  await ui.press({ key: 'menu' })
  expect(await ui.find({ type: 'Text', text: /Pong\s+7 / })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /Space Invaders\s+500 / })).toBeDefined()
  expect(await ui.find({ key: 'game' })).toBeUndefined()

  // Picking one closes the list and shows the game.
  await ui.press({ key: 'pong' })
  expect(await ui.find({ key: 'game' })).toBeDefined()
  await ui.press({ key: 'costo' })
  await ui.unmount()
})

test('a pane too narrow to play says so', async ($, on) => {
  world(on)
  const ui = await $.ui.mount({ ...pane(30), surface: 'terminal' })
  await setGames($, ui, true)
  await ui.press({ key: 'juegos' })

  expect(await screen(ui)).toMatch(/Panel muy angosto para/)

  await ui.press({ key: 'costo' })
  await setGames($, ui, false)
  await ui.unmount()
})

test('the play tab is offered without asking for it', async ($, on) => {
  world(on)
  const ui = await $.ui.mount({ ...pane(70), surface: 'terminal' })
  await $.session.end({ reason: 'other', sessionId: 's', resume: { id: 's' } }).catch(() => undefined)

  await setGames($, ui, true)
  expect(await ui.find({ type: 'Text', text: /▶ Jugar/ })).toBeDefined()

  await ui.unmount()
})
