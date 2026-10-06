import { describe, expect, it } from 'vitest'
import { HOLIDAYS, nonWorkingReason, rollForward } from './businessDays'
import { computeFilingCalendar } from './calendar'
import { JURISDICTION_PACKS, PACK_CODES } from './index'

/** Hand-checked against GovHK / MOM / Cabinet Office holiday lists (see docs/CALC_ASSUMPTIONS.md, "Filing calendar roll-forward"). */
describe('holiday data integrity', () => {
  it('covers 2026–2027 for HK, SG and JP with official sources, sourced rules and ISO dates', () => {
    expect(HOLIDAYS.coveredYears).toEqual([2026, 2027])
    for (const c of PACK_CODES) {
      const j = HOLIDAYS.jurisdictions[c]
      expect(j.rule.sourceUrl).toMatch(/^https:\/\//)
      expect(j.rule.verified).toBe(true)
      expect(j.holidaySources.length).toBeGreaterThan(0)
      j.holidaySources.forEach((s) => expect(s.url).toMatch(/^https:\/\/[^/]*(gov\.hk|gov\.sg|go\.jp)\//))
      for (const h of j.holidays) {
        expect(h.date).toMatch(/^202[67]-\d{2}-\d{2}$/)
        expect(h.name.length).toBeGreaterThan(0)
      }
      expect(new Set(j.holidays.map((h) => h.date)).size).toBe(j.holidays.length)
    }
    expect(HOLIDAYS.jurisdictions.HK.holidays.length).toBe(34)
    expect(HOLIDAYS.jurisdictions.JP.holidays.length).toBe(35)
  })
})

describe('roll-forward rules', () => {
  it('HK: Sunday rolls to Monday; Saturdays are working days unless a general holiday', () => {
    expect(rollForward('HK', '2026-06-28')).toMatchObject({ adjusted: '2026-06-29', rolled: true })
    expect(rollForward('HK', '2026-10-31')).toMatchObject({ adjusted: '2026-10-31', rolled: false })
  })
  it('HK: Good Friday 2027 chain → Tue 30 Mar 2027 (Fri hol, Sat hol, Sun, Easter Monday)', () => {
    const r = rollForward('HK', '2027-03-26')
    expect(r.adjusted).toBe('2027-03-30')
    expect(r.reasons).toHaveLength(4)
  })
  it('HK: Sat 26 Dec 2026 is a general holiday (first weekday after Christmas) → Mon 28 Dec', () => {
    expect(rollForward('HK', '2026-12-26').adjusted).toBe('2026-12-28')
  })
  it('SG: Saturday is not excluded; Labour Day on Sat 1 May 2027 → Mon 3 May 2027', () => {
    expect(rollForward('SG', '2026-10-31').rolled).toBe(false)
    expect(rollForward('SG', '2027-05-01').adjusted).toBe('2027-05-03')
  })
  it('SG: Holidays Act s.4(2) Monday after a Sunday holiday is excluded (Sun 9 Aug 2026 → Tue 11 Aug)', () => {
    expect(rollForward('SG', '2026-08-09').adjusted).toBe('2026-08-11')
  })
  it('JP: Thu 31 Dec 2026 → Mon 4 Jan 2027 (29–31 Dec, New Year holiday, Sat, Sun)', () => {
    expect(rollForward('JP', '2026-12-31').adjusted).toBe('2027-01-04')
    expect(nonWorkingReason('JP', '2027-01-04')).toBeNull()
  })
  it('JP: Saturday rolls; a 2028 date is flagged as not holiday-checked', () => {
    expect(rollForward('JP', '2026-10-31').adjusted).toBe('2026-11-02')
    expect(rollForward('JP', '2028-03-31')).toMatchObject({ rolled: false, holidaysChecked: false })
  })
})

describe('calendar integration', () => {
  it('JP GIR for FYE 30 Sep 2025 (not first year): statutory 31 Dec 2026, adjusted 4 Jan 2027', () => {
    const cal = computeFilingCalendar('2025-09-30', [JURISDICTION_PACKS.JP], { firstYear: false })
    const gir = cal.rows.find((r) => r.obligationId === 'jp-gir')!
    expect(gir.dueDate).toBe('2026-12-31')
    expect(gir.adjustedDate).toBe('2027-01-04')
    expect(gir.rolled).toBe(true)
    expect(gir.holidaysChecked).toBe(true)
  })
  it('non-applicable rows carry no adjusted date', () => {
    const cal = computeFilingCalendar('2025-12-31', PACK_CODES.map((c) => JURISDICTION_PACKS[c]), { firstYear: false })
    for (const r of cal.rows) {
      if (!r.applicable) expect(r.adjustedDate).toBeNull()
      else expect(r.adjustedDate! >= r.dueDate!).toBe(true)
    }
  })
})
