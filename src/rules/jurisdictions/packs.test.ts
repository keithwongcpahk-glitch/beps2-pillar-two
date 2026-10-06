import { describe, expect, it } from 'vitest'
import { getPack, isPackCode, JURISDICTION_PACKS, listUnverified, PACK_CODES, presetFromPack, ruleAppliesForFy, validatePack } from './index'
import type { JurisdictionPack } from './index'
import { addMonths, computeFilingCalendar, fiscalYearStartFromEnd } from './calendar'

const ALL = PACK_CODES.map((c) => JURISDICTION_PACKS[c])

describe('jurisdiction pack loader', () => {
  it('loads exactly HK, SG and JP v1 packs', () => {
    expect(PACK_CODES).toEqual(['HK', 'SG', 'JP'])
    expect(ALL.map((p) => p.packId)).toEqual(['hk.v1', 'sg.v1', 'jp.v1'])
    expect(getPack('SG')?.name).toBe('Singapore')
    expect(getPack('US')).toBeUndefined()
    expect(isPackCode('OTHER')).toBe(false)
  })

  it.each(PACK_CODES)('%s pack passes structural validation (every fact sourced + verified flag)', (code) => {
    expect(validatePack(JURISDICTION_PACKS[code])).toEqual([])
  })

  it('validation catches a missing source URL and an unexplained unverified fact', () => {
    const broken: JurisdictionPack = structuredClone(JURISDICTION_PACKS.HK)
    broken.headlineCitRate = { value: '16.5%', sourceUrl: '', verified: false }
    const errs = validatePack(broken)
    expect(errs.some((e) => e.includes('headlineCitRate: sourceUrl'))).toBe(true)
    expect(errs.some((e) => e.includes('headlineCitRate: unverified facts need a note'))).toBe(true)
  })

  it('golden effective dates match the sourced packs', () => {
    expect(JURISDICTION_PACKS.HK.rules.QDMTT.effectiveFrom).toBe('2025-01-01')
    expect(JURISDICTION_PACKS.HK.rules.IIR.effectiveFrom).toBe('2025-01-01')
    expect(JURISDICTION_PACKS.HK.rules.UTPR.status).toBe('deferred')
    expect(JURISDICTION_PACKS.SG.rules.QDMTT.effectiveFrom).toBe('2025-01-01')
    expect(JURISDICTION_PACKS.SG.rules.UTPR.status).toBe('not-implemented')
    expect(JURISDICTION_PACKS.JP.rules.IIR.effectiveFrom).toBe('2024-04-01')
    expect(JURISDICTION_PACKS.JP.rules.QDMTT.effectiveFrom).toBe('2026-04-01')
    expect(JURISDICTION_PACKS.JP.rules.UTPR.effectiveFrom).toBe('2026-04-01')
  })

  it('domestic top-up tax labels come from the packs', () => {
    expect(JURISDICTION_PACKS.HK.domesticTopUpTax.shortName).toBe('HKMTT')
    expect(JURISDICTION_PACKS.SG.domesticTopUpTax.shortName).toBe('DTT')
    expect(JURISDICTION_PACKS.JP.domesticTopUpTax.shortName).toBe('JP QDMTT')
  })

  it('ruleAppliesForFy respects "FY beginning on or after"', () => {
    const jpQ = JURISDICTION_PACKS.JP.rules.QDMTT
    expect(ruleAppliesForFy(jpQ, '2026-03-31')).toBe(false)
    expect(ruleAppliesForFy(jpQ, '2026-04-01')).toBe(true)
    expect(ruleAppliesForFy(JURISDICTION_PACKS.HK.rules.UTPR, '2030-01-01')).toBe(false)
  })

  it('presetFromPack: JP switches from IIR-only to QDMTT on FY starting 2026-04-01', () => {
    const before = presetFromPack(JURISDICTION_PACKS.JP, '2026-01-01')
    expect(before.hasQdmtt).toBe(false)
    expect(before.iirInForce).toBe(true)
    expect(before.presetNote).toContain('2026-04-01')
    const after = presetFromPack(JURISDICTION_PACKS.JP, '2026-04-01')
    expect(after.hasQdmtt).toBe(true)
    expect(after.utprInForce).toBe(true)
    expect(after.presetNote).toBeNull()
    expect(() => presetFromPack(JURISDICTION_PACKS.JP, '1/4/2026')).toThrow()
  })

  it('unverified facts are surfaced (HK territorial inference, JP registration)', () => {
    expect(listUnverified(JURISDICTION_PACKS.HK).length).toBeGreaterThan(0)
    expect(listUnverified(JURISDICTION_PACKS.JP).map((r) => r.path)).toContain('registration[0]')
  })
})

