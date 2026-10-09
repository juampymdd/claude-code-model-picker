/** @jsx hyper */
import type { EngineInterface, RenderNode } from 'claude-code'

import type { Tab } from '../types'
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
]

export type Parts = Pick<ReturnType<EngineInterface['ui']['resolve']>, 'Box' | 'Text' | 'Button'>

// Draws the rows in motion. The hooks module makes it, since a surface module's
// path is only read off that module's own source; absent where the surface runs none.
export type Live = (props: LiveProps) => RenderNode | null | undefined

export type Handlers = { onTab: (tab: Tab) => unknown; onShowDone: (show: boolean) => unknown }

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
export const drawPane = (hyper: Hyper, parts: Parts, view: View, on: Handlers, live?: Live) => {
  const { Box, Text, Button } = parts
  const props = liveProps(view)
  const hasDone = view.history.agents.some(agent => agent.endedAt !== undefined)

  return (
    <Box flexDirection="column">
      <Box>
        {TABS.map(({ tab, label, hotkey }) => (
          <Button key={tab} plain hotkey={hotkey} dimColor={tab !== view.tab} onPress={() => on.onTab(tab)}>
            {tab === view.tab ? <Text bold inverse>{` ${hotkey}: ${label} `}</Text> : <Text>{` ${hotkey}: ${label} `}</Text>}
          </Button>
        ))}
      </Box>
      {live === undefined ? paint(hyper, parts, props, null) : live(props)}
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
