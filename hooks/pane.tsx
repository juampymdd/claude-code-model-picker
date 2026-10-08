/** @jsx hyper */
import type { EngineInterface, RenderNode } from 'claude-code'

import type { History, Tab, Turn } from '../types'
import { cell, columns as columnChart, duration, hbar, pct, sparkline, stack } from './charts'
import { activity, pace } from './history'
import { pickOfId } from './models'
import { count, money } from './stats'

export const PANE = 'model-picker-stats'

export const TABS: readonly { tab: Tab; label: string; hotkey: string }[] = [
  { tab: 'costo', label: 'Costo', hotkey: '1' },
  { tab: 'modelos', label: 'Modelos', hotkey: '2' },
  { tab: 'tools', label: 'Tools', hotkey: '3' },
  { tab: 'ritmo', label: 'Ritmo', hotkey: '4' },
]

const WAITING = 'Todavía no hay datos: llegan tras la próxima respuesta.'
const REASONS: Readonly<Record<NonNullable<Turn['reason']>, string>> = {
  answer: 'respuesta',
  aborted: 'abortado',
  refusal: 'rechazo',
  error: 'error',
}
const TABLE_ROWS = 50
const LIST_ROWS = 20

type Parts = Pick<ReturnType<EngineInterface['ui']['resolve']>, 'Box' | 'Text' | 'Button'>

// What the pane reads of the session beside the history.
export type View = {
  columns: number
  tab: Tab
  history: History
  now: number
  // From `$.session.usage()`: when the session started, how full its context is, Claude Code's own cost.
  usage?: { startedAt?: number; percent?: number; usd?: number }
}

// One run of text in a line: dim by default, or coloured, bold or inverted.
type Seg = { text: string; color?: string; dim?: boolean; bold?: boolean; fill?: string }

const dim = (text: string): Seg => ({ text, dim: true })
const plain = (text: string): Seg => ({ text })

const clamp = (n: number, low: number, high: number): number => Math.min(high, Math.max(low, n))
const colorOf = (model: string): string | undefined => pickOfId(model)?.family.color
const promptOf = (t: { input: number; cacheRead: number; cacheWrite: number }): number => t.input + t.cacheRead + t.cacheWrite

/** The pane's tree: a header, the tabs and the chosen tab's chart, drawn to `view.columns`. */
// JSX compiles to calls of `hyper` (the pragma above): the hooks module hands in its own `h`.
export type Hyper = (
  tag: string | ((props: never) => RenderNode | null | undefined),
  props: Record<string, unknown> | null | undefined,
  ...children: unknown[]
) => RenderNode | null | undefined

