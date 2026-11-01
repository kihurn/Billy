import { describe, expect, it } from 'vitest'
import { sameName } from './friends'

describe('sameName', () => {
  it('ignores case and surrounding spaces', () => {
    expect(sameName('KH', ' kh ')).toBe(true)
  })

  it('tells different names apart', () => {
    expect(sameName('KH', 'WW')).toBe(false)
  })
})
