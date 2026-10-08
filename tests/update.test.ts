import { expect, test } from 'claude-code/testing'

import { isNewer, selfUpdate, versionIn } from '../hooks/update'
import type { Host } from '../hooks/update'

const DAY_MS = 86_400_000

// A host with version 0.2.0 loaded from `root`, `published` on the repository,
// and every command it runs recorded.
const hostOf = (over: { root?: string; published?: string; isRepo?: boolean; exitCode?: number; ok?: boolean }) => {
  const store = new Map<string, unknown>()
  const ran: string[] = []
  const toasts: string[] = []
  let now = 10 * DAY_MS

  const host: Host = {
    name: 'model-picker',
    root: over.root ?? '/home/me/.claude/skills/model-picker',
    now: async () => now,
    get: async key => store.get(key),
    set: async (key, value) => void store.set(key, value),
    read: async () => JSON.stringify({ version: '0.2.0' }),
    exists: async () => over.isRepo ?? true,
    fetch: async () => ({ ok: over.ok ?? true, text: JSON.stringify({ version: over.published ?? '0.3.0' }) }),
    run: async argv => {
      ran.push(argv.join(' '))

      return { exitCode: over.exitCode ?? 0 }
    },
    toast: text => void toasts.push(text),
  }

  return { host, ran, toasts, wait: (ms: number) => void (now += ms) }
}

test('versions compare by number, and only a well-formed one counts', () => {
  expect(isNewer('0.3.0', '0.2.0')).toBe(true)
  expect(isNewer('0.10.0', '0.9.0')).toBe(true)
  expect(isNewer('1.0.0', '0.9.9')).toBe(true)
  expect(isNewer('0.2.0', '0.2.0')).toBe(false)
  expect(isNewer('0.1.9', '0.2.0')).toBe(false)
  expect(versionIn('{"version":"1.2.3"}')).toBe('1.2.3')
  expect(versionIn('{"version":"1.2.3; rm -rf"}')).toBeUndefined()
  expect(versionIn('not json')).toBeUndefined()
})

test('a cloned copy pulls the newer version, once a day', async () => {
  const { host, ran, toasts, wait } = hostOf({})

  expect(await selfUpdate(host)).toBe('updated')
  expect(ran).toEqual(['git -C /home/me/.claude/skills/model-picker pull --ff-only'])
  expect(toasts[0]).toMatch(/actualizado a 0\.3\.0/)

  expect(await selfUpdate(host)).toBe('throttled')
  wait(DAY_MS)
  expect(await selfUpdate(host)).toBe('updated')
  expect(ran.length).toBe(2)
})

test('a copy Claude Code installed updates through its marketplace', async () => {
  const { host, ran } = hostOf({ root: 'C:\\Users\\me\\.claude\\plugins\\cache\\model-picker\\model-picker\\0.2.0' })

  expect(await selfUpdate(host)).toBe('updated')
  expect(ran).toEqual([
    'claude plugin marketplace update model-picker',
    'claude plugin update model-picker@model-picker',
  ])
})

test('nothing runs when the published version is not newer', async () => {
  const same = hostOf({ published: '0.2.0' })
  expect(await selfUpdate(same.host)).toBe('current')

  const older = hostOf({ published: '0.1.0' })
  expect(await selfUpdate(older.host)).toBe('current')

  expect([...same.ran, ...older.ran]).toEqual([])
  expect([...same.toasts, ...older.toasts]).toEqual([])
})

test('offline, or with a malformed answer, it stays quiet and checks again next time', async () => {
  const offline = hostOf({ ok: false })
  expect(await selfUpdate(offline.host)).toBe('unreachable')
  expect(await selfUpdate(offline.host)).toBe('unreachable')

  const odd = hostOf({ published: 'latest' })
  expect(await selfUpdate(odd.host)).toBe('unreachable')

  expect([...offline.ran, ...odd.ran, ...offline.toasts, ...odd.toasts]).toEqual([])
})

test('a failed or impossible install says so, with what to run', async () => {
  const failed = hostOf({ exitCode: 1 })
  expect(await selfUpdate(failed.host)).toBe('failed')
  expect(failed.toasts[0]).toMatch(/no se pudo instalar solo: git -C .* pull --ff-only/)

  const loose = hostOf({ isRepo: false })
  expect(await selfUpdate(loose.host)).toBe('manual')
  expect(loose.ran).toEqual([])
  expect(loose.toasts[0]).toMatch(/0\.3\.0 disponible/)
})
