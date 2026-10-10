// The games the stats pane offers, in the order its menu lists them.

import type { GameDef, Playable } from './arcade'
import { invaders, pong } from './classics'

// Each game keeps a state of its own shape; the catalog only ever hands a
// state back to the game that made it.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyGame = GameDef<any>

export const GAMES: readonly AnyGame[] = [pong, invaders]

export const gameOf = (id: string): AnyGame => GAMES.find(game => game.id === id) ?? (GAMES[0] as AnyGame)

export type { Playable }