export const drawPane = (hyper: Hyper, parts: Parts, view: View, onTab: (tab: Tab) => unknown) => {
  const { Box, Text, Button } = parts
  const { columns, history: h, now } = view

  const line = (...segs: Seg[]) => (
    <Text wrap="truncate-end">
      {segs.map(seg => (
        <Text
          color={seg.color}
          dimColor={seg.dim}
          bold={seg.bold}
          backgroundColor={seg.fill}
        >
          {seg.text}
        </Text>
      ))}
    </Text>
  )

  // --- header -------------------------------------------------------------
  const started = view.usage?.startedAt ?? h.turns[0]?.startedAt
  const turnsSeen = h.turns.length + h.dropped
  const head = [
    `sesión ${started === undefined ? '–' : duration(Math.max(0, now - started))}`,
    `~${money(h.total.cost)}`,
    `${turnsSeen} turnos`,
    ...(view.usage?.percent === undefined ? [] : [`contexto ${Math.round(view.usage.percent)}%`]),
    ...(view.usage?.usd === undefined ? [] : [`/cost ${money(view.usage.usd)}`]),
  ].join(' · ')

  const tabs = (
    <Box>
      {TABS.map(({ tab, label, hotkey }) => (
        <Button key={tab} plain hotkey={hotkey} dimColor={tab !== view.tab} onPress={() => onTab(tab)}>
          {tab === view.tab ? (
            <Text bold inverse>{` ${hotkey}: ${label} `}</Text>
          ) : (
            <Text>{` ${hotkey}: ${label} `}</Text>
          )}
        </Button>
      ))}
    </Box>
  )

  // --- costo ----------------------------------------------------------------
  const costTab = (): ReturnType<typeof line>[] => {
    const shown = h.turns.slice(-Math.max(1, columns))
    const costs = shown.map(turn => turn.cost)
    const top = costs.reduce((most, cost) => Math.max(most, cost), 0)
    const rows: ReturnType<typeof line>[] = [
      line(dim(`COSTO POR TURNO · últimos ${shown.length} de ${turnsSeen} · máx ${money(top)}`)),
      ...columnChart(costs, 3, top).map(row => line(plain(row))),
    ]

    const withTok = columns >= 48
    const withCache = columns >= 40
    const barWidth = clamp(columns - 4 - 1 - 8 - 1 - (withTok ? 13 : 0) - (withCache ? 6 : 0), 4, 40)
    const recent = h.turns.slice(-TABLE_ROWS).reverse()
    const worst = recent.reduce((most, turn) => Math.max(most, turn.cost), 0)

    rows.push(
      line(
        dim(`${cell('#', 4, 'right')} ${cell('costo', 8)}`),
        dim(cell('▒ entrada █ salida', barWidth)),
        ...(withTok ? [dim(` ${cell('tok', 12)}`)] : []),
        ...(withCache ? [dim(` ${cell('cache', 5)}`)] : []),
      ),
    )

    recent.forEach((turn, index) => {
      const number = turnsSeen - index
      const [light, full] = stack([turn.cost - turn.costOut, turn.costOut], worst, barWidth)
      const color = colorOf(turn.model)

      rows.push(
        line(
          plain(`${cell(String(number), 4, 'right')} ${cell(money(turn.cost), 8)}`),
          { text: '▒'.repeat(light ?? 0), color, dim: true },
          { text: '█'.repeat(full ?? 0), color },
          plain(' '.repeat(Math.max(0, barWidth - (light ?? 0) - (full ?? 0)))),
          ...(withTok ? [dim(` ${cell(`${count(promptOf(turn))}→${count(turn.output)}`, 12)}`)] : []),
          ...(withCache ? [dim(` ${cell(pct(turn.cacheRead, promptOf(turn)), 5)}`)] : []),
        ),
      )
    })

    const all = h.total
    rows.push(
      line(
        dim(
          `total ~${money(all.cost)} · ${count(promptOf(all))}→${count(all.output)} tok · cache ${pct(all.cacheRead, promptOf(all))}` +
            (all.agentCost > 0 ? ` · subagentes ${money(all.agentCost)}` : ''),
        ),
      ),
    )

    return rows
  }

  // --- modelos --------------------------------------------------------------
  const modelsTab = (): ReturnType<typeof line>[] => {
    const entries = Object.entries(h.models).sort((a, b) => b[1].cost - a[1].cost)
    const top = entries.reduce((most, [, stat]) => Math.max(most, stat.cost), 0)
    const withTok = columns >= 56
    const withReq = columns >= 46
    const barWidth = clamp(columns - 2 - 13 - 1 - 7 - 5 - (withTok ? 13 : 0) - (withReq ? 8 : 0), 3, 30)
    const rows: ReturnType<typeof line>[] = [line(dim('USO POR MODELO'))]

    for (const [id, stat] of entries) {
      const known = pickOfId(id)
      const name = known === undefined ? id : `${known.family.label} ${known.version.version}`
      const bar = hbar(stat.cost, top, barWidth)

      rows.push(
        line(
          { text: `${known?.family.glyph ?? '·'} `, color: known?.family.color },
          { text: cell(name, 12), dim: known === undefined },
          plain(' '),
          { text: bar, color: known?.family.color },
          plain(' '.repeat(Math.max(0, barWidth - [...bar].length))),
          plain(` ${cell(money(stat.cost), 7, 'right')}`),
          dim(` ${cell(pct(stat.cost, h.total.cost), 4, 'right')}`),
          ...(withTok ? [dim(` ${cell(`${count(stat.input)}→${count(stat.output)}`, 12)}`)] : []),
          ...(withReq ? [dim(` ${cell(`${stat.steps} req`, 7)}`)] : []),
        ),
      )
    }

    if (h.total.agentCost > 0) {
      rows.push(line(dim(`subagentes: ${money(h.total.agentCost)} (${pct(h.total.agentCost, h.total.cost)} del total)`)))
    }

    return rows
  }

  // --- tools ----------------------------------------------------------------
  const toolsTab = (): ReturnType<typeof line>[] => {
    const tools = [...h.tools].sort((a, b) => b.count - a.count)
    const calls = tools.reduce((all, tool) => all + tool.count, 0)
    const errors = tools.reduce((all, tool) => all + tool.errors, 0)
    const spent = tools.reduce((all, tool) => all + tool.totalMs, 0)
    const top = tools.reduce((most, tool) => Math.max(most, tool.count), 0)
    const withErr = columns >= 44
    const withTime = columns >= 54
    const withAvg = columns >= 62
    const barWidth = clamp(columns - 12 - 1 - 1 - 4 - (withErr ? 7 : 0) - (withTime ? 8 : 0) - (withAvg ? 7 : 0), 3, 14)
    const rows: ReturnType<typeof line>[] = [
      line(dim(`TOOLS · ${calls} llamadas · ${errors} errores · ${duration(spent)}`)),
    ]

    for (const tool of tools) {
      const bar = hbar(tool.count, top, barWidth)

      rows.push(
        line(
          plain(cell(tool.name, 12)),
          plain(' '),
          plain(bar),
          plain(' '.repeat(Math.max(0, barWidth - [...bar].length))),
          plain(` ${cell(String(tool.count), 4, 'right')}`),
          ...(withErr
            ? [tool.errors > 0 ? ({ text: ` ${cell(`${tool.errors} err`, 6)}`, color: 'error' } as Seg) : dim(` ${cell('–', 6)}`)]
            : []),
          ...(withTime ? [dim(` ${cell(duration(tool.totalMs), 7, 'right')}`)] : []),
          ...(withAvg ? [dim(` ${cell(duration(tool.totalMs / Math.max(1, tool.count)), 6, 'right')}`)] : []),
        ),
      )
    }

    return rows
  }

  // --- ritmo ----------------------------------------------------------------
  const paceTab = (): ReturnType<typeof line>[] => {
    const summary = pace(h)
    const first = h.turns[0]?.startedAt ?? now
    const span = Math.max(1, now - (view.usage?.startedAt ?? first))
    const width = clamp(columns - 11 - 1 - 14, 8, 40)
    const recent = h.turns.slice(-width)
    const lengths = recent.map(turn => turn.durationMs ?? Math.max(0, now - turn.startedAt))
    const steps = recent.map(turn => turn.steps)
    const buckets = activity(h.turns, first, Math.max(first + 1, now), width)
    const longest = lengths.reduce((most, ms) => Math.max(most, ms), 0)
    const busiest = steps.reduce((most, n) => Math.max(most, n), 0)

    const rows: ReturnType<typeof line>[] = [
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
        plain(` ${sparkline(buckets)}`),
        dim(`   ${width} tramos de ${duration(Math.max(1, now - first) / width)}`),
      ),
    ]

    h.turns
      .slice(-LIST_ROWS)
      .reverse()
      .forEach((turn, index) => {
        const label = turn.durationMs === undefined ? 'en curso' : (REASONS[turn.reason ?? 'answer'] ?? 'respuesta')

        rows.push(
          line(
            plain(`${cell(String(turnsSeen - index), 4, 'right')}  `),
            plain(cell(duration(turn.durationMs ?? Math.max(0, now - turn.startedAt)), 7)),
            dim(` ${cell(`${turn.steps} pasos`, 9)} ${label}`),
          ),
        )
      })

    return rows
  }

  const isEmpty = h.total.steps === 0 && h.tools.length === 0
  const body = isEmpty
    ? [line(dim(WAITING))]
    : { costo: costTab, modelos: modelsTab, tools: toolsTab, ritmo: paceTab }[view.tab]()

  return (
    <Box flexDirection="column">
      {line(plain(head))}
      {tabs}
      {body}
    </Box>
  )
}
