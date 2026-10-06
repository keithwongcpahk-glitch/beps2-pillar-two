import { describe, expect, it } from 'vitest'
import { buildAsiaRuleset, DEFAULT_FISCAL_YEAR_START, defaultRuleset, legacyRulesetV01, projectPillarTwo, RULESET_VERSION } from './pillarTwo'

const IN_SCOPE = 900_000_000
const lowEtr = (code: string) => ({ code, globeIncome: 100, coveredTaxes: 5 })

describe('oecd-asia-v0.2 ruleset (pack-driven presets)', () => {
  it('version string is bumped and surfaced; legacy v0.1 still available', () => {
    expect(RULESET_VERSION).toBe('oecd-asia-v0.2')
    const r = projectPillarTwo({ consolidatedRevenueEur: IN_SCOPE, jurisdictions: [lowEtr('HK')] })
    expect(r.rulesetVersion).toBe('oecd-asia-v0.2')
    expect(r.fiscalYearStart).toBe(DEFAULT_FISCAL_YEAR_START)
    const legacy = projectPillarTwo({ consolidatedRevenueEur: IN_SCOPE, ruleset: legacyRulesetV01, jurisdictions: [lowEtr('HK')] })
    expect(legacy.rulesetVersion).toBe('oecd-hk-simplified-v0.1')
    expect(legacy.fiscalYearStart).toBeNull()
  })

  it('scope is Asia: HK, SG, JP plus "Other (non-QDMTT)"', () => {
    expect(Object.keys(defaultRuleset.jurisdictions).sort()).toEqual(['HK', 'JP', 'OTHER', 'SG'])
    expect(defaultRuleset.jurisdictions.OTHER.label).toBe('Other (non-QDMTT)')
    expect(defaultRuleset.jurisdictions.OTHER.hasQdmtt).toBe(false)
  })

  it('HK low ETR → HKMTT (QDMTT) for FY2026', () => {
    const r = projectPillarTwo({ consolidatedRevenueEur: IN_SCOPE, fiscalYearStart: '2026-01-01', jurisdictions: [lowEtr('HK')] })
    expect(r.jurisdictions[0].qdmtt).toBeCloseTo(10)
    expect(r.jurisdictions[0].iir).toBe(0)
    expect(r.jurisdictions[0].qdmttLabel).toBe('HKMTT')
    expect(r.jurisdictions[0].label).toBe('Hong Kong SAR')
  })

  it('SG low ETR → DTT (QDMTT)', () => {
    const r = projectPillarTwo({ consolidatedRevenueEur: IN_SCOPE, fiscalYearStart: '2026-01-01', jurisdictions: [lowEtr('SG')] })
    expect(r.jurisdictions[0].qdmtt).toBeCloseTo(10)
    expect(r.jurisdictions[0].qdmttLabel).toBe('DTT')
  })

  it('HK and SG before their 2025-01-01 start → residual shown as IIR', () => {
    const r = projectPillarTwo({ consolidatedRevenueEur: IN_SCOPE, fiscalYearStart: '2024-07-01', jurisdictions: [lowEtr('HK'), lowEtr('SG')] })
    expect(r.totalQdmtt).toBe(0)
    expect(r.totalIir).toBeCloseTo(20)
  })

  it('JP calendar FY2026 (starts 2026-01-01) → IIR, with a timing note', () => {
    const r = projectPillarTwo({ consolidatedRevenueEur: IN_SCOPE, fiscalYearStart: '2026-01-01', jurisdictions: [lowEtr('JP')] })
    expect(r.jurisdictions[0].hasQdmtt).toBe(false)
    expect(r.jurisdictions[0].iir).toBeCloseTo(10)
    expect(r.jurisdictions[0].notes.join(' ')).toContain('2026-04-01')
  })

  it('JP FY beginning 2026-04-01 → JP QDMTT', () => {
    const r = projectPillarTwo({ consolidatedRevenueEur: IN_SCOPE, fiscalYearStart: '2026-04-01', jurisdictions: [lowEtr('JP')] })
    expect(r.jurisdictions[0].hasQdmtt).toBe(true)
    expect(r.jurisdictions[0].qdmtt).toBeCloseTo(10)
    expect(r.jurisdictions[0].qdmttLabel).toBe('JP QDMTT')
  })

  it('Mixed HK + SG + JP + OTHER golden totals (FY2026 calendar)', () => {
    const r = projectPillarTwo({
      consolidatedRevenueEur: IN_SCOPE,
      fiscalYearStart: '2026-01-01',
      jurisdictions: [
        { code: 'HK', globeIncome: 80, coveredTaxes: 4 },
        { code: 'SG', globeIncome: 40, coveredTaxes: 3 },
        { code: 'JP', globeIncome: 60, coveredTaxes: 7.5 },
        { code: 'OTHER', globeIncome: 100, coveredTaxes: 8 },
      ],
    })
    // HK 10% × 80 = 8 ; SG 7.5% × 40 = 3 ; JP 2.5% × 60 = 1.5 (IIR) ; OTHER 7% × 100 = 7 (IIR)
    expect(r.totalQdmtt).toBeCloseTo(11)
    expect(r.totalIir).toBeCloseTo(8.5)
    expect(r.totalTopUp).toBeCloseTo(19.5)
  })

  it('buildAsiaRuleset is pure and records the FY it was built for', () => {
    const a = buildAsiaRuleset('2026-04-01')
    const b = buildAsiaRuleset('2026-04-01')
    expect(a).toEqual(b)
    expect(a.fiscalYearStart).toBe('2026-04-01')
    expect(a.jurisdictions.JP.hasQdmtt).toBe(true)
    expect(defaultRuleset.jurisdictions.JP.hasQdmtt).toBe(false)
    expect(a.packs).toEqual(['hk.v1', 'sg.v1', 'jp.v1'])
  })

  it('explicit ruleset overrides fiscalYearStart resolution', () => {
    const r = projectPillarTwo({ consolidatedRevenueEur: IN_SCOPE, fiscalYearStart: '2026-04-01', ruleset: buildAsiaRuleset('2026-01-01'), jurisdictions: [lowEtr('JP')] })
    expect(r.jurisdictions[0].iir).toBeCloseTo(10)
  })
})
