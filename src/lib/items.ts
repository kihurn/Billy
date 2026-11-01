import type { Item } from './types'

// Items store the line total (what the receipt prints); these helpers let the UI
// edit "price of one × quantity" instead.

export function unitPrice(item: Item): number {
  return Math.round(item.priceCents / item.quantity)
}

export function withQuantity(item: Item, quantity: number): Item {
  const next = Math.max(1, Math.round(quantity))
  return { ...item, quantity: next, priceCents: unitPrice(item) * next }
}

export function withUnitPrice(item: Item, unitCents: number): Item {
  return { ...item, priceCents: unitCents * item.quantity }
}
