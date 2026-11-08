// What each agent does, step by step: the text it writes as it writes it,
// its thinking, every tool call with its arguments. The hooks feed it from the
// agent's own loop events; the agents tab shows one agent's log at a time.

import type { AgentLog, Entry } from '../types'

// How many entries one log keeps, how many logs are kept, and how long a text may run.
export const ENTRY_CAP = 150
export const LOG_CAP = 30
export const TEXT_MAX = 2000
export const THINKING_MAX = 600
const ARGS_MAX = 160

export const EMPTY_LOG: AgentLog = { entries: [], dropped: 0 }

/** `text` in at most `max` cells, cut with `…`. */
export const clip = (text: string, max: number): string => {
  const cells = [...text]

  return cells.length > max ? `${cells.slice(0, max - 1).join('')}…` : text
}

// A tail of `text`, the latest `max` cells: a live text keeps its newest part.
const tail = (text: string, max: number): string => {
  const cells = [...text]

  return cells.length > max ? `…${cells.slice(cells.length - max + 1).join('')}` : text
}

const str = (value: unknown): string | undefined => (typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined)

/**
 * A tool call's arguments in a line: the one or two that say what the call
 * is about (`Bash` its command, `Read` its file, `Grep` its pattern and path).
 * A tool this knows nothing of shows its first string argument.
 */
export const argsOf = (tool: string, input: Record<string, unknown>): string => {
  const quote = (text: string | undefined): string | undefined => (text === undefined ? undefined : `"${text}"`)
  const parts: (string | undefined)[] = (() => {
    switch (tool) {
      case 'Bash':
      case 'PowerShell':
        return [str(input.command)]
      case 'Read':
      case 'Write':
      case 'Edit':
      case 'NotebookEdit':
        return [str(input.file_path) ?? str(input.notebook_path)]
      case 'Grep':
        return [quote(str(input.pattern)), str(input.path), str(input.glob)]
      case 'Glob':
        return [str(input.pattern), str(input.path)]
      case 'Agent':
        return [str(input.subagent_type), quote(str(input.description))]
      case 'WebFetch':
        return [str(input.url)]
      case 'WebSearch':
        return [quote(str(input.query))]
      default: {
        const first = Object.values(input).find(value => str(value) !== undefined)

        return [str(first)]
      }
    }
  })()

  return clip(parts.filter((part): part is string => part !== undefined).join(' ').replace(/\s+/g, ' '), ARGS_MAX)
}

// An entry no longer being written.
const still = (entry: Entry): Entry => {
  if (entry.kind === 'tool' || entry.isLive !== true) return entry
  const { isLive: _, ...rest } = entry

  return rest
}

// The log with one more entry; the one before it is no longer live.
const push = (log: AgentLog, entry: Entry): AgentLog => {
  const last = log.entries[log.entries.length - 1]
  const before = last === undefined ? log.entries : [...log.entries.slice(0, -1), still(last)]
  const entries = [...before, entry]
  const over = Math.max(0, entries.length - ENTRY_CAP)

  return { entries: entries.slice(over), dropped: log.dropped + over }
}

const mapLast = (log: AgentLog, change: (entry: Entry) => Entry): AgentLog => {
  const last = log.entries[log.entries.length - 1]
  if (last === undefined) return log

  return { ...log, entries: [...log.entries.slice(0, -1), change(last)] }
}

/**
 * The log with `text` more of what the agent is writing (or thinking): it
 * joins the live entry of that kind at the end, or opens one.
 */
export const streamText = (log: AgentLog, kind: 'text' | 'thinking', text: string, at: number): AgentLog => {
  if (text === '') return log

  const max = kind === 'text' ? TEXT_MAX : THINKING_MAX
  const last = log.entries[log.entries.length - 1]

  if (last !== undefined && last.kind !== 'tool' && last.kind === kind && last.isLive === true) {
    return mapLast(log, entry => (entry.kind === 'tool' ? entry : { ...entry, text: tail(`${entry.text}${text}`, max) }))
  }

  return push(log, { kind, at, text: tail(text, max), isLive: true })
}

/**
 * The log with the agent's writing (or thinking) settled: the live entry of
 * that kind becomes `text`, whole; with no live entry and a text, one is added.
 * An empty `text` only closes the live entry.
 */
export const settleText = (log: AgentLog, kind: 'text' | 'thinking', text: string, at: number): AgentLog => {
  const max = kind === 'text' ? TEXT_MAX : THINKING_MAX
  const last = log.entries[log.entries.length - 1]

  if (last !== undefined && last.kind !== 'tool' && last.kind === kind && last.isLive === true) {
    const { isLive: _, ...still } = last

    return mapLast(log, () => ({ ...still, text: clip(text === '' ? last.text : text, max) }))
  }

  return text === '' ? log : push(log, { kind, at, text: clip(text, max) })
}

/** The log with a tool call begun. */
export const startCall = (log: AgentLog, call: { id: string; name: string; args: string }, at: number): AgentLog =>
  push(log, { kind: 'tool', at, id: call.id, name: call.name, args: call.args })

/** The log with tool call `id` over; an id it never saw is ignored. */
export const endCall = (log: AgentLog, id: string, ms: number, isError: boolean): AgentLog => ({
  ...log,
  entries: log.entries.map(entry => (entry.kind === 'tool' && entry.id === id ? { ...entry, ms: Math.max(0, ms), isError } : entry)),
})

export const ANSWER_MAX = 8000

/** The log with the agent's final answer; a blank one leaves it as it was. */
export const setAnswer = (log: AgentLog, answer: string): AgentLog =>
  answer.trim() === '' ? log : { ...log, answer: clip(answer.trim(), ANSWER_MAX) }

/**
 * The logs with the one of `agentId` changed; a new agent's starts empty,
 * and past `LOG_CAP` logs the oldest ones go.
 */
export const withLog = (logs: Readonly<Record<string, AgentLog>>, agentId: string, change: (log: AgentLog) => AgentLog): Record<string, AgentLog> => {
  const next = { ...logs, [agentId]: change(logs[agentId] ?? EMPTY_LOG) }
  const ids = Object.keys(next)
  if (ids.length <= LOG_CAP) return next

  for (const id of ids.slice(0, ids.length - LOG_CAP)) delete next[id]

  return next
}
