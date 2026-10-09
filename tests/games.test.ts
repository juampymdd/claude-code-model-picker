import { expect, test } from 'claude-code/testing'

import {
  COLS,
  fireInvaders,
  invaderAt,
  newInvaders,
  nudgeInvaders,
  ROWS,
  shipRow,
  stepInvaders,
  toggleInvaders,
} from '../hooks/invaders'
import type { Invaders } from '../hooks/invaders'
import { blank, plot, toRows, write } from '../hooks/pixels'
import { aimPong, newPong, nudgePong, PADDLE, PADDLE_X, pongScore, stepPong, togglePong, WIN } from '../hooks/pong'
import type { Pong } from '../hooks/pong'
import { drawInvaders, drawPong } from '../hooks/screens'

// The game after `seconds`, in frames of 50 ms.
const play = <T>(step: (game: T, dt: number) => T, game: T, seconds: number): T => {
  let now = game
  for (let i = 0; i < Math.round(seconds * 20); i += 1) now = step(now, 0.05)

  return now
}

test('two pixels make a cell: half blocks by which is lit, a full one when both match', () => {
  const f = blank(4, 1)
  plot(f, 0, 0, 'red')
  plot(f, 1, 1, 'blue')
  plot(f, 2, 0, 'red')
  plot(f, 2, 1, 'red')
  plot(f, 3, 0, 'red')
  plot(f, 3, 1, 'blue')
  plot(f, 9, 9, 'red')

  expect(toRows(f)).toEqual([
    [
      { text: '▀', color: 'red' },
      { text: '▄', color: 'blue' },
      { text: '█', color: 'red' },
      { text: '▀', color: 'red', fill: 'blue' },
    ],
  ])
})

test('cells of one color join into one run, and a glyph is drawn over its pixels', () => {
  const f = blank(6, 2)
  for (let x = 0; x < 6; x += 1) plot(f, x, 0, 'red')
  write(f, 4, 0, 'ab', 'green')
  write(f, 5, 1, 'xyz')

  const rows = toRows(f)
  expect(rows[0]).toEqual([
    { text: '▀▀▀▀', color: 'red' },
    { text: 'ab', color: 'green' },
  ])
  expect(rows[1]?.map(run => run.text).join('')).toBe('     x')
  expect(rows.every(row => row.reduce((n, run) => n + [...run.text].length, 0) === 6)).toBe(true)
})

test('pong waits, then the ball bounces off the walls and stays in the field', () => {
  const start = newPong(60, 36)
  expect(stepPong(start, 1)).toBe(start)

  let game = togglePong(start)
  expect(game.phase).toBe('playing')

  let lowest = game.ball.y
  let highest = game.ball.y
  for (let i = 0; i < 400 && game.phase === 'playing'; i += 1) {
    game = stepPong(aimPong(game, game.ball.y), 0.05)
    lowest = Math.min(lowest, game.ball.y)
    highest = Math.max(highest, game.ball.y)
  }

  expect(lowest).toBeGreaterThanOrEqual(0)
  expect(highest).toBeLessThanOrEqual(36)
  expect(highest - lowest).toBeGreaterThan(10)
})

test('a paddle sends the ball back faster, and a paddle never leaves the field', () => {
  const start = togglePong(newPong(60, 36))
  const served: Pong = { ...start, ball: { x: 10, y: 18, vx: -30, vy: 0 }, left: 18, aim: 18 }
  const back = play(stepPong, served, 0.5)

  expect(back.ball.vx).toBeGreaterThan(30)
  expect(back.score).toEqual([0, 0])

  const pushed = play(stepPong, nudgePong(nudgePong(served, -500), -500), 2)
  expect(pushed.left).toBe(PADDLE / 2)
  expect(play(stepPong, aimPong(served, 999), 2).left).toBe(36 - PADDLE / 2)
})

test('a ball past a paddle is a point for the other side, and eleven end the game', () => {
  const start = togglePong(newPong(60, 36))
  // The player's paddle is at the top and the ball goes by at the bottom.
  const missed: Pong = { ...start, ball: { x: PADDLE_X + 3, y: 34, vx: -40, vy: 0 }, left: 4, aim: 4 }
  const after = play(stepPong, missed, 0.5)

  expect(after.score).toEqual([0, 1])
  // Served again from the middle, at the side that lost the point.
  expect(after.ball.vx).toBeLessThan(0)
  expect(after.ball.x).toBeGreaterThan(PADDLE_X + 3)
  expect(after.phase).toBe('playing')

  const last: Pong = { ...missed, score: [3, WIN - 1] }
  const over = play(stepPong, last, 0.5)
  expect(over.phase).toBe('over')
  expect(pongScore(over)).toBe(0)
  expect(pongScore({ ...over, score: [WIN, 4] })).toBe(7)
  expect(togglePong(over)).toMatchObject({ phase: 'playing', score: [0, 0] })
})