describe('date arithmetic', () => {
  it('addMonths keeps month-end and clamps', () => {
    expect(addMonths('2025-12-31', 6)).toBe('2026-06-30')
    expect(addMonths('2025-12-31', 15)).toBe('2027-03-31')
    expect(addMonths('2025-08-31', 6)).toBe('2026-02-28')
    expect(addMonths('2025-01-15', 1)).toBe('2025-02-15')
    expect(addMonths('2024-02-29', 12)).toBe('2025-02-28')
    expect(addMonths('2025-02-28', 12)).toBe('2026-02-28')
  })

  it('fiscalYearStartFromEnd assumes a 12-month FY', () => {
    expect(fiscalYearStartFromEnd('2025-12-31')).toBe('2025-01-01')
    expect(fiscalYearStartFromEnd('2026-03-31')).toBe('2025-04-01')
    expect(fiscalYearStartFromEnd('2025-02-28')).toBe('2024-03-01')
  })
})

describe('filing calendar (indicative golden cases)', () => {
  const due = (fye: string, firstYear: boolean, id: string) =>
    computeFilingCalendar(fye, ALL, { firstYear }).rows.find((r) => r.obligationId === id)

  it('FYE 31 Dec 2025, first year: SG registration 30 Jun 2026; GIR 30 Jun 2027; payment 31 Jul 2027', () => {
    expect(due('2025-12-31', true, 'sg-registration')?.dueDate).toBe('2026-06-30')
    expect(due('2025-12-31', true, 'sg-gir')?.dueDate).toBe('2027-06-30')
    expect(due('2025-12-31', true, 'sg-payment')?.dueDate).toBe('2027-07-31')
    expect(due('2025-12-31', true, 'hk-notification')?.dueDate).toBe('2026-06-30')
    expect(due('2025-12-31', true, 'hk-return')?.dueDate).toBe('2027-06-30')
    expect(due('2025-12-31', true, 'jp-gir')?.dueDate).toBe('2027-06-30')
  })

  it('FYE 31 Dec 2025, later year: GIR 31 Mar 2027; payment 30 Apr 2027; SG registration n/a', () => {
    expect(due('2025-12-31', false, 'sg-gir')?.dueDate).toBe('2027-03-31')
    expect(due('2025-12-31', false, 'sg-payment')?.dueDate).toBe('2027-04-30')
    const reg = due('2025-12-31', false, 'sg-registration')
    expect(reg?.applicable).toBe(false)
    expect(reg?.dueDate).toBeNull()
    const hkPay = due('2025-12-31', false, 'hk-payment')
    expect(hkPay?.dueDate).toBe('2027-04-30')
    expect(hkPay?.earliestOnly).toBe(true)
  })

  it('JP: March FYE 2025 first GIR due 30 Sep 2026; QDMTT obligations not yet effective', () => {
    expect(due('2025-03-31', true, 'jp-gir')?.dueDate).toBe('2026-09-30')
    const q = due('2025-03-31', true, 'jp-qdmtt-return')
    expect(q?.applicable).toBe(false)
    expect(q?.reason).toContain('2026-04-01')
    // HK/SG rules start for FYs beginning on/after 2025-01-01, so FY Apr 2024–Mar 2025 is out
    expect(due('2025-03-31', true, 'hk-return')?.applicable).toBe(false)
  })

  it('JP QDMTT/UTPR returns apply for FY beginning 1 Apr 2026 (FYE 31 Mar 2027)', () => {
    expect(due('2027-03-31', false, 'jp-qdmtt-return')?.dueDate).toBe('2028-06-30')
    expect(due('2027-03-31', false, 'jp-utpr-return')?.dueDate).toBe('2028-06-30')
  })

  it('FYE 31 Jan 2026 (non-calendar FY) → HK return 30 Apr 2027', () => {
    expect(due('2026-01-31', false, 'hk-return')?.dueDate).toBe('2027-04-30')
  })

  it('floor date lifts an earlier computed deadline and is flagged', () => {
    const jp: JurisdictionPack = structuredClone(JURISDICTION_PACKS.JP)
    jp.filing = jp.filing.map((f) => (f.id === 'jp-gir' ? { ...f, floorDate: '2026-12-31' } : f))
    const row = computeFilingCalendar('2025-03-31', [jp], { firstYear: true }).rows.find((r) => r.obligationId === 'jp-gir')
    expect(row?.dueDate).toBe('2026-12-31')
    expect(row?.floorApplied).toBe(true)
  })

  it('rows are sorted by due date with non-applicable rows last', () => {
    const rows = computeFilingCalendar('2025-12-31', ALL, { firstYear: true }).rows
    const dated = rows.filter((r) => r.dueDate).map((r) => r.dueDate as string)
    expect([...dated].sort()).toEqual(dated)
    const firstNa = rows.findIndex((r) => !r.dueDate)
    expect(rows.slice(firstNa).every((r) => !r.dueDate)).toBe(true)
  })
})
