import { useEffect, useState } from 'react'

interface Props {
  rate: number // 0.1 for 10%
  onChange: (rate: number) => void
  label: string
}

const toText = (rate: number) => String(Math.round(rate * 10000) / 100)

// Like MoneyInput: keeps the typed text and only commits a parsed rate on blur.
export function PercentInput({ rate, onChange, label }: Props) {
  const [text, setText] = useState(toText(rate))

  useEffect(() => {
    setText(toText(rate))
  }, [rate])

  function commit() {
    const value = Number(text.replace(/[^0-9.]/g, ''))
    if (!Number.isFinite(value) || value < 0 || value > 100) {
      setText(toText(rate))
      return
    }
    onChange(Math.round(value * 100) / 10000)
  }

  return (
    <span className="input-percent">
      <input
        className="input input-money"
        inputMode="decimal"
        aria-label={label}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
      />
      <span aria-hidden>%</span>
    </span>
  )
}
