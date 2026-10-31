import { useEffect, useState } from 'react'
import { BottomBar } from '../components/BottomBar'
import { ReceiptIcon, TrashIcon } from '../components/Icons'
import { deleteBill, listBills, type SavedBill } from '../lib/bills'
import { formatMoney } from '../lib/money'
import type { Bill } from '../lib/types'

interface Props {
  onNew: () => void
  onOpen: (bill: Bill) => void
}

export function HomeStep({ onNew, onOpen }: Props) {
  const [bills, setBills] = useState<SavedBill[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    listBills()
      .then(setBills)
      .catch((e: Error) => setError(e.message))
  }, [])

  async function remove(id: string) {
    if (!confirm('Delete this bill?')) return
    try {
      await deleteBill(id)
      setBills((bs) => bs?.filter((b) => b.id !== id) ?? null)
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <div className="screen">
      <div className="glass" style={{ textAlign: 'center', padding: '32px 20px' }}>
        <div className="hero-icon">
          <ReceiptIcon />
        </div>
        <h1>Split</h1>
        <p className="muted" style={{ margin: '6px 0 0' }}>
          Snap the receipt, tick who ate what, and everyone’s share is worked out with tax and service included.
        </p>
      </div>

      <div className="glass">
        <div className="section-head">
          <h2>Past bills</h2>
        </div>
        {error && <div className="notice notice-bad">Couldn’t load bills: {error}</div>}
        {!error && bills === null && <p className="small">Loading…</p>}
        {bills?.length === 0 && <p className="small">No bills yet. Your saved bills will show up here.</p>}
        <div className="stack">
          {bills?.map((b) => (
            <div key={b.id} className="row">
              <button className="bill-card grow" style={{ background: 'none', padding: 0 }} onClick={() => onOpen(b.data)}>
                <div className="ellipsis" style={{ fontWeight: 600 }}>
                  {b.title || 'Untitled bill'}
                </div>
                <div className="small">
                  {new Date(b.created_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
                  {' · '}
                  {b.data.guests.length} {b.data.guests.length === 1 ? 'person' : 'people'}
                </div>
              </button>
              <span className="money" style={{ fontWeight: 650 }}>
                {formatMoney(b.total_cents, b.data.currency)}
              </span>
              <button className="icon-btn" aria-label="Delete bill" onClick={() => remove(b.id)}>
                <TrashIcon />
              </button>
            </div>
          ))}
        </div>
      </div>

      <BottomBar>
        <button className="btn btn-primary btn-block" onClick={onNew}>
          Split a new bill
        </button>
      </BottomBar>
    </div>
  )
}
