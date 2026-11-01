import { useEffect } from 'react'
import { formatMoney } from '../lib/money'
import { pieceCounts } from '../lib/split'
import type { Bill, Item } from '../lib/types'

interface Props {
  bill: Bill
  item: Item
  onClose: () => void
}

// Bottom sheet with everything about one item, for names too long to read in the list.
export function ItemDetails({ bill, item, onClose }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const money = (c: number) => formatMoney(c, bill.currency)
  const nameOf = new Map(bill.guests.map((g) => [g.id, g.name]))
  const counts = pieceCounts(bill, item.id)
  const sharers = (bill.assignments[item.id] ?? []).filter((id) => nameOf.has(id))
  let who = 'Not ticked yet'
  if (counts.size > 0) who = [...counts].map(([id, n]) => `${nameOf.get(id)} ×${n}`).join(', ')
  else if (sharers.length > 0) who = sharers.map((id) => nameOf.get(id)).join(', ')

  return (
    <>
      <button className="sheet-scrim" aria-label="Close" onClick={onClose} />
      <div className="sheet" role="dialog" aria-label={item.name}>
        <div className="sheet-handle" />
        <div className="detail-label">Item</div>
        <div className="detail-title wrap">{item.name}</div>
        <div className="detail-line">
          <span>Price</span>
          <span className="money">{money(item.priceCents)}</span>
        </div>
        {item.quantity > 1 && (
          <div className="detail-line">
            <span>Quantity</span>
            <span>
              {item.quantity} × <span className="money">{money(Math.round(item.priceCents / item.quantity))}</span>
            </span>
          </div>
        )}
        <div className="detail-line">
          <span>{counts.size > 0 ? 'Pieces' : 'Ticked for'}</span>
          <span className="wrap" style={{ textAlign: 'right' }}>
            {who}
          </span>
        </div>
        <div className="detail-line">
          <span>Alcohol</span>
          <span>{item.isAlcohol ? 'Yes' : 'No'}</span>
        </div>
        <button className="btn btn-ghost btn-block" style={{ marginTop: 8 }} onClick={onClose}>
          Close
        </button>
      </div>
    </>
  )
}
