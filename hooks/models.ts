export type Version = {
  version: string
  // The Claude API's id of the model.
  model: string
  // List price in dollars per million tokens: input, output.
  price: readonly [input: number, output: number]
  // Dollars per million cached input tokens read, where the list price names it.
  cacheRead?: number
}

export type Family = {
  choice: string
  label: string
  glyph: string
  color: string
  note: string
  // Newest first: a family's chip shows the first, its dropdown lists them all.
  versions: readonly Version[]
}

export type Pick = { family: Family; version: Version }

// The versions the Claude API serves, by its own model ids, at its list prices.
export const FAMILIES: readonly Family[] = [
  {
    choice: 'fable',
    label: 'Fable',
    glyph: '✦',
    color: '#C084FC',
    note: 'el más capaz',
    versions: [
      { version: '5.1', model: 'claude-fable-5-1', price: [10, 50], cacheRead: 0.25 },
      { version: '5', model: 'claude-fable-5', price: [10, 50] },
    ],
  },
  {
    choice: 'opus',
    label: 'Opus',
    glyph: '◆',
    color: '#FB923C',
    note: 'razonamiento profundo',
    versions: [
      { version: '5.5', model: 'claude-opus-5-5', price: [4, 20], cacheRead: 0.2 },
      { version: '5', model: 'claude-opus-5', price: [5, 25] },
      { version: '4.8', model: 'claude-opus-4-8', price: [5, 25] },
      { version: '4.7', model: 'claude-opus-4-7', price: [5, 25] },
      { version: '4.6', model: 'claude-opus-4-6', price: [5, 25] },
    ],
  },
  {
    choice: 'sonnet',
    label: 'Sonnet',
    glyph: '▲',
    color: '#38BDF8',
    note: 'equilibrado',
    versions: [
      { version: '5.5', model: 'claude-sonnet-5-5', price: [2, 10], cacheRead: 0.2 },
      { version: '5', model: 'claude-sonnet-5', price: [2, 10] },
      { version: '4.6', model: 'claude-sonnet-4-6', price: [3, 15] },
    ],
  },
  {
    choice: 'haiku',
    label: 'Haiku',
    glyph: '●',
    color: '#34D399',
    note: 'rápido y barato',
    versions: [
      { version: '5.5', model: 'claude-haiku-5-5', price: [0.1, 0.5] },
      { version: '4.5', model: 'claude-haiku-4-5', price: [1, 5] },
    ],
  },
]

export const latest = (family: Family): Pick => ({ family, version: family.versions[0] as Version })

/**
 * The family and version of a model id: the id itself, else the longest listed
 * id it starts with (an id the API reports with a suffix).
 */
export const pickOfId = (id: string): Pick | undefined => {
  let found: Pick | undefined

  for (const family of FAMILIES) {
    for (const version of family.versions) {
      if (version.model === id) return { family, version }

      const isLonger = found === undefined || version.model.length > found.version.model.length
      if (id.startsWith(`${version.model}-`) && isLonger) found = { family, version }
    }
  }

  return found
}

/** `opus`, `opus 4.8`: a family and, when written, one of its versions. */
export const pickOfText = (text: string): Pick | undefined => {
  const [name = '', written] = text.trim().toLowerCase().split(/\s+/)
  const family = FAMILIES.find(f => f.choice === name)
  if (family === undefined) return undefined

  const version = family.versions.find(v => v.version === written)

  return written === undefined ? latest(family) : version && { family, version }
}

/** The family and version a model name holds (`Opus 5.5`, `claude-opus-5-5`). */
export const pickOfName = (name: string): Pick | undefined => {
  const lower = name.toLowerCase()
  const family = FAMILIES.find(f => lower.includes(f.choice))
  if (family === undefined) return undefined

  const written = /(\d+)(?:[.-](\d{1,2})(?!\d))?/.exec(lower)
  const text = written === null ? undefined : [written[1], written[2]].filter(Boolean).join('.')
  const known = family.versions.find(v => v.version === text)
  const newest = latest(family).version

  // A version the list lacks is still named as written, at no known price.
  return { family, version: known ?? { ...newest, version: text ?? newest.version, model: '' } }
}

/** A model id as the band names it (`claude-opus-5-5` -> `Opus 5.5`). */
export const nameOfId = (id: string): string => {
  const known = pickOfId(id)

  return known === undefined ? id : `${known.family.label} ${known.version.version}`
}
