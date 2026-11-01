import { useEffect, useRef, useState } from 'react'
import { BackIcon } from './components/Icons'
import { newBill, saveBill, type SavedBill } from './lib/bills'
import { isConfigured } from './lib/supabase'
import type { Bill } from './lib/types'
import { AssignStep } from './steps/AssignStep'
import { GuestsStep } from './steps/GuestsStep'
import { HomeStep } from './steps/HomeStep'
import { ReviewStep } from './steps/ReviewStep'
import { ScanStep } from './steps/ScanStep'
import { SummaryStep } from './steps/SummaryStep'

const STEPS = [
  { key: 'scan', title: 'Scan receipt', Component: ScanStep },
  { key: 'review', title: 'Check items', Component: ReviewStep },
  { key: 'guests', title: 'People', Component: GuestsStep },
  { key: 'assign', title: 'Who had what', Component: AssignStep },
  { key: 'summary', title: 'The split', Component: SummaryStep },
] as const

const SUMMARY = STEPS.length - 1
const REVIEW = 1
const AUTOSAVE_MS = 800

function Backdrop() {
  return (
    <div className="backdrop" aria-hidden>
      <span />
      <span />
      <span />
    </div>
  )
}

export default function App() {
  const [bill, setBill] = useState<Bill | null>(null)
  const [step, setStep] = useState(0)

  const goBack = () => (step === 0 ? setBill(null) : setStep(step - 1))
  const goNext = () => {
    if (step === SUMMARY) return setBill(null)
    if (step + 1 === SUMMARY) setBill((b) => (b ? { ...b, finished: true } : b))
    setStep(step + 1)
  }

  // Save as you go, so a locked phone or a closed app never loses a half-split bill.
  useEffect(() => {
    if (!bill || bill.items.length === 0) return
    const timer = setTimeout(() => {
      saveBill({ ...bill, lastStep: step }).catch(() => {
        // Offline or similar: the next change tries again, and the split screen shows the status.
      })
    }, AUTOSAVE_MS)
    return () => clearTimeout(timer)
  }, [bill, step])

  // iPhone back swipe / browser back: while a bill is open we keep one extra history entry,
  // so going "back" steps back inside Billy instead of leaving the app.
  const guarded = useRef(false)
  const skipNextPop = useRef(false)
  const backRef = useRef(goBack)
  backRef.current = goBack

  useEffect(() => {
    if (bill && !guarded.current) {
      history.pushState({ billy: 'guard' }, '')
      guarded.current = true
    } else if (!bill && guarded.current) {
      guarded.current = false
      skipNextPop.current = true
      history.back() // drop the guard we left behind
    }
  }, [bill, step])

  useEffect(() => {
    const onPop = () => {
      if (skipNextPop.current) {
        skipNextPop.current = false
        return
      }
      if (!guarded.current) return // on the home page: let the browser leave as normal
      guarded.current = false // the swipe used up the guard; the effect above adds a new one
      backRef.current()
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  function openSaved(saved: SavedBill) {
    const finished = !saved.is_draft
    setBill({ ...saved.data, finished })
    setStep(finished ? SUMMARY : Math.min(saved.data.lastStep ?? REVIEW, SUMMARY - 1))
  }

  if (!isConfigured) {
    return (
      <div className="app">
        <Backdrop />
        <div className="screen">
          <div className="notice notice-bad">
            Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY. Add them to .env.local (or
            Vercel’s environment variables) and redeploy.
          </div>
        </div>
      </div>
    )
  }

  if (!bill) {
    return (
      <div className="app">
        <Backdrop />
        <HomeStep
          onNew={() => {
            setBill(newBill())
            setStep(0)
          }}
          onOpen={openSaved}
        />
      </div>
    )
  }

  const { key, title, Component } = STEPS[step]

  return (
    <div className="app">
      <Backdrop />
      <header className="topbar">
        <div className="topbar-row">
          <button className="icon-btn" aria-label="Back" onClick={goBack}>
            <BackIcon />
          </button>
          <div className="topbar-title">{title}</div>
          <div className="topbar-step">
            {step + 1} / {STEPS.length}
          </div>
        </div>
        <div className="progress">
          <div style={{ transform: `scaleX(${(step + 1) / STEPS.length})` }} />
        </div>
      </header>
      <Component key={key} bill={bill} update={(fn) => setBill((b) => (b ? fn(b) : b))} onNext={goNext} />
    </div>
  )
}
