import { expect, test } from 'claude-code/testing'

import { lcg, NO_DATA, pressKey, pressPointer, screenOf } from '../hooks/arcade'
import type { GameData } from '../hooks/arcade'
import { asteroids, fire, MAX_SHOTS, newAsteroids, stepAsteroids, thrust, turnShip } from '../hooks/asteroids'
import type { Asteroids } from '../hooks/asteroids'
import { breakout, BRICK_ROWS, launch, newBreakout, stepBreakout } from '../hooks/breakout'
import type { Breakout } from '../hooks/breakout'
import { GAMES } from '../hooks/catalog'
import { pong } from '../hooks/classics'
import { dino, DINO_X, duck, jump, newDino, stepDino } from '../hooks/dino'
import type { Dino } from '../hooks/dino'
import { BIRD_X, flap, gapOf, newFlappy, stepFlappy } from '../hooks/flappy'
import type { Flappy } from '../hooks/flappy'
import { BANK_ROW, frogger, homeAt, hop, lookAt, newFrogger, START_ROW, stepFrogger } from '../hooks/frogger'
import type { Frogger } from '../hooks/frogger'
import { move2048, new2048, slide } from '../hooks/g2048'
import { evolve, newLife } from '../hooks/life'
import { chord, flagCell, near, newMines, openCell } from '../hooks/mines'
import { race, tagOf, tagsFor, hurry, tokens } from '../hooks/sessiongames'
import { newSnake, paceOf, stepSnake, turnSnake } from '../hooks/snake'
import type { Snake } from '../hooks/snake'
import { LEVELS, moveSokoban, newSokoban, undoSokoban } from '../hooks/sokoban'
import type { Sokoban } from '../hooks/sokoban'
import { cellsOf, COLS, drop, holdPiece, newTetris, rotate, shift, stepTetris } from '../hooks/tetris'
import type { Tetris } from '../hooks/tetris'

const playing = <S extends { phase: string }>(s: S): S => ({ ...s, phase: 'playing' })
const run = <T>(step: (s: T, dt: number) => T, s: T, seconds: number): T => {
  let now = s
  for (let i = 0; i < Math.round(seconds * 20); i += 1) now = step(now, 0.05)

  return now
}
const text = (rows: { text: string }[][]): string => rows.map(row => row.map(seg => seg.text).join('')).join('\n')

test('every game takes the same keys to start, pause and start over', () => {
  const fresh = () => pong.create(40, 10, 1, NO_DATA)
  const ready = fresh()

  expect(pressKey(pong, ready, ' ', fresh).phase).toBe('playing')
  expect(pressKey(pong, ready, 'space', fresh).phase).toBe('playing')
  expect(pressKey(pong, playing(ready), 'p', fresh).phase).toBe('paused')
  expect(pressKey(pong, { ...ready, phase: 'paused' }, 'up', fresh).phase).toBe('paused')
  expect(pressKey(pong, { ...ready, phase: 'paused' }, ' ', fresh).phase).toBe('playing')
  expect(pressKey(pong, { ...ready, phase: 'over', score: [11, 2] as [number, number] }, 'x', fresh).phase).toBe('over')
  expect(pressKey(pong, { ...ready, phase: 'over', score: [11, 2] as [number, number] }, 'return', fresh)).toMatchObject({ phase: 'playing', score: [0, 0] })
  expect(pressKey(pong, { ...playing(ready), score: [3, 2] as [number, number] }, 'R', fresh)).toMatchObject({ phase: 'playing', score: [0, 0] })

  // A key that is the game's own starts a waiting game and is played.
  const nudged = pressKey(pong, ready, 'up', fresh)
  expect(nudged.phase).toBe('playing')
  expect(nudged.aim).toBeLessThan(ready.aim)

  expect(pressPointer(pong, ready, { type: 'down', x: 5, y: 2 }, fresh).phase).toBe('playing')
  expect(pressPointer(pong, ready, { type: 'move', x: 5, y: 2 }, fresh)).toBe(ready)
  expect(pressPointer(pong, { ...ready, phase: 'over' }, { type: 'down', x: 5, y: 2 }, fresh).phase).toBe('playing')
})

