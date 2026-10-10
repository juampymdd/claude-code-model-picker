// The stats pane as data: each tab is a list of rows of text runs, some of
// them marked to move (a clock, a spinner, a bar that grows). `paint.tsx`
// draws them, still or animated; nothing here touches the engine.

import type { AgentStat, Best, Game, History, Tab, Turn } from '../types'
import { cell, duration, hbar, pct, sparkline, stack } from './charts'
import { activity, isDone, pace } from './history'
import { pickOfId } from './models'
import { count, money } from './stats'

// One run of text in a row. `fx` says how it moves when the row is animated:
//  pulse  alternates `text` and `alt`        spin   a spinner in its place
//  dots   `text` then one to three dots      clock  time since `since`, `width` cells
//  grow   `text` revealed cell by cell       meter  a gauge of `value` percent, `width` cells
export type Seg = {
  text: string
  color?: string
  dim?: boolean
  bold?: boolean
  fill?: string
  fx?: 'pulse' | 'spin' | 'dots' | 'clock' | 'grow' | 'meter'
  alt?: string
  since?: number
  width?: number
  align?: 'left' | 'right'
  // clock: past this many milliseconds it turns to the warning color.
  warnAfter?: number
  // grow, meter: what tells one bar from another between draws.
  key?: string
  value?: number
  // meter: a high value is the good one (cache served), so the colors run the other way.
  isGoodHigh?: boolean
}

// A line of runs, or a column chart. A keyed line slides in when it first
// appears and fades once `isDone`.
export type Row =
  | { key?: string; segs: Seg[]; isDone?: boolean }
  | { key: string; chart: number[]; height: number; max?: number; color?: string }

// What the animated drawing is handed: plain data only.
export type LiveProps = { tab: string; now: number; rows: Row[] }

export type View = {
  columns: number
  tab: Tab
  history: History
  now: number
  showDone: boolean
  // The games tab: whether it is offered, which game it shows, the best scores.
  games?: boolean
  game?: Game
  best?: Best
  // From `$.session.usage()`: when the session started, how full its context is, Claude Code's own cost.
  usage?: { startedAt?: number; percent?: number; usd?: number }
}

const WAITING = 'Todavía no hay datos: llegan tras la próxima respuesta.'
const NO_AGENTS = 'Sin agentes en esta sesión. Aparecen cuando Claude delega trabajo (Agent, Explore, Plan…).'
const REASONS: Readonly<Record<NonNullable<Turn['reason']>, string>> = {
  answer: 'respuesta',
  aborted: 'abortado',
  refusal: 'rechazo',
  error: 'error',
}
const TABLE_ROWS = 50
const LIST_ROWS = 20
const DONE_SHOWN = 10
const SLOW_AGENT_MS = 300_000
const SLOW_TOOL_MS = 10_000
const DEAR = 1

const dim = (text: string): Seg => ({ text, dim: true })
const plain = (text: string): Seg => ({ text })
const line = (...segs: Seg[]): Row => ({ segs })

const clamp = (n: number, low: number, high: number): number => Math.min(high, Math.max(low, n))
const colorOf = (model: string): string | undefined => pickOfId(model)?.family.color
const promptOf = (t: { input: number; cacheRead: number; cacheWrite: number }): number => t.input + t.cacheRead + t.cacheWrite
const seen = (h: History): number => h.turns.length + h.dropped

/** The header every tab shares: session time, cost, turns and how full the context is. */
export const headRow = (view: View): Row => {
  const { history: h, now } = view
  const started = view.usage?.startedAt ?? h.turns[0]?.startedAt
  const segs: Seg[] = [dim('sesión ')]

  segs.push(started === undefined ? plain('–') : { text: duration(Math.max(0, now - started)), fx: 'clock', since: started })
  segs.push(dim(' · '), plain(`~${money(h.total.cost)}`), dim(` · ${seen(h)} turnos`))

  if (view.usage?.percent !== undefined) {
    const percent = Math.round(view.usage.percent)
    segs.push(dim(' · contexto '), { text: '', fx: 'meter', key: 'context', value: percent, width: 8 }, plain(` ${percent}%`))
  }
  if (view.usage?.usd !== undefined) segs.push(dim(` · /cost ${money(view.usage.usd)}`))

  return { segs }
}

