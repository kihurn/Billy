import { describe, expect, it } from 'vitest'
import { allocate, computeSplit } from './split'
import type { Bill } from './types'

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0)

describe('allocate', () => {
  it('splits evenly and hands leftover cents out one at a time', () => {
    expect(allocate(1000, [1, 1, 1])).toEqual([334, 333, 333])
  })

  it('splits proportionally to weights', () => {
    expect(allocate(300, [2000, 1000])).toEqual([200, 100])
  })

  it('always sums to the total', () => {
    const shares = allocate(1237, [333, 517, 1, 92])
    expect(sum(shares)).toBe(1237)
  })

  it('handles negative totals (discounts)', () => {
    const shares = allocate(-1000, [1, 1, 1])
    expect(shares).toEqual([-334, -333, -333])
  })

  it('gives zero-weight people nothing', () => {
    expect(allocate(101, [0, 1, 1])).toEqual([0, 51, 50])
  })

  it('returns zeros when all weights are zero', () => {
    expect(allocate(500, [0, 0])).toEqual([0, 0])
  })
})

function bill(partial: Partial<Bill>): Bill {
  return {
    id: 'b',
    title: '',
    currency: 'RM',
    items: [],
    charges: [],
    receiptTotalCents: null,
    guests: [],
    assignments: {},
    createdAt: '',
    ...partial,
  }
}

describe('computeSplit', () => {
  const guests = [
    { id: 'a', name: 'Ali' },
    { id: 'b', name: 'Ben' },
    { id: 'c', name: 'Cara' },
  ]

  it('splits shared items and spreads charges by each person’s share', () => {
    const result = computeSplit(
      bill({
        guests,
        items: [
          { id: 'i1', name: 'Nasi lemak', quantity: 1, priceCents: 1200, isAlcohol: false },
          { id: 'i2', name: 'Platter', quantity: 1, priceCents: 3000, isAlcohol: false },
          { id: 'i3', name: 'Beer', quantity: 1, priceCents: 1800, isAlcohol: true },
        ],
        charges: [
          { id: 'c1', label: 'Service 10%', amountCents: 600, appliesTo: 'all' },
          { id: 'c2', label: 'SST 6%', amountCents: 396, appliesTo: 'all' },
          { id: 'c3', label: 'Alcohol tax', amountCents: 180, appliesTo: 'alcohol' },
        ],
        assignments: { i1: ['a'], i2: ['a', 'b', 'c'], i3: ['c'] },
      }),
    )

    expect(result.unassignedItemIds).toEqual([])
    const [ali, ben, cara] = result.people
    expect(ali.subtotalCents).toBe(2200)
    expect(ben.subtotalCents).toBe(1000)
    expect(cara.subtotalCents).toBe(2800)
    // Only Cara had alcohol, so she pays all the alcohol tax.
    expect(cara.charges.find((c) => c.label === 'Alcohol tax')?.cents).toBe(180)
    expect(ali.charges.find((c) => c.label === 'Alcohol tax')).toBeUndefined()
    // Everything adds up to the receipt to the sen.
    expect(sum(result.people.map((p) => p.totalCents))).toBe(6000 + 600 + 396 + 180)
    expect(result.totalCents).toBe(7176)
  })

  it('reports unassigned items', () => {
    const result = computeSplit(
      bill({
        guests,
        items: [{ id: 'i1', name: 'Tea', quantity: 1, priceCents: 300, isAlcohol: false }],
      }),
    )
    expect(result.unassignedItemIds).toEqual(['i1'])
  })

  it('falls back to all items when an alcohol charge has no alcohol items', () => {
    const result = computeSplit(
      bill({
        guests,
        items: [{ id: 'i1', name: 'Tea', quantity: 1, priceCents: 300, isAlcohol: false }],
        charges: [{ id: 'c1', label: 'Alcohol tax', amountCents: 30, appliesTo: 'alcohol' }],
        assignments: { i1: ['a'] },
      }),
    )
    expect(result.people[0].totalCents).toBe(330)
    expect(result.warnings).toHaveLength(1)
  })

  it('applies discounts as negative charges', () => {
    const result = computeSplit(
      bill({
        guests: guests.slice(0, 2),
        items: [
          { id: 'i1', name: 'A', quantity: 1, priceCents: 1000, isAlcohol: false },
          { id: 'i2', name: 'B', quantity: 1, priceCents: 1000, isAlcohol: false },
        ],
        charges: [{ id: 'c1', label: 'Discount', amountCents: -200, appliesTo: 'all' }],
        assignments: { i1: ['a'], i2: ['b'] },
      }),
    )
    expect(result.people.map((p) => p.totalCents)).toEqual([900, 900])
  })

  it('ignores assignments to guests who were removed', () => {
    const result = computeSplit(
      bill({
        guests: [guests[0]],
        items: [{ id: 'i1', name: 'Tea', quantity: 1, priceCents: 300, isAlcohol: false }],
        assignments: { i1: ['a', 'gone'] },
      }),
    )
    expect(result.people[0].totalCents).toBe(300)
  })
})
