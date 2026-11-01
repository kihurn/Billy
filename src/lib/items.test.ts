import { describe, expect, it } from 'vitest'
import { unitPrice, withQuantity, withUnitPrice } from './items'
import type { Item } from './types'

const item = (quantity: number, priceCents: number): Item => ({
  id: 'i',
  name: 'Ayam Gepuk',
  quantity,
  priceCents,
  isAlcohol: false,
})

describe('unitPrice', () => {
  it('is the line total divided by quantity', () => {
    expect(unitPrice(item(2, 1900))).toBe(950)
  })

  it('rounds when the total does not divide evenly', () => {
    expect(unitPrice(item(3, 1000))).toBe(333)
  })
})

describe('withQuantity', () => {
  it('keeps the price of one and recomputes the line total', () => {
    expect(withQuantity(item(1, 950), 2)).toMatchObject({ quantity: 2, priceCents: 1900 })
  })

  it('works going down too', () => {
    expect(withQuantity(item(3, 2850), 1)).toMatchObject({ quantity: 1, priceCents: 950 })
  })

  it('never goes below 1', () => {
    expect(withQuantity(item(1, 950), 0)).toMatchObject({ quantity: 1, priceCents: 950 })
  })
})

describe('withUnitPrice', () => {
  it('sets the price of one and multiplies by quantity', () => {
    expect(withUnitPrice(item(2, 0), 950)).toMatchObject({ quantity: 2, priceCents: 1900 })
  })
})
