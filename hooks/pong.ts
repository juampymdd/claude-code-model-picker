// Pong against the machine, in pixels. Pure: a state and the functions that
// move it. The terminal sends no key releases, so the player's paddle follows
// an aim that a key nudges and the pointer sets.

export type Phase = 'ready' | 'playing' | 'paused' | 'over'

export type Pong = {
  w: number
  h: number
  // The paddles' centers, top to bottom: the player's on the left, the machine's on the right.
  left: number
  right: number
  // Where the player's paddle is headed.
  aim: number
  ball: { x: number; y: number; vx: number; vy: number }
  score: [player: number, machine: number]
  phase: Phase
}

export const WIN = 11
export const PADDLE = 8
export const PADDLE_X = 2
const PADDLE_SPEED = 60
// The machine is slower than the player and only chases a ball coming at it.
const MACHINE_SPEED = 30
const SERVE_SPEED = 34
const FASTER = 1.05
const MAX_SPEED = 90

const clamp = (n: number, low: number, high: number): number => Math.min(high, Math.max(low, n))
const inField = (s: Pong, y: number): number => clamp(y, PADDLE / 2, s.h - PADDLE / 2)

// The ball at the center, served at whoever just lost the point, up or down by turns.
const serve = (s: Pong, toPlayer: boolean): Pong['ball'] => {
  const turn = (s.score[0] + s.score[1]) % 2 === 0 ? 1 : -1

  return { x: s.w / 2, y: s.h / 2, vx: toPlayer ? -SERVE_SPEED : SERVE_SPEED, vy: turn * SERVE_SPEED * 0.4 }
}

export const newPong = (w: number, h: number): Pong => {
  const base: Pong = { w, h, left: h / 2, right: h / 2, aim: h / 2, ball: { x: 0, y: 0, vx: 0, vy: 0 }, score: [0, 0], phase: 'ready' }

  return { ...base, ball: serve(base, false) }
}

/** The player's aim moved by `dy` pixels, or set to `y`. */
export const nudgePong = (s: Pong, dy: number): Pong => ({ ...s, aim: inField(s, s.aim + dy) })
export const aimPong = (s: Pong, y: number): Pong => ({ ...s, aim: inField(s, y) })

/** Starts a game that waits, pauses one that runs and resumes one paused; a finished one starts over. */
export const togglePong = (s: Pong): Pong => {
  if (s.phase === 'over') return { ...newPong(s.w, s.h), phase: 'playing' }

  return { ...s, phase: s.phase === 'playing' ? 'paused' : 'playing' }
}

const toward = (from: number, to: number, most: number): number => from + clamp(to - from, -most, most)

// One small step: the ball moves less than a pixel, so it cannot pass through a paddle.
const tick = (s: Pong, dt: number): Pong => {
  const left = inField(s, toward(s.left, s.aim, PADDLE_SPEED * dt))
  const target = s.ball.vx > 0 ? s.ball.y : s.h / 2
  const right = inField(s, toward(s.right, target, MACHINE_SPEED * dt))

  let { x, y, vx, vy } = s.ball
  x += vx * dt
  y += vy * dt

  if (y < 0.5) {
    y = 0.5
    vy = Math.abs(vy)
  } else if (y > s.h - 0.5) {
    y = s.h - 0.5
    vy = -Math.abs(vy)
  }

  // A paddle sends the ball back faster, at the angle of where it was hit.
  const hit = (paddle: number): boolean => Math.abs(y - paddle) <= PADDLE / 2 + 0.5
  const bounce = (paddle: number, direction: 1 | -1) => {
    const speed = Math.min(MAX_SPEED, Math.abs(vx) * FASTER)
    vx = direction * speed
    vy = ((y - paddle) / (PADDLE / 2)) * speed * 0.75
  }

  if (vx < 0 && x <= PADDLE_X + 1 && s.ball.x > PADDLE_X + 1 && hit(left)) {
    x = PADDLE_X + 1
    bounce(left, 1)
  } else if (vx > 0 && x >= s.w - PADDLE_X - 1 && s.ball.x < s.w - PADDLE_X - 1 && hit(right)) {
    x = s.w - PADDLE_X - 1
    bounce(right, -1)
  }

  const moved: Pong = { ...s, left, right, ball: { x, y, vx, vy } }
  if (x >= 0 && x <= s.w) return moved

  const score: Pong['score'] = x < 0 ? [s.score[0], s.score[1] + 1] : [s.score[0] + 1, s.score[1]]
  const scored: Pong = { ...moved, score }

  return score[0] >= WIN || score[1] >= WIN ? { ...scored, phase: 'over' } : { ...scored, ball: serve(scored, x < 0) }
}

/** The game `dt` seconds later; one that is not being played stays as it is. */
export const stepPong = (s: Pong, dt: number): Pong => {
  let now = s
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(s.ball.vx), Math.abs(s.ball.vy), PADDLE_SPEED) * dt * 2))

  for (let i = 0; i < steps && now.phase === 'playing'; i += 1) now = tick(now, dt / steps)

  return now
}

/** What a finished game is worth: the points the player won by, 0 if they lost. */
export const pongScore = (s: Pong): number => Math.max(0, s.score[0] - s.score[1])
