import { describe, expect, it } from 'vitest'
import { projectGlobe, resolveTcshLaw } from './globe'
import type { CbcrInput, EntityInput, GroupInputV3, TcshBasis } from './globe'
import { JURISDICTION_PACKS, localTcshPeriod } from '../rules/jurisdictions'

/**
 * v0.4 golden tests: local adoption of the Transitional CbCR Safe Harbour (TCSH).
 * Hand-worked in docs/CALC_ASSUMPTIONS.md, "v0.4 worked examples 7–9".
 */
const ent = (p: Partial<EntityInput> & Pick<EntityInput, 'id' | 'jurisdiction'>): EntityInput => ({
  name: p.id, role: 'CE', ownershipPct: 100, globeIncome: 0, coveredTaxes: 0, deferredTaxExpense: 0, deferredTaxRate: 0, eligiblePayroll: 0, eligibleTangibleAssets: 0, ...p,
})
// HK UPE taxed at 20% (no HK top-up) so only the tested jurisdiction matters.
const upe = ent({ id: 'upe', name: 'UPE', jurisdiction: 'HK', role: 'UPE', globeIncome: 10_000_000, coveredTaxes: 2_000_000 })
const g = (fyStart: string, basis: TcshBasis, sub: EntityInput, cb: CbcrInput): GroupInputV3 => ({
  groupName: 'T', consolidatedRevenueEur: 1_000_000_000, fiscalYearStart: fyStart, applyTransitionalSafeHarbour: true, tcshBasis: basis, entities: [upe, sub], cbcr: [cb],
})
// Example 7: SG sub, GloBE ETR 10% on 10m, SBIE 0 → top-up 5% × 10m = 500,000. CbCR simplified ETR 1.8m / 10m = 18%.
const sg = ent({ id: 'sg', jurisdiction: 'SG', globeIncome: 10_000_000, coveredTaxes: 1_000_000 })
const sgCb: CbcrInput = { jurisdiction: 'SG', revenue: 50_000_000, profitBeforeTax: 10_000_000, simplifiedCoveredTaxes: 1_800_000 }
const jur = (r: ReturnType<typeof projectGlobe>, c: string) => r.jurisdictions.find((j) => j.code === c)!

describe('local TCSH periods from the packs', () => {
  it('HK enacted only to FY beginning 2026; SG extension announced; JP extension enacted', () => {
    const { HK, SG, JP } = JURISDICTION_PACKS
    expect(localTcshPeriod(HK, 'enacted')?.fyBeginsOnOrBefore).toBe('2026-12-31')
    expect(localTcshPeriod(HK, 'announced')?.fyBeginsOnOrBefore).toBe('2026-12-31')
    expect(localTcshPeriod(SG, 'enacted')).toMatchObject({ fyBeginsOnOrBefore: '2026-12-31', fyEndsOnOrBefore: '2028-06-30', source: 'enacted' })
    expect(localTcshPeriod(SG, 'announced')).toMatchObject({ fyBeginsOnOrBefore: '2027-12-31', fyEndsOnOrBefore: '2029-06-30', source: 'extension-announced' })
    expect(localTcshPeriod(JP, 'enacted')).toMatchObject({ fyBeginsOnOrBefore: '2027-12-31', source: 'extension-enacted' })
    expect(localTcshPeriod(JP, 'oecd')).toBeNull()
  })

  it('collector law: domestic tax first, then the IIR parent, else OECD terms', () => {
    const { HK, SG } = JURISDICTION_PACKS
    expect(resolveTcshLaw(SG, true, 'HK', 'enacted').label).toContain('Singapore')
    expect(resolveTcshLaw(undefined, false, 'HK', 'enacted').label).toContain('IIR')
    expect(resolveTcshLaw(undefined, false, null, 'enacted').label).toMatch(/^OECD terms/)
    const hk = resolveTcshLaw(HK, true, null, 'enacted')
    expect(hk.assumption).toMatch(/Assumed/)
    expect(resolveTcshLaw(HK, true, null, 'oecd').period.fyBeginsOnOrBefore).toBe('2027-12-31')
  })
})

