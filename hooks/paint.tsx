/** @jsx hyper */
// Draws rows (`rows.ts`), still or in motion. The motion is a small state
// stepped on a timer: `stepAnim` moves it, `paint` reads it. With no state the
// rows are drawn as they stand, which is what a surface with no timer gets.

import type { EngineInterface, RenderNode } from 'claude-code'

import { cell, columns as columnChart, duration } from './charts'
import type { LiveProps, Row, Seg } from './rows'

// JSX compiles to calls of `hyper` (the pragma above): the caller hands in its own `h`.
export type Hyper = (
  tag: string | ((props: never) => RenderNode | null | undefined),
  props: Record<string, unknown> | null | undefined,
  ...children: unknown[]
) => RenderNode | null | undefined

// The elements `paint` draws with, as every surface names them.
export type Parts = Pick<ReturnType<EngineInterface['ui']['resolve']>, 'Box' | 'Text'>

// Where the motion stands. Frames count ticks; the maps are by row or bar key.
export type Anim = {
  frame: number
  // Milliseconds since the props in hand were made, which clocks add to their `now`.
  ms: number
  propsNow: number
  tab: string
  // The frame the tab was shown at: its charts rise from there.
  tabFrame: number
  // The frame each keyed row first appeared at, and the one it was first seen done at.
  seen: Record<string, number>
  over: Record<string, number>
  // How much of each growing bar or meter is drawn so far.
  shown: Record<string, number>
}

const SPINNER = '⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏'
// A frame so long ago that nothing is in motion because of it.
const LONG_AGO = -1000
const SLIDE_FRAMES = 4
const SLIDE_CELLS = 4
const FADE_FRAMES = 6
const RISE_FRAMES = 5
const PULSE_FRAMES = 8

const isLine = (row: Row): row is Extract<Row, { segs: Seg[] }> => 'segs' in row
const lengthOf = (text: string): number => [...text].length
const targetOf = (seg: Seg): number => (seg.fx === 'meter' ? (seg.value ?? 0) : lengthOf(seg.text))

const movers = (props: LiveProps): Seg[] =>
  props.rows.flatMap(row => (isLine(row) ? row.segs.filter(seg => (seg.fx === 'grow' || seg.fx === 'meter') && seg.key !== undefined) : []))

// The state a tab starts from: its rows are already there (none slides in or
// fades), its bars and charts start empty and rise.
const fresh = (props: LiveProps, frame: number): Anim => {
  const seen: Record<string, number> = {}
  const over: Record<string, number> = {}

  for (const row of props.rows) {
    if (row.key === undefined) continue
    seen[row.key] = LONG_AGO
    if (isLine(row) && row.isDone) over[row.key] = LONG_AGO
  }

  return { frame, ms: 0, propsNow: props.now, tab: props.tab, tabFrame: frame, seen, over, shown: {} }
}

// One step of `from` toward `to`: a third of the way, a whole unit at least.
const toward = (from: number, to: number): number => {
  const gap = to - from
  if (gap === 0) return from

  return from + Math.sign(gap) * Math.max(1, Math.ceil(Math.abs(gap) / 3))
}

/**
 * How often the drawing has to be stepped: `fast` while something turns,
 * slides, fades or grows; `slow` when only clocks run (a step a second is
 * enough); `still` when nothing moves.
 */
export const paceOf = (props: LiveProps, anim: Anim): 'fast' | 'slow' | 'still' => {
  let hasClock = false

  for (const row of props.rows) {
    if (!isLine(row)) {
      if (anim.frame - anim.tabFrame <= RISE_FRAMES) return 'fast'
      continue
    }

    if (row.key !== undefined) {
      if (anim.seen[row.key] === undefined || anim.frame - (anim.seen[row.key] ?? 0) <= SLIDE_FRAMES) return 'fast'
      if (row.isDone && (anim.over[row.key] === undefined || anim.frame - (anim.over[row.key] ?? 0) <= FADE_FRAMES)) return 'fast'
    }

    for (const seg of row.segs) {
      if (seg.fx === 'pulse' || seg.fx === 'spin' || seg.fx === 'dots') return 'fast'
      if ((seg.fx === 'grow' || seg.fx === 'meter') && seg.key !== undefined && (anim.shown[seg.key] ?? 0) !== targetOf(seg)) return 'fast'
      if (seg.fx === 'clock') hasClock = true
    }
  }

  return hasClock ? 'slow' : 'still'
}

/**
 * The motion `dt` milliseconds later. With none before, the state the props
 * start from; a change of tab starts over from that tab's.
 */
