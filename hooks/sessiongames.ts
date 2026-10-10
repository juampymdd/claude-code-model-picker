// The two games made of the session itself: its tools as invaders, and its agents in a race.

import { clamp } from './arcade'
import type { GameData, GameDef, Phase } from './arcade'
import { cell } from './charts'
import { aimInvaders, COLS, fireInvaders, newInvaders, nudgeInvaders, ROWS, stepInvaders } from './invaders'
import type { Invaders } from './invaders'
import { pickOfId } from './models'
import type { Seg } from './rows'
import { drawInvaders, invadersHud } from './screens'
import { money } from './stats'

/** A tool's name in two letters: `Bash` is `Ba`, an MCP tool goes by its own last name. */
export const tagOf = (name: string): string => {
  const last = name.split('__').pop() ?? name
  const letters = [...last.replace(/[^A-Za-z0-9]/g, '')]

  return ((letters[0] ?? '?').toUpperCase() + (letters[1] ?? '?').toLowerCase()).slice(0, 2)
}

/**
 * The invaders' tags: the session's tools, the most used first, over and over
 * until every invader has one; green with no errors, amber with some, red past
 * one call in five. With no tools yet, question marks.
 */
export const tagsFor = (data: GameData): { text: string; color: string }[] => {
  const tools = [...data.tools].sort((a, b) => b.count - a.count)

  return Array.from({ length: ROWS * COLS }, (_, i) => {
    const tool = tools[i % Math.max(1, tools.length)]
    if (tool === undefined) return { text: '??', color: 'inactive' }

    const share = tool.errors / Math.max(1, tool.count)

    return { text: tagOf(tool.name), color: tool.errors === 0 ? 'success' : share > 0.2 ? 'error' : 'warning' }
  })
}

/** How much faster the invaders come for what the session has cost: twice as fast from ten dollars on. */
export const hurry = (cost: number): number => 1 + clamp(cost / 10, 0, 1)

export const tokens: GameDef<Invaders> = {
  id: 'tokens',
  label: 'Token Invaders',
  glyph: '$',
  hint: 'tus tools bajan, más rápido cuanto más gastaste · ←→ o mouse · espacio dispara',
  minW: 38,
  maxW: 60,
  minRows: 14,
  maxRows: 20,
  ownNotice: true,
  create: (w, rows) => newInvaders(w, rows),
  step: (s, dt, data) => stepInvaders(s, dt * hurry(data.cost)),
  key: (s, key) => {
    if (key === ' ') return fireInvaders(s)
    if (key === 'left' || key === 'a') return nudgeInvaders(s, -4)
    if (key === 'right' || key === 'd') return nudgeInvaders(s, 4)

    return s
  },
  pointer: (s, e) => (e.type === 'down' ? fireInvaders(aimInvaders(s, e.x)) : aimInvaders(s, e.x)),
  score: s => s.score,
  hud: (s, color, data) => [
    ...invadersHud(s, color),
    { text: `   sesión ~${money(data.cost)} · ritmo ×${hurry(data.cost).toFixed(1)}`, dim: true },
  ],
  draw: (s, color, data) => drawInvaders(s, color, tagsFor(data)),
}

// The race has nothing to play: it shows the session's agents, each as far along as the requests it has made.
export type Race = { w: number; rows: number; beat: number; phase: Phase }

const GOAL = 30

export const race: GameDef<Race> = {
  id: 'race',
  label: 'Carrera de agentes',
  glyph: '⚑',
  hint: 'no se juega: cada agente avanza una celda por request',
  minW: 36,
  maxW: 70,
  minRows: 8,
  maxRows: 14,
  noRecord: true,
  ownNotice: true,
  every: 250,
  create: (w, rows) => ({ w, rows, beat: 0, phase: 'playing' }),
  step: s => ({ ...s, beat: s.beat + 1 }),
  key: s => s,
  pointer: s => s,
  score: () => 0,
  hud: (_, __, data) => {
    const live = data.agents.filter(agent => agent.state === 'live').length

    return [
      { text: 'CARRERA  ', dim: true },
      { text: `${live} corriendo`, bold: true },
      { text: ` · ${data.agents.length - live} llegaron`, dim: true },
    ]
  },
  draw: (s, _, data) => {
    const agents = [...data.agents].sort((a, b) => Number(b.state === 'live') - Number(a.state === 'live') || b.steps - a.steps).slice(0, s.rows)
    const goal = Math.max(GOAL, ...agents.map(agent => agent.steps))
    const track = Math.max(8, s.w - 10 - 9)
    const lanes = agents.map((agent): Seg[] => {
      const known = pickOfId(agent.model)
      const at = clamp(Math.round((agent.steps / goal) * (track - 1)), 0, track - 1)
      const color = agent.state === 'live' ? (known?.family.color ?? 'text') : agent.state === 'failed' ? 'error' : 'inactive'
      // The one at work beats; the ones that arrived show how it ended.
      const mark = agent.state === 'live' ? (s.beat % 2 === 0 ? '▶' : '▷') : agent.state === 'failed' ? '✕' : '✔'

      return [
        { text: cell(agent.type, 9), color, bold: agent.state === 'live' },
        { text: ' ' },
        { text: '·'.repeat(at), color: 'subtle', dim: true },
        { text: mark, color, bold: true },
        { text: '·'.repeat(track - 1 - at), color: 'subtle', dim: true },
        { text: '⚑', color: 'subtle' },
        { text: cell(money(agent.cost), 8, 'right'), dim: agent.state !== 'live' },
      ]
    })

    if (lanes.length === 0) lanes.push([{ text: 'Sin agentes en carrera. Lanzá trabajo en paralelo y volvé.', dim: true }])
    while (lanes.length < s.rows) lanes.push([{ text: ' ' }])

    return lanes
  },
}
