import type { Seg } from './rows'

// One rate-limit window as Claude Code reports it (`$.session.usage().rateLimits`).
export type Limit = { kind: string; percentUsed: number; resetsAt?: string }

// Which windows were already warned about, by kind; one leaves once it is back under the line.
export type Alerted = Record<string, true>

/** From this percent on a window is warned about, once until it drops back under. */
export const ALERT_AT = 90

const LABELS: Readonly<Record<string, string>> = {
  five_hour: '5h',
  seven_day: 'semana',
  spend_limit: 'gasto',
}
const ORDER = ['five_hour', 'seven_day']

const isFable = (kind: string): boolean => /fable/i.test(kind)

/** A window's short name: `5h`, `semana`, `fable`, or its kind as Claude Code spells it. */
export const labelOf = (kind: string): string => LABELS[kind] ?? (isFable(kind) ? 'fable' : kind.replace(/_/g, ' '))

const rankOf = (kind: string): number => {
  const known = ORDER.indexOf(kind)
  if (known !== -1) return known

  return isFable(kind) ? ORDER.length : ORDER.length + 1
}

/** The windows worth showing, in order: 5 hours, the week, Fable's, then any other. */
export const sortLimits = (limits: readonly Limit[]): Limit[] =>
  limits.filter(limit => Number.isFinite(limit.percentUsed)).sort((a, b) => rankOf(a.kind) - rankOf(b.kind))

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

/** How long until a window resets (`2h 10m`, `3d 4h`, `12m`); undefined without a date or once past it. */
export const resetsIn = (resetsAt: string | undefined, now: number): string | undefined => {
  if (resetsAt === undefined) return undefined

  const at = Date.parse(resetsAt)
  if (Number.isNaN(at) || at <= now) return undefined

  const left = at - now
  if (left >= DAY) return `${Math.floor(left / DAY)}d ${Math.floor((left % DAY) / HOUR)}h`
  if (left >= HOUR) return `${Math.floor(left / HOUR)}h ${Math.floor((left % HOUR) / MINUTE)}m`

  return `${Math.max(1, Math.ceil(left / MINUTE))}m`
}

/**
 * One window as runs of text: its name, a meter of how much is used and the
 * percent. With `now` it also says how long until it resets; the 5-hour window
 * is then named by that time alone (`↻ 2h 10m`), and keeps `5h` without a date.
 */
export const limitSegs = (limit: Limit, width: number, now?: number): Seg[] => {
  const used = Math.round(limit.percentUsed)
  const left = now === undefined ? undefined : resetsIn(limit.resetsAt, now)
  const isNamedByTime = limit.kind === 'five_hour' && left !== undefined
  const segs: Seg[] = [
    { text: `${isNamedByTime ? `↻ ${left}` : labelOf(limit.kind)} `, dim: true },
    { text: '', fx: 'meter', key: `limit:${limit.kind}`, value: Math.min(100, used), width },
    { text: ` ${used}%`, dim: true },
  ]
  if (left !== undefined && !isNamedByTime) segs.push({ text: ` ↻ ${left}`, dim: true })

  return segs
}

/**
 * What to warn about now: each window at `ALERT_AT` or more not yet warned
 * about. `alerted` comes back with those added and the ones back under the line
 * dropped, so a window that resets warns again the next time it fills.
 */
export const alertsFor = (limits: readonly Limit[], alerted: Alerted, now: number): { texts: string[]; alerted: Alerted } => {
  const next: Alerted = {}
  const texts: string[] = []

  for (const limit of sortLimits(limits)) {
    if (limit.percentUsed < ALERT_AT) continue

    next[limit.kind] = true
    if (alerted[limit.kind]) continue

    const left = resetsIn(limit.resetsAt, now)
    texts.push(`Límite ${labelOf(limit.kind)} al ${Math.round(limit.percentUsed)}%${left === undefined ? '' : ` · se renueva en ${left}`}`)
  }

  return { texts, alerted: next }
}
