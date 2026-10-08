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

declare module 'claude-code' {
  interface PluginState {
    // `choice`: 'auto' follows the session's model; else the id the main loop's
    // requests name. `open`: the family whose versions are listed.
    'model-picker': { choice: Choice; open: string; stats: Stats | null }
  }
}
