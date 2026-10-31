import { useState } from 'react'
import { BackIcon } from './components/Icons'
import { newBill } from './lib/bills'
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
          onOpen={(saved) => {
            setBill(saved)
            setStep(SUMMARY)
          }}
        />
      </div>
    )
  }

  const { key, title, Component } = STEPS[step]
  const goBack = () => (step === 0 ? setBill(null) : setStep(step - 1))
  const goNext = () => (step === SUMMARY ? setBill(null) : setStep(step + 1))

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
      <Component
        key={key}
        bill={bill}
        update={(fn) => setBill((b) => (b ? fn(b) : b))}
        onNext={goNext}
      />
    </div>
  )
}
