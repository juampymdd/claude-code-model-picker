// Pong and Space Invaders as the arcade takes its games.

import type { GameDef } from './arcade'
import { aimInvaders, fireInvaders, newInvaders, nudgeInvaders, stepInvaders } from './invaders'
import type { Invaders } from './invaders'
import { aimPong, newPong, nudgePong, pongScore, stepPong, WIN } from './pong'
import type { Pong } from './pong'
import { drawInvaders, drawPong, invadersHud } from './screens'

const STEP = 4

export const pong: GameDef<Pong> = {
  id: 'pong',
  label: 'Pong',
  glyph: '◆',
  hint: '↑↓ o mouse mueven · espacio pausa · r reinicia',
  minW: 38,
  maxW: 60,
  minRows: 8,
  maxRows: 18,
  ownNotice: true,
  create: (w, rows) => newPong(w, rows * 2),
  step: (s, dt) => stepPong(s, dt),
  key: (s, key) => {
    if (key === ' ') return { ...s, phase: 'paused' }
    if (key === 'up' || key === 'w') return nudgePong(s, -STEP)
    if (key === 'down' || key === 's') return nudgePong(s, STEP)

    return s
  },
  // A cell of text is two pixels tall.
  pointer: (s, e) => aimPong(s, e.y * 2 + 1),
  score: pongScore,
  hud: () => [{ text: `PONG  a ${WIN} puntos`, dim: true }],
  draw: drawPong,
}

export const invaders: GameDef<Invaders> = {
  id: 'invaders',
  label: 'Space Invaders',
  glyph: '▲',
  hint: '←→ o mouse mueven · espacio o clic dispara · p pausa · r reinicia',
  minW: 38,
  maxW: 60,
  minRows: 14,
  maxRows: 20,
  ownNotice: true,
  create: (w, rows) => newInvaders(w, rows),
  step: (s, dt) => stepInvaders(s, dt),
  key: (s, key) => {
    if (key === ' ') return fireInvaders(s)
    if (key === 'left' || key === 'a') return nudgeInvaders(s, -STEP)
    if (key === 'right' || key === 'd') return nudgeInvaders(s, STEP)

    return s
  },
  pointer: (s, e) => (e.type === 'down' ? fireInvaders(aimInvaders(s, e.x)) : aimInvaders(s, e.x)),
  score: s => s.score,
  hud: (s, color) => invadersHud(s, color),
  draw: drawInvaders,
}
