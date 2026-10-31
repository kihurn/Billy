import type { Bill } from './types'

/**
 * Splits `total` cents across people in proportion to `weights`, so the
 * shares always add back up to exactly `total` (largest-remainder method).
 */
export function allocate(total: number, weights: number[]): number[] {
  const sumWeights = weights.reduce((a, b) => a + b, 0)
  if (weights.length === 0 || sumWeights <= 0) return weights.map(() => 0)

  const sign = total < 0 ? -1 : 1
  const abs = Math.abs(total)
  const raw = weights.map((w) => (abs * w) / sumWeights)
  const shares = raw.map(Math.floor)
  let leftover = abs - shares.reduce((a, b) => a + b, 0)

  const byRemainder = raw
    .map((r, i) => ({ i, frac: r - shares[i] }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i)
  for (let k = 0; leftover > 0; k++, leftover--) shares[byRemainder[k].i]++

  return shares.map((s) => s * sign)
}

export interface Line {
  label: string
  cents: number
}

export interface PersonSplit {
  guestId: string
  name: string
  items: Line[]
  charges: Line[]
  subtotalCents: number
  totalCents: number
}

export interface SplitResult {
  people: PersonSplit[]
  unassignedItemIds: string[]
  warnings: string[]
  totalCents: number
}

type SplitInput = Pick<Bill, 'items' | 'charges' | 'guests' | 'assignments'>

export function computeSplit(bill: SplitInput): SplitResult {
  const indexOf = new Map(bill.guests.map((g, i) => [g.id, i]))
  const people: PersonSplit[] = bill.guests.map((g) => ({
    guestId: g.id,
    name: g.name,
    items: [],
    charges: [],
    subtotalCents: 0,
    totalCents: 0,
  }))
  const baseAll = bill.guests.map(() => 0)
  const baseAlcohol = bill.guests.map(() => 0)
  const unassignedItemIds: string[] = []
  const warnings: string[] = []

  for (const item of bill.items) {
    const sharers = (bill.assignments[item.id] ?? []).filter((id) => indexOf.has(id))
    if (sharers.length === 0) {
      unassignedItemIds.push(item.id)
      continue
    }
    const shares = allocate(item.priceCents, sharers.map(() => 1))
    sharers.forEach((guestId, k) => {
      const i = indexOf.get(guestId)!
      const label = sharers.length > 1 ? `${item.name} (1/${sharers.length})` : item.name
      people[i].items.push({ label, cents: shares[k] })
      people[i].subtotalCents += shares[k]
      baseAll[i] += shares[k]
      if (item.isAlcohol) baseAlcohol[i] += shares[k]
    })
  }

  for (const charge of bill.charges) {
    let base = charge.appliesTo === 'alcohol' ? baseAlcohol : baseAll
    if (charge.appliesTo === 'alcohol' && !base.some((w) => w > 0)) {
      warnings.push(`No alcohol items are ticked, so “${charge.label}” is split across all items.`)
      base = baseAll
    }
    const weights = base.map((w) => Math.max(0, w))
    const shares = allocate(charge.amountCents, weights)
    shares.forEach((cents, i) => {
      if (weights[i] > 0) people[i].charges.push({ label: charge.label, cents })
    })
  }

  for (const p of people) {
    p.totalCents = p.subtotalCents + p.charges.reduce((a, c) => a + c.cents, 0)
  }

  return {
    people,
    unassignedItemIds,
    warnings,
    totalCents: people.reduce((a, p) => a + p.totalCents, 0),
  }
}
