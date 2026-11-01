import { useState } from 'react'
import { BottomBar } from '../components/BottomBar'
import { CheckIcon } from '../components/Icons'
import { formatMoney } from '../lib/money'
import { pieceCounts, totalPieces } from '../lib/split'
import { plural } from '../lib/text'
import type { Bill, Item } from '../lib/types'
import type { StepProps } from './props'

function sharedWith(sharers: string[], others: string[], checked: boolean, activeName: string): string {
  if (sharers.length === 0) return 'Not ticked yet'
  if (!checked) return `Had by ${others.join(', ')}`
  if (others.length === 0) return `Just ${activeName}`
  return `Shared with ${others.join(', ')}`
}

// Pieces of a counted line nobody has claimed yet, or null if the line isn't being counted.
function piecesLeft(bill: Bill, item: Item): number | null {
  const counts = pieceCounts(bill, item.id)
  if (counts.size === 0) return null
  return Math.max(0, item.quantity - totalPieces(counts))
}

function bottomNote(bill: Bill, open: Item[]): string {
  if (open.length === 0) return 'Every item is ticked'
  const partial = open.find((i) => piecesLeft(bill, i) !== null)
  if (!partial) return `${plural(open.length, 'item')} not ticked yet`
  const rest = open.length > 1 ? ` · ${open.length - 1} more` : ''
  return `${partial.name}: ${plural(piecesLeft(bill, partial)!, 'piece')} left${rest}`
}

export function AssignStep({ bill, update, onNext }: StepProps) {
  const [activeId, setActiveId] = useState(bill.guests[0]?.id)
  const active = bill.guests.find((g) => g.id === activeId) ?? bill.guests[0]
  const nameOf = new Map(bill.guests.map((g) => [g.id, g.name]))
  const sharersOf = (itemId: string) => (bill.assignments[itemId] ?? []).filter((id) => nameOf.has(id))

  const isDone = (item: Item) => {
    const left = piecesLeft(bill, item)
    return left === null ? sharersOf(item.id).length > 0 : left === 0
  }
  const open = bill.items.filter((i) => !isDone(i))
  const countFor = (guestId: string) =>
    bill.items.filter((i) => sharersOf(i.id).includes(guestId) || pieceCounts(bill, i.id).has(guestId)).length

  const toggle = (itemId: string) =>
    update((b) => {
      const current = b.assignments[itemId] ?? []
      const next = current.includes(active.id) ? current.filter((id) => id !== active.id) : [...current, active.id]
      return { ...b, assignments: { ...b.assignments, [itemId]: next } }
    })

  // Counting pieces replaces any "shared" ticks on that line, and vice versa.
  const setPieces = (itemId: string, n: number) =>
    update((b) => ({
      ...b,
      assignments: { ...b.assignments, [itemId]: [] },
      pieces: { ...b.pieces, [itemId]: { ...b.pieces?.[itemId], [active.id]: n } },
    }))

  const shareWithEveryone = (itemId: string) =>
    update((b) => ({
      ...b,
      assignments: { ...b.assignments, [itemId]: b.guests.map((g) => g.id) },
      pieces: { ...b.pieces, [itemId]: {} },
    }))

  return (
    <div className="screen">
      <div className="chips chips-scroll" role="tablist" aria-label="People">
        {bill.guests.map((g) => (
          <button
            key={g.id}
            role="tab"
            className="chip"
            aria-pressed={g.id === active.id}
            aria-selected={g.id === active.id}
            onClick={() => setActiveId(g.id)}
          >
            {g.name}
            <span className="count">{countFor(g.id)}</span>
          </button>
        ))}
      </div>

      <div className="glass">
        <div className="section-head">
          <h2>What did {active.name} have?</h2>
        </div>
        <div className="stack">
          {bill.items.map((item) => {
            const sharers = sharersOf(item.id)
            const showAll = bill.guests.length > 1 && sharers.length !== bill.guests.length
            const allButton = showAll && (
              <button
                className="btn btn-small"
                style={{ minHeight: 'auto', padding: '0 10px', fontSize: 12 }}
                onClick={() => shareWithEveryone(item.id)}
              >
                All
              </button>
            )

            if (item.quantity > 1) {
              const counts = pieceCounts(bill, item.id)
              const mine = counts.get(active.id) ?? 0
              const claimed = totalPieces(counts)
              const left = Math.max(0, item.quantity - claimed)
              const claims = [...counts].map(([id, n]) => `${nameOf.get(id)} ${n}`)
              let caption = `${plural(item.quantity, 'piece')} · ${left} left`
              if (claims.length > 0) caption = left > 0 ? `${left} left · ${claims.join(' · ')}` : claims.join(' · ')
              // More eaten than billed: the printed price is shared by pieces eaten.
              if (claimed > item.quantity) caption = `${claimed} counted, receipt says ${item.quantity} · ${claims.join(' · ')}`
              else if (sharers.length > 0) caption = `Shared by ${sharers.map((id) => nameOf.get(id)).join(', ')}`
              return (
                <div key={item.id} style={{ display: 'flex', gap: 6, alignItems: 'stretch' }}>
                  <div className={`row grow count-row${mine > 0 ? ' count-row-on' : ''}`}>
                    <span className="grow">
                      <span className="ellipsis" style={{ display: 'block', fontWeight: 560 }}>
                        {item.name} <span className="count-qty">×{item.quantity}</span>
                      </span>
                      <span className="small" style={{ display: 'block' }}>
                        {caption}
                      </span>
                      <span className="pieces-bar">
                        <span style={{ transform: `scaleX(${Math.min(1, claimed / item.quantity)})` }} />
                      </span>
                    </span>
                    <span className={`stepper${mine > 0 ? ' stepper-on' : ''}`}>
                      <button
                        aria-label={`One fewer ${item.name} for ${active.name}`}
                        disabled={mine === 0}
                        onClick={() => setPieces(item.id, mine - 1)}
                      >
                        −
                      </button>
                      <span aria-label={`${active.name} had`}>{mine}</span>
                      <button
                        aria-label={`One more ${item.name} for ${active.name}`}
                        onClick={() => setPieces(item.id, mine + 1)}
                      >
                        +
                      </button>
                    </span>
                  </div>
                  {allButton}
                </div>
              )
            }

            const checked = sharers.includes(active.id)
            const others = sharers.filter((id) => id !== active.id).map((id) => nameOf.get(id) ?? '')
            return (
              <div key={item.id} style={{ display: 'flex', gap: 6, alignItems: 'stretch' }}>
                <button role="checkbox" aria-checked={checked} className="row check-row grow" onClick={() => toggle(item.id)}>
                  <span className="check">
                    <CheckIcon />
                  </span>
                  <span className="grow">
                    <span className="ellipsis" style={{ display: 'block', fontWeight: 560 }}>
                      {item.name}
                    </span>
                    <span className="small">{sharedWith(sharers, others, checked, active.name)}</span>
                  </span>
                  <span className="money">{formatMoney(item.priceCents, bill.currency)}</span>
                </button>
                {allButton}
              </div>
            )
          })}
        </div>
      </div>

      <BottomBar note={bottomNote(bill, open)}>
        <button className="btn btn-primary" disabled={open.length > 0} onClick={onNext}>
          See the split
        </button>
      </BottomBar>
    </div>
  )
}