export const stepAnim = (was: Anim | undefined, props: LiveProps, dt: number): Anim => {
  if (was === undefined) return fresh(props, 0)

  const base = props.tab === was.tab ? was : fresh(props, was.frame)
  const frame = base.frame + 1
  const seen: Record<string, number> = {}
  const over: Record<string, number> = {}
  const shown: Record<string, number> = {}

  for (const row of props.rows) {
    if (row.key === undefined) continue
    seen[row.key] = base.seen[row.key] ?? frame
    if (isLine(row) && row.isDone) over[row.key] = base.over[row.key] ?? frame
  }
  for (const seg of movers(props)) {
    const key = seg.key as string
    shown[key] = toward(base.shown[key] ?? 0, targetOf(seg))
  }

  return {
    frame,
    ms: props.now === base.propsNow ? base.ms + dt : 0,
    propsNow: props.now,
    tab: props.tab,
    tabFrame: base.tabFrame,
    seen,
    over,
    shown,
  }
}

/**
 * The motion as these props are to be drawn with it: the held state, brought
 * in line when the props are newer than it (another tab, a later `now`), so no
 * frame is drawn with the last props' motion.
 */
export const animFor = (held: Anim | undefined, props: LiveProps): Anim => {
  if (held === undefined) return fresh(props, 0)
  if (held.tab !== props.tab) return fresh(props, held.frame)

  return held.propsNow === props.now ? held : { ...held, ms: 0, propsNow: props.now }
}

// A run as it reads at this frame: its text, and the color it takes.
const settle = (seg: Seg, props: LiveProps, anim: Anim | null): { text: string; color?: string } => {
  const frame = anim?.frame ?? 0

  switch (seg.fx) {
    case 'pulse':
      return { text: anim !== null && frame % PULSE_FRAMES >= PULSE_FRAMES / 2 ? (seg.alt ?? seg.text) : seg.text, color: seg.color }
    case 'spin':
      return { text: anim === null ? seg.text : (SPINNER[frame % SPINNER.length] as string), color: seg.color }
    case 'dots':
      return { text: seg.text + cell('.'.repeat(anim === null ? 3 : 1 + (Math.floor(frame / 3) % 3)), 3), color: seg.color }
    case 'clock': {
      const elapsed = Math.max(0, props.now + (anim?.ms ?? 0) - (seg.since ?? props.now))
      const text = duration(elapsed)

      return {
        text: seg.width === undefined ? text : cell(text, seg.width, seg.align),
        color: seg.warnAfter !== undefined && elapsed > seg.warnAfter ? 'warning' : seg.color,
      }
    }
    case 'grow': {
      const glyphs = [...seg.text]
      const upTo = anim === null || seg.key === undefined ? glyphs.length : Math.min(glyphs.length, anim.shown[seg.key] ?? 0)

      return { text: cell(glyphs.slice(0, upTo).join(''), seg.width ?? glyphs.length), color: seg.color }
    }
    case 'meter': {
      const width = seg.width ?? 8
      const percent = anim === null || seg.key === undefined ? (seg.value ?? 0) : (anim.shown[seg.key] ?? 0)
      const filled = Math.max(0, Math.min(width, Math.round((percent / 100) * width)))

      return {
        text: '▰'.repeat(filled) + '▱'.repeat(width - filled),
        color: seg.isGoodHigh
          ? percent >= 70 ? 'success' : percent >= 30 ? 'warning' : 'error'
          : percent >= 90 ? 'error' : percent >= 70 ? 'warning' : 'success',
      }
    }
    default:
      return { text: seg.text, color: seg.color }
  }
}

/** The rows as a tree: one line of text per row, a chart as its rows of columns. */
export const paint = (hyper: Hyper, parts: Parts, props: LiveProps, anim: Anim | null) => {
  const { Box, Text } = parts
  const frame = anim?.frame ?? 0

  return (
    <Box flexDirection="column">
      {props.rows.map(row => {
        if (!isLine(row)) {
          // A chart rises from nothing when its tab is shown.
          const risen = anim === null ? 1 : Math.min(1, (frame - anim.tabFrame + 1) / RISE_FRAMES)

          return columnChart(row.chart.map(value => value * risen), row.height, row.max).map(text => (
            <Text wrap="truncate-end" color={row.color}>
              {text}
            </Text>
          ))
        }

        const key = row.key
        // A row that just appeared slides in from the right; one that just ended flashes, then fades.
        const age = anim === null || key === undefined ? SLIDE_FRAMES : frame - (anim.seen[key] ?? frame)
        const gone = anim === null || key === undefined ? FADE_FRAMES : frame - (anim.over[key] ?? frame)
        const pad = age < SLIDE_FRAMES ? ' '.repeat((SLIDE_FRAMES - age) * SLIDE_CELLS) : ''
        const isFlash = row.isDone === true && gone < FADE_FRAMES / 2
        const isFaded = row.isDone === true && gone >= FADE_FRAMES

        return (
          <Text wrap="truncate-end">
            {pad}
            {row.segs.map(seg => {
              const now = settle(seg, props, anim)

              return (
                <Text
                  color={now.color}
                  backgroundColor={seg.fill}
                  bold={seg.bold === true || isFlash}
                  dimColor={seg.dim === true || isFaded}
                >
                  {now.text}
                </Text>
              )
            })}
          </Text>
        )
      })}
    </Box>
  )
}
