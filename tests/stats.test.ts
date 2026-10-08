import { expect, test } from 'claude-code/testing'

import { nameOfId, pickOfId, pickOfName } from '../hooks/models'
import { costOf, count, money, priceLabel, statsLine, tally } from '../hooks/stats'
import type { Usage } from '../hooks/stats'

const usage = (model: string, over: Partial<Usage> = {}): Usage => ({
  model,
  input_tokens: 0,
  output_tokens: 0,
  cache_read_input_tokens: 0,
  cache_creation_input_tokens: 0,
  ...over,
})

test('a model id names its family and version, a suffixed or unknown one too', () => {
  expect(nameOfId('claude-opus-5-5')).toBe('Opus 5.5')
  expect(nameOfId('claude-opus-5')).toBe('Opus 5')
  expect(nameOfId('claude-opus-5-5-20260101')).toBe('Opus 5.5')
  expect(nameOfId('some-other-model')).toBe('some-other-model')
  expect(pickOfId('claude-haiku-4-5')?.version.price).toEqual([1, 5])
  expect(pickOfName('Sonnet 5.5 (1M context)')?.version.model).toBe('claude-sonnet-5-5')
  expect(pickOfName('gpt')).toBeUndefined()
})

test('a response costs its tokens at list price, cached ones at their own rate', () => {
  const million = { input_tokens: 1_000_000 }

  expect(money(costOf(usage('claude-opus-5-5', million)))).toBe(money(4))
  expect(money(costOf(usage('claude-opus-5-5', { output_tokens: 1_000_000 })))).toBe(money(20))
  // A listed cache rate (Opus 5.5: $0.20), else a tenth of the input price.
  expect(money(costOf(usage('claude-opus-5-5', { cache_read_input_tokens: 1_000_000 })))).toBe(money(0.2))
  expect(money(costOf(usage('claude-opus-5', { cache_read_input_tokens: 1_000_000 })))).toBe(money(0.5))
  expect(money(costOf(usage('claude-opus-5', { cache_creation_input_tokens: 1_000_000 })))).toBe(money(6.25))
  expect(costOf(usage('some-other-model', million))).toBe(0)
})

test('the tally keeps the latest main response, its turn and the whole session', () => {
  const first = tally(null, { turnId: 'a', effort: 'high' }, usage('claude-opus-5', { input_tokens: 1_000_000 }), true)
  expect(first).toMatchObject({ answeredBy: 'claude-opus-5', effort: 'high', turnCost: 5, sessionCost: 5 })

  const same = tally(first, { turnId: 'a' }, usage('claude-opus-5', { input_tokens: 1_000_000 }), true)
  expect(same).toMatchObject({ effort: '', turnCost: 10, sessionCost: 10 })

  const sub = tally(same, { turnId: 'z' }, usage('claude-haiku-4-5', { input_tokens: 1_000_000 }), false)
  expect(sub).toMatchObject({ answeredBy: 'claude-opus-5', turnId: 'a', turnCost: 10, sessionCost: 11 })

  const next = tally(sub, { turnId: 'b' }, usage('claude-haiku-4-5', { input_tokens: 1_000_000 }), true)
  expect(next).toMatchObject({ answeredBy: 'claude-haiku-4-5', turnCost: 1, sessionCost: 12 })
})

test('amounts and counts are short', () => {
  expect(money(0.0291)).toBe('$0.029')
  expect(money(0.1)).toBe('$0.10')
  expect(money(12.345)).toBe('$12.35')
  expect(count(800)).toBe('800')
  expect(count(1234)).toBe('1.2k')
  expect(count(45_600)).toBe('46k')
  expect(count(1_200_000)).toBe('1.2M')
  expect(priceLabel([4, 20])).toBe('$4/$20')
  expect(priceLabel([0.1, 0.5])).toBe('$0.10/$0.50')
})

test('the stats row drops its last parts to fit, and is empty with nothing to show', () => {
  const stats = tally(
    null,
    { turnId: 'a', effort: 'medium' },
    usage('claude-opus-5-5', { input_tokens: 2000, output_tokens: 500, cache_read_input_tokens: 8000 }),
    true,
  )
  const whole = statsLine(stats, true, 200)

  expect(whole).toBe('respondió Opus 5.5 · sesión ~$0.020 · turno ~$0.020 · effort medium · 10k→500 tok · cache 80% · manual')
  expect(statsLine(stats, true, 40)).toBe('respondió Opus 5.5 · sesión ~$0.020')
  expect(statsLine(stats, true, 5)).toBe('respondió Opus 5.5')
  expect(statsLine(null, false, 200)).toBe('')
  expect(statsLine(null, true, 200)).toBe('manual')
})
