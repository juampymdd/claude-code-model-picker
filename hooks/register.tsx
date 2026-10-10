import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import { addStep, addTool, closeAgent, closeTurn, EMPTY, openAgent, openTurn, startTool, syncAgents } from './history'
import { FAMILIES, latest, pickOfId, pickOfName, pickOfText } from './models'
import type { Pick } from './models'
import { drawPane, PANE } from './pane'
import { liveAgents, plainData } from './rows'
import type { LiveProps } from './rows'
import type { Best } from '../types'
import { paint } from './paint'
import { priceLabel, statsSegs, tally } from './stats'
import { selfUpdate } from './update'
import type { Host } from './update'

const COMMAND = 'modelo'
const NAMES = ['auto', ...FAMILIES.map(f => f.choice)].join(' | ')
const INK = '#18181B'
// What the band draws before its first chip.
const HEAD = '▌ MODELO '

// Below these widths the band drops the note, then the unpicked names.
const NOTE_COLUMNS = 106
const NAME_COLUMNS = 70

const WAITING = 'costo, tokens y cache: tras la próxima respuesta'

const choice = atom({ plugin: 'model-picker', key: 'choice' } as const, 'auto')
// The family whose version dropdown is open; '' while none is.
const open = atom({ plugin: 'model-picker', key: 'open' } as const, '')
// What the API reported of the session's responses; null before the first.
const stats = atom({ plugin: 'model-picker', key: 'stats' } as const, null)
// What the stats pane charts: the session's turns, models and tools, and its tab.
const history = atom({ plugin: 'model-picker', key: 'record' } as const, EMPTY)
const tabOf = atom({ plugin: 'model-picker', key: 'tab' } as const, 'costo')
// Whether the agents tab lists the finished ones.
const showDone = atom({ plugin: 'model-picker', key: 'showDone' } as const, true)
// When the model was last switched, while its chip is still lit; 0 otherwise.
const flash = atom({ plugin: 'model-picker', key: 'flash' } as const, 0)

// The games tab: whether it is offered this session (it is, unless turned off), the game shown, the best scores.
const gamesOn = atom({ plugin: 'model-picker', key: 'games' } as const, true)
const gameOf = atom({ plugin: 'model-picker', key: 'game' } as const, 'pong')
const best = atom({ plugin: 'model-picker', key: 'best' } as const, { pong: 0, invaders: 0 })

// The key the best scores are kept under between sessions.
const BEST_KEY = 'games.best'

const FLASH_MS = 600
const AGENT_POLL_MS = 2000
const FLASH_FILL = '#FFFFFF'

const OPEN = { id: PANE, title: 'Estadísticas', focus: true, closeOnEscape: true, columns: 64 } as const

// Shows the stats pane, or closes it when it is up; says whether it is up now.
const togglePane = async ($: EngineInterface): Promise<boolean> => {
  const mine = (await $.ui.panes()).find(pane => pane.id === PANE)
  if (mine?.isShown) {
    await $.ui.close({ id: PANE })

    return false
  }

  // One that is open but not drawn (too narrow, or behind another tab) is reopened so it surfaces.
  if (mine !== undefined) await $.ui.close({ id: PANE })
  await $.ui.open(OPEN)

  return true
}

// What the pane shows of the session beyond its own history; nothing where it cannot be read.
const sessionUsage = async ($: EngineInterface) => {
  try {
    const usage = await $.session.usage()

    return { startedAt: usage.startedAt, percent: usage.context.percent, usd: usage.cost?.usd }
  } catch {
    return undefined
  }
}

// The session's own model as `/model` names it (`Opus 5.5`, `claude-opus-5-5`).
const pickOfSession = async ($: EngineInterface): Promise<Pick | undefined> => {
  try {
    return pickOfName(await $.session.model())
  } catch {
    return undefined
  }
}

// The main loop's requests name the picked model (`turn.step` below), which
// is instant and touches neither `/model` nor the saved default. Picking the
// session's own model drops the override.
const switchTo = async ($: EngineInterface, target: Pick): Promise<void> => {
  const own = await pickOfSession($)
  const isOwn = own?.family === target.family && own.version.version === target.version.version

  await update($, choice, () => (isOwn ? 'auto' : target.version.model))
  await update($, open, () => '')
  $.ui.invalidate('ui.render')

  // The chip lights up for a moment; a switch is done whether or not it does.
  try {
    const at = await $.clock.now()
    await update($, flash, () => at)
    $.clock.after(FLASH_MS, () => void update($, flash, was => (was === at ? 0 : was)))
  } catch {
    // no clock, no light
  }
}

