import { useLayoutEffect, useRef } from 'react'

interface Props {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  label: string
  className?: string
}

// A one-line text box that grows onto more lines when the text is long, instead of hiding it.
// Enter finishes editing rather than adding a line break.
export function GrowingInput({ value, onChange, placeholder, label, className = '' }: Props) {
  const ref = useRef<HTMLTextAreaElement>(null)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [value])

  return (
    <textarea
      ref={ref}
      rows={1}
      className={`input input-bare growing-input ${className}`}
      aria-label={label}
      placeholder={placeholder}
      enterKeyHint="done"
      value={value}
      onChange={(e) => onChange(e.target.value.replace(/\n/g, ' '))}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault()
          e.currentTarget.blur()
        }
      }}
    />
  )
}
