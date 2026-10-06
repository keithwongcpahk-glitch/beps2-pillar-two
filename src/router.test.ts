import { describe, expect, it } from 'vitest'
import { href, parseHash } from './router'

describe('hash router', () => {
  it('parses page and sub-route, falling back to home', () => {
    expect(parseHash('#/updates')).toEqual({ page: 'updates', sub: null })
    expect(parseHash('#/jurisdictions/jp')).toEqual({ page: 'jurisdictions', sub: 'jp' })
    expect(parseHash('')).toEqual({ page: 'home', sub: null })
    expect(parseHash('#/scenarios')).toEqual({ page: 'scenarios', sub: null })
    expect(parseHash('#/changes')).toEqual({ page: 'changes', sub: null })
    expect(parseHash('#/group')).toEqual({ page: 'group', sub: null })
    expect(parseHash('#/nope')).toEqual({ page: 'home', sub: null })
    expect(href('jurisdictions', 'calendar')).toBe('#/jurisdictions/calendar')
  })
})
