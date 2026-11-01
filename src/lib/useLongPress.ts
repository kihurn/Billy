import { useRef, type PointerEvent } from 'react'

const HOLD_MS = 450
const MOVE_TOLERANCE_PX = 10

// Press-and-hold on touch or mouse. A normal tap still clicks; a hold calls `onLongPress`
// and swallows the click that follows. Moving (scrolling) cancels the hold.
export function useLongPress(onLongPress: () => void) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const start = useRef<{ x: number; y: number } | null>(null)
  const fired = useRef(false)

  const cancel = () => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
    start.current = null
  }

  return {
    onPointerDown: (e: PointerEvent) => {
      fired.current = false
      start.current = { x: e.clientX, y: e.clientY }
      timer.current = setTimeout(() => {
        fired.current = true
        cancel()
        onLongPress()
      }, HOLD_MS)
    },
    onPointerMove: (e: PointerEvent) => {
      if (!start.current) return
      if (Math.hypot(e.clientX - start.current.x, e.clientY - start.current.y) > MOVE_TOLERANCE_PX) cancel()
    },
    onPointerUp: cancel,
    onPointerLeave: cancel,
    onPointerCancel: cancel,
    onClickCapture: (e: React.MouseEvent) => {
      if (fired.current) {
        e.preventDefault()
        e.stopPropagation()
        fired.current = false
      }
    },
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  }
}
