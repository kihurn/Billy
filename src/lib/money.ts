// Receipts often round the total to the nearest 5 sen. Gaps this small are ignored:
// Billy just uses the amounts as listed.
export const ROUNDING_TOLERANCE_CENTS = 10

export function toCents(value: number): number {
  return Math.round(value * 100)
}

export function formatMoney(cents: number, currency: string): string {
  const sign = cents < 0 ? '-' : ''
  return `${sign}${currency} ${(Math.abs(cents) / 100).toFixed(2)}`
}

// Parses user input like "12.5", "RM 12.50" or "-3". Returns null if not a number.
export function parseMoney(input: string): number | null {
  const cleaned = input.replace(/[^0-9.,-]/g, '').replace(',', '.')
  if (cleaned === '' || cleaned === '-' || cleaned === '.') return null
  const value = Number(cleaned)
  return Number.isFinite(value) ? toCents(value) : null
}

export function centsToInput(cents: number): string {
  return (cents / 100).toFixed(2)
}