test('a fast ball does not pass through a paddle in one long frame', () => {
  const start = togglePong(newPong(60, 36))
  const fast: Pong = { ...start, ball: { x: 20, y: 18, vx: -90, vy: 0 }, left: 18, aim: 18 }

  expect(stepPong(fast, 0.5).score).toEqual([0, 0])
})

test('the invaders march sideways, drop at the edge and turn back', () => {
  const start = toggleInvaders(newInvaders(60, 20))
  expect(start.alive.filter(Boolean)).toHaveLength(ROWS * COLS)

  const marched = play(stepInvaders, start, 3)
  expect(marched.ox).toBeGreaterThan(start.ox)
  expect(marched.oy).toBe(start.oy)

  const later = play(stepInvaders, start, 25)
  expect(later.oy).toBeGreaterThan(start.oy)
  expect(stepInvaders(newInvaders(60, 20), 1).ox).toBe(start.ox)
})

test('a shot takes out the invader over the ship and scores its row; one shot at a time', () => {
  const start = toggleInvaders(newInvaders(60, 20))
  const under = invaderAt(start, ROWS - 1, 3)
  const aimed: Invaders = { ...start, ship: under.x, aim: under.x, wait: 99_999 }

  const fired = fireInvaders(aimed)
  expect(fired.shot).not.toBeNull()
  expect(fireInvaders(fired)).toBe(fired)

  const hit = play(stepInvaders, fired, 1)
  expect(hit.alive.filter(Boolean)).toHaveLength(ROWS * COLS - 1)
  expect(hit.alive[(ROWS - 1) * COLS + 3]).toBe(false)
  expect(hit.score).toBe(10)
  expect(hit.shot).toBeNull()
})

test('a shield wears out under fire, and a bomb on the ship costs a life', () => {
  const start = toggleInvaders(newInvaders(60, 20))
  const shield = start.shields[0]!
  const behind: Invaders = { ...start, ship: shield.x, aim: shield.x, wait: 99_999 }

  const once = play(stepInvaders, fireInvaders(behind), 1)
  expect(once.shields.find(cell => cell.x === shield.x && cell.y === shield.y)?.hp).toBe(1)
  const twice = play(stepInvaders, fireInvaders(once), 1)
  expect(twice.shields.some(cell => cell.x === shield.x && cell.y === shield.y)).toBe(false)

  const bombed: Invaders = { ...start, ship: 2, aim: 2, wait: 99_999, bombs: [{ x: 2, y: shipRow(start) - 2 }] }
  const struck = play(stepInvaders, bombed, 1)
  expect(struck.lives).toBe(2)
  expect(struck.phase).toBe('playing')

  const dying: Invaders = { ...bombed, lives: 1 }
  expect(play(stepInvaders, dying, 1).phase).toBe('over')
})

test('clearing the wave brings a faster one, and invaders reaching the ship end the game', () => {
  const start = toggleInvaders(newInvaders(60, 20))
  const one: Invaders = { ...start, alive: start.alive.map((_, i) => i === 0), wait: 99_999 }
  const top = invaderAt(one, 0, 0)
  const cleared = play(stepInvaders, fireInvaders({ ...one, ship: top.x, aim: top.x }), 1)

  expect(cleared.wave).toBe(2)
  expect(cleared.alive.filter(Boolean)).toHaveLength(ROWS * COLS)
  expect(cleared.wait).toBeLessThan(start.wait)
  expect(cleared.score).toBe(30)

  const low: Invaders = { ...start, oy: shipRow(start) - ROWS }
  expect(stepInvaders(low, 0.05).phase).toBe('over')
})

test('the ship follows its aim and stays in the field', () => {
  const start = toggleInvaders(newInvaders(60, 20))
  const far = play(stepInvaders, { ...nudgeInvaders(start, -999), wait: 99_999 }, 3)

  expect(far.ship).toBe(1)
  expect(toggleInvaders(toggleInvaders(start)).phase).toBe('playing')
  expect(toggleInvaders(start).phase).toBe('paused')
})

test('each game is drawn to its field, with a notice while it waits', () => {
  const pong = drawPong(newPong(60, 36), '#FB923C')
  expect(pong).toHaveLength(18)
  expect(pong.every(row => row.reduce((n, run) => n + [...run.text].length, 0) === 60)).toBe(true)
  expect(pong.map(row => row.map(run => run.text).join('')).join('\n')).toMatch(/clic o espacio para jugar/)

  const invaders = drawInvaders(toggleInvaders(newInvaders(60, 20)), '#FB923C')
  const screen = invaders.map(row => row.map(run => run.text).join('')).join('\n')
  expect(invaders).toHaveLength(20)
  expect(screen).toMatch(/▚▞/)
  expect(screen).toMatch(/▟█▙/)
  expect(screen).not.toMatch(/para jugar/)
})
