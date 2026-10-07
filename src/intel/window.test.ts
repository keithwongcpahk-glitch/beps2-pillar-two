import { describe, expect, it } from 'vitest'
import { beforeWindow, byDateDesc, calendarDateAt, filterByWindow, isInWindow, windowFor } from './window'
import { INTEL_ITEMS, INTEL_JURISDICTIONS, INTEL_META } from './types'
import { applyFilters, countByJurisdiction, distinctTopics, effectiveStatus, NO_FILTERS, parseStatusMap, setStatus } from './review'

describe('intel window helpers', () => {
  it('windowFor(2026-10-06, 30) spans 2026-09-06 → 2026-10-06', () => {
    expect(windowFor('2026-10-06', 30)).toEqual({ start: '2026-09-06', end: '2026-10-06' })
  })

  it('window bounds are inclusive', () => {
    const w = windowFor('2026-10-06', 30)
    expect(isInWindow('2026-09-06', w)).toBe(true)
    expect(isInWindow('2026-10-06', w)).toBe(true)
    expect(isInWindow('2026-09-05', w)).toBe(false)
    expect(isInWindow('2026-10-07', w)).toBe(false)
  })

  it('calendarDateAt uses HK (+08:00) calendar date by default', () => {
    expect(calendarDateAt('2026-10-05T18:30:00Z')).toBe('2026-10-06')
    expect(calendarDateAt('2026-10-06T11:30:00+08:00')).toBe('2026-10-06')
    expect(calendarDateAt('2026-10-05T18:30:00Z', 0)).toBe('2026-10-05')
  })

  it('filterByWindow returns newest first and beforeWindow returns the rest', () => {
    const items = [{ date: '2026-09-10' }, { date: '2026-10-01' }, { date: '2026-08-01' }, { date: '2026-09-06' }]
    const w = windowFor('2026-10-06', 30)
    expect(filterByWindow(items, w).map((i) => i.date)).toEqual(['2026-10-01', '2026-09-10', '2026-09-06'])
    expect(beforeWindow(items, w).map((i) => i.date)).toEqual(['2026-08-01'])
    expect([...items].sort(byDateDesc)[0].date).toBe('2026-10-01')
  })

  it('rejects invalid dates and window lengths', () => {
    expect(() => windowFor('2026-02-30', 30)).toThrow()
    expect(() => windowFor('06/10/2026', 30)).toThrow()
    expect(() => windowFor('2026-10-06', -1)).toThrow()
    expect(() => calendarDateAt('not a date')).toThrow()
  })

  it('handles leap-year crossing', () => {
    expect(windowFor('2028-03-01', 1)).toEqual({ start: '2028-02-29', end: '2028-03-01' })
  })
})

describe('intel dataset integrity', () => {
  const w = windowFor(calendarDateAt(INTEL_META.lastRefreshed), INTEL_META.windowDays)

  it('meta window is the 30 days ending on the lastRefreshed (HK) date', () => {
    // Refresh-agnostic so routine news refreshes don't need a test edit.
    expect(INTEL_META.windowDays).toBe(30)
    expect(w.end).toBe(calendarDateAt(INTEL_META.lastRefreshed))
    expect(windowFor(w.end, 30)).toEqual(w)
  })

  it('every item has an https source, valid enums and a unique id', () => {
    const ids = new Set<string>()
    for (const i of INTEL_ITEMS) {
      expect(i.sourceUrl.startsWith('https://')).toBe(true)
      expect(['OECD', 'HK', 'SG', 'JP']).toContain(i.jurisdiction)
      expect(['official', 'secondary']).toContain(i.sourceType)
      expect(['yes', 'no', 'unknown']).toContain(i.affectsCalc)
      expect(['new', 'reviewed', 'needs-rule-change']).toContain(i.status)
      expect(typeof i.verified).toBe('boolean')
      expect(i.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(ids.has(i.id)).toBe(false)
      ids.add(i.id)
    }
  })

  it('no item is dated after the refresh date', () => {
    for (const i of INTEL_ITEMS) expect(i.date <= w.end).toBe(true)
  })

  it('HK has no items in the window (verified empty state)', () => {
    const counts = countByJurisdiction(filterByWindow(INTEL_ITEMS, w), INTEL_JURISDICTIONS)
    expect(counts.HK).toBe(0)
    expect(counts.OECD).toBeGreaterThan(0)
  })
})

describe('intel review helpers (local-only)', () => {
  const item = INTEL_ITEMS[0]

  it('filters by jurisdiction / topic / affectsCalc', () => {
    expect(applyFilters(INTEL_ITEMS, NO_FILTERS)).toHaveLength(INTEL_ITEMS.length)
    const hk = applyFilters(INTEL_ITEMS, { ...NO_FILTERS, jurisdiction: 'HK' })
    expect(hk.every((i) => i.jurisdiction === 'HK')).toBe(true)
    const topic = distinctTopics(INTEL_ITEMS)[0]
    expect(applyFilters(INTEL_ITEMS, { ...NO_FILTERS, topic }).every((i) => i.topic === topic)).toBe(true)
    expect(applyFilters(INTEL_ITEMS, { ...NO_FILTERS, affectsCalc: 'yes' }).every((i) => i.affectsCalc === 'yes')).toBe(true)
  })

  it('parses stored status defensively and round-trips overrides', () => {
    expect(parseStatusMap(null)).toEqual({})
    expect(parseStatusMap('{bad json')).toEqual({})
    expect(parseStatusMap('[1,2]')).toEqual({})
    expect(parseStatusMap('{"a":"reviewed","b":"bogus"}')).toEqual({ a: 'reviewed' })
    const m = setStatus({}, item, 'needs-rule-change')
    expect(effectiveStatus(item, m)).toBe('needs-rule-change')
    const back = setStatus(m, item, item.status)
    expect(back).toEqual({})
    expect(effectiveStatus(item, back)).toBe(item.status)
  })
})
