import { createClient } from '@supabase/supabase-js'

const env = import.meta.env

export const SUPABASE_URL = (env.NEXT_PUBLIC_SUPABASE_URL ?? env.VITE_SUPABASE_URL) as string | undefined
// The publishable key (sb_publishable_...) or the legacy anon key. Both are safe in the browser.
export const SUPABASE_ANON_KEY = (env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  env.VITE_SUPABASE_ANON_KEY) as string | undefined

export const isConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY)

export const supabase = createClient(
  SUPABASE_URL ?? 'http://localhost',
  SUPABASE_ANON_KEY ?? 'missing',
)

let signingIn: Promise<string> | null = null

// Each device gets a silent anonymous account so bills are private to it.
export async function ensureSession(): Promise<string> {
  const { data } = await supabase.auth.getSession()
  if (data.session) return data.session.access_token

  // Share one sign-in between concurrent callers so we don't create two users.
  signingIn ??= supabase.auth.signInAnonymously().then(({ data: signedIn, error }) => {
    signingIn = null
    if (error || !signedIn.session) throw new Error(error?.message ?? 'Could not start a session.')
    return signedIn.session.access_token
  })
  return signingIn
}
