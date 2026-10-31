// All money is stored as integer cents (sen) to avoid floating-point drift.

export type ChargeScope = 'all' | 'alcohol'

export interface Item {
  id: string
  name: string
  quantity: number
  priceCents: number // line total, not unit price
  isAlcohol: boolean
}

export interface Charge {
  id: string
  label: string
  amountCents: number // negative for discounts
  appliesTo: ChargeScope
}

export interface Guest {
  id: string
  name: string
}

export interface Bill {
  id: string
  title: string
  currency: string
  items: Item[]
  charges: Charge[]
  receiptTotalCents: number | null
  guests: Guest[]
  assignments: Record<string, string[]> // itemId -> guestIds sharing it
  createdAt: string
}

// Shape returned by the scan-receipt edge function.
export interface ScannedReceipt {
  merchant: string
  currency: string
  items: { name: string; quantity: number; total_price: number; is_alcohol: boolean }[]
  charges: { label: string; amount: number; applies_to: ChargeScope }[]
  total: number | null
}
