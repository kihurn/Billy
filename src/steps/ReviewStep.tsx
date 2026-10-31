import { BottomBar } from '../components/BottomBar'
import { CloseIcon, PlusIcon } from '../components/Icons'
import { MoneyInput } from '../components/MoneyInput'
import { formatMoney } from '../lib/money'
import { allocate } from '../lib/split'
import type { Charge, Item } from '../lib/types'
import type { StepProps } from './props'

const PRESETS = [
  { label: 'Service charge 10%', rate: 0.1 },
  { label: 'SST 6%', rate: 0.06 },
  { label: 'SST 8%', rate: 0.08 },
]

export function ReviewStep({ bill, update, onNext }: StepProps) {
  const itemsTotal = bill.items.reduce((a, i) => a + i.priceCents, 0)
  const chargesTotal = bill.charges.reduce((a, c) => a + c.amountCents, 0)
  const computed = itemsTotal + chargesTotal
  const diff = bill.receiptTotalCents == null ? 0 : bill.receiptTotalCents - computed
  const money = (c: number) => formatMoney(c, bill.currency)

  const setItem = (id: string, patch: Partial<Item>) =>
    update((b) => ({ ...b, items: b.items.map((i) => (i.id === id ? { ...i, ...patch } : i)) }))

  const setCharge = (id: string, patch: Partial<Charge>) =>
    update((b) => ({ ...b, charges: b.charges.map((c) => (c.id === id ? { ...c, ...patch } : c)) }))

  const addItem = () =>
    update((b) => ({
      ...b,
      items: [...b.items, { id: crypto.randomUUID(), name: '', quantity: 1, priceCents: 0, isAlcohol: false }],
    }))

  const removeItem = (id: string) =>
    update((b) => {
      const { [id]: _removed, ...assignments } = b.assignments
      return { ...b, items: b.items.filter((i) => i.id !== id), assignments }
    })

  // "3x Teh tarik RM 9.00" -> three RM 3.00 lines, so each person can tick one.
  const splitUnits = (item: Item) =>
    update((b) => {
      const prices = allocate(item.priceCents, Array(item.quantity).fill(1))
      const units = prices.map((priceCents) => ({ ...item, id: crypto.randomUUID(), quantity: 1, priceCents }))
      const index = b.items.findIndex((i) => i.id === item.id)
      const items = [...b.items.slice(0, index), ...units, ...b.items.slice(index + 1)]
      const { [item.id]: _removed, ...assignments } = b.assignments
      return { ...b, items, assignments }
    })

  const addCharge = (label: string, rate: number | null) =>
    update((b) => ({
      ...b,
      charges: [
        ...b.charges,
        {
          id: crypto.randomUUID(),
          label,
          amountCents: rate == null ? 0 : Math.round(itemsTotal * rate),
          appliesTo: 'all',
        },
      ],
    }))

  const removeCharge = (id: string) => update((b) => ({ ...b, charges: b.charges.filter((c) => c.id !== id) }))

  const canContinue = bill.items.length > 0 && bill.items.every((i) => i.name.trim())

  return (
    <div className="screen">
      <div className="glass">
        <input
          className="input input-bare"
          style={{ fontSize: 22, fontWeight: 700 }}
          placeholder="Restaurant name"
          aria-label="Restaurant name"
          value={bill.title}
          onChange={(e) => update((b) => ({ ...b, title: e.target.value }))}
        />
        <p className="small" style={{ margin: '4px 4px 0' }}>
          Check the items against the receipt and fix anything the scan got wrong.
        </p>
      </div>

      <div className="glass">
        <div className="section-head">
          <h2>Items</h2>
          <span className="small money">{money(itemsTotal)}</span>
        </div>
        <div className="stack">
          {bill.items.map((item) => (
            <div key={item.id} className="row" style={{ flexWrap: 'wrap', rowGap: 6 }}>
              <input
                className="input input-bare grow"
                placeholder="Item name"
                aria-label="Item name"
                value={item.name}
                onChange={(e) => setItem(item.id, { name: e.target.value })}
              />
              <MoneyInput label="Price" cents={item.priceCents} onChange={(c) => setItem(item.id, { priceCents: c ?? 0 })} />
              <button className="icon-btn" aria-label="Remove item" onClick={() => removeItem(item.id)}>
                <CloseIcon />
              </button>
              <div style={{ display: 'flex', gap: 6, width: '100%', paddingLeft: 4 }}>
                <button
                  className="toggle"
                  aria-pressed={item.isAlcohol}
                  onClick={() => setItem(item.id, { isAlcohol: !item.isAlcohol })}
                >
                  {item.isAlcohol ? 'Alcohol' : 'Not alcohol'}
                </button>
                {item.quantity > 1 && (
                  <button className="toggle" onClick={() => splitUnits(item)}>
                    {item.quantity}× · split into {item.quantity} lines
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
        <button className="btn btn-small btn-ghost" style={{ marginTop: 10 }} onClick={addItem}>
          <PlusIcon /> Add item
        </button>
      </div>

      <div className="glass">
        <div className="section-head">
          <h2>Tax & charges</h2>
          <span className="small money">{money(chargesTotal)}</span>
        </div>
        <div className="stack">
          {bill.charges.length === 0 && <p className="small" style={{ margin: 0 }}>No charges on this receipt.</p>}
          {bill.charges.map((charge) => (
            <div key={charge.id} className="row" style={{ flexWrap: 'wrap', rowGap: 6 }}>
              <input
                className="input input-bare grow"
                placeholder="e.g. Service charge"
                aria-label="Charge name"
                value={charge.label}
                onChange={(e) => setCharge(charge.id, { label: e.target.value })}
              />
              <MoneyInput
                label="Charge amount"
                cents={charge.amountCents}
                onChange={(c) => setCharge(charge.id, { amountCents: c ?? 0 })}
              />
              <button className="icon-btn" aria-label="Remove charge" onClick={() => removeCharge(charge.id)}>
                <CloseIcon />
              </button>
              <div style={{ width: '100%', paddingLeft: 4 }}>
                <button
                  className="toggle"
                  aria-pressed={charge.appliesTo === 'alcohol'}
                  onClick={() => setCharge(charge.id, { appliesTo: charge.appliesTo === 'all' ? 'alcohol' : 'all' })}
                >
                  {charge.appliesTo === 'alcohol' ? 'Only people who had alcohol' : 'Shared by everyone'}
                </button>
              </div>
            </div>
          ))}
        </div>
        <div className="chips" style={{ marginTop: 10 }}>
          {PRESETS.map((p) => (
            <button key={p.label} className="chip" style={{ fontSize: 13, minHeight: 32 }} onClick={() => addCharge(p.label, p.rate)}>
              + {p.label}
            </button>
          ))}
          <button className="chip" style={{ fontSize: 13, minHeight: 32 }} onClick={() => addCharge('', null)}>
            + Other
          </button>
        </div>
        <p className="small" style={{ margin: '10px 0 0' }}>
          Use the amount printed on the receipt. Discounts are negative, e.g. -5.00.
        </p>
      </div>

      <div className="glass">
        <div className="row" style={{ background: 'none', padding: 0 }}>
          <div className="grow">
            <h2>Receipt total</h2>
            <div className="small">What the receipt says you pay</div>
          </div>
          <MoneyInput
            label="Receipt total"
            allowEmpty
            placeholder="optional"
            cents={bill.receiptTotalCents}
            onChange={(c) => update((b) => ({ ...b, receiptTotalCents: c }))}
          />
        </div>
        {bill.receiptTotalCents != null && (
          <div className={`notice ${diff === 0 ? 'notice-good' : ''}`} style={{ marginTop: 12 }}>
            {diff === 0
              ? 'Items and charges match the receipt total.'
              : `Items and charges add up to ${money(computed)}, which is ${money(Math.abs(diff))} ${
                  diff > 0 ? 'less' : 'more'
                } than the receipt. Check for a missing or misread line.`}
          </div>
        )}
      </div>

      <BottomBar note={<span className="money">{money(computed)}</span>}>
        <button className="btn btn-primary" disabled={!canContinue} onClick={onNext}>
          Add people
        </button>
      </BottomBar>
    </div>
  )
}
