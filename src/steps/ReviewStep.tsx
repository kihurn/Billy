import { BottomBar } from '../components/BottomBar'
import { GrowingInput } from '../components/GrowingInput'
import { CloseIcon, PlusIcon } from '../components/Icons'
import { MoneyInput } from '../components/MoneyInput'
import { PercentInput } from '../components/PercentInput'
import { chargeAmounts, parseRate } from '../lib/charges'
import { unitPrice, withQuantity, withUnitPrice } from '../lib/items'
import { formatMoney, ROUNDING_TOLERANCE_CENTS } from '../lib/money'
import type { Charge, Item } from '../lib/types'
import type { StepProps } from './props'

const PRESETS = [
  { label: 'Service charge 10%', rate: 0.1 },
  { label: 'SST 6%', rate: 0.06 },
  { label: 'SST 8%', rate: 0.08 },
]

export function ReviewStep({ bill, update, onNext }: StepProps) {
  const itemsTotal = bill.items.reduce((a, i) => a + i.priceCents, 0)
  const alcoholTotal = bill.items.filter((i) => i.isAlcohol).reduce((a, i) => a + i.priceCents, 0)
  const amounts = chargeAmounts(bill.charges, itemsTotal, alcoholTotal)
  const chargesTotal = amounts.reduce((a, b) => a + b, 0)
  const computed = itemsTotal + chargesTotal
  const diff = bill.receiptTotalCents == null ? 0 : bill.receiptTotalCents - computed
  const money = (c: number) => formatMoney(c, bill.currency)

  const setItem = (id: string, patch: Partial<Item>) =>
    update((b) => ({ ...b, items: b.items.map((i) => (i.id === id ? { ...i, ...patch } : i)) }))

  const replaceItem = (next: Item) =>
    update((b) => ({ ...b, items: b.items.map((i) => (i.id === next.id ? next : i)) }))

  const setCharge = (id: string, patch: Partial<Charge>) =>
    update((b) => ({ ...b, charges: b.charges.map((c) => (c.id === id ? { ...c, ...patch } : c)) }))

  const addItem = () =>
    update((b) => ({
      ...b,
      items: [...b.items, { id: crypto.randomUUID(), name: '', quantity: 1, priceCents: 0, isAlcohol: false }],
    }))

  const removeItem = (item: Item) => {
    const ticked = (bill.assignments[item.id]?.length ?? 0) > 0 || Object.values(bill.pieces?.[item.id] ?? {}).some((n) => n > 0)
    const name = item.name || 'this item'
    if (ticked && !confirm(`Remove ${name}? It’s already been ticked for people. If you ate a different number than the receipt says, change the counts on “Who had what” instead.`)) return
    update((b) => {
      const { [item.id]: _ticks, ...assignments } = b.assignments
      const { [item.id]: _pieces, ...pieces } = b.pieces ?? {}
      return { ...b, items: b.items.filter((i) => i.id !== item.id), assignments, pieces }
    })
  }

  // Switch a charge between "% of each person's food" and a fixed amount shared by food.
  const toggleChargeMode = (charge: Charge, index: number) => {
    if (charge.rate != null) {
      setCharge(charge.id, { rate: null, compound: false, amountCents: amounts[index] })
      return
    }
    const base = charge.appliesTo === 'alcohol' ? alcoholTotal : itemsTotal
    const guess = base > 0 ? Math.round((charge.amountCents / base) * 200) / 200 : 0
    setCharge(charge.id, { rate: parseRate(charge.label) ?? (guess > 0 ? guess : 0.1) })
  }

  // Changing how many pieces there are resets who-had-how-many for that line.
  const setQuantity = (item: Item, quantity: number) =>
    update((b) => ({
      ...b,
      items: b.items.map((i) => (i.id === item.id ? withQuantity(item, quantity) : i)),
      pieces: { ...b.pieces, [item.id]: {} },
    }))

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
          rate,
          compound: false,
        },
      ],
    }))

  const removeCharge = (id: string) => update((b) => ({ ...b, charges: b.charges.filter((c) => c.id !== id) }))

  const direction = diff > 0 ? 'less' : 'more'
  const tiny = diff !== 0 && Math.abs(diff) <= ROUNDING_TOLERANCE_CENTS
  let totalCheck = `Items and charges add up to ${money(computed)}, which is ${money(Math.abs(diff))} ${direction} than the receipt. Check for a missing or misread line.`
  if (diff === 0) totalCheck = 'Items and charges match the receipt total.'
  if (tiny) totalCheck = `Off by ${money(Math.abs(diff))} from the receipt, probably rounding. Billy will use ${money(computed)}.`

  const canContinue = bill.items.length > 0 && bill.items.every((i) => i.name.trim())

  return (
    <div className="screen">
      <div className="glass">
        <GrowingInput
          className="title-input"
          placeholder="Restaurant name"
          label="Restaurant name"
          value={bill.title}
          onChange={(title) => update((b) => ({ ...b, title }))}
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
              <GrowingInput
                className="grow"
                placeholder="Item name"
                label="Item name"
                value={item.name}
                onChange={(name) => setItem(item.id, { name })}
              />
              <MoneyInput
                label={item.quantity > 1 ? 'Price of one' : 'Price'}
                cents={unitPrice(item)}
                onChange={(c) => replaceItem(withUnitPrice(item, c ?? 0))}
              />
              <button className="icon-btn" aria-label="Remove item" onClick={() => removeItem(item)}>
                <CloseIcon />
              </button>
              <div className="item-meta">
                <span className="stepper">
                  <button
                    aria-label="One fewer"
                    disabled={item.quantity <= 1}
                    onClick={() => setQuantity(item, item.quantity - 1)}
                  >
                    −
                  </button>
                  <span aria-label="Quantity">{item.quantity}</span>
                  <button aria-label="One more" onClick={() => setQuantity(item, item.quantity + 1)}>
                    +
                  </button>
                </span>
                {item.quantity > 1 && <span className="money item-total">= {money(item.priceCents)}</span>}
                <button
                  className="toggle"
                  aria-pressed={item.isAlcohol}
                  onClick={() => setItem(item.id, { isAlcohol: !item.isAlcohol })}
                >
                  {item.isAlcohol ? 'Alcohol' : 'Not alcohol'}
                </button>
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
          {bill.charges.map((charge, index) => {
            const earlierRate = bill.charges.slice(0, index).some((c) => c.rate != null)
            return (
              <div key={charge.id} className="row" style={{ flexWrap: 'wrap', rowGap: 6 }}>
                <GrowingInput
                  className="grow"
                  placeholder="e.g. Service charge"
                  label="Charge name"
                  value={charge.label}
                  onChange={(label) => setCharge(charge.id, { label })}
                />
                {charge.rate == null ? (
                  <MoneyInput
                    label="Charge amount"
                    cents={charge.amountCents}
                    onChange={(c) => setCharge(charge.id, { amountCents: c ?? 0 })}
                  />
                ) : (
                  <PercentInput label="Charge rate" rate={charge.rate} onChange={(rate) => setCharge(charge.id, { rate })} />
                )}
                <button className="icon-btn" aria-label="Remove charge" onClick={() => removeCharge(charge.id)}>
                  <CloseIcon />
                </button>
                <div className="item-meta">
                  {charge.rate != null && <span className="money item-total">= {money(amounts[index])}</span>}
                  <button className="toggle" aria-pressed={charge.rate != null} onClick={() => toggleChargeMode(charge, index)}>
                    {charge.rate == null ? 'Fixed amount' : '% of food'}
                  </button>
                  {charge.rate != null && earlierRate && (
                    <button
                      className="toggle"
                      aria-pressed={Boolean(charge.compound)}
                      onClick={() => setCharge(charge.id, { compound: !charge.compound })}
                    >
                      {charge.compound ? 'Also on charges above' : 'On food only'}
                    </button>
                  )}
                  <button
                    className="toggle"
                    aria-pressed={charge.appliesTo === 'alcohol'}
                    onClick={() => setCharge(charge.id, { appliesTo: charge.appliesTo === 'all' ? 'alcohol' : 'all' })}
                  >
                    {charge.appliesTo === 'alcohol' ? 'Alcohol only' : 'All items'}
                  </button>
                </div>
              </div>
            )
          })}
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
          % charges are worked out on each person’s own food. Fixed amounts (rounding, RM 5 off) are shared by how
          much each person had; discounts are negative, e.g. -5.00.
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
          <div className={`notice ${diff === 0 || tiny ? 'notice-good' : ''}`} style={{ marginTop: 12 }}>
            {totalCheck}
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
