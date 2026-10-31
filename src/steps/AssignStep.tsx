import { useState } from 'react'
import { BottomBar } from '../components/BottomBar'
import { CheckIcon } from '../components/Icons'
import { formatMoney } from '../lib/money'
import type { StepProps } from './props'

export function AssignStep({ bill, update, onNext }: StepProps) {
  const [activeId, setActiveId] = useState(bill.guests[0]?.id)
  const active = bill.guests.find((g) => g.id === activeId) ?? bill.guests[0]
  const nameOf = new Map(bill.guests.map((g) => [g.id, g.name]))
  const sharersOf = (itemId: string) => (bill.assignments[itemId] ?? []).filter((id) => nameOf.has(id))

  const unassigned = bill.items.filter((i) => sharersOf(i.id).length === 0).length
  const countFor = (guestId: string) => bill.items.filter((i) => sharersOf(i.id).includes(guestId)).length

  const toggle = (itemId: string) =>
    update((b) => {
      const current = b.assignments[itemId] ?? []
      const next = current.includes(active.id) ? current.filter((id) => id !== active.id) : [...current, active.id]
      return { ...b, assignments: { ...b.assignments, [itemId]: next } }
    })

  const shareWithEveryone = (itemId: string) =>
    update((b) => ({ ...b, assignments: { ...b.assignments, [itemId]: b.guests.map((g) => g.id) } }))

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
            const checked = sharers.includes(active.id)
            const others = sharers.filter((id) => id !== active.id).map((id) => nameOf.get(id))
            return (
              <div key={item.id} style={{ display: 'flex', gap: 6, alignItems: 'stretch' }}>
                <button
                  role="checkbox"
                  aria-checked={checked}
                  className="row check-row grow"
                  onClick={() => toggle(item.id)}
                >
                  <span className="check">
                    <CheckIcon />
                  </span>
                  <span className="grow">
                    <span className="ellipsis" style={{ display: 'block', fontWeight: 560 }}>
                      {item.name}
                    </span>
                    <span className="small">
                      {sharers.length === 0
                        ? 'Not ticked yet'
                        : !checked
                          ? `Had by ${others.join(', ')}`
                          : others.length === 0
                            ? `Just ${active.name}`
                            : `Shared with ${others.join(', ')}`}
                    </span>
                  </span>
                  <span className="money">{formatMoney(item.priceCents, bill.currency)}</span>
                </button>
                {bill.guests.length > 1 && sharers.length !== bill.guests.length && (
                  <button className="btn btn-small" style={{ minHeight: 'auto', padding: '0 10px', fontSize: 12 }} onClick={() => shareWithEveryone(item.id)}>
                    All
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </div>

      <BottomBar note={unassigned === 0 ? 'Every item is ticked' : `${unassigned} item${unassigned === 1 ? '' : 's'} not ticked yet`}>
        <button className="btn btn-primary" disabled={unassigned > 0} onClick={onNext}>
          See the split
        </button>
      </BottomBar>
    </div>
  )
}