test('every game makes a state, draws it to its field and names its keys', () => {
  expect(GAMES.map(game => game.id)).toHaveLength(15)
  expect(new Set(GAMES.map(game => game.id)).size).toBe(15)

  for (const game of GAMES) {
    const w = game.maxW
    const s = game.create(w, game.maxRows, 12345, NO_DATA)
    const screen = screenOf(game, s, w, '#FB923C', NO_DATA)

    expect(screen.length).toBeGreaterThan(3)
    expect(text(screen)).toMatch(/\S/)
    expect(game.hint.length).toBeGreaterThan(10)
    expect(game.minW).toBeLessThanOrEqual(game.maxW)
    expect(game.score(s)).toBe(0)

    // Half a minute of play with keys held never throws, whatever the game.
    let now = playing(s)
    for (let i = 0; i < 600; i += 1) {
      if (i % 7 === 0) now = game.key(now, ['left', 'up', ' ', 'right', 'down'][i % 5] as string)
      if (i % 11 === 0) now = game.pointer(now, { type: 'down', x: i % w, y: i % game.maxRows, button: 'left' })
      now = game.step?.(now, 0.05, NO_DATA) ?? now
      if (now.phase === 'over') now = playing(game.create(w, game.maxRows, lcg(i), NO_DATA))
    }
    expect(text(game.draw(now, '#FB923C', NO_DATA)).length).toBeGreaterThan(0)
  }
})

test('snake grows on food, will not turn back on itself, and dies on a wall or itself', () => {
  const start = playing(newSnake(40, 10, 3))
  const head = start.body[0]!
  const fed: Snake = { ...start, food: { x: head.x + 1, y: head.y } }
  const grown = stepSnake(fed, paceOf(0) / 1000)

  expect(grown.body).toHaveLength(start.body.length + 1)
  expect(grown.eaten).toBe(1)
  expect(grown.body.some(part => part.x === grown.food.x && part.y === grown.food.y)).toBe(false)

  expect(turnSnake(start, { x: -1, y: 0 })).toBe(start)
  expect(turnSnake(start, { x: 0, y: 1 }).turns).toEqual([{ x: 0, y: 1 }])

  expect(run(stepSnake, start, 20).phase).toBe('over')

  // Up, back and down again brings the head onto its own body.
  const long: Snake = { ...start, body: Array.from({ length: 8 }, (_, i) => ({ x: 20 - i, y: 10 })), food: { x: 0, y: 0 } }
  let coiled = turnSnake(long, { x: 0, y: -1 })
  coiled = stepSnake(coiled, 0.126)
  coiled = stepSnake(turnSnake(coiled, { x: -1, y: 0 }), 0.126)
  coiled = stepSnake(turnSnake(coiled, { x: 0, y: 1 }), 0.126)
  expect(coiled.phase).toBe('over')
})

test('breakout holds the ball until launched, breaks bricks for points and loses a life past the paddle', () => {
  const start = playing(newBreakout(40, 14))
  expect(stepBreakout(start, 0.5).ball.vy).toBe(0)

  const flying = launch(start)
  expect(flying.isHeld).toBe(false)
  expect(flying.ball.vy).toBeLessThan(0)

  const up = run(stepBreakout, { ...flying, ball: { ...flying.ball, vx: 0 } }, 1.2)
  expect(up.bricks.filter(Boolean).length).toBeLessThan(start.bricks.length)
  expect(up.score).toBeGreaterThan(0)
  expect(up.score).toBeLessThanOrEqual(BRICK_ROWS * 3)

  const lost: Breakout = { ...flying, ball: { x: 2, y: flying.h - 1, vx: 0, vy: 30 }, paddle: 30, aim: 30 }
  const after = run(stepBreakout, lost, 0.3)
  expect(after.lives).toBe(2)
  expect(after.isHeld).toBe(true)
  expect(run(stepBreakout, { ...lost, lives: 1 }, 0.3).phase).toBe('over')

  const last: Breakout = { ...flying, bricks: flying.bricks.map((_, i) => i === 0), ball: { x: 1, y: 6, vx: 0, vy: -30 } }
  const cleared = run(stepBreakout, last, 0.2)
  expect(cleared.level).toBe(2)
  expect(cleared.bricks.every(Boolean)).toBe(true)
})