const costRows = (view: View): Row[] => {
  const { columns, history: h } = view
  const shown = h.turns.slice(-Math.max(1, columns))
  const costs = shown.map(turn => turn.cost)
  const top = costs.reduce((most, cost) => Math.max(most, cost), 0)
  const withTok = columns >= 48
  const withCache = columns >= 40
  const barWidth = clamp(columns - 4 - 1 - 8 - 1 - (withTok ? 13 : 0) - (withCache ? 6 : 0), 4, 40)
  const recent = h.turns.slice(-TABLE_ROWS).reverse()
  const worst = recent.reduce((most, turn) => Math.max(most, turn.cost), 0)
  const all = h.total

  return [
    line(dim(`COSTO POR TURNO · últimos ${shown.length} de ${seen(h)} · máx ${money(top)}`)),
    { key: 'cost', chart: costs, height: 3, max: top },
    line(
      dim(`${cell('#', 4, 'right')} ${cell('costo', 8)}`),
      dim(cell('▒ entrada █ salida', barWidth)),
      ...(withTok ? [dim(` ${cell('tok', 12)}`)] : []),
      ...(withCache ? [dim(` ${cell('cache', 5)}`)] : []),
    ),
    ...recent.map((turn, index) => {
      const [light = 0, full = 0] = stack([turn.cost - turn.costOut, turn.costOut], worst, barWidth)
      const color = colorOf(turn.model)

      return line(
        plain(`${cell(String(seen(h) - index), 4, 'right')} ${cell(money(turn.cost), 8)}`),
        { text: '▒'.repeat(light), color, dim: true },
        { text: '█'.repeat(full), color },
        plain(' '.repeat(Math.max(0, barWidth - light - full))),
        ...(withTok ? [dim(` ${cell(`${count(promptOf(turn))}→${count(turn.output)}`, 12)}`)] : []),
        ...(withCache ? [dim(` ${cell(pct(turn.cacheRead, promptOf(turn)), 5)}`)] : []),
      )
    }),
    line(
      dim(
        `total ~${money(all.cost)} · ${count(promptOf(all))}→${count(all.output)} tok · cache ${pct(all.cacheRead, promptOf(all))}` +
          (all.agentCost > 0 ? ` · subagentes ${money(all.agentCost)}` : ''),
      ),
    ),
  ]
}

const modelRows = (view: View): Row[] => {
  const { columns, history: h } = view
  const entries = Object.entries(h.models).sort((a, b) => b[1].cost - a[1].cost)
  const top = entries.reduce((most, [, stat]) => Math.max(most, stat.cost), 0)
  const withTok = columns >= 56
  const withReq = columns >= 46
  const barWidth = clamp(columns - 2 - 13 - 1 - 7 - 5 - (withTok ? 13 : 0) - (withReq ? 8 : 0), 3, 30)

  return [
    line(dim('USO POR MODELO')),
    ...entries.map(([id, stat]) => {
      const known = pickOfId(id)
      const name = known === undefined ? id : `${known.family.label} ${known.version.version}`

      return line(
        { text: `${known?.family.glyph ?? '·'} `, color: known?.family.color },
        { text: cell(name, 12), dim: known === undefined },
        plain(' '),
        { text: hbar(stat.cost, top, barWidth), color: known?.family.color, fx: 'grow', key: `model:${id}`, width: barWidth },
        plain(` ${cell(money(stat.cost), 7, 'right')}`),
        dim(` ${cell(pct(stat.cost, h.total.cost), 4, 'right')}`),
        ...(withTok ? [dim(` ${cell(`${count(stat.input)}→${count(stat.output)}`, 12)}`)] : []),
        ...(withReq ? [dim(` ${cell(`${stat.steps} req`, 7)}`)] : []),
      )
    }),
    ...(h.total.agentCost > 0
      ? [line(dim(`subagentes: ${money(h.total.agentCost)} (${pct(h.total.agentCost, h.total.cost)} del total)`))]
      : []),
  ]
}

const toolRows = (view: View): Row[] => {
  const { columns, history: h } = view
  const tools = [...h.tools].sort((a, b) => b.count - a.count)
  const calls = tools.reduce((all, tool) => all + tool.count, 0)
  const errors = tools.reduce((all, tool) => all + tool.errors, 0)
  const spent = tools.reduce((all, tool) => all + tool.totalMs, 0)
  const top = tools.reduce((most, tool) => Math.max(most, tool.count), 0)
  const withErr = columns >= 44
  const withTime = columns >= 54
  const withAvg = columns >= 62
  const barWidth = clamp(columns - 12 - 1 - 1 - 4 - (withErr ? 7 : 0) - (withTime ? 8 : 0) - (withAvg ? 7 : 0), 3, 14)

  return [
    line(dim(`TOOLS · ${calls} llamadas · ${errors} errores · ${duration(spent)}`)),
    ...tools.map(tool =>
      line(
        plain(`${cell(tool.name, 12)} `),
        { text: hbar(tool.count, top, barWidth), fx: 'grow', key: `tool:${tool.name}`, width: barWidth },
        plain(` ${cell(String(tool.count), 4, 'right')}`),
        ...(withErr
          ? [tool.errors > 0 ? ({ text: ` ${cell(`${tool.errors} err`, 6)}`, color: 'error' } as Seg) : dim(` ${cell('–', 6)}`)]
          : []),
        ...(withTime ? [dim(` ${cell(duration(tool.totalMs), 7, 'right')}`)] : []),
        ...(withAvg ? [dim(` ${cell(duration(tool.totalMs / Math.max(1, tool.count)), 6, 'right')}`)] : []),
      ),
    ),
  ]
}

