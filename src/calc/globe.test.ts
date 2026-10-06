import { describe, expect, it } from 'vitest'
import {
  deferredTaxAdjustment,
  evaluateTcsh,
  fiscalYearEndFromStart,
  GLOBE_PARAMS,
  GLOBE_VERSION,
  inTcshTransitionPeriod,
  projectGlobe,
  sbieRates,
  tcshTransitionRate,
} from './globe'
import type { EntityInput, GroupInputV3 } from './globe'
import { parseStoredGroup, SAMPLE_GROUP } from './sampleGroup'

const ent = (p: Partial<EntityInput> & Pick<EntityInput, 'id' | 'jurisdiction'>): EntityInput => ({
  name: p.id, role: 'CE', ownershipPct: 100, globeIncome: 0, coveredTaxes: 0, deferredTaxExpense: 0, deferredTaxRate: 0, eligiblePayroll: 0, eligibleTangibleAssets: 0, ...p,
})
const group = (p: Partial<GroupInputV3>): GroupInputV3 => ({
  groupName: 'T', consolidatedRevenueEur: 1_000_000_000, fiscalYearStart: '2026-01-01', applyTransitionalSafeHarbour: false, entities: [], cbcr: [], ...p,
})
const J = (r: ReturnType<typeof projectGlobe>, code: string) => r.jurisdictions.find((j) => j.code === code)!