describe('Example 7: SG DTT, FY beginning 1 Jan 2027', () => {
  it('enacted basis: SG period ends with FYs beginning 2026 → TCSH unavailable, DTT collects 500,000', () => {
    const r = projectGlobe(g('2027-01-01', 'enacted', sg, sgCb))
    const s = jur(r, 'SG')
    expect(s.topUpBeforeSafeHarbour).toBeCloseTo(500_000, 2)
    expect(s.safeHarbour.available).toBe(false)
    expect(s.safeHarbour.reason).toMatch(/announced, but not yet enacted/)
    expect(s.domestic).toBeCloseTo(500_000, 2)
  })
  it('enacted + announced basis: extension counts; 18% ≥ 17% (2027 rate) → passes, top-up 0', () => {
    const s = jur(projectGlobe(g('2027-01-01', 'announced', sg, sgCb)), 'SG')
    expect(s.safeHarbour.available).toBe(true)
    expect(s.safeHarbour.transitionRate).toBe(0.17)
    expect(s.safeHarbour.tests.simplifiedEtr).toBe('pass')
    expect(s.topUp).toBe(0)
  })
  it('OECD basis: passes, top-up 0', () => {
    expect(jur(projectGlobe(g('2027-01-01', 'oecd', sg, sgCb)), 'SG').topUp).toBe(0)
  })
  it('FY beginning 2026 passes under every basis (inside the enacted period)', () => {
    for (const b of ['enacted', 'announced', 'oecd'] as TcshBasis[]) expect(jur(projectGlobe(g('2026-01-01', b, sg, sgCb)), 'SG').topUp).toBe(0)
  })
})

describe('Example 8: JP QDMTT, FY beginning 1 Apr 2027 (extension enacted in Japan)', () => {
  const jp = ent({ id: 'jp', jurisdiction: 'JP', globeIncome: 10_000_000, coveredTaxes: 1_000_000 })
  const jpCb: CbcrInput = { jurisdiction: 'JP', revenue: 50_000_000, profitBeforeTax: 10_000_000, simplifiedCoveredTaxes: 1_800_000 }
  it('enacted basis: Japan law applies (FY ends 31 Mar 2028 ≤ 30 Jun 2029) → passes, top-up 0', () => {
    const j = jur(projectGlobe(g('2027-04-01', 'enacted', jp, jpCb)), 'JP')
    expect(j.qdmttInForce).toBe(true)
    expect(j.safeHarbour.basisLabel).toContain('Japan')
    expect(j.safeHarbour.available).toBe(true)
    expect(j.topUp).toBe(0)
  })
  it('FY beginning 1 Jan 2028 is outside every transition period → JP QDMTT collects 500,000', () => {
    const j = jur(projectGlobe(g('2028-01-01', 'enacted', jp, jpCb)), 'JP')
    expect(j.safeHarbour.available).toBe(false)
    expect(j.domestic).toBeCloseTo(500_000, 2)
  })
})

describe('Example 9: non-pack jurisdiction under the HK IIR, FY beginning 1 Jan 2027', () => {
  // OTHER: 500,000 income taxed 25,000 (5%), SBIE 0 → top-up 10% × 500,000 = 50,000. De minimis on CbCR.
  const other = ent({ id: 'o', jurisdiction: 'OTHER', globeIncome: 500_000, coveredTaxes: 25_000 })
  const oCb: CbcrInput = { jurisdiction: 'OTHER', revenue: 6_000_000, profitBeforeTax: 500_000, simplifiedCoveredTaxes: 25_000 }
  it('enacted basis: HK (IIR parent) has not adopted the extension → no TCSH, IIR 50,000', () => {
    const o = jur(projectGlobe(g('2027-01-01', 'enacted', other, oCb)), 'OTHER')
    expect(o.safeHarbour.basisLabel).toContain('IIR')
    expect(o.safeHarbour.available).toBe(false)
    expect(o.iir).toBeCloseTo(50_000, 2)
  })
  it('OECD basis: de minimis passes → 0', () => {
    const o = jur(projectGlobe(g('2027-01-01', 'oecd', other, oCb)), 'OTHER')
    expect(o.safeHarbour.tests.deMinimis).toBe('pass')
    expect(o.topUp).toBe(0)
  })
})

describe('HKMTT assumption flag', () => {
  it('HK CE passing the simplified ETR test in FY2026: top-up 0 and an "Assumed" note (HK law silent on HKMTT)', () => {
    // HK UPE alone: 10m taxed 1m (10%), SBIE 0 → 500,000 before safe harbour; CbCR 1.8m / 10m = 18% ≥ 17%.
    const hk = ent({ id: 'hk', jurisdiction: 'HK', role: 'UPE', globeIncome: 10_000_000, coveredTaxes: 1_000_000 })
    const r = projectGlobe({ ...g('2026-01-01', 'enacted', hk, { jurisdiction: 'HK', revenue: 80_000_000, profitBeforeTax: 10_000_000, simplifiedCoveredTaxes: 1_800_000 }), entities: [hk] })
    const h = jur(r, 'HK')
    expect(h.topUpBeforeSafeHarbour).toBeCloseTo(500_000, 2)
    expect(h.topUp).toBe(0)
    expect(h.notes.join(' ')).toMatch(/Assumed/)
  })
})
