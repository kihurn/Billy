```
██████╗ ██╗██╗     ██╗  ██╗   ██╗
██╔══██╗██║██║     ██║  ╚██╗ ██╔╝
██████╔╝██║██║     ██║   ╚████╔╝ 
██╔══██╗██║██║     ██║    ╚██╔╝  
██████╔╝██║███████╗███████╗██║   
╚═════╝ ╚═╝╚══════╝╚══════╝╚═╝   
                                 
```

Snap a receipt → the AI (Qwen3-VL on your C0RE server) reads the items → add the people at the table →
tick who had what → everyone's share, with service charge / SST / alcohol tax split fairly.

**Stack:** React + Vite (on Vercel) · Supabase (database, anonymous auth, Edge Function) · C0RE → Ollama `qwen3-vl:8b-instruct`

```
Phone (React on Vercel) ──► Supabase Edge Function "scan-receipt" ──► C0RE (your desktop) ──► Ollama
                         └─► Supabase Postgres "bills" table (saved bills)
```

The C0RE API key lives **only** in Supabase secrets. It is never in this repo or in the browser.

## How the split works

- Items ticked by several people are split evenly between them.
- A line like "2× Teh Tarik" can be split into separate lines so each person ticks their own.
- Charges use the **amount printed on the receipt**, split by each person's share of the items:
  - "Shared by everyone" (service charge, SST/GST, rounding, discounts) → by share of all items.
  - "Only people who had alcohol" (alcohol tax) → by share of alcohol items only.
- Everything is in whole sen, and leftover sen are handed out so the shares add up to the receipt exactly.

## Setup

### 1. Supabase

1. Create a project at supabase.com.
2. **Authentication → Sign In / Providers → turn on "Allow anonymous sign-ins".**
   (Each phone gets a silent anonymous account so its saved bills are private.)
3. Install the CLI (`npm i -g supabase`), then from this folder:

```bash
supabase login
supabase link --project-ref <your-project-ref>
supabase db push
supabase secrets set C0RE_URL=<your C0RE public URL> C0RE_API_KEY=<your C0RE key>
supabase functions deploy scan-receipt
```

Or without the CLI: paste `supabase/migrations/*.sql` into the SQL Editor, create the Edge Function
`scan-receipt` from `supabase/functions/scan-receipt/index.ts` (with "Verify JWT" **off**; the function checks
the user itself), and add the two secrets under Edge Functions → Secrets.

### 2. Run locally

```bash
cp .env.example .env.local   # fill in your Supabase URL + publishable key
npm install
npm run dev
```

### 3. Vercel

Import the GitHub repo in Vercel (it detects Vite automatically), add `NEXT_PUBLIC_SUPABASE_URL` and
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` under Settings → Environment Variables, and deploy.
(`VITE_` names work too.) Never add the Supabase **secret** key (`sb_secret_...`); the app doesn't use it.

### 4. Keep-alive (optional but recommended)

Free Supabase projects pause after about a week without activity. `vercel.json` schedules a daily Vercel cron
that calls `/api/keep-alive`, which runs the tiny `keep_alive()` database function. It uses the same two
`NEXT_PUBLIC_SUPABASE_*` variables. To stop strangers calling it, add a `CRON_SECRET` environment variable in
Vercel (any long random string); Vercel's cron sends it automatically.

## Tests

```bash
npm test
```

## Files

| Path | What it does |
| --- | --- |
| `src/lib/split.ts` | The money maths (with tests in `split.test.ts`) |
| `src/lib/scan.ts`, `src/lib/image.ts` | Shrinks the photo to ~1600 px JPEG and sends it to the edge function |
| `src/lib/bills.ts` | Save / list / delete bills in Supabase |
| `src/steps/*` | One screen per step: Home → Scan → Review → People → Who had what → Split |
| `src/styles.css` | Monotone "Smoke" glass theme; VT323 titles and money, Geist Mono text |
| `supabase/functions/scan-receipt` | Calls C0RE with a JSON schema, cleans up the answer, friendly errors |
| `supabase/migrations` | `bills` and `friends` tables with row-level security, plus `keep_alive()` |
| `src/lib/charges.ts` | Works out % charges (service, SST) from each person's own food |
| `api/keep-alive.ts`, `vercel.json` | Daily ping so Supabase never pauses |
