// The theory tab's notes: what the agent says of the concepts it applies, as
// it applies them. It tells them through a tool of the mod's; nothing here
// touches the engine.

import type { Level, Note } from '../types'

/** The tool's short name, and the name the model calls it by. */
export const TOOL_NAME = 'teoria'
export const TOOL = 'mcp__model-picker__teoria'

/** The system prompt section that asks for the notes. */
export const SECTION_ID = 'model-picker:teoria'

export const NOTE_CAP = 100
const TITLE_MAX = 80
const TEXT_MAX = 900
const WHERE_MAX = 120

export const LEVELS: Readonly<Record<Level, string>> = { aprender: 'aprendiendo', experto: 'experto' }

export const isLevel = (value: unknown): value is Level => value === 'aprender' || value === 'experto'

export const SPEC = {
  name: TOOL_NAME,
  description:
    'Anota en el panel "Teoría" del usuario un concepto, patrón o decisión de diseño que estás aplicando en lo que construís. ' +
    'No cambia nada: solo muestra la nota. Una llamada por concepto.',
  inputSchema: {
    type: 'object',
    properties: {
      title: { type: 'string', description: 'El concepto, en pocas palabras (p. ej. "Debounce", "Índice compuesto").' },
      explanation: { type: 'string', description: 'Qué es y por qué lo usás acá, en texto plano.' },
      where: { type: 'string', description: 'Dónde se aplica: archivo, función o parte del sistema. Opcional.' },
    },
    required: ['title', 'explanation'],
  },
  isDeferred: false,
} as const

// How much each level asks of a note.
const DEPTH: Readonly<Record<Level, string>> = {
  aprender:
    'El usuario está aprendiendo: explicá el concepto desde cero, con palabras simples, en 2 a 4 oraciones: ' +
    'qué es, qué problema resuelve y por qué lo elegiste acá en vez de la alternativa más obvia.',
  experto:
    'El usuario ya conoce los conceptos: en 1 o 2 oraciones, solo la decisión que tomaste y su trade-off frente a la alternativa.',
}

/** What the system prompt says of the notes, at a level. */
export const sectionFor = (level: Level): string =>
  [
    '# Notas de teoría',
    `El usuario tiene abierto un panel "Teoría" donde lee, mientras trabajás, la teoría detrás de lo que construís. ` +
      `Cada vez que apliques un concepto, patrón, algoritmo o decisión de diseño que no sea trivial, anotalo llamando a \`${TOOL}\` ` +
      'en el momento en que lo aplicás, junto con las demás herramientas del paso.',
    DEPTH[level],
    'Una nota por concepto y solo la primera vez que aparece; las tareas sin teoría (renombrar, mover, leer archivos) no llevan nota. ' +
      'La nota va en el panel y no en tu respuesta: no la repitas ni la menciones en el chat. Escribila en el idioma del usuario.',
  ].join('\n\n')

const clip = (text: string, max: number): string => {
  const cells = [...text.trim().replace(/\s+/g, ' ')]

  return cells.length > max ? `${cells.slice(0, max - 1).join('')}…` : cells.join('')
}

/** What a call to the tool holds, as a note's fields; undefined when it names no concept or says nothing of it. */
export const noteOf = (input: Record<string, unknown>): Pick<Note, 'title' | 'text' | 'where'> | undefined => {
  const title = typeof input.title === 'string' ? clip(input.title, TITLE_MAX) : ''
  const text = typeof input.explanation === 'string' ? clip(input.explanation, TEXT_MAX) : ''
  const where = typeof input.where === 'string' ? clip(input.where, WHERE_MAX) : ''
  if (title === '' || text === '') return undefined

  return where === '' ? { title, text } : { title, text, where }
}

/** The notes with one more, the latest `NOTE_CAP` kept. */
export const addNote = (notes: readonly Note[], fields: Pick<Note, 'title' | 'text' | 'where'>, at: number): Note[] => {
  const id = (notes[notes.length - 1]?.id ?? 0) + 1

  return [...notes, { id, at, ...fields }].slice(-NOTE_CAP)
}
