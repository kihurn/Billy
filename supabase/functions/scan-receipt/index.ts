// Receives a receipt photo from the app, asks Qwen3-VL (via C0RE) to read it,
// and returns clean JSON. The C0RE key never leaves this function.
import { createClient } from 'npm:@supabase/supabase-js@2.45.4'

const MODEL = 'qwen3-vl:8b-instruct'
const C0RE_TIMEOUT_MS = 60_000
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
    total: { type: ['number', 'null'] },
  },
  required: ['merchant', 'currency', 'items', 'charges', 'total'],
}

const PROMPT = `You are reading a restaurant receipt. Extract it as JSON.

- merchant: the restaurant name, or "" if not visible.
- currency: the currency symbol or code printed (e.g. "RM", "$", "SGD"). Use "RM" if none is shown.
- items: every food or drink line. name = item name as printed. quantity = the quantity (1 if not shown).
  total_price = the LINE TOTAL for that row (quantity x unit price), as a number with no currency symbol.
  is_alcohol = true for beer, wine, spirits, cocktails, sake, soju, liquor; otherwise false.
  Do not include subtotal, total, payment, cash, change or tax rows as items.
- charges: every extra amount added or removed after the items, using the AMOUNT printed (not the percentage):
  service charge, SST, GST, VAT, service tax, alcohol tax, rounding adjustment, discounts.
  Discounts and negative rounding must be negative numbers.
  applies_to = "alcohol" only for a tax that applies just to alcohol; otherwise "all".
  Never include subtotal, total, cash, change or payment rows as charges.
- total: the final amount payable printed on the receipt, or null if not visible.

Read numbers exactly as printed. Do not invent items.`

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
      is_alcohol: it?.is_alcohol === true,
    }))
    .filter((it: any) => it.name && it.total_price !== null)

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
    total: num(raw?.total),
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

  const c0reUrl = Deno.env.get('C0RE_URL')
  const c0reKey = Deno.env.get('C0RE_API_KEY')
  if (!c0reUrl || !c0reKey) {
    return fail(500, 'not_configured', 'The scanner isn’t set up yet (missing C0RE secrets).')
  }

  const body = await req.json().catch(() => null)
  const image = typeof body?.image === 'string' ? body.image.replace(/^data:[^,]*,/, '') : ''
  if (!image) return fail(400, 'no_image', 'No photo was sent.')
  if (image.length > MAX_IMAGE_CHARS) {
    return fail(413, 'body_too_large', C0RE_MESSAGES.body_too_large[1])
  }

  let res: Response
  try {
    res = await fetch(`${c0reUrl.replace(/\/$/, '')}/api/chat`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${c0reKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: MODEL,
        stream: false,
        format: RECEIPT_SCHEMA,
        options: { temperature: 0 },
        messages: [{ role: 'user', content: PROMPT, images: [image] }],
      }),
      signal: AbortSignal.timeout(C0RE_TIMEOUT_MS),
    })
  } catch (err) {
    const timedOut = err instanceof DOMException && err.name === 'TimeoutError'
    return fail(
      503,
      timedOut ? 'timeout' : 'engine_unreachable',
      timedOut
        ? 'The AI took too long to read the receipt. Try again, or enter the items manually.'
        : 'Couldn’t reach the AI server (is the desktop on?). Enter the items manually for now.',
    )
  }

  const data = await res.json().catch(() => null)
  if (!res.ok) {
    const code: string = data?.error?.code ?? 'c0re_error'
    const [status, message] = C0RE_MESSAGES[code] ?? [502, data?.error?.message ?? `AI server error (${res.status}).`]
    console.error('C0RE error', res.status, code, data?.error?.message)
    return fail(status, code, message)
  }

  try {
    const receipt = normalize(JSON.parse(data?.message?.content ?? ''))
    if (receipt.items.length === 0) {
      return fail(422, 'no_items', 'Couldn’t find any items on that photo. Try a clearer, straighter photo.')
    }
    return json({ receipt })
  } catch {
    return fail(502, 'bad_output', 'The AI’s answer couldn’t be read. Try scanning again.')
  }
})
