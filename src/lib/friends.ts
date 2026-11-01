import { ensureSession, supabase } from './supabase'

export interface Friend {
  id: string
  name: string
}

export function sameName(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase()
}

export async function listFriends(): Promise<Friend[]> {
  await ensureSession()
  const { data, error } = await supabase
    .from('friends')
    .select('id, name')
    .order('last_used_at', { ascending: false })
    .limit(100)
  if (error) throw new Error(error.message)
  return (data ?? []).filter((f) => typeof f?.name === 'string')
}

export async function saveFriend(name: string): Promise<Friend> {
  await ensureSession()
  const { data, error } = await supabase.from('friends').insert({ name: name.trim() }).select('id, name').single()
  if (error) throw new Error(error.message)
  if (typeof data?.name !== 'string') throw new Error('Unexpected reply while saving a friend.')
  return data
}

// Bumps a friend to the front of the list next time.
export async function markFriendUsed(id: string): Promise<void> {
  const { error } = await supabase.from('friends').update({ last_used_at: new Date().toISOString() }).eq('id', id)
  if (error) throw new Error(error.message)
}

export async function deleteFriend(id: string): Promise<void> {
  const { error } = await supabase.from('friends').delete().eq('id', id)
  if (error) throw new Error(error.message)
}
