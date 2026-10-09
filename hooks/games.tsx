// The stats pane's games: a surface module with a clock, keys and a pointer
// of its own. It has no `$`: the hooks tell it which game and at what size,
// and it posts a finished game's score back to them.

import type { ClientSurface, JsonValue } from 'claude-code'

import { aimInvaders, fireInvaders, newInvaders, nudgeInvaders, stepInvaders, toggleInvaders } from './invaders'
import type { Invaders } from './invaders'
import { paint } from './paint'
import { aimPong, newPong, nudgePong, pongScore, stepPong, togglePong, WIN } from './pong'
import type { Pong } from './pong'
import type { Seg } from './rows'
import { drawInvaders, drawPong, invadersHud } from './screens'

export type Game = 'pong' | 'invaders'

// What the hooks hand the games: which one, the player's color, the room there is.
export type GameProps = { game: Game; color: string; columns: number; rows: number }

type State = { pong?: Pong; invaders?: Invaders }

const TICK_MS = 50
// Rows of the region above the field (the line of points) and below it (the keys).
const ABOVE = 1
const CHROME = 3
const WIDEST = 60
const NARROWEST = 40
const KEY_STEP = 4

const HINTS: Readonly<Record<Game, string>> = {
  pong: '↑↓ o mouse mueven · espacio pausa · r reinicia',
  invaders: '←→ o mouse mueven · espacio o clic dispara · p pausa · r reinicia',
}

const clamp = (n: number, low: number, high: number): number => Math.min(high, Math.max(low, n))

// The field each game gets in the room given: cells across and rows down; undefined when it does not fit.
const fieldOf = (props: GameProps): { w: number; rows: number } | undefined => {
  if (props.columns < NARROWEST) return undefined

  const most = props.game === 'pong' ? 18 : 20
  const least = props.game === 'pong' ? 8 : 14

  return { w: clamp(props.columns - 2, NARROWEST - 2, WIDEST), rows: clamp(props.rows - CHROME - 4, least, most) }
}

// The game in hand, made anew when there is none or the room changed.
const pongOf = (state: State | undefined, props: GameProps): Pong | undefined => {
  const field = fieldOf(props)
  if (field === undefined) return undefined

  const has = state?.pong

  return has !== undefined && has.w === field.w && has.h === field.rows * 2 ? has : newPong(field.w, field.rows * 2)
}

const invadersOf = (state: State | undefined, props: GameProps): Invaders | undefined => {
  const field = fieldOf(props)
  if (field === undefined) return undefined

  const has = state?.invaders

  return has !== undefined && has.w === field.w && has.h === field.rows ? has : newInvaders(field.w, field.rows)
}

// Each instance's latest props, for its timer and listeners (which outlive the call that set them).
const held = new WeakMap<object, GameProps>()

const Games = (props: JsonValue, surface: ClientSurface<State>) => {
  const now = props as unknown as GameProps

  if (!held.has(surface)) {
    const propsNow = (): GameProps => held.get(surface) as GameProps

    // One game changed by `change`, the other kept; a finished one posts its score once.
    const pong = (change: (game: Pong) => Pong): void => {
      const game = pongOf(surface.state, propsNow())
      if (game === undefined) return

      const next = change(game)
      if (next === game) return
      if (next.phase === 'over' && game.phase !== 'over') surface.post({ game: 'pong', score: pongScore(next) })
      surface.setState({ ...surface.state, pong: next })
    }
    const invaders = (change: (game: Invaders) => Invaders): void => {
      const game = invadersOf(surface.state, propsNow())
      if (game === undefined) return

      const next = change(game)
      if (next === game) return
      if (next.phase === 'over' && game.phase !== 'over') surface.post({ game: 'invaders', score: next.score })
      surface.setState({ ...surface.state, invaders: next })
    }

    surface.every(TICK_MS, () => {
      // A game that is not being played comes back the same, and asks for no redraw.
      if (propsNow().game === 'pong') pong(game => stepPong(game, TICK_MS / 1000))
      else invaders(game => stepInvaders(game, TICK_MS / 1000))
    })

    surface.onKey(({ key }) => {
      const isPong = propsNow().game === 'pong'
      const name = key.toLowerCase()

      if (name === 'r') {
        if (isPong) pong(game => ({ ...newPong(game.w, game.h), phase: 'playing' }))
        else invaders(game => ({ ...newInvaders(game.w, game.h), phase: 'playing' }))
      } else if (name === 'p' || name === 'return') {
        if (isPong) pong(togglePong)
        else invaders(toggleInvaders)
      } else if (name === ' ' || name === 'space') {
        if (isPong) pong(togglePong)
        else invaders(fireInvaders)
      } else if (isPong && (name === 'up' || name === 'w')) {
        pong(game => nudgePong(game, -KEY_STEP))
      } else if (isPong && (name === 'down' || name === 's')) {
        pong(game => nudgePong(game, KEY_STEP))
      } else if (!isPong && (name === 'left' || name === 'a')) {
        invaders(game => nudgeInvaders(game, -KEY_STEP))
      } else if (!isPong && (name === 'right' || name === 'd')) {
        invaders(game => nudgeInvaders(game, KEY_STEP))
      }
    })

    surface.onPointer(event => {
      if (event.type !== 'down' && event.type !== 'move') return

      if (propsNow().game === 'pong') {
        // A cell of text is two pixels tall.
        pong(game => {
          const aimed = aimPong(game, (event.y - ABOVE) * 2 + 1)

          return event.type === 'down' && game.phase !== 'playing' ? togglePong(aimed) : aimed
        })
      } else {
        invaders(game => {
          const aimed = aimInvaders(game, event.x)

          return event.type === 'down' ? fireInvaders(aimed) : aimed
        })
      }
    })
  }
  held.set(surface, now)

  const lines: Seg[][] = []
  const game = now.game === 'pong' ? pongOf(surface.state, now) : invadersOf(surface.state, now)

  if (game === undefined) {
    lines.push([{ text: 'Panel muy angosto para jugar: agrandalo a 40 columnas o más.', dim: true }])
  } else if (now.game === 'pong') {
    lines.push([{ text: 'PONG', dim: true }, { text: `  a ${WIN} puntos`, dim: true }], ...drawPong(game as Pong, now.color))
  } else {
    lines.push(invadersHud(game as Invaders, now.color), ...drawInvaders(game as Invaders, now.color))
  }
  if (game !== undefined) lines.push([{ text: HINTS[now.game], dim: true }])

  return paint(h, surface.elements, { tab: 'game', now: 0, rows: lines.map(segs => ({ segs })) }, null)
}

export default Games
