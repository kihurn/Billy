import type { Bill } from './types'

/**
 * Splits `total` cents across people in proportion to `weights`, so the
 * shares always add back up to exactly `total` (largest-remainder method).
 * When leftover sen tie, the person with the lowest `priority` gets one first.
 */
export function allocate(total: number, weights: number[], priority: number[] = []): number[] {
  const sumWeights = weights.reduce((a, b) => a + b, 0)
  if (weights.length === 0 || sumWeights <= 0) return weights.map(() => 0)

  const sign = total < 0 ? -1 : 1
  const abs = Math.abs(total)
  const raw = weights.map((w) => (abs * w) / sumWeights)
  const shares = raw.map(Math.floor)
  let leftover = abs - shares.reduce((a, b) => a + b, 0)

  const byRemainder = raw
    .map((r, i) => ({ i, frac: r - shares[i] }))
    .sort((a, b) => b.frac - a.frac || (priority[a.i] ?? 0) - (priority[b.i] ?? 0) || a.i - b.i)
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

type SplitInput = Pick<Bill, 'items' | 'charges' | 'guests' | 'assignments' | 'pieces'>

// Pieces each current guest had of a counted line (guests with 0 or who were removed are left out).
export function pieceCounts(bill: Pick<Bill, 'guests' | 'pieces'>, itemId: string): Map<string, number> {
  const counts = new Map<string, number>()
  for (const g of bill.guests) {
    const n = bill.pieces?.[itemId]?.[g.id] ?? 0
    if (n > 0) counts.set(g.id, n)
  }
  return counts
}

export const totalPieces = (counts: Map<string, number>) => [...counts.values()].reduce((a, b) => a + b, 0)

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
  // Leftover sen each person has already absorbed, so ties go to whoever has had the fewest.
  const extraSen = bill.guests.map(() => 0)

  // allocate(), with rounding leftovers spread evenly across the whole bill.
  const fairAllocate = (total: number, weights: number[], who: number[]) => {
    const shares = allocate(total, weights, who.map((i) => extraSen[i]))
    const sumW = weights.reduce((a, b) => a + b, 0)
    shares.forEach((share, k) => {
      if (sumW > 0) extraSen[who[k]] += Math.abs(share) - Math.floor((Math.abs(total) * weights[k]) / sumW)
    })
    return shares
  }

  for (const item of bill.items) {
    const counts = pieceCounts(bill, item.id)
    const counted = counts.size > 0
    if (counted && totalPieces(counts) < item.quantity) {
      unassignedItemIds.push(item.id) // some pieces still unclaimed
      continue
    }
    const sharers = counted ? [...counts.keys()] : (bill.assignments[item.id] ?? []).filter((id) => indexOf.has(id))
    if (sharers.length === 0) {
      unassignedItemIds.push(item.id)
      continue
    }
    const who = sharers.map((id) => indexOf.get(id)!)
    const weights = sharers.map((id) => (counted ? counts.get(id)! : 1))
    const shares = fairAllocate(item.priceCents, weights, who)
    sharers.forEach((guestId, k) => {
      const i = who[k]
      let label = item.name
      if (counted) label = `${item.name} ×${counts.get(guestId)}`
      else if (sharers.length > 1) label = `${item.name} (1/${sharers.length})`
      people[i].items.push({ label, cents: shares[k] })
      people[i].subtotalCents += shares[k]
      baseAll[i] += shares[k]
      if (item.isAlcohol) baseAlcohol[i] += shares[k]
    })
  }

  // Each person's share of the % charges so far, for charges that compound on top of them.
  const rateChargesSoFar = bill.guests.map(() => 0)
  const everyone = people.map((_, i) => i)

  for (const charge of bill.charges) {
    let base = charge.appliesTo === 'alcohol' ? baseAlcohol : baseAll
    if (charge.appliesTo === 'alcohol' && !base.some((w) => w > 0)) {
      warnings.push(`No alcohol items are ticked, so “${charge.label}” is split across all items.`)
      base = baseAll
    }
    let weights = base.map((w) => Math.max(0, w))
    let amount = charge.amountCents
    if (charge.rate != null) {
      // % charge: the rate on each person's own food (plus their earlier % charges if it compounds).
      if (charge.compound) weights = weights.map((w, i) => w + rateChargesSoFar[i])
      amount = Math.round(charge.rate * weights.reduce((a, b) => a + b, 0))
    }
    const shares = fairAllocate(amount, weights, everyone)
    shares.forEach((cents, i) => {
      if (weights[i] > 0) people[i].charges.push({ label: charge.label, cents })
      if (charge.rate != null) rateChargesSoFar[i] += cents
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
