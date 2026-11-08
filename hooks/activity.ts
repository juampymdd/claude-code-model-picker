// What Claude is doing right now, as the band's data row leads with it while
// it works: the main loop's tool in progress (or that it is thinking), and the
// newest agent at work with its own.

import type { Doing, History } from '../types'
import { isDone } from './history'
import { clip } from './log'
import type { Seg } from './rows'

// How many cells a tool's arguments take in the row, the main loop's and an agent's.
const ARGS_CELLS = 40
const AGENT_ARGS_CELLS = 24

/**
 * The row's leading parts while something is at work, each a list of runs:
 * the main loop's, then the agents'. Empty when nothing is.
 */
export const activityParts = (h: History, doing: Doing | null): Seg[][] => {
  const parts: Seg[][] = []
  const turn = h.turns[h.turns.length - 1]
  const isTurnOpen = turn !== undefined && turn.durationMs === undefined

  if (doing !== null) {
    parts.push([
      { text: '⠋', fx: 'spin', color: 'claude' },
      { text: ` ${doing.tool}`, color: 'claude', bold: true },
      ...(doing.args === '' ? [] : [{ text: ` ${clip(doing.args, ARGS_CELLS)}`, color: 'claude' }]),
      { text: ' ' },
      { text: '', fx: 'clock', since: doing.since, width: 5, color: 'claude', dim: true },
    ])
  } else if (isTurnOpen) {
    parts.push([{ text: 'pensando', fx: 'dots', color: 'claude' }])
  }

  const live = h.agents.filter(agent => !isDone(agent)).sort((a, b) => b.startedAt - a.startedAt)
  const newest = live[0]

  if (newest !== undefined) {
    const busy = newest.busy
    const what =
      busy === undefined ? 'pensando' : `${busy.tool}${busy.args === undefined || busy.args === '' ? '' : ` ${clip(busy.args, AGENT_ARGS_CELLS)}`}`

    parts.push([
      { text: '●', alt: '◉', fx: 'pulse', color: 'success' },
      { text: ` ${newest.type} ▸ ${what}`, color: 'success' },
      ...(live.length > 1 ? [{ text: ` +${live.length - 1}`, dim: true }] : []),
    ])
  }

  return parts
}
