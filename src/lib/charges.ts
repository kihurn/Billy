import type { Charge, ChargeScope } from './types'

// Labels that are never a percentage, even when the amount happens to look like one.
const FIXED_LABEL = /round|adj|discount|voucher|promo|rebate|deposit|corkage|delivery|packing|takeaway/i
const MAX_RATE = 0.3
const MATCH_TOLERANCE_CENTS = 2

export function parseRate(label: string): number | null {
  const m = label.match(/(\d+(?:\.\d+)?)\s*%/)
  if (!m) return null
  const rate = Number(m[1]) / 100
  return rate > 0 && rate <= MAX_RATE ? Math.round(rate * 10000) / 10000 : null
}

// A rate in 0.5% steps that reproduces `amountCents` on `baseCents`, or null if none does.
function inferRate(amountCents: number, baseCents: number): number | null {
  if (baseCents <= 0 || amountCents <= 0) return null
  const rate = Math.round((amountCents / baseCents) * 200) / 200
  if (rate <= 0 || rate > MAX_RATE) return null
  return Math.abs(rate * baseCents - amountCents) <= MATCH_TOLERANCE_CENTS ? rate : null
}

interface ScannedCharge {
  label: string
  amount: number
  applies_to: ChargeScope
}

/** Turns scanned charges into Billy charges, working out each one's rate and whether it compounds. */
export function chargesFromReceipt(scanned: ScannedCharge[], foodCents: number, alcoholCents: number): Charge[] {
  let rateChargesSoFar = 0
  return scanned.map((c) => {
    const amountCents = Math.round(c.amount * 100)
    const base = c.applies_to === 'alcohol' ? alcoholCents : foodCents
    let rate: number | null = null
    let compound = false
    if (!FIXED_LABEL.test(c.label)) {
      rate = parseRate(c.label) ?? inferRate(amountCents, base) ?? inferRate(amountCents, base + rateChargesSoFar)
      if (rate !== null && rateChargesSoFar > 0) {
        const onFood = Math.abs(rate * base - amountCents)
        const onFoodAndCharges = Math.abs(rate * (base + rateChargesSoFar) - amountCents)
        compound = onFoodAndCharges < onFood
      }
    }
    if (rate !== null) rateChargesSoFar += amountCents
    return { id: crypto.randomUUID(), label: c.label, amountCents, appliesTo: c.applies_to, rate, compound }
  })
}

/** What each charge comes to for the given food: rate × food for % charges, the printed amount otherwise. */
export function chargeAmounts(charges: Charge[], foodCents: number, alcoholCents: number): number[] {
  let rateChargesSoFar = 0
  return charges.map((c) => {
    if (c.rate == null) return c.amountCents
    const base = (c.appliesTo === 'alcohol' ? alcoholCents : foodCents) + (c.compound ? rateChargesSoFar : 0)
    const amount = Math.round(c.rate * base)
    rateChargesSoFar += amount
    return amount
  })
}

export const formatRate = (rate: number) => `${Math.round(rate * 10000) / 100}%`
