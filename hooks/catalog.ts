// The games the stats pane offers, in the order its menu lists them.

import type { GameDef } from './arcade'
import { asteroids } from './asteroids'
import { breakout } from './breakout'
import { invaders, pong } from './classics'
import { dino } from './dino'
import { flappy } from './flappy'
import { frogger } from './frogger'
import { g2048 } from './g2048'
import { life } from './life'
import { mines } from './mines'
import { race, tokens } from './sessiongames'
import { snake } from './snake'
import { sokoban } from './sokoban'
import { tetris } from './tetris'

// Each game keeps a state of its own shape; the catalog only ever hands a
// state back to the game that made it.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyGame = GameDef<any>

export const GAMES: readonly AnyGame[] = [
  pong,
  invaders,
  snake,
  tetris,
  breakout,
  g2048,
  mines,
  flappy,
  dino,
  frogger,
  asteroids,
  sokoban,
  life,
  tokens,
  race,
]

export const gameOf = (id: string): AnyGame => GAMES.find(game => game.id === id) ?? (GAMES[0] as AnyGame)
