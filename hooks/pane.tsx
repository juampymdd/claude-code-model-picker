/** @jsx hyper */
import type { EngineInterface, RenderNode } from 'claude-code'

import type { Game, Tab } from '../types'
import { gameOf, GAMES } from './catalog'
import { paint } from './paint'
import type { Hyper } from './paint'
import { headRow, rowsFor } from './rows'
import type { LiveProps, View } from './rows'

export const PANE = 'model-picker-stats'

export const TABS: readonly { tab: Tab; label: string; hotkey: string }[] = [
  { tab: 'costo', label: 'Costo', hotkey: '1' },
  { tab: 'modelos', label: 'Modelos', hotkey: '2' },
  { tab: 'tools', label: 'Tools', hotkey: '3' },
  { tab: 'ritmo', label: 'Ritmo', hotkey: '4' },
  { tab: 'agentes', label: 'Agentes', hotkey: '5' },
  { tab: 'juegos', label: '▶ Jugar', hotkey: '6' },
]

export type Parts = Pick<ReturnType<EngineInterface['ui']['resolve']>, 'Box' | 'Text' | 'Button'>

// Draws the rows in motion. The hooks module makes it, since a surface module's
// path is only read off that module's own source; absent where the surface runs none.
export type Live = (props: LiveProps) => RenderNode | null | undefined

export type Handlers = {
  onTab: (tab: Tab) => unknown
  onShowDone: (show: boolean) => unknown
  onGame: (game: Game) => unknown
  onMenu: (open: boolean) => unknown
}

// Draws the game in play; the hooks module makes it, as it makes `Live`.
export type Play = () => RenderNode | null | undefined

/** The pane's props for its drawing: the header and the chosen tab's rows. */
export const liveProps = (view: View): LiveProps => ({
  tab: view.tab,
  now: view.now,
  rows: [headRow(view), ...rowsFor(view)],
})

/**
 * The pane's tree: the tabs, then the header and the chosen tab. Given `live`
 * the rows move (`live.tsx`); without it they are drawn as they stand.
 */
export const drawPane = (hyper: Hyper, parts: Parts, view: View, on: Handlers, live?: Live, play?: Play) => {
  const { Box, Text, Button } = parts
  const isGames = view.tab === 'juegos'
  const isMenu = view.menu === true
  const current = gameOf(view.game ?? '')
  // A game's entry in the list: its glyph, its name and its best score, at one width.
  const widest = GAMES.reduce((most, game) => Math.max(most, [...game.label].length), 0)
  const tag = (game: { id: string; glyph: string; label: string }): string =>
    ` ${game.glyph} ${game.label.padEnd(widest)} ${String(view.best?.[game.id] ?? 0).padStart(5)} `
  const perShelf = Math.max(1, Math.floor(view.columns / (widest + 10)))
  const shelves = GAMES.reduce<(typeof GAMES)[number][][]>((all, game, i) => {
    if (i % perShelf === 0) all.push([])
    all[all.length - 1]?.push(game)

    return all
  }, [])
  const tabs = TABS.filter(({ tab }) => tab !== 'juegos' || view.games === true)
  // Each tab takes its key, a colon, a space and its name with one more space.
  const isRoomy = tabs.reduce((all, { label }) => all + 3 + [...label].length + 1, 0) <= view.columns
  const props = liveProps(view)
  const hasDone = view.history.agents.some(agent => agent.endedAt !== undefined)

  return (
    <Box flexDirection="column">
      <Box>
        {tabs.map(({ tab, label, hotkey }) => {
          // The button draws its own key (`1:`); a pane too narrow for every name keeps only the shown tab's.
          const name = isRoomy || tab === view.tab ? `${label} ` : ''

          return (
            <Button key={tab} plain hotkey={hotkey} dimColor={tab !== view.tab} onPress={() => on.onTab(tab)}>
              {tab === view.tab ? <Text bold inverse>{name}</Text> : <Text>{name}</Text>}
            </Button>
          )
        })}
      </Box>
      {live === undefined ? paint(hyper, parts, props, null) : live(props)}
      {isGames && (
        <Box>
          <Button key="menu" plain dimColor={!isMenu} onPress={() => on.onMenu(!isMenu)}>
            {isMenu ? <Text bold inverse>{' ☰ juegos '}</Text> : <Text>{' ☰ juegos '}</Text>}
          </Button>
          <Text dimColor>
            {`  ${current.glyph} ${current.label} · récord ${view.best?.[current.id] ?? 0}`}
          </Text>
        </Box>
      )}
      {isGames &&
        isMenu &&
        shelves.map(shelf => (
          <Box>
            {shelf.map(game => (
              <Button key={game.id} plain dimColor={game.id !== current.id} onPress={() => on.onGame(game.id)}>
                {game.id === current.id ? <Text bold inverse>{tag(game)}</Text> : <Text>{tag(game)}</Text>}
              </Button>
            ))}
          </Box>
        ))}
      {isGames &&
        !isMenu &&
        (play === undefined ? <Text dimColor>Los juegos corren en la terminal y en la app de escritorio.</Text> : play())}
      {view.tab === 'agentes' && hasDone && (
        <Box>
          <Button key="done" plain dimColor onPress={() => on.onShowDone(!view.showDone)}>
            <Text>{view.showDone ? ' ocultar terminados ' : ' mostrar terminados '}</Text>
          </Button>
        </Box>
      )}
    </Box>
  )
}