describe('GloBE params (sourced JSON)', () => {
  it('version and every parameter block carries an OECD source', () => {
    expect(GLOBE_VERSION).toBe('oecd-asia-v0.3')
    for (const k of ['minimumRate', 'revenueThresholdEur', 'sbie', 'transitionalCbcrSafeHarbour', 'deferredTax', 'ordering', 'investmentEntities'] as const) {
      expect(GLOBE_PARAMS[k].sourceUrl).toMatch(/^https:\/\/www\.oecd\.org\//)
      expect(GLOBE_PARAMS[k].verified).toBe(true)
    }
  })

  it('SBIE transition rates match Model Rules Art. 9.2 (golden)', () => {
    expect(sbieRates('2023-01-01')).toMatchObject({ payroll: 0.10, tangible: 0.08 })
    expect(sbieRates('2025-04-01')).toMatchObject({ payroll: 0.096, tangible: 0.076 })
    expect(sbieRates('2026-01-01')).toMatchObject({ payroll: 0.094, tangible: 0.074 })
    expect(sbieRates('2029-07-01')).toMatchObject({ payroll: 0.082, tangible: 0.066 })
    expect(sbieRates('2032-01-01')).toMatchObject({ payroll: 0.058, tangible: 0.054 })
    expect(sbieRates('2033-01-01')).toMatchObject({ payroll: 0.05, tangible: 0.05 })
  })

  it('TCSH transition rate 15/15/16/17/17% and null after 2027', () => {
    expect(['2023', '2024', '2025', '2026', '2027', '2028'].map((y) => tcshTransitionRate(`${y}-01-01`))).toEqual([0.15, 0.15, 0.16, 0.17, 0.17, null])
  })

  it('TCSH transition period: FY begins ≤ 2027-12-31 and ends ≤ 2029-06-30 (SbS extension)', () => {
    expect(inTcshTransitionPeriod('2026-01-01')).toBe(true)
    expect(inTcshTransitionPeriod('2027-07-01')).toBe(true) // ends 2028-06-30
    expect(inTcshTransitionPeriod('2027-12-31')).toBe(true) // ends 2028-12-30
    expect(inTcshTransitionPeriod('2028-01-01')).toBe(false)
  })

  it('fiscal year end is start + 12 months − 1 day', () => {
    expect(fiscalYearEndFromStart('2026-01-01')).toBe('2026-12-31')
    expect(fiscalYearEndFromStart('2026-04-01')).toBe('2027-03-31')
    expect(fiscalYearEndFromStart('2024-03-01')).toBe('2025-02-28')
  })
})

describe('deferred tax (Art. 4.4.1, simplified)', () => {
  it('recasts at 15% only when booked above 15%', () => {
    expect(deferredTaxAdjustment(100, 0.25)).toBeCloseTo(60)
    expect(deferredTaxAdjustment(100, 0.15)).toBe(100)
    expect(deferredTaxAdjustment(100, 0.1)).toBe(100)
    expect(deferredTaxAdjustment(-50, 0.3)).toBeCloseTo(-25)
    expect(deferredTaxAdjustment(0, 0.3)).toBe(0)
  })
})

describe('transitional CbCR safe harbour tests', () => {
  const FY = '2026-01-01'
  it('de minimis: revenue < 10m AND PBT < 1m', () => {
    expect(evaluateTcsh({ jurisdiction: 'X', revenue: 9_999_999, profitBeforeTax: 999_999, simplifiedCoveredTaxes: 0 }, 0, FY, true).tests.deMinimis).toBe('pass')
    expect(evaluateTcsh({ jurisdiction: 'X', revenue: 10_000_000, profitBeforeTax: 500_000, simplifiedCoveredTaxes: 0 }, 0, FY, true).tests.deMinimis).toBe('fail')
  })
  it('simplified ETR uses the FY transition rate (boundary 17% passes in 2026, 16.9% fails)', () => {
    const at = (t: number) => evaluateTcsh({ jurisdiction: 'X', revenue: 50e6, profitBeforeTax: 10e6, simplifiedCoveredTaxes: t }, 0, FY, true)
    expect(at(1_700_000).tests.simplifiedEtr).toBe('pass')
    expect(at(1_690_000).tests.simplifiedEtr).toBe('fail')
    expect(evaluateTcsh({ jurisdiction: 'X', revenue: 50e6, profitBeforeTax: 10e6, simplifiedCoveredTaxes: 1_600_000 }, 0, '2025-01-01', true).tests.simplifiedEtr).toBe('pass')
  })
  it('routine profits: PBT ≤ SBIE passes; a loss always passes (para 30)', () => {
    expect(evaluateTcsh({ jurisdiction: 'X', revenue: 50e6, profitBeforeTax: 2e6, simplifiedCoveredTaxes: 0 }, 2e6, FY, true).tests.routineProfits).toBe('pass')
    expect(evaluateTcsh({ jurisdiction: 'X', revenue: 50e6, profitBeforeTax: 2_000_001, simplifiedCoveredTaxes: 0 }, 2e6, FY, true).tests.routineProfits).toBe('fail')
    const loss = evaluateTcsh({ jurisdiction: 'X', revenue: 50e6, profitBeforeTax: -3e6, simplifiedCoveredTaxes: 0 }, 0, FY, true)
    expect(loss.tests.routineProfits).toBe('pass')
    expect(loss.tests.simplifiedEtr).toBe('n/a')
  })
  it('not available outside the transition period, without CbCR data, or when switched off', () => {
    const cb = { jurisdiction: 'X', revenue: 1, profitBeforeTax: 1, simplifiedCoveredTaxes: 0 }
    expect(evaluateTcsh(cb, 0, '2028-01-01', true).available).toBe(false)
    expect(evaluateTcsh(undefined, 0, FY, true).reason).toContain('No CbCR data')
    expect(evaluateTcsh(cb, 0, FY, false).passed).toBe(false)
  })
})

describe('sample group golden (FY beginning 2026-01-01, hand-worked in CALC_ASSUMPTIONS.md)', () => {
  const r = projectGlobe(SAMPLE_GROUP)

  it('HK: ETR 6.875%, SBIE 3,260,000, top-up 6,235,125 collected by HKMTT', () => {
    const hk = J(r, 'HK')
    expect(hk.netGlobeIncome).toBe(80_000_000)
    expect(hk.etr).toBeCloseTo(0.06875, 10)
    expect(hk.sbie).toBeCloseTo(3_260_000, 4)
    expect(hk.excessProfit).toBeCloseTo(76_740_000, 4)
    expect(hk.topUp).toBeCloseTo(6_235_125, 2)
    expect(hk.domestic).toBeCloseTo(6_235_125, 2)
    expect(hk.domesticLabel).toBe('HKMTT')
    expect(hk.qdmttSafeHarbour).toBe(true)
    expect(hk.iir).toBe(0)
    expect(hk.safeHarbour.passed).toBe(false)
  })

  it('SG: deferred tax 400k@20% → 300k; ETR 5.75%; top-up 3,548,300 to DTT', () => {
    const sg = J(r, 'SG')
    expect(sg.deferredTaxAdjustment).toBeCloseTo(300_000, 6)
    expect(sg.etr).toBeCloseTo(0.0575, 10)
    expect(sg.sbie).toBeCloseTo(1_640_000, 4)
    expect(sg.topUp).toBeCloseTo(3_548_300, 2)
    expect(sg.domesticLabel).toBe('DTT')
    expect(sg.domestic).toBeCloseTo(3_548_300, 2)
  })

  it('JP: QDMTT not yet in force → IIR at HK UPE × 80% = 897,408; minority 224,352 not collected', () => {
    const jp = J(r, 'JP')
    expect(jp.etr).toBeCloseTo(0.09, 10)
    expect(jp.topUp).toBeCloseTo(1_121_760, 2)
    expect(jp.qdmttInForce).toBe(false)
    expect(jp.domestic).toBe(0)
    expect(jp.iir).toBeCloseTo(897_408, 2)
    expect(jp.iirParent).toBe('Harbour Holdings Ltd')
    expect(jp.minorityNotCollected).toBeCloseTo(224_352, 2)
    expect(jp.utprResidual).toBe(0)
  })

  it('OTHER: de minimis test passes → top-up 47,380 deemed zero', () => {
    const o = J(r, 'OTHER')
    expect(o.topUpBeforeSafeHarbour).toBeCloseTo(47_380, 4)
    expect(o.safeHarbour.tests.deMinimis).toBe('pass')
    expect(o.topUp).toBe(0)
    expect(o.collectors).toEqual(['None'])
  })

  it('group totals reconcile', () => {
    expect(r.inScope).toBe(true)
    expect(r.totals.topUp).toBeCloseTo(10_905_185, 2)
    expect(r.totals.domestic).toBeCloseTo(9_783_425, 2)
    expect(r.totals.iir).toBeCloseTo(897_408, 2)
    expect(r.totals.utprResidual).toBe(0)
    expect(r.totals.domestic + r.totals.iir + r.totals.minorityNotCollected + r.totals.utprResidual).toBeCloseTo(r.totals.topUp, 2)
    expect(r.utprInForceIn).toEqual([])
  })

  it('every jurisdiction has an explanation trail with source links', () => {
    for (const j of r.jurisdictions) {
      expect(j.trail.length).toBeGreaterThanOrEqual(9)
      for (const s of j.trail) expect(s.sourceUrl).toMatch(/^https:\/\//)
    }
  })
})

describe('ordering and timing from packs', () => {
  it('JP FY beginning 2026-04-01 → JP QDMTT collects; UTPR flagged as in force in JP', () => {
    const r = projectGlobe({ ...SAMPLE_GROUP, fiscalYearStart: '2026-04-01' })
    const jp = J(r, 'JP')
    expect(jp.domesticLabel).toBe('JP QDMTT')
    expect(jp.domestic).toBeCloseTo(1_121_760, 2)
    expect(jp.iir).toBe(0)
    expect(r.utprInForceIn).toEqual(['JP'])
  })

  it('FY beginning 2028: no TCSH; 2028 SBIE rates; OTHER top-up 47,500 via IIR at HK UPE', () => {
    const r = projectGlobe({ ...SAMPLE_GROUP, fiscalYearStart: '2028-01-01' })
    const o = J(r, 'OTHER')
    expect(o.safeHarbour.available).toBe(false)
    expect(o.sbie).toBeCloseTo(25_000, 6)
    expect(o.topUp).toBeCloseTo(47_500, 4)
    expect(o.iir).toBeCloseTo(47_500, 4)
  })

  it('UPE in a non-pack jurisdiction → JP top-up is a flagged UTPR residual', () => {
    const r = projectGlobe(group({
      entities: [
        ent({ id: 'upe', jurisdiction: 'OTHER', role: 'UPE', globeIncome: 10e6, coveredTaxes: 2.5e6 }),
        ent({ id: 'jp', jurisdiction: 'JP', globeIncome: 10e6, coveredTaxes: 1e6 }),
      ],
    }))
    const jp = J(r, 'JP')
    expect(jp.topUp).toBeCloseTo(500_000, 4) // (15% − 10%) × 10m, no SBIE
    expect(jp.iir).toBe(0)
    expect(jp.utprResidual).toBeCloseTo(500_000, 4)
    expect(jp.collectors).toEqual(['UTPR residual'])
  })

  it('…but an SG intermediate parent with an IIR in force picks it up (Art. 2.1.3), using the ownership %', () => {
    const r = projectGlobe(group({
      entities: [
        ent({ id: 'upe', jurisdiction: 'OTHER', role: 'UPE', globeIncome: 10e6, coveredTaxes: 2.5e6 }),
        ent({ id: 'ipe', jurisdiction: 'SG', role: 'IPE', globeIncome: 10e6, coveredTaxes: 2e6 }),
        ent({ id: 'jp', jurisdiction: 'JP', globeIncome: 10e6, coveredTaxes: 1e6, ownershipPct: 60 }),
      ],
    }))
    const jp = J(r, 'JP')
    expect(jp.iir).toBeCloseTo(300_000, 4)
    expect(jp.iirParentJurisdiction).toBe('SG')
    expect(jp.minorityNotCollected).toBeCloseTo(200_000, 4)
  })

  it('HK and SG before 2025: no HKMTT/DTT; SG low-tax CE goes to IIR at a JP UPE (JP IIR from 2024-04-01)', () => {
    const r = projectGlobe(group({
      fiscalYearStart: '2024-04-01',
      entities: [
        ent({ id: 'upe', jurisdiction: 'JP', role: 'UPE', globeIncome: 10e6, coveredTaxes: 3e6 }),
        ent({ id: 'sg', jurisdiction: 'SG', globeIncome: 10e6, coveredTaxes: 0.5e6 }),
      ],
    }))
    const sg = J(r, 'SG')
    expect(sg.qdmttInForce).toBe(false)
    expect(sg.iir).toBeCloseTo(1_000_000, 4)
  })

  it('top-up is allocated to CEs pro rata to positive GloBE income (Art. 5.2.4)', () => {
    const r = projectGlobe(group({
      entities: [
        ent({ id: 'upe', jurisdiction: 'HK', role: 'UPE', globeIncome: 100e6, coveredTaxes: 20e6 }),
        ent({ id: 'a', jurisdiction: 'OTHER', globeIncome: 3e6, ownershipPct: 100 }),
        ent({ id: 'b', jurisdiction: 'OTHER', globeIncome: 1e6, ownershipPct: 50 }),
      ],
    }))
    const o = J(r, 'OTHER')
    expect(o.topUp).toBeCloseTo(600_000, 4)
    expect(o.allocations.map((a) => Math.round(a.topUp))).toEqual([450_000, 150_000])
    expect(o.iir).toBeCloseTo(450_000 + 75_000, 4)
  })
})

describe('scope, exclusions and losses', () => {
  it('out-of-scope group → zero top-up and a warning', () => {
    const r = projectGlobe({ ...SAMPLE_GROUP, consolidatedRevenueEur: 700_000_000 })
    expect(r.inScope).toBe(false)
    expect(r.totals.topUp).toBe(0)
    expect(r.warnings.join(' ')).toContain('out of scope')
  })

  it('investment entities are excluded from blending and SBIE', () => {
    const r = projectGlobe(group({
      entities: [
        ent({ id: 'upe', jurisdiction: 'HK', role: 'UPE', globeIncome: 10e6, coveredTaxes: 1e6 }),
        ent({ id: 'fund', jurisdiction: 'HK', investmentEntity: true, globeIncome: 90e6, coveredTaxes: 0, eligiblePayroll: 1e9 }),
      ],
    }))
    const hk = J(r, 'HK')
    expect(hk.netGlobeIncome).toBe(10e6)
    expect(hk.sbie).toBe(0)
    expect(hk.topUp).toBeCloseTo(500_000, 4)
    expect(hk.excludedEntities).toEqual(['fund'])
  })

  it('loss jurisdiction → net GloBE income 0, ETR undefined, no top-up', () => {
    const r = projectGlobe(group({
      entities: [ent({ id: 'upe', jurisdiction: 'HK', role: 'UPE', globeIncome: 10e6, coveredTaxes: 2e6 }), ent({ id: 'sg', jurisdiction: 'SG', globeIncome: -5e6, coveredTaxes: 0 })],
    }))
    const sg = J(r, 'SG')
    expect(sg.netGlobeIncome).toBe(0)
    expect(sg.etr).toBeNull()
    expect(sg.topUp).toBe(0)
  })

  it('warns when no UPE is flagged', () => {
    const r = projectGlobe(group({ entities: [ent({ id: 'x', jurisdiction: 'JP', globeIncome: 1e6 })] }))
    expect(r.warnings.join(' ')).toContain('No UPE')
  })
})

describe('stored group parsing (localStorage)', () => {
  it('round-trips the sample and rejects junk', () => {
    expect(parseStoredGroup(JSON.stringify(SAMPLE_GROUP))).toEqual(SAMPLE_GROUP)
    expect(parseStoredGroup('{oops')).toBeNull()
    expect(parseStoredGroup(JSON.stringify({ groupName: 'x' }))).toBeNull()
    const bad = { ...SAMPLE_GROUP, entities: [...SAMPLE_GROUP.entities, { id: 'z', name: 'z', jurisdiction: 'HK', role: 'BOSS' }] }
    expect(parseStoredGroup(JSON.stringify(bad))?.entities).toHaveLength(SAMPLE_GROUP.entities.length)
  })
})
