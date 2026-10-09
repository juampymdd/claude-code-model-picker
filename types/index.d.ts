export type Choice = string

// What the band shows of the session's requests, from what the API reported.
export type Stats = {
  // The model id of the main loop's latest response; '' before the first.
  answeredBy: string
  // The effort that request asked for; '' when it named none.
  effort: string
  // The turn the latest response belongs to.
  turnId: string
  // The latest response's prompt tokens (cached ones included) and output tokens.
  input: number
  output: number
  // How many of those prompt tokens the cache served.
  cacheRead: number
  // Dollars at list price: that turn's responses, and every response so far.
  turnCost: number
  sessionCost: number
}

// The stats pane's tabs.
export type Tab = 'costo' | 'modelos' | 'tools' | 'ritmo' | 'agentes'

// One user turn of the main loop, as the stats pane charts it.
export type Turn = {
  turnId: string
  // `$.clock.now()` when it opened, in milliseconds.
  startedAt: number
  // Absent while the turn runs.
  durationMs?: number
  reason?: 'answer' | 'aborted' | 'refusal' | 'error'
  // Main-loop requests the turn made.
  steps: number
  // The model id of its latest response; '' before the first.
  model: string
  // Dollars of the main loop, and the part of them that is output tokens.
  cost: number
  costOut: number
  // Dollars of subagents that landed while this was the open turn.
  agentCost: number
  // Uncached prompt tokens, output tokens, and the cache's reads and writes.
  input: number
  output: number
  cacheRead: number
  cacheWrite: number
}

// A model's share of the session, every loop together; `input` is the whole
// prompt, cache included.
export type ModelStat = { cost: number; input: number; output: number; steps: number }

export type ToolStat = { name: string; count: number; errors: number; totalMs: number }

// Where an agent's loop stands, as Claude Code names it.
export type AgentStatus = 'pending' | 'running' | 'waiting' | 'idle' | 'completed' | 'failed' | 'killed'

// One subagent or teammate of the session, as the stats pane lists it.
export type AgentStat = {
  id: string
  // Its agent type (`Explore`, `Plan`, ...); `agente` until Claude Code says.
  type: string
  description: string
  // The agent whose loop spawned it; absent when the main loop did.
  parentId?: string
  // The model id of its latest response; '' before the first.
  model: string
  startedAt: number
  // Absent while it runs.
  endedAt?: number
  status: AgentStatus
  // Its requests, their dollars, and the dollars of the latest ones (for its sparkline).
  steps: number
  cost: number
  costs: number[]
  // Whole prompt tokens (cache included) and output tokens.
  input: number
  output: number
  tools: ToolStat[]
  // The tool call it is in now, and since when.
  busy?: { tool: string; since: number }
}

export type History = {
  // Newest last, the latest 200; `dropped` counts the ones cut.
  turns: Turn[]
  dropped: number
  // By model id, as the model list names it.
  models: Record<string, ModelStat>
  tools: ToolStat[]
  // Newest last, the latest 100.
  agents: AgentStat[]
  // The whole session, whatever the caps cut.
  total: {
    cost: number
    agentCost: number
    input: number
    output: number
    cacheRead: number
    cacheWrite: number
    steps: number
  }
}

declare module 'claude-code' {
  interface PluginState {
    // `choice`: 'auto' follows the session's model; else the id the main loop's
    // requests name. `open`: the family whose versions are listed.
    'model-picker': {
      choice: Choice
      open: string
      stats: Stats | null
      // The stats pane's data: `record` what it charts, `tab` the one shown,
      // `showDone` whether finished agents are listed, `flash` when the model
      // was last switched (0 once the chip's highlight is over).
      record: History
      tab: Tab
      showDone: boolean
      flash: number
    }
  }
}