test('flappy falls, flaps up, scores a pipe it gets past and ends on a pipe or the ground', () => {
  const start = playing(newFlappy(50, 12, 9))
  const fallen = stepFlappy(start, 0.1)
  expect(fallen.y).toBeGreaterThan(start.y)
  expect(stepFlappy(flap(start), 0.1).y).toBeLessThan(start.y)
  expect(run(stepFlappy, start, 3).phase).toBe('over')

  const through: Flappy = { ...start, y: 10, vy: 0, pipes: [{ x: BIRD_X - 4.5, gap: 10, isPassed: false }] }
  expect(stepFlappy(through, 0.05).score).toBe(1)

  const blocked: Flappy = { ...start, y: 2, vy: 0, pipes: [{ x: BIRD_X, gap: 18, isPassed: false }] }
  expect(stepFlappy(blocked, 0.05).phase).toBe('over')
  expect(gapOf(0)).toBeGreaterThan(gapOf(40))
})

test('the runner jumps and lands, ducks under a bird and stops at a cactus', () => {
  const start = playing(newDino(50, 8, 4))
  const clear: Dino = { ...start, things: [{ x: 400, w: 2, h: 3, lift: 0 }] }

  const up = stepDino(jump(clear), 0.2)
  expect(up.lift).toBeGreaterThan(4)
  expect(jump(up)).toBe(up)
  expect(run(stepDino, jump(clear), 1.5).lift).toBe(0)

  const cactus: Dino = { ...start, things: [{ x: DINO_X + 1, w: 2, h: 3, lift: 0 }] }
  expect(stepDino(cactus, 0.05).phase).toBe('over')
  expect(stepDino({ ...jump(cactus), lift: 6, vy: 10 }, 0.05).phase).toBe('playing')

  const bird: Dino = { ...start, things: [{ x: DINO_X + 1, w: 4, h: 2, lift: 3 }] }
  expect(stepDino(bird, 0.05).phase).toBe('over')
  expect(stepDino(duck(bird), 0.05).phase).toBe('playing')
  expect(dino.score(run(stepDino, clear, 1))).toBeGreaterThan(0)
})

test('2048 slides and merges once per tile, and only a slide that moves something adds a tile', () => {
  expect(slide([2, 2, 4, 0])).toEqual({ line: [4, 4, 0, 0], gained: 4 })
  expect(slide([2, 2, 2, 2])).toEqual({ line: [4, 4, 0, 0], gained: 8 })
  expect(slide([4, 0, 0, 4])).toEqual({ line: [8, 0, 0, 0], gained: 8 })
  expect(slide([2, 4, 8, 16])).toEqual({ line: [2, 4, 8, 16], gained: 0 })

  const start = playing(new2048(26, 8, 5))
  expect(start.cells.filter(n => n !== 0)).toHaveLength(2)

  const packed = { ...start, cells: [2, 4, 8, 16, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] }
  expect(move2048(packed, 'left')).toBe(packed)
  const down = move2048(packed, 'down')
  expect(down.cells.slice(12)).toEqual([2, 4, 8, 16])
  expect(down.cells.filter(n => n !== 0)).toHaveLength(5)

  // One free cell and no merge left once it is filled: the game is over.
  const full = [2, 4, 2, 4, 4, 2, 4, 2, 2, 4, 2, 4, 4, 2, 4, 0]
  expect(move2048({ ...start, cells: [...full.slice(0, 15), 0].map((n, i) => (i === 14 ? 0 : n)).map((n, i) => (i === 15 ? 4 : n)) }, 'right').phase).toBe('playing')
  expect(move2048({ ...start, cells: [2, 4, 2, 4, 4, 2, 4, 2, 2, 4, 2, 4, 0, 8, 16, 32] }, 'left').phase).toBe('over')
})

test('minesweeper keeps the first cell safe, opens empty ground, chords and is won by opening the rest', () => {
  const start = playing(newMines(20, 9, 7))
  const opened = openCell(start, 40)

  expect(opened.phase).toBe('playing')
  expect(opened.mines.filter(Boolean)).toHaveLength(10)
  expect(opened.mines[40]).toBe(false)
  expect(near(opened, 40)).toBe(0)
  expect(opened.open.filter(Boolean).length).toBeGreaterThan(8)

  const mine = opened.mines.findIndex(Boolean)
  expect(openCell(opened, mine).phase).toBe('over')
  expect(openCell(flagCell(opened, mine), mine).open[mine]).toBe(false)

  // Every safe cell opened wins it, with a score.
  let won = opened
  opened.mines.forEach((is, i) => {
    if (!is) won = openCell(won, i)
  })
  expect(won).toMatchObject({ phase: 'over', isWon: true })

  // A number with its mines flagged opens what else is around it.
  const numbered = opened.open.findIndex((is, i) => is && near(opened, i) > 0)
  let flagged = opened
  opened.mines.forEach((is, i) => {
    if (is) flagged = flagCell(flagged, i)
  })
  expect(chord(flagged, numbered).open.filter(Boolean).length).toBeGreaterThanOrEqual(opened.open.filter(Boolean).length)
  expect(chord(opened, numbered)).toBe(opened)
})

