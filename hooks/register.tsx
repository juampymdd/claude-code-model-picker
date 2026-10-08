import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import { FAMILIES, latest, pickOfId, pickOfName, pickOfText } from './models'
import type { Pick } from './models'
import { priceLabel, statsLine, tally } from './stats'

const COMMAND = 'modelo'
const NAMES = ['auto', ...FAMILIES.map(f => f.choice)].join(' | ')
const INK = '#18181B'
// What the band draws before its first chip.
const HEAD = '▌ MODELO '

// Below these widths the band drops the note, then the unpicked names.
const NOTE_COLUMNS = 96
const NAME_COLUMNS = 70

const WAITING = 'costo, tokens y cache: tras la próxima respuesta'

const choice = atom({ plugin: 'model-picker', key: 'choice' } as const, 'auto')
// The family whose version dropdown is open; '' while none is.
const open = atom({ plugin: 'model-picker', key: 'open' } as const, '')
// What the API reported of the session's responses; null before the first.
const stats = atom({ plugin: 'model-picker', key: 'stats' } as const, null)

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
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: COMMAND,
      description: `Elige el modelo de las próximas requests (${NAMES}) y su versión: /${COMMAND} opus 4.8`,
    })

    return next(e)
  })

  on('command.run', { command: COMMAND }, async ($, e) => {
    const text = e.args.trim().toLowerCase()

    if (text === '') {
      const own = await pickOfSession($)

      return { text: `Modelo: ${own ? `${own.family.label} ${own.version.version}` : 'desconocido'}. Uso: /${COMMAND} ${NAMES} [versión]` }
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

    return response
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)

    const { Box, Button, Text } = $.ui.resolve(e)
    const own = await pickOfSession($)
    const override = pickOfId(await read($, choice))
    const picked = override ?? own
    const shown = await read($, open)
    const columns = e.props.bodyColumns
    const hasNames = columns >= NAME_COLUMNS
    const opened = FAMILIES.find(f => f.choice === shown)
    const seen = await read($, stats)
    // Before the session's first response there is nothing to report yet.
    const line = seen === null ? WAITING : statsLine(seen, override !== undefined, columns - 2)

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
                <Text backgroundColor={family.color} color={INK} bold>
                  {text}
                </Text>
              ) : (
                <Text color={family.color}>{text}</Text>
              )}
            </Button>
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
        {opened === undefined && line !== '' && (
          <Box marginLeft={2}>
            <Text dimColor wrap="truncate-end">
              {line}
            </Text>
          </Box>
        )}
      </Box>
    )
  })
}
