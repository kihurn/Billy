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
  // The amount printed on the receipt. For a charge with a `rate` this is only used to check the
  // maths; for a fixed charge (rounding, RM 5 off) it's the amount that gets shared out.
  amountCents: number // negative for discounts
  appliesTo: ChargeScope
  rate?: number | null // e.g. 0.1 for 10%: each person pays this on their own food
  compound?: boolean // the rate is also charged on earlier % charges (e.g. SST on the service charge)
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
  // For lines with quantity > 1: itemId -> guestId -> pieces they had. Takes over from
  // `assignments` for that line once anyone has a count. Optional so older saved bills still load.
  pieces?: Record<string, Record<string, number>>
  finished?: boolean // reached the split screen at least once; unfinished bills are drafts
  lastStep?: number // where to pick a draft back up
  createdAt: string
}

// Shape returned by the scan-receipt edge function.
export interface ScannedReceipt {
  merchant: string
  currency: string
  items: { name: string; quantity: number; total_price: number; is_alcohol: boolean }[]
  charges: { label: string; amount: number; applies_to: ChargeScope }[]
  subtotal?: number | null
  total: number | null
}