// Whether a level can be solved, by trying every push from every place the player can reach.
const solvable = (level: number): boolean => {
  const start: Sokoban = { ...newSokoban(40, 10), phase: 'playing' }
  let frontier: Sokoban[] = [level === 0 ? start : ({ ...start, level } as Sokoban)]
  if (level > 0) {
    // Load the level the way the game does: by solving up to it is not needed, the layout is read from LEVELS.
    const boxes: { x: number; y: number }[] = []
    let player = { x: 0, y: 0 }
    LEVELS[level]!.forEach((line, y) =>
      [...line].forEach((ch, x) => {
        if (ch === '$' || ch === '*') boxes.push({ x, y })
        if (ch === '@' || ch === '+') player = { x, y }
      }),
    )
    frontier = [{ ...start, level, boxes, player }]
  }

  const key = (s: Sokoban): string => `${s.player.x},${s.player.y}|${s.boxes.map(b => `${b.x},${b.y}`).sort().join(';')}`
  const seen = new Set(frontier.map(key))

  for (let depth = 0; depth < 80 && frontier.length > 0; depth += 1) {
    const next: Sokoban[] = []

    for (const s of frontier) {
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const moved = moveSokoban(s, dx, dy)
        if (moved === s) continue
        if (moved.level !== level || moved.phase === 'over') return true

        const id = key(moved)
        if (!seen.has(id)) {
          seen.add(id)
          next.push(moved)
        }
      }
    }
    frontier = next
  }

  return false
}

test('every sokoban level can be solved; boxes are pushed one at a time and a move can be undone', () => {
  for (let level = 0; level < LEVELS.length; level += 1) expect(solvable(level)).toBe(true)

  const start = playing(newSokoban(40, 10))
  const pushed = moveSokoban(start, 1, 0)
  expect(pushed.level).toBe(1)
  expect(pushed.solved).toBe(1)

  expect(moveSokoban(start, -1, 0)).toBe(start)
  expect(moveSokoban(start, 0, 1)).toBe(start)

  const second = pushed
  const stepped = moveSokoban(second, 0, -1)
  expect(stepped.moves).toBe(1)
  expect(undoSokoban(stepped)).toMatchObject({ player: second.player, moves: 0 })
  expect(undoSokoban(second)).toBe(second)

  // Two boxes in a row do not move.
  const jammed: Sokoban = { ...second, player: { x: 1, y: 2 }, boxes: [{ x: 2, y: 2 }, { x: 3, y: 2 }] }
  expect(moveSokoban(jammed, 1, 0)).toBe(jammed)
})

test('life: a blinker turns, a block stands, and the board wraps', () => {
  const board = (cells: [number, number][]) => {
    const s = newLife(8, 4, 1)

    return { w: 8, h: 8, cells: s.cells.map((_, i) => (cells.some(([x, y]) => y * 8 + x === i) ? 1 : 0)) }
  }
  const alive = (cells: number[]) => cells.flatMap((c, i) => (c === 1 ? [[i % 8, Math.floor(i / 8)]] : []))

  expect(alive(evolve(board([[2, 3], [3, 3], [4, 3]])))).toEqual([[3, 2], [3, 3], [3, 4]])
  expect(alive(evolve(board([[1, 1], [2, 1], [1, 2], [2, 2]])))).toEqual([[1, 1], [2, 1], [1, 2], [2, 2]])
  // A blinker across the left edge keeps turning: its neighbors are counted around the edge.
  expect(alive(evolve(board([[7, 3], [0, 3], [1, 3]]))).sort()).toEqual([[0, 2], [0, 3], [0, 4]])
})

