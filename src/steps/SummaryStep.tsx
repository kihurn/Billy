import { useEffect, useState, type CSSProperties } from 'react'
import { BottomBar } from '../components/BottomBar'
import { ChevronIcon } from '../components/Icons'
import { saveBill } from '../lib/bills'
import { formatMoney, ROUNDING_TOLERANCE_CENTS } from '../lib/money'
import { plural } from '../lib/text'
import { computeSplit, type SplitResult } from '../lib/split'
import type { Bill } from '../lib/types'
import type { StepProps } from './props'

type SaveState = 'saving' | 'saved' | { error: string }

function shareText(bill: Bill, split: SplitResult): string {
  const money = (c: number) => formatMoney(c, bill.currency)
  const lines = split.people.map((p) => `${p.name}: ${money(p.totalCents)}`)
  return [`${bill.title || 'Bill'} — ${money(split.totalCents)}`, '', ...lines].join('\n')
}

export function SummaryStep({ bill, onNext }: StepProps) {
  const split = computeSplit(bill)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [save, setSave] = useState<SaveState>('saving')
  const [toast, setToast] = useState<string | null>(null)
  const money = (c: number) => formatMoney(c, bill.currency)

  useEffect(() => {
    saveBill(bill)
      .then(() => setSave('saved'))
      .catch((e: Error) => setSave({ error: e.message }))
  }, [bill])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 1800)
    return () => clearTimeout(t)
  }, [toast])

  async function copy() {
    const text = shareText(bill, split)
    try {
      if (navigator.share) await navigator.share({ text })
      else {
        await navigator.clipboard.writeText(text)
        setToast('Copied — paste it in the group chat')
      }
    } catch {
      // User closed the share sheet.
    }
  }

  const diff = bill.receiptTotalCents == null ? null : bill.receiptTotalCents - split.totalCents

  return (
    <div className="screen">
      {split.warnings.map((w) => (
        <div key={w} className="notice">
          {w}
        </div>
      ))}
      {diff != null && Math.abs(diff) > ROUNDING_TOLERANCE_CENTS && (
        <div className="notice">
          This split comes to {money(split.totalCents)} but the receipt says {money(bill.receiptTotalCents!)}. Go back
          to check the items and charges.
        </div>
      )}

      {split.people.map((p, i) => {
        const open = expanded === p.guestId
        return (
          <div key={p.guestId} className="glass person" style={{ '--i': i } as CSSProperties}>
            <button className="person-head" aria-expanded={open} onClick={() => setExpanded(open ? null : p.guestId)}>
              <span className="avatar">{p.name.slice(0, 1).toUpperCase()}</span>
              <span className="grow">
                <span className="ellipsis person-name">
                  {p.name}
                </span>
                <span className="small">
                  {plural(p.items.length, 'item')}
                </span>
              </span>
              <span className="person-total money">{money(p.totalCents)}</span>
              <ChevronIcon />
            </button>
            {open && (
              <div className="person-detail">
                {p.items.map((l, k) => (
                  <div key={k} className="line">
                    <span>{l.label}</span>
                    <span className="money">{money(l.cents)}</span>
                  </div>
                ))}
                {p.charges.map((l, k) => (
                  <div key={`c${k}`} className="line">
                    <span>{l.label}</span>
                    <span className="money">{money(l.cents)}</span>
                  </div>
                ))}
                <div className="line line-total">
                  <span>Total</span>
                  <span className="money">{money(p.totalCents)}</span>
                </div>
              </div>
            )}
          </div>
        )
      })}

      <p className="small" style={{ textAlign: 'center', margin: 0 }}>
        {save === 'saving' && 'Saving…'}
        {save === 'saved' && 'Saved to your bills'}
        {typeof save === 'object' && `Couldn’t save: ${save.error}`}
      </p>

      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}

      <BottomBar note={<span className="money" style={{ color: 'var(--text)' }}>{money(split.totalCents)}</span>}>
        <button className="btn" onClick={() => void copy()}>
          Share
        </button>
        <button className="btn btn-primary" onClick={onNext}>
          Done
        </button>
      </BottomBar>
    </div>
  )
}