// Brings the agents the pane lists up to Claude Code's own list, while any is at work.
const pollAgents = async ($: EngineInterface): Promise<void> => {
  try {
    const data = await read($, history)
    if (liveAgents(data) === 0) return

    const list = await $.agent.list()
    const now = await $.clock.now()
    const next = syncAgents(data, list, now)
    if (next !== data) await update($, history, was => syncAgents(was, list, now))
  } catch {
    // the list is a refinement: the pane keeps what the hooks saw
  }
}

// The host as the self-update reaches it.
const hostOf = ($: EngineInterface): Host => ({
  name: $.plugin.name,
  root: $.plugin.root,
  now: () => $.clock.now(),
  get: key => $.store.get(key),
  set: (key, value) => $.store.set(key, value),
  read: path => $.fs.read(path),
  exists: path => $.fs.exists(path),
  fetch: url => $.http.fetch(url),
  run: (argv, init) => $.process.run(argv, init),
  toast: text => $.ui.toast(text),
})

export const register: Register = (on, options) => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: COMMAND,
      description: `Elige el modelo de las próximas requests (${NAMES}) y su versión: /${COMMAND} opus 4.8; /${COMMAND} stats abre las estadísticas`,
    })

    // Left running: the session does not wait on the network to start.
    if (options.autoUpdate !== false) void selfUpdate(hostOf($))

    // The games are offered unless the option says not; their best scores come from the store.
    try {
      if (options.games === false) await update($, gamesOn, () => false)

      const kept = (await $.store.get(BEST_KEY)) as Partial<Best> | undefined
      if (kept !== undefined) await update($, best, was => ({ pong: Number(kept.pong ?? was.pong), invaders: Number(kept.invaders ?? was.invaders) }))
    } catch {
      // no store: the scores start at zero
    }

    try {
      $.clock.every(AGENT_POLL_MS, () => void pollAgents($))
    } catch {
      // without the timer the agents still show what the hooks saw of them
    }

    return next(e)
  })

  on('command.run', { command: COMMAND }, async ($, e) => {
    const text = e.args.trim().toLowerCase()

    if (text === '') {
      const own = await pickOfSession($)

      return { text: `Modelo: ${own ? `${own.family.label} ${own.version.version}` : 'desconocido'}. Uso: /${COMMAND} ${NAMES} [versión]` }
    }

    if (text === 'juegos') {
      const isOn = !(await read($, gamesOn))
      await update($, gamesOn, () => isOn)
      if (!isOn) await update($, tabOf, was => (was === 'juegos' ? 'costo' : was))

      return { text: `Juegos: ${isOn ? 'habilitados (pestaña ▶ Jugar del panel de estadísticas)' : 'deshabilitados'}` }
    }

    if (text === 'stats') {
      const isUp = await togglePane($)

      return { text: `Estadísticas: ${isUp ? 'abiertas' : 'cerradas'}` }
    }

    if (text === 'auto') {
      await update($, choice, () => 'auto')
      $.ui.invalidate('ui.render')

      return { text: 'Modelo: el de la sesión' }
    }

    const target = pickOfText(text)
    if (target === undefined) return { text: `Modelo desconocido. Uso: /${COMMAND} ${NAMES} [versión]` }

    await switchTo($, target)

    return { text: `Modelo: ${target.family.label} ${target.version.version}` }
  })

  // The main loop's requests name the picked model; a subagent keeps its own.
  // What the API reports of every response is tallied for the band.
  on('turn.step', async function* ($, e, next) {
    const isMain = e.agentId === undefined
    const override = isMain ? pickOfId(await read($, choice)) : undefined
    const response = yield* next(override === undefined ? e : { ...e, model: override.version.model })

    const usage = response.usage
    if (usage !== null) await update($, stats, was => tally(was, e, usage, isMain))

    // The pane's record is a side note: it must never fail the request.
    try {
      const now = await $.clock.now()
      await update($, history, was => addStep(was, { turnId: e.turnId, isMain, agentId: e.agentId }, usage, now))
    } catch {
      // the request already answered; its chart just misses a point
    }

    return response
  })

  on('turn.start', async ($, e, next) => {
    try {
      const now = await $.clock.now()
      await update($, history, was => openTurn(was, e.turnId, now))
    } catch {
      // the turn runs all the same
    }

    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    const done = await next(e)

    try {
      const agentId = e.agentId
      if (agentId === undefined) {
        await update($, history, was => closeTurn(was, { turnId: e.turnId, durationMs: e.durationMs, reason: e.reason }))
      } else {
        const now = await $.clock.now()
        await update($, history, was => closeAgent(was, { id: agentId, reason: e.reason }, now))
      }
    } catch {
      // the answer is already out
    }

    return done
  })

  // A spawned agent is listed from the start, under the name its spawn gave it.
  on('agent.spawn', async ($, e, next) => {
    const spawned = await next(e)

    try {
      const id = spawned.deny === undefined ? spawned.agentId : undefined
      if (id !== undefined) {
        const now = await $.clock.now()
        await update($, history, was =>
          openAgent(was, { id, type: e.subagentType, description: e.description, parentId: e.parentAgentId, model: spawned.model }, now),
        )
      }
    } catch {
      // the agent runs all the same
    }

    return spawned
  }).catch(($, e, next) => next(e))

  // Every tool call of every loop is timed and counted, and none is ever changed.
  on('tool.call', async ($, e, next) => {
    const started = await $.clock.now()
    const agentId = e.agentId
    let isError = false

    if (agentId !== undefined) {
      try {
        await update($, history, was => startTool(was, agentId, e.tool, started))
      } catch {
        // the call goes on unlisted
      }
    }

    try {
      const ran = await next(e)
      isError = ran.deny !== undefined || ran.isError === true

      return ran
    } catch (error) {
      isError = true

      throw error
    } finally {
      try {
        const ms = (await $.clock.now()) - started
        await update($, history, was => addTool(was, { name: e.tool, ms, isError, agentId }))
      } catch {
        // the call is over; only its count is lost
      }
    }
  }).catch(($, e, next) => next(e))

  // A /clear starts the session's numbers over.
  on('session.end', async ($, e, next) => {
    if (e.reason === 'clear') {
      await update($, history, () => EMPTY)
      await update($, stats, () => null)
    }

    return next(e)
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const data = await read($, history)
    const hasGames = await read($, gamesOn)
    const picked = await read($, tabOf)
    const current = picked === 'juegos' && !hasGames ? 'costo' : picked
    const game = await read($, gameOf)
    const isShowingDone = await read($, showDone)
    const now = await $.clock.now()
    const usage = await sessionUsage($)
    const parts = $.ui.resolve(e)
    // The player's color is the active model's.
    const color = (pickOfId(await read($, choice)) ?? (await pickOfSession($)))?.family.color ?? 'claude'
    const room = { game, color, columns: e.props.bodyColumns, rows: e.props.scroll.bodyRows }

    return drawPane(
      h,
      parts,
      {
        columns: e.props.bodyColumns,
        tab: current,
        history: data,
        now,
        showDone: isShowingDone,
        usage,
        games: hasGames,
        game,
        best: await read($, best),
      },
      {
        onTab: next => update($, tabOf, () => next),
        onShowDone: show => update($, showDone, () => show),
        onGame: next => update($, gameOf, () => next),
      },
      // Where the surface runs surface modules, the rows are drawn in motion and the games can run.
      'Client' in parts ? props => <parts.Client key="live" module="./live.tsx" props={plainData(props)} /> : undefined,
      'Client' in parts ? () => <parts.Client key="game" module="./games.tsx" props={plainData(room)} /> : undefined,
    )
  })

  // A finished game posts its score: the best of each is kept, between sessions too.
  on('ui.message', async ($, e, next) => {
    const data = e.data as { game?: unknown; score?: unknown } | null
    const game = data?.game
    if (e.element !== 'game' || (game !== 'pong' && game !== 'invaders') || typeof data?.score !== 'number') return next(e)

    const score = data.score
    const was = await read($, best)

    if (score > was[game]) {
      const now = { ...was, [game]: score }
      await update($, best, () => now)
      try {
        await $.store.set(BEST_KEY, now)
      } catch {
        // kept for the session all the same
      }
    }

    return {}
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)

    const parts = $.ui.resolve(e)
    const { Box, Button, Text } = parts
    const own = await pickOfSession($)
    const isLit = (await read($, flash)) !== 0
    const working = liveAgents(await read($, history))
    const beat: LiveProps = {
      tab: 'band',
      now: 0,
      rows: [{ segs: [{ text: '●', alt: '◉', fx: 'pulse', color: 'success' }, { text: `${working} `, color: 'success' }] }],
    }
    const override = pickOfId(await read($, choice))
    const picked = override ?? own
    const shown = await read($, open)
    const columns = e.props.bodyColumns
    const hasNames = columns >= NAME_COLUMNS
    const opened = FAMILIES.find(f => f.choice === shown)
    const seen = await read($, stats)
    // Before the session's first response there is nothing to report yet.
    const facts: LiveProps = {
      tab: 'band',
      now: 0,
      rows: [
        {
          segs:
            seen === null
              ? [{ text: WAITING, dim: true }]
              : statsSegs(seen, override !== undefined, columns - 2, (await sessionUsage($))?.percent),
        },
      ],
    }

    const chips = FAMILIES.map(family => {
      const isActive = picked?.family === family
      const version = isActive ? picked.version.version : latest(family).version.version
      const text = isActive
        ? ` ${family.glyph} ${family.label} ${version} ${family === opened ? '▴' : '▾'} `
        : ` ${family.glyph}${hasNames ? ` ${family.label} ${version}` : ''} `

      return { family, isActive, text }
    })

    // The dropdown hangs under its family's chip: the cells drawn before it.
    const at = chips.findIndex(chip => chip.family === opened)
    const indent = HEAD.length + chips.slice(0, at).reduce((sum, chip) => sum + [...chip.text].length, 0)

    return (
      <Box flexDirection="column">
        <Box>
          <Text color={picked?.family.color} bold>
            ▌
          </Text>
          <Text dimColor> MODELO </Text>
          {chips.map(({ family, isActive, text }) => (
            <Button
              key={family.choice}
              plain
              dimColor={!isActive}
              // The active chip opens its versions; another switches to its newest.
              onPress={() =>
                isActive
                  ? update($, open, now => (now === family.choice ? '' : family.choice))
                  : switchTo($, latest(family))
              }
            >
              {isActive ? (
                <Text backgroundColor={isLit ? FLASH_FILL : family.color} color={INK} bold>
                  {text}
                </Text>
              ) : (
                <Text color={family.color}>{text}</Text>
              )}
            </Button>
          ))}
          <Button key="stats" plain dimColor onPress={() => togglePane($)}>
            <Text>{hasNames ? ' ▦ stats ' : ' ▦ '}</Text>
          </Button>
          {working > 0 &&
            ('Client' in parts ? (
              <parts.Client key="agents" module="./live.tsx" props={plainData(beat)} />
            ) : (
              <Text color="success">●{working} </Text>
            ))}
          {columns >= NOTE_COLUMNS && picked !== undefined && (
            <Text color={picked.family.color} italic>
              {'  '}
              {picked.family.note}
            </Text>
          )}
        </Box>
        {opened?.versions.map(version => {
          const isCurrent = picked?.family === opened && picked.version.version === version.version

          return (
            <Box marginLeft={indent}>
              <Button
                key={`${opened.choice}-${version.version}`}
                plain
                dimColor={!isCurrent}
                onPress={() => switchTo($, { family: opened, version })}
              >
                <Text color={opened.color} bold={isCurrent}>
                  {` ${isCurrent ? '●' : '○'} ${opened.label} ${version.version} `}
                </Text>
              </Button>
              <Text dimColor>{priceLabel(version.price)} por MTok</Text>
            </Box>
          )
        })}
        {opened === undefined && (
          <Box marginLeft={2}>
            {'Client' in parts ? <parts.Client key="datos" module="./live.tsx" props={plainData(facts)} /> : paint(h, parts, facts, null)}
          </Box>
        )}
      </Box>
    )
  })
}
