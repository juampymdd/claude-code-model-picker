// Sokoban: push every box onto a goal. Boxes are pushed, never pulled, one at a time.

import type { GameDef, Phase } from './arcade'
import type { Seg } from './rows'

type Point = { x: number; y: number }

// `#` wall, `@` the player, `$` a box, `.` a goal, `*` a box on a goal.
export const LEVELS: readonly (readonly string[])[] = [
  ['#####', '#@$.#', '#####'],
  ['#######', '#     #', '#@$ . #', '# $ . #', '#     #', '#######'],
  ['#######', '#  .  #', '#  $  #', '# .$@ #', '#     #', '#######'],
  ['#########', '#       #', '# .$ $. #', '#   @   #', '#########'],
  ['######', '#.   #', '# $  #', '#  $ #', '#   .#', '#@   #', '######'],
  ['#######', '#     #', '# #$# #', '#.   .#', '# #$# #', '#  @  #', '#######'],
]

export type Sokoban = {
  w: number
  rows: number
  level: number
  boxes: Point[]
  player: Point
  moves: number
  // What the level looked like before each move, the latest last.
  past: { boxes: Point[]; player: Point }[]
  solved: number
  phase: Phase
}

const same = (a: Point, b: Point): boolean => a.x === b.x && a.y === b.y
const at = (level: number, p: Point): string => LEVELS[level]?.[p.y]?.[p.x] ?? '#'
const isGoal = (level: number, p: Point): boolean => '.*+'.includes(at(level, p))

const load = (level: number): Pick<Sokoban, 'level' | 'boxes' | 'player' | 'moves' | 'past'> => {
  const boxes: Point[] = []
  let player = { x: 1, y: 1 }

  ;(LEVELS[level] ?? []).forEach((line, y) =>
    [...line].forEach((ch, x) => {
      if (ch === '$' || ch === '*') boxes.push({ x, y })
      if (ch === '@' || ch === '+') player = { x, y }
    }),
  )

  return { level, boxes, player, moves: 0, past: [] }
}

export const newSokoban = (w: number, rows: number): Sokoban => ({ w, rows, ...load(0), solved: 0, phase: 'ready' })

/** A step toward (dx, dy), pushing the box in the way if the cell past it is free. */
export const moveSokoban = (s: Sokoban, dx: number, dy: number): Sokoban => {
  const to = { x: s.player.x + dx, y: s.player.y + dy }
  if (at(s.level, to) === '#') return s

  const pushed = s.boxes.findIndex(box => same(box, to))
  const past = [...s.past, { boxes: s.boxes, player: s.player }].slice(-100)
  if (pushed < 0) return { ...s, player: to, moves: s.moves + 1, past }

  const beyond = { x: to.x + dx, y: to.y + dy }
  if (at(s.level, beyond) === '#' || s.boxes.some(box => same(box, beyond))) return s

  const boxes = s.boxes.map((box, i) => (i === pushed ? beyond : box))
  const moved: Sokoban = { ...s, boxes, player: to, moves: s.moves + 1, past }
  if (!boxes.every(box => isGoal(s.level, box))) return moved

  // Every box on a goal: on to the next level, or the end after the last.
  const solved = Math.max(s.solved, s.level + 1)

  return s.level + 1 >= LEVELS.length ? { ...moved, solved, phase: 'over' } : { ...s, ...load(s.level + 1), solved }
}

export const undoSokoban = (s: Sokoban): Sokoban => {
  const last = s.past[s.past.length - 1]

  return last === undefined ? s : { ...s, ...last, moves: Math.max(0, s.moves - 1), past: s.past.slice(0, -1) }
}

const MOVES: Readonly<Record<string, [number, number]>> = { left: [-1, 0], a: [-1, 0], right: [1, 0], d: [1, 0], up: [0, -1], w: [0, -1], down: [0, 1], s: [0, 1] }

export const sokoban: GameDef<Sokoban> = {
  id: 'sokoban',
  label: 'Sokoban',
  glyph: '▣',
  hint: 'flechas o wasd mueven · u deshace · n/b cambian de nivel · r reinicia',
  minW: 20,
  maxW: 40,
  minRows: 8,
  maxRows: 10,
  create: newSokoban,
  key: (s, key) => {
    const move = MOVES[key]
    if (move !== undefined) return moveSokoban(s, move[0], move[1])
    if (key === 'u') return undoSokoban(s)
    // Any level already solved, and the first one not yet, can be gone to.
    if (key === 'n' && s.level < Math.min(s.solved, LEVELS.length - 1)) return { ...s, ...load(s.level + 1) }
    if (key === 'b' && s.level > 0) return { ...s, ...load(s.level - 1) }

    return s
  },
  // A press on a cell beside the player steps toward it.
  pointer: (s, e) => {
    if (e.type !== 'down') return s

    const level = LEVELS[s.level] ?? []
    const left = Math.floor((s.w - (level[0]?.length ?? 0) * 2) / 2)
    const dx = Math.floor((e.x - left) / 2) - s.player.x
    const dy = e.y - s.player.y

    return Math.abs(dx) + Math.abs(dy) === 1 ? moveSokoban(s, dx, dy) : s
  },
  score: s => s.solved,
  hud: s => [
    { text: 'SOKOBAN  ', dim: true },
    { text: `nivel ${s.level + 1}/${LEVELS.length}`, bold: true },
    { text: `  ${s.moves} pasos`, dim: true },
  ],
  over: () => 'TODOS RESUELTOS',
  draw: (s, color) => {
    const level = LEVELS[s.level] ?? []
    const left = Math.max(0, Math.floor((s.w - (level[0]?.length ?? 0) * 2) / 2))

    return Array.from({ length: s.rows }, (_, y): Seg[] => {
      const line = level[y]
      if (line === undefined) return [{ text: ' '.repeat(s.w) }]

      return [
        { text: ' '.repeat(left) },
        ...[...line].map((ch, x): Seg => {
          const here = { x, y }
          const goal = isGoal(s.level, here)

          if (ch === '#') return { text: '██', color: 'subtle' }
          if (same(s.player, here)) return { text: '☻ ', color, bold: true }
          if (s.boxes.some(box => same(box, here))) return { text: '▣ ', color: goal ? 'success' : 'warning', bold: true }

          return goal ? { text: '· ', color: 'success' } : { text: '  ' }
        }),
      ]
    })
  },
}
