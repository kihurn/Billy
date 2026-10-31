import { ensureSession, SUPABASE_ANON_KEY, SUPABASE_URL } from './supabase'
import type { ScannedReceipt } from './types'

const TIMEOUT_MS = 70_000 // edge function gives up on C0RE after 60s

export class ScanError extends Error {}

export async function scanReceipt(imageBase64: string): Promise<ScannedReceipt> {
  const token = await ensureSession()

  let res: Response
  try {
    res = await fetch(`${SUPABASE_URL}/functions/v1/scan-receipt`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: SUPABASE_ANON_KEY ?? '',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ image: imageBase64 }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
  } catch {
    throw new ScanError('Couldn’t reach the scanner. Check your connection, or enter the items manually.')
  }

  const data = await res.json().catch(() => null)
  if (!res.ok) {
    throw new ScanError(data?.error?.message ?? `Scanning failed (${res.status}).`)
  }
  return data.receipt as ScannedReceipt
}
