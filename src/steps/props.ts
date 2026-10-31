import type { Bill } from '../lib/types'

export interface StepProps {
  bill: Bill
  update: (fn: (bill: Bill) => Bill) => void
  onNext: () => void
}