test('tetris turns pieces within the well, clears full rows, deals from a bag and holds a piece', () => {
  const start = playing(newTetris(34, 16, 11))

  const turned = [1, 2, 3, 4].reduce(s => rotate(s, 1), start)
  expect(cellsOf(turned.piece)).toEqual(cellsOf(start.piece))
  expect(rotate(rotate(start, 1), -1).piece).toEqual(start.piece)

  const walled = [1, 2, 3, 4, 5, 6, 7].reduce(s => shift(s, -1, 0), start)
  expect(Math.min(...cellsOf(walled.piece).map(([x]) => x))).toBe(0)
  expect(cellsOf(rotate(walled, 1).piece).every(([x]) => x >= 0 && x < COLS)).toBe(true)

  const landed = drop(start)
  expect(landed.well.filter(n => n !== 0)).toHaveLength(4)
  expect(landed.piece.kind).toBe(start.queue[0])
  expect(landed.score).toBeGreaterThan(0)

  // The first seven pieces are the seven kinds.
  const kinds = [start.piece.kind, ...start.queue.slice(0, 6)]
  expect([...kinds].sort()).toEqual([1, 2, 3, 4, 5, 6, 7])

  // A row with one gap, filled by an upright bar, is cleared.
  const well = start.well.map((_, i) => (Math.floor(i / COLS) === 15 && i % COLS !== 0 ? 1 : 0))
  const bar: Tetris = { ...start, well, piece: { kind: 1, turn: 1, x: -2, y: 0 } }
  expect(cellsOf(bar.piece).every(([x]) => x === 0)).toBe(true)
  const cleared = drop(bar)
  expect(cleared.lines).toBe(1)
  expect(cleared.score).toBeGreaterThanOrEqual(100)
  // What is left of the bar comes down a row: three cells, all in its column.
  expect(cleared.well.filter(n => n !== 0)).toHaveLength(3)
  expect(cleared.well.slice(15 * COLS).filter(n => n !== 0)).toHaveLength(1)

  const held = holdPiece(start)
  expect(held.hold).toBe(start.piece.kind)
  expect(held.piece.kind).toBe(start.queue[0])
  expect(holdPiece(held)).toBe(held)

  expect(stepTetris(start, 0.6).piece.y).toBeGreaterThan(start.piece.y)

  const stacked: Tetris = { ...start, well: start.well.map((_, i) => (i % COLS < 9 ? 1 : 0)) }
  expect(drop(stacked).phase).toBe('over')
})

test('frogger scores each new row, rides logs, and is lost to a car, the water or a taken home', () => {
  const start = playing(newFrogger(40, 13))
  const up = hop(start, 0, -1)

  expect(up.frog.y).toBe(START_ROW - 1)
  expect(up.score).toBe(10)
  expect(hop(hop(up, 0, 1), 0, -1).score).toBe(10)
  expect(hop(start, 1, 0).frog.x).toBe(start.frog.x + 2)

  // On the road: under a car is lost, beside it is not.
  const row = START_ROW - 1
  const car = Array.from({ length: 40 }, (_, x) => x).find(x => lookAt(start, row, x) !== ' ')!
  const gap = Array.from({ length: 40 }, (_, x) => x).find(x => lookAt(start, row, x) === ' ' && lookAt({ ...start, t: 0.05 }, row, x) === ' ')!
  expect(stepFrogger({ ...start, frog: { x: car, y: row } }, 0.001).lives).toBe(2)
  expect(stepFrogger({ ...start, frog: { x: gap, y: row } }, 0.001).lives).toBe(3)

  // On the river: on a log it drifts with it, off one it is lost.
  const river = BANK_ROW - 1
  const log = Array.from({ length: 30 }, (_, x) => x + 5).find(x => lookAt(start, river, x) !== ' ' && lookAt(start, river, x + 1) !== ' ')!
  const water = Array.from({ length: 30 }, (_, x) => x + 5).find(x => lookAt(start, river, x) === ' ')!
  const riding = stepFrogger({ ...start, frog: { x: log, y: river } }, 0.05)
  expect(riding.lives).toBe(3)
  expect(riding.frog.x).not.toBe(log)
  expect(stepFrogger({ ...start, frog: { x: water, y: river } }, 0.001).lives).toBe(2)

  // A free home is taken and scored; the same home again is a life.
  const below: Frogger = { ...start, frog: { x: homeAt(start, 2), y: 1 }, reached: 1 }
  const home = hop(below, 0, -1)
  expect(home.homes).toEqual([false, false, true, false, false])
  expect(home.score).toBeGreaterThanOrEqual(200)
  expect(home.frog.y).toBe(START_ROW)
  expect(hop({ ...home, frog: { x: homeAt(start, 2), y: 1 } }, 0, -1).lives).toBe(2)
  expect(hop({ ...below, frog: { x: homeAt(start, 2) + 4, y: 1 } }, 0, -1).lives).toBe(2)

  expect(frogger.score(run(stepFrogger, { ...start, left: 100 }, 0.2))).toBe(0)
  expect(run(stepFrogger, { ...start, left: 100 }, 0.2).lives).toBe(2)
})

