import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

type Version = { version: string; model: string }

type Family = {
  choice: string
  label: string
  glyph: string
  color: string
  note: string
  // Newest first: a family's chip shows the first, its dropdown lists them all.
  versions: readonly Version[]
}

// The versions the Claude API serves, by its own model ids.
const FAMILIES: readonly Family[] = [
  {
    choice: 'fable',
    label: 'Fable',
    glyph: '✦',
    color: '#C084FC',
    note: 'el más capaz',
    versions: [
      { version: '5.1', model: 'claude-fable-5-1' },
      { version: '5', model: 'claude-fable-5' },
    ],
  },
  {
    choice: 'opus',
    label: 'Opus',
    glyph: '◆',
    color: '#FB923C',
    note: 'razonamiento profundo',
    versions: [
      { version: '5.5', model: 'claude-opus-5-5' },
      { version: '5', model: 'claude-opus-5' },
      { version: '4.8', model: 'claude-opus-4-8' },
      { version: '4.7', model: 'claude-opus-4-7' },
      { version: '4.6', model: 'claude-opus-4-6' },
    ],
  },
  {
    choice: 'sonnet',
    label: 'Sonnet',
    glyph: '▲',
    color: '#38BDF8',
    note: 'equilibrado',
    versions: [
      { version: '5.5', model: 'claude-sonnet-5-5' },
      { version: '5', model: 'claude-sonnet-5' },
      { version: '4.6', model: 'claude-sonnet-4-6' },
    ],
  },
  {
    choice: 'haiku',
    label: 'Haiku',
    glyph: '●',
    color: '#34D399',
    note: 'rápido y barato',
    versions: [
      { version: '5.5', model: 'claude-haiku-5-5' },
      { version: '4.5', model: 'claude-haiku-4-5' },
    ],
  },
]

const COMMAND = 'modelo'
const NAMES = ['auto', ...FAMILIES.map(f => f.choice)].join(' | ')
const INK = '#18181B'
// What the band draws before its first chip.
const HEAD = '▌ MODELO '

// Below these widths the band drops the note, then the unpicked names.
const NOTE_COLUMNS = 96
const NAME_COLUMNS = 70

const choice = atom({ plugin: 'model-picker', key: 'choice' } as const, 'auto')
// The family whose version dropdown is open; '' while none is.
const open = atom({ plugin: 'model-picker', key: 'open' } as const, '')
// The model id the API reported on the main loop's latest response; '' before it.
const answeredBy = atom({ plugin: 'model-picker', key: 'answeredBy' } as const, '')

type Pick = { family: Family; version: Version }

const latest = (family: Family): Pick => ({ family, version: family.versions[0] as Version })

const pickOfId = (id: string): Pick | undefined => {
  for (const family of FAMILIES) {
    const version = family.versions.find(v => v.model === id)
    if (version !== undefined) return { family, version }
  }

  return undefined
}

// `opus`, `opus 4.8`: a family and, when written, one of its versions.
const pickOfText = (text: string): Pick | undefined => {
  const [name = '', written] = text.trim().toLowerCase().split(/\s+/)
  const family = FAMILIES.find(f => f.choice === name)
  if (family === undefined) return undefined

  const version = family.versions.find(v => v.version === written)

  return written === undefined ? latest(family) : version && { family, version }
}

// The session's own model as `/model` names it (`Opus 5.5`, `claude-opus-5-5`).
const pickOfSession = async ($: EngineInterface): Promise<Pick | undefined> => {
  try {
    const name = (await $.session.model()).toLowerCase()
    const family = FAMILIES.find(f => name.includes(f.choice))
    if (family === undefined) return undefined

    const written = /(\d+)(?:[.-](\d{1,2})(?!\d))?/.exec(name)
    const text = written === null ? undefined : [written[1], written[2]].filter(Boolean).join('.')
    const known = family.versions.find(v => v.version === text)

    // A version the list lacks is still shown as the session runs it.
    return { family, version: known ?? { version: text ?? latest(family).version.version, model: '' } }
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

// A model id as the band names it (`claude-opus-5-5` -> `Opus 5.5`).
const nameOfId = (id: string): string => {
  const known = pickOfId(id)

  return known === undefined ? id : `${known.family.label} ${known.version.version}`
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
  // What the API reports as having answered is kept for the band.
  on('turn.step', async function* ($, e, next) {
    if (e.agentId !== undefined) return yield* next(e)

    const override = pickOfId(await read($, choice))
    const response = yield* next(override === undefined ? e : { ...e, model: override.version.model })

    const answered = response.usage?.model ?? null
    if (answered !== null && answered !== (await read($, answeredBy))) {
      await update($, answeredBy, () => answered)
    }

    return response
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)

    const { Box, Button, Text } = $.ui.resolve(e)
    const own = await pickOfSession($)
    const picked = pickOfId(await read($, choice)) ?? own
    const shown = await read($, open)
    const answered = await read($, answeredBy)
    const columns = e.props.bodyColumns
    const hasNames = columns >= NAME_COLUMNS
    const opened = FAMILIES.find(f => f.choice === shown)

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
              {answered === '' ? '' : ` · respondió ${nameOfId(answered)}`}
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
            </Box>
          )
        })}
      </Box>
    )
  })
}
