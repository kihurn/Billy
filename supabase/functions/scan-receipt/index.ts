// Receives a receipt photo from the app, asks Qwen3-VL (via C0RE) to read it,
// and returns clean JSON. The C0RE key never leaves this function.
import { createClient } from 'npm:@supabase/supabase-js@2.45.4'

const MODEL = 'qwen3-vl:8b-instruct'
const C0RE_BUDGET_MS = 60_000 // for all attempts together
const RETRY_MIN_MS = 25_000 // only retry if at least this much budget is left
const MAX_IMAGE_CHARS = 7_500_000 // ~5.6 MB of JPEG; C0RE caps requests at 8 MB

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const RECEIPT_SCHEMA = {
  type: 'object',
  properties: {
    merchant: { type: 'string' },
    currency: { type: 'string' },
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          quantity: { type: 'number' },
          total_price: { type: 'number' },
          is_alcohol: { type: 'boolean' },
        },
        required: ['name', 'quantity', 'total_price', 'is_alcohol'],
      },
    },
    charges: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          label: { type: 'string' },
          amount: { type: 'number' },
          applies_to: { type: 'string', enum: ['all', 'alcohol'] },
        },
        required: ['label', 'amount', 'applies_to'],
      },
    },
    subtotal: { type: ['number', 'null'] },
    total: { type: ['number', 'null'] },
  },
  required: ['merchant', 'currency', 'items', 'charges', 'subtotal', 'total'],
}

const PROMPT = `You are reading a photo of a restaurant receipt. Extract it as JSON.

merchant: the restaurant name, or "" if not visible.
currency: the currency printed (e.g. "RM", "$", "SGD"). Use "RM" if none is shown.

items: one entry per PRICED line in the item list.
- quantity = the number at the START of the line (1 if there is none).
- name = the item name as printed, without that leading quantity. Numbers inside the name stay in the name:
  in "14 Sushi 2.80   39.20" the quantity is 14, the name is "Sushi 2.80" and total_price is 39.20.
- total_price = the amount in the right-hand price column on that line (the line total), as a plain number.
- Lines with NO amount in the price column are not items: indented sub-lines, set or tower contents
  (e.g. "2 Tiger" under "Tiger Twin Tower"), modifiers and notes. Skip them.
- Read every line down to the subtotal. Do not stop early, merge lines or invent lines.
- is_alcohol = true for beer, towers or buckets of beer, wine, spirits, cocktails (e.g. Long Island Tea, mojito),
  sake, soju and liquor; otherwise false.

subtotal: the printed subtotal, or null if there is none.

charges: every amount added or removed after the subtotal, using the AMOUNT printed (not the percentage):
service charge, SST, GST, VAT, service tax, alcohol tax, rounding adjustment, discounts.
- Discounts and negative rounding are negative numbers; a positive rounding adjustment stays positive.
- applies_to = "alcohol" only for a tax that applies just to alcohol; otherwise "all".
- Never include subtotal, total, cash, change, payment or tax-summary rows as charges.

total: the final amount payable, or null if not visible.

Check before answering: the items' total_price values should add up to the subtotal.`

// Backup for the model's is_alcohol, which sometimes misses cocktails and beer brands.
const ALCOHOL =
  /\b(beer|lager|stout|cider|tiger(?!\s*(prawns?|shrimps?))|heineken|carlsberg|guinness|asahi|kirin|sapporo|hoegaarden|wine|soju|whisk(e)?y|vodka|gin|rum|tequila|brandy|bourbon|champagne|prosecco|cocktail|long island|mojito|margarita|martini|negroni|sangria|highball)s?\b/i

const NOT_CHARGE = /sub\s*-?\s*total|grand\s*total|^total|cash|change|tender|paid|payment|visa|master|card/i

// Friendly messages for the error codes C0RE returns.
const C0RE_MESSAGES: Record<string, [number, string]> = {
  engine_offline: [503, 'The AI server is offline right now. Enter the items manually, or try again later.'],
  rate_limited: [429, 'Too many scans in a short time. Wait a minute and try again.'],
  invalid_key: [502, 'The scanner isn’t set up correctly (C0RE key rejected).'],
  key_disabled: [502, 'The scanner’s C0RE key has been disabled.'],
  key_not_public: [502, 'The scanner’s C0RE key needs reach set to Public.'],
  body_too_large: [413, 'That photo is too large. Try again with a smaller photo.'],
  model_missing: [502, `The AI server doesn’t have ${MODEL} installed.`],
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function fail(status: number, code: string, message: string) {
  return json({ error: { code, message } }, status)
}

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null)
const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '')

// The model is usually right, but never trust its output blindly.
function normalize(raw: any) {
  const items = (Array.isArray(raw?.items) ? raw.items : [])
    .map((it: any) => ({
      name: str(it?.name),
      quantity: Math.max(1, Math.round(num(it?.quantity) ?? 1)),
      total_price: num(it?.total_price),
      is_alcohol: it?.is_alcohol === true || ALCOHOL.test(str(it?.name)),
    }))
    // Zero-priced lines are set contents or notes (e.g. "2 Tiger" inside a tower), not things to split.
    .filter((it: any) => it.name && it.total_price !== null && it.total_price !== 0)

  const charges = (Array.isArray(raw?.charges) ? raw.charges : [])
    .map((c: any) => ({
      label: str(c?.label) || 'Charge',
      amount: num(c?.amount),
      applies_to: c?.applies_to === 'alcohol' ? 'alcohol' : 'all',
    }))
    .filter((c: any) => c.amount !== null && c.amount !== 0 && !NOT_CHARGE.test(c.label))

  return {
    merchant: str(raw?.merchant),
    currency: str(raw?.currency) || 'RM',
    items,
    charges,
    subtotal: num(raw?.subtotal),
    total: num(raw?.total),
  }
}

