import { computeSplit } from './split'
import { ensureSession, supabase } from './supabase'
import type { Bill, ScannedReceipt } from './types'
import { toCents } from './money'

export function newBill(): Bill {
  return {
    id: crypto.randomUUID(),
    title: '',
    currency: 'RM',
    items: [],
    charges: [],
    receiptTotalCents: null,
    guests: [],
    assignments: {},
    createdAt: new Date().toISOString(),
  }
}

export function billFromScan(bill: Bill, scan: ScannedReceipt): Bill {
  return {
    ...bill,
    title: scan.merchant || bill.title,
    currency: scan.currency || bill.currency,
    items: scan.items.map((it) => ({
      id: crypto.randomUUID(),
      name: it.name,
      quantity: it.quantity,
      priceCents: toCents(it.total_price),
      isAlcohol: it.is_alcohol,
    })),
    charges: scan.charges.map((c) => ({
      id: crypto.randomUUID(),
      label: c.label,
      amountCents: toCents(c.amount),
      appliesTo: c.applies_to,
    })),
    receiptTotalCents: scan.total == null ? null : toCents(scan.total),
  }
}

export interface SavedBill {
  id: string
  title: string
  total_cents: number
  created_at: string
  pinned: boolean
  data: Bill
}

export async function saveBill(bill: Bill): Promise<void> {
  await ensureSession()
  const { error } = await supabase.from('bills').upsert({
    id: bill.id,
    title: bill.title,
    total_cents: computeSplit(bill).totalCents,
    data: bill,
    updated_at: new Date().toISOString(),
  })
  if (error) throw new Error(error.message)
}

export async function listBills(): Promise<SavedBill[]> {
  await ensureSession()
  const { data, error } = await supabase
    .from('bills')
    .select('id, title, total_cents, created_at, pinned, data')
    .order('pinned', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) throw new Error(error.message)
  return data as SavedBill[]
}

export async function deleteBill(id: string): Promise<void> {
  const { error } = await supabase.from('bills').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

export async function renameBill(bill: Bill, title: string): Promise<void> {
  const { error } = await supabase.from('bills').update({ title, data: { ...bill, title } }).eq('id', bill.id)
  if (error) throw new Error(error.message)
}

export async function setBillPinned(id: string, pinned: boolean): Promise<void> {
  const { error } = await supabase.from('bills').update({ pinned }).eq('id', id)
  if (error) throw new Error(error.message)
}
