import { describe, expect, it } from 'vitest'
import { defaultRuleset, projectPillarTwo, type Ruleset } from './pillarTwo'

const IN_SCOPE = 900_000_000

describe('projectPillarTwo v0.1', () => {
  it('HK low ETR → all top-up to QDMTT / HKMTT', () => {
    const r = projectPillarTwo({
      consolidatedRevenueEur: IN_SCOPE,
      jurisdictions: [{ code: 'HK', globeIncome: 100, coveredTaxes: 5, carveOut: 0 }],
    })
    expect(r.inScope).toBe(true)
    expect(r.jurisdictions[0].etr).toBeCloseTo(0.05)
    expect(r.jurisdictions[0].topUpRate).toBeCloseTo(0.10)
    expect(r.jurisdictions[0].qdmtt).toBeCloseTo(10)
    expect(r.jurisdictions[0].iir).toBe(0)
    expect(r.jurisdictions[0].qdmttLabel).toBe('HKMTT')
    expect(r.totalQdmtt).toBeCloseTo(10)
  })

  it('Non-QDMTT jurisdiction → IIR residual to UPE', () => {
    const r = projectPillarTwo({
      consolidatedRevenueEur: IN_SCOPE,
      jurisdictions: [{ code: 'US', globeIncome: 200, coveredTaxes: 10 }],
    })
    expect(r.jurisdictions[0].hasQdmtt).toBe(false)
    expect(r.jurisdictions[0].qdmtt).toBe(0)
    expect(r.jurisdictions[0].iir).toBeCloseTo(20)
    expect(r.totalIir).toBeCloseTo(20)
  })

  it('ETR ≥ 15% → zero top-up', () => {
    const r = projectPillarTwo({
      consolidatedRevenueEur: IN_SCOPE,
      jurisdictions: [{ code: 'IE', globeIncome: 100, coveredTaxes: 16 }],
    })
    expect(r.jurisdictions[0].etr).toBeCloseTo(0.16)
    expect(r.totalTopUp).toBe(0)
  })

  it('Substance carve-out reduces Excess Profit', () => {
    const without = projectPillarTwo({
      consolidatedRevenueEur: IN_SCOPE,
      jurisdictions: [{ code: 'HK', globeIncome: 100, coveredTaxes: 5, carveOut: 0 }],
    })
    const withCarve = projectPillarTwo({
      consolidatedRevenueEur: IN_SCOPE,
      jurisdictions: [{ code: 'HK', globeIncome: 100, coveredTaxes: 5, carveOut: 40 }],
    })
    expect(withCarve.jurisdictions[0].excessProfit).toBe(60)
    expect(withCarve.totalTopUp).toBeLessThan(without.totalTopUp)
    expect(withCarve.totalTopUp).toBeCloseTo(6)
  })

  it('Transitional safe harbour flag → zero top-up', () => {
    const r = projectPillarTwo({
      consolidatedRevenueEur: IN_SCOPE,
      jurisdictions: [{ code: 'HK', globeIncome: 100, coveredTaxes: 5, transitionalSafeHarbour: true }],
    })
    expect(r.totalTopUp).toBe(0)
  })

  it('Out of scope revenue → zero top-up', () => {
    const r = projectPillarTwo({
      consolidatedRevenueEur: 100_000_000,
      jurisdictions: [{ code: 'HK', globeIncome: 100, coveredTaxes: 5 }],
    })
    expect(r.inScope).toBe(false)
    expect(r.totalTopUp).toBe(0)
  })

  it('Multi-jurisdiction mix HK + SG + IE', () => {
    const r = projectPillarTwo({
      consolidatedRevenueEur: IN_SCOPE,
      jurisdictions: [
        { code: 'HK', globeIncome: 100, coveredTaxes: 5 },
        { code: 'SG', globeIncome: 80, coveredTaxes: 4 },
        { code: 'IE', globeIncome: 50, coveredTaxes: 10 },
      ],
    })
    expect(r.jurisdictions).toHaveLength(3)
    expect(r.jurisdictions[0].qdmtt).toBeCloseTo(10)
    expect(r.jurisdictions[1].qdmtt).toBeCloseTo(8)
    expect(r.jurisdictions[2].qdmtt).toBe(0)
    expect(r.totalQdmtt).toBeCloseTo(18)
    expect(r.totalIir).toBe(0)
  })

  it('CN without QDMTT contributes IIR in a multi-jur mix', () => {
    const r = projectPillarTwo({
      consolidatedRevenueEur: IN_SCOPE,
      jurisdictions: [
        { code: 'HK', globeIncome: 100, coveredTaxes: 5 },
        { code: 'CN', globeIncome: 100, coveredTaxes: 5 },
      ],
    })
    expect(r.totalQdmtt).toBeCloseTo(10)
    expect(r.totalIir).toBeCloseTo(10)
    expect(r.totalTopUp).toBeCloseTo(20)
  })

  it('ETR exactly 15% → zero top-up', () => {
    const r = projectPillarTwo({
      consolidatedRevenueEur: IN_SCOPE,
      jurisdictions: [{ code: 'GB', globeIncome: 100, coveredTaxes: 15 }],
    })
    expect(r.totalTopUp).toBe(0)
  })

  it('Zero GloBE income → ETR null and zero top-up', () => {
    const r = projectPillarTwo({
      consolidatedRevenueEur: IN_SCOPE,
      jurisdictions: [{ code: 'HK', globeIncome: 0, coveredTaxes: 0 }],
    })
    expect(r.jurisdictions[0].etr).toBeNull()
    expect(r.totalTopUp).toBe(0)
  })

  it('Changing rules JSON minEtr changes calc behavior', () => {
    const tight: Ruleset = {
      ...defaultRuleset,
      version: 'oecd-hk-simplified-v0.1-test',
      minEtr: 0.20,
    }
    const r = projectPillarTwo({
      consolidatedRevenueEur: IN_SCOPE,
      ruleset: tight,
      jurisdictions: [{ code: 'HK', globeIncome: 100, coveredTaxes: 15 }],
    })
    expect(r.jurisdictions[0].topUpRate).toBeCloseTo(0.05)
    expect(r.totalTopUp).toBeCloseTo(5)
  })

  it('Disabling carve-out feature ignores carveOut input', () => {
    const noCarve: Ruleset = {
      ...defaultRuleset,
      features: { ...defaultRuleset.features, substanceCarveOut: false },
    }
    const r = projectPillarTwo({
      consolidatedRevenueEur: IN_SCOPE,
      ruleset: noCarve,
      jurisdictions: [{ code: 'HK', globeIncome: 100, coveredTaxes: 5, carveOut: 40 }],
    })
    expect(r.jurisdictions[0].excessProfit).toBe(100)
    expect(r.totalTopUp).toBeCloseTo(10)
  })

  it('Ruleset version is surfaced on the result', () => {
    const r = projectPillarTwo({
      consolidatedRevenueEur: IN_SCOPE,
      jurisdictions: [{ code: 'HK', globeIncome: 100, coveredTaxes: 15 }],
    })
    expect(r.rulesetVersion).toBe('oecd-hk-simplified-v0.1')
  })
})
