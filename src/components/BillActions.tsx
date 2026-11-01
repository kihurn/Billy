import { useEffect, useState } from 'react'
import type { SavedBill } from '../lib/bills'

interface Props {
  bill: SavedBill
  onClose: () => void
  onRename: (title: string) => void
  onTogglePin: () => void
  onDelete: () => void
}

// Bottom sheet with the actions for one saved bill.
export function BillActions({ bill, onClose, onRename, onTogglePin, onDelete }: Props) {
  const [renaming, setRenaming] = useState(false)
  const [title, setTitle] = useState(bill.title)
  const [deleteArmed, setDeleteArmed] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <>
      <button className="sheet-scrim" aria-label="Close" onClick={onClose} />
      <div className="sheet" role="dialog" aria-label={`Actions for ${bill.title || 'this bill'}`}>
        <div className="sheet-handle" />
        {renaming ? (
          <form
            className="stack"
            onSubmit={(e) => {
              e.preventDefault()
              if (title.trim()) onRename(title.trim())
            }}
          >
            <h2>Rename bill</h2>
            <input
              className="input"
              aria-label="Bill name"
              autoFocus
              enterKeyHint="done"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <button className="btn btn-primary btn-block" type="submit" disabled={!title.trim()}>
              Save
            </button>
            <button className="btn btn-ghost btn-block" type="button" onClick={() => setRenaming(false)}>
              Back
            </button>
          </form>
        ) : (
          <div className="stack">
            <h2 className="ellipsis">{bill.title || 'Untitled bill'}</h2>
            <button className="btn btn-block sheet-action" onClick={() => setRenaming(true)}>
              Rename
            </button>
            <button className="btn btn-block sheet-action" onClick={onTogglePin}>
              {bill.pinned ? 'Unpin' : 'Pin to top'}
            </button>
            <button
              className={`btn btn-block sheet-action${deleteArmed ? ' sheet-danger' : ''}`}
              onClick={() => (deleteArmed ? onDelete() : setDeleteArmed(true))}
            >
              {deleteArmed ? 'Tap again to delete' : 'Delete'}
            </button>
            <button className="btn btn-ghost btn-block" onClick={onClose}>
              Cancel
            </button>
          </div>
        )}
      </div>
    </>
  )
}
