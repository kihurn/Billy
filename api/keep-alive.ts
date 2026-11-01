// Called once a day by the Vercel cron in vercel.json. Free Supabase projects pause after
// about a week without activity; one tiny database call a day keeps billy-db awake.
export async function GET(request: Request): Promise<Response> {
  // If CRON_SECRET is set in Vercel, only Vercel's cron (which sends it) may call this.
  const secret = process.env.CRON_SECRET
  if (secret && request.headers.get('authorization') !== `Bearer ${secret}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.VITE_SUPABASE_ANON_KEY
  if (!url || !key) return Response.json({ ok: false, error: 'Supabase env vars missing' }, { status: 500 })

  const res = await fetch(`${url}/rest/v1/rpc/keep_alive`, {
    method: 'POST',
    headers: { apikey: key, 'Content-Type': 'application/json' },
    body: '{}',
  })
  const body = await res.text()
  return Response.json({ ok: res.ok, status: res.status, database_time: body }, { status: res.ok ? 200 : 502 })
}
