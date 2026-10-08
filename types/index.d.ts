export type Choice = string

declare module 'claude-code' {
  interface PluginState {
    // 'auto' follows the session's model; else the id the main loop's requests
    // name. `open` is the family whose versions are listed, `answeredBy` the id
    // the API reported on the latest response.
    'model-picker': { choice: Choice; open: string; answeredBy: string }
  }
}
