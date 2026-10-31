import { useEffect, useState } from 'react'
import { centsToInput, parseMoney } from '../lib/money'

interface Props {
  cents: number | null
  onChange: (cents: number | null) => void
  allowEmpty?: boolean
  placeholder?: string
  label: string
}

// Keeps the typed text locally and only commits a parsed value on blur,
// so "12." doesn't get rewritten to "12.00" mid-typing.
export function MoneyInput({ cents, onChange, allowEmpty, placeholder = '0.00', label }: Props) {
  const [text, setText] = useState(cents == null ? '' : centsToInput(cents))

  useEffect(() => {
    setText(cents == null ? '' : centsToInput(cents))
  }, [cents])

  function commit() {
    const parsed = parseMoney(text)
    if (parsed == null && !allowEmpty) {
      setText(cents == null ? '' : centsToInput(cents))
      return
    }
    onChange(parsed)
    setText(parsed == null ? '' : centsToInput(parsed))
  }

  return (
    <input
      className="input input-money"
      inputMode="decimal"
      aria-label={label}
      placeholder={placeholder}
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
    />
  )
}
