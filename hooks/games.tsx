// The stats pane's games: a surface module with a clock, keys and a pointer
// of its own. It has no `$`: the hooks tell it which game and in what room,
// and it posts a finished game's score back to them. It knows no game: each
// is a `GameDef` from the catalog.

import type { ClientSurface, JsonValue } from 'claude-code'

import { clamp, lcg, NO_DATA, pressKey, pressPointer, screenOf } from './arcade'
import type { GameData, Playable } from './arcade'
import { gameOf } from './catalog'
import type { AnyGame } from './catalog'
import { paint } from './paint'
import type { Seg } from './rows'

// What the hooks hand the games: which one, the player's color, the room there is, the session's data.
export type GameProps = { game: string; color: string; columns: number; rows: number; seed: number; data?: GameData }

// Each game's state, with the field it was made for.
type Slot = { w: number; rows: number; s: Playable }
// The games' states are held beside the instance (below); the surface's own
// state only counts changes, which is what asks for a redraw.
type State = number

const TICK_MS = 50
// Rows of the pane the field cannot use: the header, the tabs, the menu, the game's own lines.
const CHROME = 6

// The field a game gets in the room given; undefined when it does not fit.
const fieldOf = (def: AnyGame, props: GameProps): { w: number; rows: number } | undefined =>
  props.columns < def.minW
    ? undefined
    : { w: Math.min(def.maxW, props.columns - 1), rows: clamp(props.rows - CHROME, def.minRows, def.maxRows) }

// Each instance's latest props, its games and how many it has started, for
// its timer and listeners (which outlive the call that set them).
const held = new WeakMap<object, { props: GameProps; made: number; slots: Record<string, Slot> }>()

const Games = (props: JsonValue, surface: ClientSurface<State>) => {
  const now = props as unknown as GameProps
  const mine = held.get(surface) ?? { props: now, made: 0, slots: {} }
  mine.props = now

  const dataOf = (p: GameProps): GameData => p.data ?? NO_DATA
  // A new game of `def`, each from a seed of its own.
  const fresh = (def: AnyGame, field: { w: number; rows: number }, p: GameProps): Playable => {
    mine.made += 1

    return def.create(field.w, field.rows, lcg(p.seed + mine.made * 7919), dataOf(p)) as Playable
  }
  // The game in hand, made anew when there is none or the room changed.
  const slotOf = (def: AnyGame, p: GameProps): Slot | undefined => {
    const field = fieldOf(def, p)
    if (field === undefined) return undefined

    const has = mine.slots[def.id]
    if (has !== undefined && has.w === field.w && has.rows === field.rows) return has

    const made = { ...field, s: fresh(def, field, p) }
    mine.slots[def.id] = made

    return made
  }

  if (!held.has(surface)) {
    held.set(surface, mine)

    // The game in play changed by `change`; a finished one posts its score once.
    const play = (change: (def: AnyGame, slot: Slot, p: GameProps) => Playable): void => {
      const p = mine.props
      const def = gameOf(p.game)
      const slot = slotOf(def, p)
      if (slot === undefined) return

      const next = change(def, slot, p)
      if (next === slot.s) return
      if (next.phase === 'over' && slot.s.phase !== 'over' && def.noRecord !== true) {
        surface.post({ game: def.id, score: def.score(next) })
      }
      mine.slots[def.id] = { w: slot.w, rows: slot.rows, s: next }
      surface.setState((surface.state ?? 0) + 1)
    }

    surface.every(TICK_MS, () => {
      const def = gameOf(mine.props.game)
      const slot = mine.slots[def.id]
      // Only a game being played moves: the rest asks for no redraw.
      if (def.step === undefined || slot === undefined || slot.s.phase !== 'playing') return

      play((game, at, p) => game.step?.(at.s, TICK_MS / 1000, dataOf(p)) ?? at.s)
    })

    surface.onKey(({ key }) => play((def, slot, p) => pressKey(def, slot.s, key, () => fresh(def, slot, p))))

    surface.onPointer(event =>
      play((def, slot, p) => {
        // The field starts under the game's line above, when it has one.
        const y = event.y - (def.hud === undefined ? 0 : 1)
        const e = { type: event.type as 'down' | 'move' | 'up', x: event.x, y, ...(event.button === undefined ? {} : { button: event.button }) }

        return pressPointer(def, slot.s, e, () => fresh(def, slot, p))
      }),
    )
  }

  const def = gameOf(now.game)
  const slot = slotOf(def, now)
  const lines: Seg[][] =
    slot === undefined
      ? [[{ text: `Panel muy angosto para ${def.label}: necesita ${def.minW} columnas.`, dim: true }]]
      : screenOf(def, slot.s, slot.w, now.color, dataOf(now))

  return paint(h, surface.elements, { tab: 'game', now: 0, rows: lines.map(segs => ({ segs })) }, null)
}

export default Games
