// The mod updating itself: once a day it reads the version published on the
// repository's main branch and, when that is newer than the one loaded,
// brings the new one in the way this copy was installed.

const REPO = 'juampymdd/claude-code-model-picker'
const MARKETPLACE = 'model-picker'
const MANIFEST = '.claude-plugin/plugin.json'
const PUBLISHED = `https://raw.githubusercontent.com/${REPO}/main/${MANIFEST}`
const DAY_MS = 86_400_000
const UPDATE_TIMEOUT_MS = 120_000
const CHECKED_AT = 'update.checkedAt'

// What the update needs of the host, so a test can stand in for each part.
export type Host = {
  // The mod's own name and folder.
  name: string
  root: string
  now: () => Promise<number>
  get: (key: string) => Promise<unknown>
  set: (key: string, value: unknown) => Promise<void>
  read: (path: string) => Promise<string>
  exists: (path: string) => Promise<boolean>
  fetch: (url: string) => Promise<{ ok: boolean; text: string }>
  run: (argv: readonly string[], init: { timeoutMs: number }) => Promise<{ exitCode: number }>
  toast: (text: string) => void
}

export type Outcome = 'throttled' | 'unreachable' | 'current' | 'updated' | 'failed' | 'manual'

/** The `version` of a plugin.json's text when it is `1.2.3`-shaped, else undefined. */
export const versionIn = (manifest: string): string | undefined => {
  try {
    const version: unknown = (JSON.parse(manifest) as { version?: unknown }).version

    return typeof version === 'string' && /^\d+\.\d+\.\d+$/.test(version) ? version : undefined
  } catch {
    return undefined
  }
}

export const isNewer = (published: string, loaded: string): boolean => {
  const a = published.split('.').map(Number)
  const b = loaded.split('.').map(Number)

  for (let i = 0; i < 3; i += 1) {
    if ((a[i] ?? 0) !== (b[i] ?? 0)) return (a[i] ?? 0) > (b[i] ?? 0)
  }

  return false
}

/**
 * The commands that bring the published version into this copy, by how it was
 * installed; undefined for a copy neither Claude Code nor git keeps.
 */
export const stepsFor = async (host: Host): Promise<readonly (readonly string[])[] | undefined> => {
  if (host.root.replace(/\\/g, '/').includes('/plugins/cache/')) {
    return [
      ['claude', 'plugin', 'marketplace', 'update', MARKETPLACE],
      ['claude', 'plugin', 'update', `${host.name}@${MARKETPLACE}`],
    ]
  }

  if (await host.exists(`${host.root}/.git`)) return [['git', '-C', host.root, 'pull', '--ff-only']]

  return undefined
}

/**
 * Checks for a newer published version, at most once a day, and installs it.
 * Never rejects: offline, or with anything unexpected, it leaves the mod as is.
 */
export const selfUpdate = async (host: Host): Promise<Outcome> => {
  try {
    const now = await host.now()
    if (now - Number((await host.get(CHECKED_AT)) ?? 0) < DAY_MS) return 'throttled'

    const response = await host.fetch(PUBLISHED)
    const published = response.ok ? versionIn(response.text) : undefined
    const loaded = versionIn(await host.read(`${host.root}/${MANIFEST}`))
    if (published === undefined || loaded === undefined) return 'unreachable'

    await host.set(CHECKED_AT, now)
    if (!isNewer(published, loaded)) return 'current'

    const steps = await stepsFor(host)
    if (steps === undefined) {
      host.toast(`${host.name} ${published} disponible: github.com/${REPO}`)

      return 'manual'
    }

    for (const argv of steps) {
      const { exitCode } = await host.run(argv, { timeoutMs: UPDATE_TIMEOUT_MS })
      if (exitCode !== 0) {
        host.toast(`${host.name} ${published} disponible, no se pudo instalar solo: ${argv.join(' ')}`)

        return 'failed'
      }
    }

    host.toast(`${host.name} actualizado a ${published} · /reload-plugins o sesión nueva para aplicar`)

    return 'updated'
  } catch {
    return 'unreachable'
  }
}