const paceRows = (view: View): Row[] => {
  const { columns, history: h, now } = view
  const summary = pace(h)
  const first = h.turns[0]?.startedAt ?? now
  const span = Math.max(1, now - (view.usage?.startedAt ?? first))
  const width = clamp(columns - 11 - 1 - 14, 8, 40)
  const recent = h.turns.slice(-width)
  const lengths = recent.map(turn => turn.durationMs ?? Math.max(0, now - turn.startedAt))
  const steps = recent.map(turn => turn.steps)
  const buckets = [...sparkline(activity(h.turns, first, Math.max(first + 1, now), width))]
  const isRunning = h.turns.some(turn => turn.durationMs === undefined)
  const longest = lengths.reduce((most, ms) => Math.max(most, ms), 0)
  const busiest = steps.reduce((most, n) => Math.max(most, n), 0)

  return [
    line(
      dim(
        `RITMO · activo ${duration(summary.activeMs)} de ${duration(span)} (${pct(summary.activeMs, span)})` +
          ` · ${summary.avgSteps.toFixed(1)} pasos/turno · prom ${duration(summary.avgMs)}`,
      ),
    ),
    line(dim(cell('duración', 10)), plain(` ${sparkline(lengths)}`), dim(`   máx ${duration(longest)}`)),
    line(dim(cell('pasos', 10)), plain(` ${sparkline(steps)}`), dim(`   máx ${busiest}`)),
    line(
      dim(cell('actividad', 10)),
      plain(` ${buckets.slice(0, -1).join('')}`),
      // The newest stretch beats while a turn runs.
      isRunning
        ? { text: buckets[buckets.length - 1] ?? '·', alt: '█', fx: 'pulse', color: 'claude' }
        : plain(buckets[buckets.length - 1] ?? ''),
      dim(`   ${width} tramos de ${duration(Math.max(1, now - first) / width)}`),
    ),
    ...h.turns
      .slice(-LIST_ROWS)
      .reverse()
      .map((turn, index) => {
        const isOpen = turn.durationMs === undefined

        return line(
          plain(`${cell(String(seen(h) - index), 4, 'right')}  `),
          isOpen
            ? { text: '', fx: 'clock', since: turn.startedAt, width: 7, color: 'claude' }
            : plain(cell(duration(turn.durationMs ?? 0), 7)),
          dim(` ${cell(`${turn.steps} pasos`, 9)} ${isOpen ? 'en curso' : REASONS[turn.reason ?? 'answer']}`),
        )
      }),
  ]
}

// How an agent's state is drawn: its glyph, the one it beats with, its color.
const STATE = {
  running: { glyph: '●', alt: '◉', color: 'success', label: 'corriendo' },
  waiting: { glyph: '◐', alt: '◑', color: 'warning', label: 'esperando' },
  done: { glyph: '○', alt: '○', color: 'inactive', label: 'terminados' },
  failed: { glyph: '✕', alt: '✕', color: 'error', label: 'fallaron' },
} as const

type StateName = keyof typeof STATE

const stateOf = (agent: AgentStat): StateName => {
  if (agent.status === 'failed' || agent.status === 'killed') return 'failed'
  if (isDone(agent)) return 'done'

  return agent.status === 'running' ? 'running' : 'waiting'
}

const ORDER: readonly StateName[] = ['running', 'waiting', 'failed', 'done']

/** The agents as the pane lists them: the live ones first, newest on top, then the latest finished. */
export const listedAgents = (h: History, showDone: boolean): AgentStat[] => {
  const live = h.agents.filter(agent => !isDone(agent)).sort((a, b) => b.startedAt - a.startedAt)
  const done = h.agents
    .filter(isDone)
    .sort((a, b) => (b.endedAt ?? b.startedAt) - (a.endedAt ?? a.startedAt))
    .slice(0, DONE_SHOWN)

  return [...live.sort((a, b) => ORDER.indexOf(stateOf(a)) - ORDER.indexOf(stateOf(b))), ...(showDone ? done : [])]
}