test('asteroids wraps at the edges, splits a rock that is shot and allows four shots at once', () => {
  const start = playing(newAsteroids(50, 16, 21))
  const empty: Asteroids = { ...start, rocks: [{ x: 5, y: 5, vx: 0, vy: 0, size: 3 }], safe: 0 }

  const gone = stepAsteroids({ ...empty, ship: { x: 49.5, y: 20, vx: 20, vy: 0 } }, 0.1)
  expect(gone.ship.x).toBeLessThan(5)

  const shots = [1, 2, 3, 4, 5, 6].reduce(s => fire(s), empty)
  expect(shots.shots).toHaveLength(MAX_SHOTS)

  const aimed: Asteroids = { ...empty, ship: { x: 5, y: 20, vx: 0, vy: 0 }, heading: 12 }
  const hit = run(stepAsteroids, fire(aimed), 0.5)
  expect(hit.rocks).toHaveLength(2)
  expect(hit.rocks.every(rock => rock.size === 2)).toBe(true)
  expect(hit.score).toBe(20)

  const struck = stepAsteroids({ ...empty, ship: { x: 5, y: 5, vx: 0, vy: 0 } }, 0.05)
  expect(struck.lives).toBe(2)
  expect(stepAsteroids({ ...empty, ship: { x: 5, y: 5, vx: 0, vy: 0 }, safe: 500 }, 0.05).lives).toBe(3)

  expect(turnShip(start, -1).heading).toBe(11)
  expect(turnShip({ ...start, heading: 15 }, 1).heading).toBe(0)
  expect(Math.hypot(thrust(start).ship.vx, thrust(start).ship.vy)).toBeGreaterThan(0)
  expect(asteroids.score(start)).toBe(0)
})

test("the session's tools become invaders and its agents run a race", () => {
  expect(tagOf('Bash')).toBe('Ba')
  expect(tagOf('mcp__github__create_issue')).toBe('Cr')
  expect(tagOf('x')).toBe('X?')

  const data: GameData = {
    cost: 5,
    tools: [
      { name: 'Read', count: 3, errors: 0 },
      { name: 'Bash', count: 10, errors: 1 },
      { name: 'Edit', count: 4, errors: 2 },
    ],
    agents: [
      { id: 'a', type: 'Explore', model: 'claude-haiku-5-5', steps: 15, cost: 0.02, state: 'live' },
      { id: 'b', type: 'Plan', model: 'claude-opus-5-5', steps: 30, cost: 0.4, state: 'done' },
      { id: 'c', type: 'general', model: '', steps: 2, cost: 0, state: 'failed' },
    ],
  }
  const tags = tagsFor(data)

  expect(tags).toHaveLength(24)
  expect(tags.slice(0, 4)).toEqual([
    { text: 'Ba', color: 'warning' },
    { text: 'Ed', color: 'error' },
    { text: 'Re', color: 'success' },
    { text: 'Ba', color: 'warning' },
  ])
  expect(tagsFor(NO_DATA)[0]).toEqual({ text: '??', color: 'inactive' })

  expect(hurry(0)).toBe(1)
  expect(hurry(5)).toBe(1.5)
  expect(hurry(500)).toBe(2)
  expect(text(tokens.draw(playing(tokens.create(50, 16, 1, data)), '#fff', data))).toMatch(/Ba Ed Re Ba/)

  const lanes = text(race.draw(race.create(60, 8, 1, data), '#fff', data))
  expect(lanes).toMatch(/Explore\s+·+▶/)
  expect(lanes).toMatch(/Plan\s+·+✔⚑/)
  expect(lanes).toMatch(/general\s+·*✕/)
  expect(text(race.draw(race.create(60, 8, 1, NO_DATA), '#fff', NO_DATA))).toMatch(/Sin agentes en carrera/)
})
