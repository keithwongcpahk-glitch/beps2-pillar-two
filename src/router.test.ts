import { describe, expect, it } from 'vitest'
import { href, parseHash } from './router'

describe('hash router', () => {
  it('parses page and sub-route, falling back to overview', () => {
    expect(parseHash('#/updates')).toEqual({ page: 'updates', sub: null })
    expect(parseHash('#/jurisdictions/jp')).toEqual({ page: 'jurisdictions', sub: 'jp' })
    expect(parseHash('')).toEqual({ page: 'overview', sub: null })
    expect(parseHash('#/nope')).toEqual({ page: 'overview', sub: null })
    expect(href('jurisdictions', 'calendar')).toBe('#/jurisdictions/calendar')
  })
})
