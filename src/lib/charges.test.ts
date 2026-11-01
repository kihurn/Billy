import { describe, expect, it } from 'vitest'
import { chargeAmounts, chargesFromReceipt, parseRate } from './charges'
import type { Charge } from './types'

describe('parseRate', () => {
  it('reads the percentage in a label', () => {
    expect(parseRate('Service Charge@10%:')).toBe(0.1)
    expect(parseRate('SST 6%')).toBe(0.06)
    expect(parseRate('Tax 6.5 %')).toBe(0.065)
  })

  it('returns null when there is none', () => {
    expect(parseRate('Round Adj')).toBeNull()
  })
})

describe('chargesFromReceipt', () => {
  it('uses the rate printed in the label', () => {
    const [service] = chargesFromReceipt([{ label: 'Service Charge 10%', amount: 11.74, applies_to: 'all' }], 11740, 0)
    expect(service).toMatchObject({ rate: 0.1, compound: false, amountCents: 1174 })
  })

  it('works out a missing rate from the amount when it is a clean percentage', () => {
    const [service] = chargesFromReceipt([{ label: 'Service Charge', amount: 42.5, applies_to: 'all' }], 42500, 0)
    expect(service.rate).toBe(0.1)
  })

  it('treats rounding and odd amounts as fixed', () => {
    const charges = chargesFromReceipt(
      [
        { label: 'Round Adj', amount: 0.02, applies_to: 'all' },
        { label: 'Corkage', amount: 7.13, applies_to: 'all' },
      ],
      11740,
      0,
    )
    expect(charges.map((c) => c.rate)).toEqual([null, null])
  })

  it('spots tax charged on top of the service charge', () => {
    // food 100.00, service 10% = 10.00, SST 6% on 110.00 = 6.60
    const charges = chargesFromReceipt(
      [
        { label: 'Service 10%', amount: 10, applies_to: 'all' },
        { label: 'SST 6%', amount: 6.6, applies_to: 'all' },
      ],
      10000,
      0,
    )
    expect(charges[1]).toMatchObject({ rate: 0.06, compound: true })
  })

  it('leaves tax on food only when that is what the receipt did', () => {
    const charges = chargesFromReceipt(
      [
        { label: 'Service Charge 10%', amount: 11.74, applies_to: 'all' },
        { label: 'Tax 6%', amount: 7.04, applies_to: 'all' },
      ],
      11740,
      0,
    )
    expect(charges[1].compound).toBe(false)
  })
})

describe('chargeAmounts', () => {
  const c = (patch: Partial<Charge>): Charge => ({ id: 'x', label: '', amountCents: 0, appliesTo: 'all', ...patch })

  it('computes % charges from the food, and keeps fixed charges as printed', () => {
    const amounts = chargeAmounts(
      [c({ rate: 0.1, amountCents: 999 }), c({ rate: 0.06 }), c({ amountCents: 2 })],
      11740,
      0,
    )
    expect(amounts).toEqual([1174, 704, 2])
  })

  it('compounds when asked', () => {
    expect(chargeAmounts([c({ rate: 0.1 }), c({ rate: 0.06, compound: true })], 10000, 0)).toEqual([1000, 660])
  })

  it('uses the alcohol subtotal for alcohol-only charges', () => {
    expect(chargeAmounts([c({ rate: 0.1, appliesTo: 'alcohol' })], 10000, 1800)).toEqual([180])
  })
})
