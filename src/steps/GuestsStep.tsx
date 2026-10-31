import { useState } from 'react'
import { BottomBar } from '../components/BottomBar'
import { CloseIcon, PlusIcon } from '../components/Icons'
import type { StepProps } from './props'

export function GuestsStep({ bill, update, onNext }: StepProps) {
  const [name, setName] = useState('')

  function add() {
    const trimmed = name.trim()
    if (!trimmed) return
    update((b) => ({ ...b, guests: [...b.guests, { id: crypto.randomUUID(), name: trimmed }] }))
    setName('')
  }

  const remove = (id: string) =>
    update((b) => ({
      ...b,
      guests: b.guests.filter((g) => g.id !== id),
      assignments: Object.fromEntries(
        Object.entries(b.assignments).map(([itemId, ids]) => [itemId, ids.filter((g) => g !== id)]),
      ),
    }))

  return (
    <div className="screen">
      <div className="glass">
        <div className="section-head">
          <h2>Who’s at the table?</h2>
          <span className="small">{bill.guests.length} added</span>
        </div>
        <form
          className="row"
          style={{ padding: 6 }}
          onSubmit={(e) => {
            e.preventDefault()
            add()
          }}
        >
          <input
            className="input input-bare grow"
            placeholder="Name"
            aria-label="Guest name"
            autoFocus
            enterKeyHint="done"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <button className="btn btn-small" type="submit" disabled={!name.trim()}>
            <PlusIcon /> Add
          </button>
        </form>

        {bill.guests.length > 0 && (
          <div className="chips" style={{ marginTop: 14 }}>
            {bill.guests.map((g) => (
              <span key={g.id} className="chip" style={{ paddingRight: 4, cursor: 'default' }}>
                {g.name}
                <button className="icon-btn" style={{ width: 30, height: 30 }} aria-label={`Remove ${g.name}`} onClick={() => remove(g.id)}>
                  <CloseIcon />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      <BottomBar>
        <button className="btn btn-primary btn-block" disabled={bill.guests.length === 0} onClick={onNext}>
          Choose who had what
        </button>
      </BottomBar>
    </div>
  )
}