type Receipt = ReturnType<typeof normalize>

const cents = (n: number) => Math.round(n * 100)
const itemsSum = (r: Receipt) => r.items.reduce((a: number, i: any) => a + cents(i.total_price), 0)

// How far the items are from what the receipt says they should add up to (in cents), or null if unknown.
function itemsGap(r: Receipt): number | null {
  if (r.subtotal !== null) return cents(r.subtotal) - itemsSum(r)
  if (r.total === null) return null
  const charges = r.charges.reduce((a: number, c: any) => a + cents(c.amount), 0)
  return cents(r.total) - charges - itemsSum(r)
}

function retryPrompt(r: Receipt): string {
  const sum = (itemsSum(r) / 100).toFixed(2)
  const expected = r.subtotal === null ? 'that doesn’t match the total' : `the printed subtotal is ${r.subtotal.toFixed(2)}`
  return (
    `Your items add up to ${sum}, but ${expected}. Look at the receipt again, line by line: ` +
    'the quantity at the start of each line, the amount in the right-hand price column, the last lines before ' +
    'the subtotal, and sub-lines with no price (skip those). Reply with the corrected, complete JSON.'
  )
}

type Message = { role: 'user' | 'assistant'; content: string; images?: string[] }
type Attempt = { ok: true; content: string } | { ok: false; response: Response }

async function askC0RE(url: string, key: string, messages: Message[], timeoutMs: number): Promise<Attempt> {
  let res: Response
  try {
    res = await fetch(`${url.replace(/\/$/, '')}/api/chat`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: MODEL, stream: false, format: RECEIPT_SCHEMA, options: { temperature: 0 }, messages }),
      signal: AbortSignal.timeout(timeoutMs),
    })
  } catch (err) {
    const timedOut = err instanceof DOMException && err.name === 'TimeoutError'
    return {
      ok: false,
      response: timedOut
        ? fail(503, 'timeout', 'The AI took too long to read the receipt. Try again, or enter the items manually.')
        : fail(503, 'engine_unreachable', 'Couldn’t reach the AI server (is the desktop on?). Enter the items manually for now.'),
    }
  }
  const data = await res.json().catch(() => null)
  if (!res.ok) {
    const code: string = data?.error?.code ?? 'c0re_error'
    const [status, message] = C0RE_MESSAGES[code] ?? [502, data?.error?.message ?? `AI server error (${res.status}).`]
    console.error('C0RE error', res.status, code, data?.error?.message)
    return { ok: false, response: fail(status, code, message) }
  }
  return { ok: true, content: data?.message?.content ?? '' }
}

function parse(content: string): Receipt | null {
  try {
    return normalize(JSON.parse(content))
  } catch {
    return null
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return fail(405, 'method_not_allowed', 'Use POST.')

  // Only signed-in users of this app (anonymous accounts count) may use the GPU.
  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '')
  if (!token) return fail(401, 'unauthorized', 'Please reload the app and try again.')
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!)
  const { data: userData, error: authError } = await supabase.auth.getUser(token)
  if (authError || !userData.user) {
    return fail(401, 'unauthorized', 'Please reload the app and try again.')
  }

  // Accept both spellings: C0RE (zero) and CORE (letter O).
  const c0reUrl = Deno.env.get('C0RE_URL') ?? Deno.env.get('CORE_URL')
  const c0reKey = Deno.env.get('C0RE_API_KEY') ?? Deno.env.get('CORE_API_KEY')
  if (!c0reUrl || !c0reKey) {
    return fail(500, 'not_configured', 'The scanner isn’t set up yet (missing C0RE secrets).')
  }

  const body = await req.json().catch(() => null)
  const image = typeof body?.image === 'string' ? body.image.replace(/^data:[^,]*,/, '') : ''
  if (!image) return fail(400, 'no_image', 'No photo was sent.')
  if (image.length > MAX_IMAGE_CHARS) {
    return fail(413, 'body_too_large', C0RE_MESSAGES.body_too_large[1])
  }

  const started = Date.now()
  const remaining = () => C0RE_BUDGET_MS - (Date.now() - started)
  const first: Message[] = [{ role: 'user', content: PROMPT, images: [image] }]

  const attempt = await askC0RE(c0reUrl, c0reKey, first, remaining())
  if (!attempt.ok) return attempt.response
  let receipt = parse(attempt.content)
  if (!receipt) return fail(502, 'bad_output', 'The AI’s answer couldn’t be read. Try scanning again.')

  // Self-check: if the items don't add up to the printed subtotal, ask once more and keep the better answer.
  const gap = itemsGap(receipt)
  if (gap !== null && gap !== 0 && remaining() > RETRY_MIN_MS) {
    const followUp: Message[] = [
      ...first,
      { role: 'assistant', content: attempt.content },
      { role: 'user', content: retryPrompt(receipt) },
    ]
    const retry = await askC0RE(c0reUrl, c0reKey, followUp, remaining())
    const second = retry.ok ? parse(retry.content) : null
    const secondGap = second ? itemsGap(second) : null
    if (second && secondGap !== null && Math.abs(secondGap) < Math.abs(gap)) receipt = second
    console.log('self-check retry', { gap, secondGap, kept: receipt === second ? 'second' : 'first' })
  }

  if (receipt.items.length === 0) {
    return fail(422, 'no_items', 'Couldn’t find any items on that photo. Try a clearer, straighter photo.')
  }
  return json({ receipt })
})
