import { useEffect, useState, type CSSProperties } from 'react'
import { PlusIcon, TrashIcon } from '../components/Icons'
import { deleteBill, listBills, type SavedBill } from '../lib/bills'
import { formatMoney } from '../lib/money'
import { plural } from '../lib/text'
import type { Bill } from '../lib/types'

interface Props {
  onNew: () => void
  onOpen: (bill: Bill) => void
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000
const MAX_INITIALS = 5

function dayLabel(d: Date): string {
  const daysAgo = Math.round((new Date().setHours(0, 0, 0, 0) - new Date(d).setHours(0, 0, 0, 0)) / 86_400_000)
  if (daysAgo === 0) return 'today'
  if (daysAgo === 1) return 'yesterday'
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}

// "today, 8:42 pm", "yesterday, 1:15 pm", "28 Oct, 11:58 pm"
function when(iso: string): string {
  const d = new Date(iso)
  const time = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }).toLowerCase()
  return `${dayLabel(d)}, ${time}`
}

function subtitle(bills: SavedBill[] | null): string {
  if (bills === null) return 'Loading…'
  if (bills.length === 0) return 'Split your first bill'
  const thisWeek = bills.filter((b) => Date.now() - new Date(b.created_at).getTime() < WEEK_MS).length
  if (thisWeek === 0) return `${plural(bills.length, 'bill')} saved`
  return `${plural(thisWeek, 'bill')} this week`
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
      <header className="home-head">
        <h1 className="home-title">Billy</h1>
        <div className="small">{error ? 'Offline' : subtitle(bills)}</div>
      </header>

      {error && <div className="notice notice-bad">Couldn’t load bills: {error}</div>}

      {bills?.length === 0 && (
        <button className="slip slip-empty" onClick={onNew}>
          <h2>No bills yet</h2>
          <span className="small">Tap + to split your first one.</span>
        </button>
      )}

      {bills?.map((b, i) => {
        const guests = b.data.guests
        // The slip's content is one real <button>; the delete button sits beside it
        // (absolutely positioned) because buttons can't be nested.
        return (
          <div key={b.id} className={`glass slip${i >= 2 ? ' slip-old' : ''}`} style={{ '--i': i } as CSSProperties}>
            <button className="slip-open" onClick={() => onOpen(b.data)}>
              <span className="slip-top">
                <span className="grow">
                  <span className="ellipsis slip-title">{b.title || 'Untitled bill'}</span>
                  <span className="small">{when(b.created_at)}</span>
                </span>
                <span className="initials" aria-label={guests.map((g) => g.name).join(', ')}>
                  {guests.slice(0, MAX_INITIALS).map((g) => (
                    <span key={g.id}>{g.name.slice(0, 1).toUpperCase()}</span>
                  ))}
                  {guests.length > MAX_INITIALS && <span>+{guests.length - MAX_INITIALS}</span>}
                </span>
              </span>
              <span className="slip-dash" />
              <span className="slip-bottom">
                <span className="slip-label">Total</span>
                <span className="money slip-total">{formatMoney(b.total_cents, b.data.currency)}</span>
              </span>
            </button>
            <button className="icon-btn slip-delete" aria-label="Delete bill" onClick={() => void remove(b.id)}>
              <TrashIcon />
            </button>
          </div>
        )
      })}

      <button className="fab" aria-label="Split a new bill" onClick={onNew}>
        <PlusIcon />
      </button>
    </div>
  )
}