const agentRows = (view: View): Row[] => {
  const { columns, history: h, now } = view
  if (h.agents.length === 0) return [line(dim(NO_AGENTS))]

  const tally = (name: StateName): number => h.agents.filter(agent => stateOf(agent) === name).length
  const spent = h.agents.reduce((all, agent) => all + agent.cost, 0)
  const head: Seg[] = [dim('AGENTES ')]

  for (const name of ORDER) {
    const n = tally(name)
    if (n === 0) continue

    const state = STATE[name]
    head.push(
      plain(' '),
      name === 'running' || name === 'waiting'
        ? { text: state.glyph, alt: state.alt, fx: 'pulse', color: state.color }
        : { text: state.glyph, color: state.color },
      dim(` ${n} ${state.label} `),
    )
  }
  head.push(plain(` ${money(spent)}`))

  const rows: Row[] = [{ segs: head }, line({ text: '─'.repeat(Math.max(1, columns)), color: 'subtle' })]
  const ids = new Set(h.agents.map(agent => agent.id))

  for (const agent of listedAgents(h, view.showDone)) {
    const name = stateOf(agent)
    const state = STATE[name]
    const over = name === 'done' || name === 'failed'
    const isChild = agent.parentId !== undefined && ids.has(agent.parentId)
    const lead = isChild ? '  └ ' : ''
    const room = clamp(columns - [...lead].length - 2 - 10 - 1 - 7 - 1 - 7, 4, 60)
    const known = pickOfId(agent.model)

    rows.push({
      key: `a:${agent.id}`,
      isDone: over,
      segs: [
        dim(lead),
        name === 'running' || name === 'waiting'
          ? { text: state.glyph, alt: state.alt, fx: 'pulse', color: state.color }
          : { text: state.glyph, color: state.color },
        { text: ` ${cell(agent.type, 9)} `, color: state.color, bold: true },
        { text: cell(agent.description, room), dim: over },
        plain(' '),
        over
          ? dim(cell(duration(Math.max(0, (agent.endedAt ?? now) - agent.startedAt)), 7, 'right'))
          : { text: '', fx: 'clock', since: agent.startedAt, width: 7, align: 'right', warnAfter: SLOW_AGENT_MS },
        { text: ` ${cell(money(agent.cost), 7, 'right')}`, ...(agent.cost > DEAR ? { color: 'error' } : {}) },
        ...(name === 'failed' ? [{ text: agent.status === 'killed' ? ' cancelado' : ' error', color: 'error' } as Seg] : []),
      ],
    })

    const detail: Seg[] = [plain(isChild ? '      ' : '  ')]
    detail.push(
      known === undefined
        ? dim('· ')
        : { text: `${known.family.glyph} ${known.family.label} ${known.version.version} `, color: known.family.color },
      dim(` ${agent.steps} req `),
    )

    if (columns >= 50) {
      for (const tool of [...agent.tools].sort((a, b) => b.count - a.count).slice(0, columns >= 64 ? 4 : 2)) {
        detail.push(dim(` ${tool.name} ×${tool.count}`))
        if (tool.errors > 0) detail.push({ text: ` ✕${tool.errors}`, color: 'error' })
      }
    }

    if (!over) {
      detail.push({ text: '  ▸ ', color: 'claude' })
      if (agent.busy === undefined) {
        detail.push({ text: 'pensando', fx: 'dots', color: 'claude' })
      } else {
        detail.push(
          { text: '⠋', fx: 'spin', color: 'claude' },
          { text: ` ${agent.busy.tool} `, color: 'claude' },
          { text: '', fx: 'clock', since: agent.busy.since, warnAfter: SLOW_TOOL_MS, color: 'claude' },
        )
      }
    }

    if (columns >= 56 && agent.costs.length > 1) {
      detail.push(plain('  '), { text: sparkline(agent.costs), color: known?.family.color, dim: over })
    }

    rows.push({ key: `b:${agent.id}`, isDone: over, segs: detail })
  }

  return rows
}

const TABS: Readonly<Record<Tab, (view: View) => Row[]>> = {
  costo: costRows,
  modelos: modelRows,
  tools: toolRows,
  ritmo: paceRows,
  agentes: agentRows,
  // The games draw themselves (`games.tsx`).
  juegos: () => [],
}

/** The chosen tab's rows; a session with nothing yet says so (the agents tab says its own). */
export const rowsFor = (view: View): Row[] => {
  const h = view.history
  const isEmpty = h.total.steps === 0 && h.tools.length === 0 && h.agents.length === 0

  return isEmpty && view.tab !== 'agentes' && view.tab !== 'juegos' ? [line(dim(WAITING))] : TABS[view.tab](view)
}

/**
 * A value as a surface module may be handed it: plain data, with nothing
 * `undefined` left in it (a color a model has none of, an absent field), which
 * the engine refuses in a module's props.
 */
export const plainData = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T

/** How many agents are at work now. */
export const liveAgents = (h: History): number => h.agents.filter(agent => !isDone(agent)).length
