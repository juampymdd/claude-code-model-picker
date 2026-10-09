// The stats pane's moving part: a surface module, drawn on the drawing thread
// with a timer of its own. It has no `$`: the hooks hand it rows as props and
// it draws them, stepping the motion while something is moving.

import type { ClientSurface, JsonValue } from 'claude-code'

import { animFor, paceOf, paint, stepAnim } from './paint'
import type { Anim } from './paint'
import type { LiveProps } from './rows'

const TICK_MS = 120
const SECOND_MS = 1000

// Each instance's latest props and the time not yet stepped, for its timer
// (which outlives the call that started it).
const held = new WeakMap<object, { props: LiveProps; pending: number }>()

const Live = (props: JsonValue, surface: ClientSurface<Anim>) => {
  const rows = props as unknown as LiveProps
  const mine = held.get(surface)

  if (mine === undefined) {
    held.set(surface, { props: rows, pending: 0 })

    surface.every(TICK_MS, () => {
      const now = held.get(surface)
      if (now === undefined) return

      now.pending += TICK_MS
      const anim = animFor(surface.state, now.props)
      const pace = paceOf(now.props, anim)

      // Nothing moving asks for no redraw; clocks alone, for one a second.
      if (pace === 'still' && anim === surface.state) {
        now.pending = 0

        return
      }
      if (pace === 'slow' && anim === surface.state && now.pending < SECOND_MS) return

      surface.setState(stepAnim(surface.state, now.props, now.pending))
      now.pending = 0
    })
  } else {
    mine.props = rows
  }

  return paint(h, surface.elements, rows, animFor(surface.state, rows))
}

export default Live
