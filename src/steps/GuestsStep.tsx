import { useEffect, useState } from 'react'
import { BottomBar } from '../components/BottomBar'
import { CloseIcon, PlusIcon } from '../components/Icons'
import { deleteFriend, listFriends, markFriendUsed, saveFriend, sameName, type Friend } from '../lib/friends'
import type { Bill } from '../lib/types'
import type { StepProps } from './props'

function withoutGuest(b: Bill, guestId: string): Bill {
  return {
    ...b,
    guests: b.guests.filter((g) => g.id !== guestId),
    assignments: Object.fromEntries(
      Object.entries(b.assignments).map(([itemId, ids]) => [itemId, ids.filter((g) => g !== guestId)]),
    ),
  }
}

export function GuestsStep({ bill, update, onNext }: StepProps) {
  const [name, setName] = useState('')
  const [saveToFriends, setSaveToFriends] = useState(true)
  const [friends, setFriends] = useState<Friend[] | null>(null)
  const [friendsError, setFriendsError] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)

  useEffect(() => {
    listFriends()
      .then(setFriends)
      .catch((e: Error) => setFriendsError(e.message))
  }, [])

  const guestNamed = (n: string) => bill.guests.find((g) => sameName(g.name, n))

  const addGuest = (n: string) => {
    if (guestNamed(n)) return
    update((b) => ({ ...b, guests: [...b.guests, { id: crypto.randomUUID(), name: n }] }))
  }

  async function rememberFriend(n: string) {
    if (!saveToFriends || !friends || friends.some((f) => sameName(f.name, n))) return
    try {
      const friend = await saveFriend(n)
      setFriends((fs) => [friend, ...(fs ?? [])])
    } catch (e) {
      setFriendsError((e as Error).message)
    }
  }

  function addTyped() {
    const trimmed = name.trim()
    if (!trimmed) return
    addGuest(trimmed)
    void rememberFriend(trimmed)
    setName('')
  }

  function toggleFriend(friend: Friend) {
    const guest = guestNamed(friend.name)
    if (guest) {
      update((b) => withoutGuest(b, guest.id))
      return
    }
    addGuest(friend.name)
    markFriendUsed(friend.id).catch(() => {
      // Only affects ordering; safe to ignore.
    })
  }

  async function forget(friend: Friend) {
    try {
      await deleteFriend(friend.id)
      setFriends((fs) => fs?.filter((f) => f.id !== friend.id) ?? null)
    } catch (e) {
      setFriendsError((e as Error).message)
    }
  }

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
            addTyped()
          }}
        >
          <input
            className="input input-bare grow"
            placeholder="Name"
            aria-label="Guest name"
            enterKeyHint="done"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <button className="btn btn-small" type="submit" disabled={!name.trim()}>
            <PlusIcon /> Add
          </button>
        </form>
        <button
          className="toggle"
          style={{ marginTop: 10 }}
          aria-pressed={saveToFriends}
          onClick={() => setSaveToFriends((v) => !v)}
        >
          {saveToFriends ? 'Saving new names to friends' : 'Not saving to friends'}
        </button>

        {bill.guests.length > 0 && (
          <div className="chips" style={{ marginTop: 14 }}>
            {bill.guests.map((g) => (
              <span key={g.id} className="chip" style={{ paddingRight: 4, cursor: 'default' }}>
                {g.name}
                <button
                  className="icon-btn"
                  style={{ width: 30, height: 30 }}
                  aria-label={`Remove ${g.name}`}
                  onClick={() => update((b) => withoutGuest(b, g.id))}
                >
                  <CloseIcon />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="glass">
        <div className="section-head">
          <h2>Friends</h2>
          {friends && friends.length > 0 && (
            <button className="btn btn-small btn-ghost" style={{ minHeight: 28 }} onClick={() => setEditing((v) => !v)}>
              {editing ? 'Done' : 'Edit'}
            </button>
          )}
        </div>
        {friendsError && <div className="notice notice-bad">Couldn’t load friends: {friendsError}</div>}
        {!friendsError && friends === null && <p className="small">Loading…</p>}
        {friends?.length === 0 && (
          <p className="small" style={{ margin: 0 }}>
            People you add are saved here, so next time it’s one tap.
          </p>
        )}
        {friends && friends.length > 0 && (
          <div className="chips">
            {friends.map((f) =>
              editing ? (
                <button key={f.id} className="chip" aria-label={`Forget ${f.name}`} onClick={() => void forget(f)}>
                  {f.name}
                  <CloseIcon />
                </button>
              ) : (
                <button key={f.id} className="chip" aria-pressed={Boolean(guestNamed(f.name))} onClick={() => toggleFriend(f)}>
                  {f.name}
                </button>
              ),
            )}
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
