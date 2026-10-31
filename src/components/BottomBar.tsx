import type { ReactNode } from 'react'

export function BottomBar({ note, children }: { note?: ReactNode; children: ReactNode }) {
  return (
    <div className="bottombar">
      <div className="bottombar-inner">
        {note != null && <div className="bottombar-note">{note}</div>}
        {children}
      </div>
    </div>
  )
}
