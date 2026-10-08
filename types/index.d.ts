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
export type Tab = 'costo' | 'modelos' | 'tools' | 'ritmo'

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

export type History = {
  // Newest last, the latest 200; `dropped` counts the ones cut.
  turns: Turn[]
  dropped: number
  // By model id, as the model list names it.
  models: Record<string, ModelStat>
  tools: ToolStat[]
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
      history: History
      tab: Tab
    }
  }
}
