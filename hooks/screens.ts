// How each game looks: its state drawn as rows of runs of text. Pure.

import { COLS, invaderAt, ROWS, shipRow } from './invaders'
import type { Invaders } from './invaders'
import { blank, plot, rect, toRows, write } from './pixels'
import type { Frame } from './pixels'
import { PADDLE, PADDLE_X, WIN } from './pong'
import type { Phase, Pong } from './pong'
import type { Seg } from './rows'

// The two shapes each row of invaders marches with, and its color.
const SHAPES: readonly { poses: readonly [string, string]; color: string }[] = [
  { poses: ['▚▞', '▞▚'], color: 'error' },
  { poses: ['▛▜', '▙▟'], color: 'warning' },
  { poses: ['▙▟', '▛▜'], color: 'success' },
]

const centered = (f: Frame, row: number, text: string, color?: string): void =>
  write(f, Math.floor((f.w - [...text].length) / 2), row, text, color)

const NOTICE: Readonly<Record<Exclude<Phase, 'playing' | 'over'>, string>> = {
  ready: ' clic o espacio para jugar ',
  paused: ' PAUSA · espacio sigue ',
}

/** Pong: the net, both paddles, the ball and the score, and a notice while it is not being played. */
export const drawPong = (s: Pong, color: string): Seg[][] => {
  const f = blank(s.w, s.h / 2)

  for (let y = 1; y < s.h; y += 4) plot(f, s.w / 2, y, 'subtle')
  rect(f, PADDLE_X, s.left - PADDLE / 2, 1, PADDLE, color)
  rect(f, s.w - 1 - PADDLE_X, s.right - PADDLE / 2, 1, PADDLE, 'inactive')
  if (s.phase !== 'over') plot(f, s.ball.x, s.ball.y, 'claude')

  write(f, Math.floor(s.w / 2) - 4 - String(s.score[0]).length, 0, String(s.score[0]), color)
  write(f, Math.floor(s.w / 2) + 5, 0, String(s.score[1]), 'inactive')

  const middle = Math.floor(s.h / 4)
  if (s.phase === 'over') {
    const won = s.score[0] >= WIN
    centered(f, middle, won ? ' GANASTE ' : ' PERDISTE ', won ? 'success' : 'error')
    centered(f, middle + 1, ' r para otra ')
  } else if (s.phase !== 'playing') {
    centered(f, middle, NOTICE[s.phase])
  }

  return toRows(f)
}

/** Space Invaders: the block of invaders, shots, shields, the ship and what just blew up. */
export const drawInvaders = (s: Invaders, color: string): Seg[][] => {
  const f = blank(s.w, s.h)

  for (let row = 0; row < ROWS; row += 1) {
    const shape = SHAPES[row] as (typeof SHAPES)[number]

    for (let col = 0; col < COLS; col += 1) {
      if (!s.alive[row * COLS + col]) continue

      const at = invaderAt(s, row, col)
      write(f, at.x, at.y, shape.poses[s.pose], shape.color)
    }
  }

  for (const cell of s.shields) write(f, cell.x, cell.y, cell.hp > 1 ? '█' : '▒', 'subtle')
  for (const bomb of s.bombs) write(f, Math.round(bomb.x), Math.round(bomb.y), '╏', 'warning')
  if (s.shot !== null) write(f, Math.round(s.shot.x), Math.round(s.shot.y), '│', 'claude')
  if (s.phase !== 'over' || s.lives > 0) write(f, Math.round(s.ship) - 1, shipRow(s), '▟█▙', color)
  for (const blast of s.blasts) write(f, Math.round(blast.x), Math.round(blast.y), '✦', 'warning')

  const middle = Math.floor(s.h / 2)
  if (s.phase === 'over') {
    centered(f, middle, ' GAME OVER ', 'error')
    centered(f, middle + 1, ' r para otra ')
  } else if (s.phase !== 'playing') {
    centered(f, middle, NOTICE[s.phase])
  }

  return toRows(f)
}

/** The line above the invaders' field: points, lives and wave. */
export const invadersHud = (s: Invaders, color: string): Seg[] => [
  { text: 'PUNTOS ', dim: true },
  { text: String(s.score), bold: true },
  { text: `   ${'◆'.repeat(s.lives)}${' '.repeat(Math.max(0, 3 - s.lives))}   `, color },
  { text: `OLEADA ${s.wave}`, dim: true },
]
