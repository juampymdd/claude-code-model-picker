import { expect, test } from 'claude-code/testing'

import { cell, columns, duration, hbar, pct, sparkline, stack } from '../hooks/charts'

test('a sparkline scales to its max and marks zero apart', () => {
  expect(sparkline([0, 1, 4, 8])).toBe('·▁▄█')
  expect(sparkline([])).toBe('')
  expect(sparkline([0, 0, 0])).toBe('···')
  expect(sparkline([5], 10)).toBe('▄')
  expect(sparkline([20], 10)).toBe('█')
})

test('columns stack full and partial cells, top row first', () => {
  const chart = columns([0, 4, 8], 2)

  // The tallest value fills both rows, half of it fills the bottom one.
  expect(chart).toEqual(['  █', ' ██'])
  // A column under the top cell shows its remainder in eighths: 3 of 8 over two rows is 6/16.
  expect(columns([3, 8], 2)).toEqual([' █', '▆█'])
  expect(chart.every(row => [...row].length === 3)).toBe(true)
  expect(columns([], 3)).toEqual(['', '', ''])
  expect(columns([0, 0], 2)).toEqual(['  ', '  '])
})

test('a horizontal bar fills eighths and never passes its width', () => {
  expect(hbar(0, 10, 8)).toBe('')
  expect(hbar(10, 10, 8)).toBe('████████')
  expect(hbar(5, 10, 8)).toBe('████')
  expect(hbar(0.01, 10, 8)).toBe('▏')
  expect(hbar(15, 10, 8)).toBe('████████')
  expect(hbar(1, 0, 8)).toBe('')
  expect(hbar(1, 10, 0)).toBe('')
  expect(hbar(1.5, 8, 8)).toBe('█▌')
})

test("a stack's cells add up to its share of the width", () => {
  expect(stack([1, 1], 2, 10)).toEqual([5, 5])
  expect(stack([1, 2], 3, 10).reduce((a, b) => a + b, 0)).toBe(10)
  expect(stack([1, 1], 4, 10).reduce((a, b) => a + b, 0)).toBe(5)
  expect(stack([0, 3], 3, 6)).toEqual([0, 6])
  expect(stack([0, 0], 3, 6)).toEqual([0, 0])
  expect(stack([1, 1], 0, 6)).toEqual([0, 0])
  expect(stack([0.001, 100], 100, 10)[0]).toBeLessThanOrEqual(1)
})

test('percent, duration and cell are short', () => {
  expect(pct(94, 100)).toBe('94%')
  expect(pct(1, 0)).toBe('–')
  expect(duration(850)).toBe('850ms')
  expect(duration(12_000)).toBe('12s')
  expect(duration(192_000)).toBe('3m12s')
  expect(duration(3_840_000)).toBe('1h04m')
  expect(cell('Bash', 6)).toBe('Bash  ')
  expect(cell('42', 5, 'right')).toBe('   42')
  expect(cell('mcp__server__tool', 8)).toBe('mcp__se…')
  expect(cell('ab', 1)).toBe('a')
})
