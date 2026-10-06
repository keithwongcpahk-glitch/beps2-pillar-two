import { describe, expect, it } from 'vitest'
import { projectGlobe } from './globe'
import type { CbcrInput, EntityInput, GroupInputV3, TcshBasis } from './globe'
import { SAMPLE_GROUP } from './sampleGroup'
import { blendedEtr, collectorSplit, dataReadiness, keyRisks, materialUpdates, nextDeadlines, ragFor, summarize, summaryDelta } from './dashboard'
import { computeFilingCalendar } from '../rules/jurisdictions/calendar'
import { JURISDICTION_PACKS, PACK_CODES } from '../rules/jurisdictions'
import type { IntelItem } from '../intel/types'

const PACKS = PACK_CODES.map((c) => JURISDICTION_PACKS[c])
const ent = (p: Partial<EntityInput> & Pick<EntityInput, 'id' | 'jurisdiction'>): EntityInput => ({
  name: p.id, role: 'CE', ownershipPct: 100, globeIncome: 0, coveredTaxes: 0, deferredTaxExpense: 0, deferredTaxRate: 0, eligiblePayroll: 0, eligibleTangibleAssets: 0, ...p,
})
const upe = ent({ id: 'upe', name: 'UPE', jurisdiction: 'HK', role: 'UPE', globeIncome: 10_000_000, coveredTaxes: 2_000_000 })
const grp = (fy: string, basis: TcshBasis, subs: EntityInput[], cbcr: CbcrInput[] = [], tcsh = true): GroupInputV3 => ({
  groupName: 'T', consolidatedRevenueEur: 1_000_000_000, fiscalYearStart: fy, applyTransitionalSafeHarbour: tcsh, tcshBasis: basis, entities: [upe, ...subs], cbcr,
})
const jur = (g: GroupInputV3, code: string) => projectGlobe(g).jurisdictions.find((j) => j.code === code)!

describe('summarize (sample group, FY2026)', () => {
  const p = projectGlobe(SAMPLE_GROUP)
  const s = summarize(p)
  it('aggregates engine totals without changing them', () => {
    expect(s.totalTopUp).toBe(p.totals.topUp)
    expect(s.collectors.domestic + s.collectors.iir + s.collectors.utprResidual + s.collectors.minorityNotCollected).toBeCloseTo(p.totals.topUp, 0)
    expect(s.jurisdictionCount).toBe(4)
  })
  it('blended ETR = Σ adjusted covered taxes ÷ Σ net GloBE income = 9.625m ÷ 140.5m', () => {
    expect(blendedEtr(p)).toBeCloseTo(9_625_000 / 140_500_000, 10)
  })
  it('RAG: HK, SG, JP red (top-up due); OTHER green (safe harbour under enacted HK IIR law); 1 of 4 exposed jurisdictions passes', () => {
    expect(s.rag.map((r) => `${r.code}:${r.rag}`)).toEqual(['HK:red', 'SG:red', 'JP:red', 'OTHER:green'])
    expect(s.ragCounts).toEqual({ red: 3, amber: 0, green: 1, grey: 0 })
    expect([s.safeHarbourPassed, s.exposedCount]).toEqual([1, 4])
  })
  it('collector split shares sum to 100%', () => {
    const split = collectorSplit(s)
    expect(split.reduce((a, b) => a + b.share, 0)).toBeCloseTo(1, 10)
    expect(split[0]).toMatchObject({ key: 'domestic', amount: s.collectors.domestic })
  })
})

describe('ragFor rules', () => {
  const cb = (j: string, taxes: number): CbcrInput => ({ jurisdiction: j, revenue: 50_000_000, profitBeforeTax: 10_000_000, simplifiedCoveredTaxes: taxes })
  it('green when ETR ≥ 16% with no top-up', () => {
    expect(ragFor(jur(grp('2026-01-01', 'enacted', [ent({ id: 'sg', jurisdiction: 'SG', globeIncome: 10_000_000, coveredTaxes: 1_650_000 })], [], false), 'SG')).rag).toBe('green')
  })
  it('amber when ETR is within 1pp of 15% (15.5%)', () => {
    const r = ragFor(jur(grp('2026-01-01', 'enacted', [ent({ id: 'sg', jurisdiction: 'SG', globeIncome: 10_000_000, coveredTaxes: 1_550_000 })], [], false), 'SG'))
    expect(r.rag).toBe('amber')
    expect(r.reason).toMatch(/within 1pp/)
  })
  it('amber when ETR < 15% but the substance carve-out absorbs all excess profit', () => {
    const sg = ent({ id: 'sg', jurisdiction: 'SG', globeIncome: 1_000_000, coveredTaxes: 100_000, eligiblePayroll: 20_000_000 })
    const r = ragFor(jur(grp('2026-01-01', 'enacted', [sg], [], false), 'SG'))
    expect(r.rag).toBe('amber')
    expect(r.reason).toMatch(/carve-out/)
  })
  it('grey for a loss jurisdiction; red when top-up is due', () => {
    expect(ragFor(jur(grp('2026-01-01', 'enacted', [ent({ id: 'jp', jurisdiction: 'JP', globeIncome: -500_000 })], [], false), 'JP')).rag).toBe('grey')
    expect(ragFor(jur(grp('2026-01-01', 'enacted', [ent({ id: 'jp', jurisdiction: 'JP', globeIncome: 10_000_000, coveredTaxes: 1_000_000 })], [], false), 'JP')).rag).toBe('red')
  })
  it('green when the safe harbour passes under enacted local law (SG FY2026)', () => {
    const r = ragFor(jur(grp('2026-01-01', 'enacted', [ent({ id: 'sg', jurisdiction: 'SG', globeIncome: 10_000_000, coveredTaxes: 1_000_000 })], [cb('SG', 1_800_000)]), 'SG'))
    expect(r).toMatchObject({ rag: 'green', reason: 'Safe harbour passed under enacted local law' })
  })
  it('amber when the pass relies on the HKMTT assumption', () => {
    const hk = ent({ id: 'hk', jurisdiction: 'HK', role: 'UPE', globeIncome: 10_000_000, coveredTaxes: 1_000_000 })
    const g = { ...grp('2026-01-01', 'enacted', [], [cb('HK', 1_800_000)]), entities: [hk] }
    const r = ragFor(projectGlobe(g).jurisdictions[0])
    expect(r.rag).toBe('amber')
    expect(r.reason).toMatch(/assumption/)
  })
  it('amber when the pass relies on an announced, not enacted extension (SG FY2027, re-run on the enacted basis)', () => {
    const sg = ent({ id: 'sg', jurisdiction: 'SG', globeIncome: 10_000_000, coveredTaxes: 1_000_000 })
    const announced = projectGlobe(grp('2027-01-01', 'announced', [sg], [cb('SG', 1_800_000)]))
    const enacted = projectGlobe(grp('2027-01-01', 'enacted', [sg], [cb('SG', 1_800_000)]))
    const s = summarize(announced, enacted)
    expect(s.rag.find((r) => r.code === 'SG')).toMatchObject({ rag: 'amber', reason: expect.stringMatching(/not enacted/) })
  })
  it('amber when the pass is on OECD terms only', () => {
    const sg = ent({ id: 'sg', jurisdiction: 'SG', globeIncome: 10_000_000, coveredTaxes: 1_000_000 })
    expect(ragFor(jur(grp('2027-01-01', 'oecd', [sg], [cb('SG', 1_800_000)]), 'SG')).reason).toMatch(/OECD terms/)
  })
  it('grey for every jurisdiction when the group is out of scope', () => {
    const g = { ...SAMPLE_GROUP, consolidatedRevenueEur: 500_000_000 }
    expect(summarize(projectGlobe(g)).ragCounts.grey).toBe(4)
  })
})

describe('summaryDelta', () => {
  it('current − comparison for top-up, collectors and ETR (pp)', () => {
    const base = summarize(projectGlobe(SAMPLE_GROUP))
    const alt = { ...SAMPLE_GROUP, entities: SAMPLE_GROUP.entities.map((e) => (e.jurisdiction === 'SG' ? { ...e, coveredTaxes: e.coveredTaxes * 2 } : e)) }
    const s = summarize(projectGlobe(alt))
    const d = summaryDelta(s, base)
    expect(d.totalTopUp).toBeCloseTo(s.totalTopUp - base.totalTopUp, 6)
    expect(d.totalTopUp).toBeLessThan(0)
    expect(d.blendedEtrPp).toBeCloseTo(((s.blendedEtr as number) - (base.blendedEtr as number)) * 100, 10)
    expect(d.domestic + d.iir + d.utprResidual).toBeLessThan(0)
  })
})

describe('nextDeadlines', () => {
  const cal = computeFilingCalendar('2026-12-31', PACKS, { firstYear: true })
  it('returns up to n applicable rows on or after today, sorted by adjusted date', () => {
    const rows = nextDeadlines(cal, '2027-01-01', 5)
    expect(rows.length).toBeGreaterThan(0)
    expect(rows.length).toBeLessThanOrEqual(5)
    rows.forEach((r) => expect(r.applicable && (r.adjustedDate as string) >= '2027-01-01').toBe(true))
    expect([...rows.map((r) => r.adjustedDate)]).toEqual([...rows.map((r) => r.adjustedDate)].sort())
  })
  it('is empty when every deadline has passed', () => {
    expect(nextDeadlines(cal, '2035-01-01')).toEqual([])
  })
})

describe('materialUpdates', () => {
  const item = (id: string, date: string, affectsCalc: IntelItem['affectsCalc']): IntelItem => ({
    id, date, jurisdiction: 'HK', title: id, summary: '', topic: 't', sourceUrl: 'https://x', sourceName: 'x', sourceType: 'official', affectsCalc, impactNote: '', status: 'new', verified: true,
  })
  const items = [item('new-info', '2026-09-30', 'no'), item('old-calc', '2026-05-01', 'yes'), item('flagged', '2026-06-01', 'no'), item('mid', '2026-08-01', 'unknown')]
  it('material (affects calc, or locally flagged "needs rule change") first, then newest', () => {
    const r = materialUpdates(items, (i) => (i.id === 'flagged' ? 'needs-rule-change' : 'reviewed'), 3)
    expect(r.map((i) => i.id)).toEqual(['flagged', 'old-calc', 'new-info'])
    expect(r.map((i) => i.material)).toEqual([true, true, false])
  })
})

describe('dataReadiness and keyRisks', () => {
  it('flags missing CbCR rows and missing substance data', () => {
    const g = grp('2026-01-01', 'enacted', [ent({ id: 'sg', jurisdiction: 'SG', globeIncome: 1, eligiblePayroll: 5 })], [{ jurisdiction: 'SG', revenue: 1, profitBeforeTax: 1, simplifiedCoveredTaxes: 0 }])
    const r = dataReadiness(g)
    expect(r[0]).toMatchObject({ done: 1, total: 2, missing: ['HK'] })
    expect(r[1]).toMatchObject({ done: 1, total: 2, missing: ['UPE'] })
    expect(dataReadiness(SAMPLE_GROUP).every((c) => c.done === c.total)).toBe(true)
  })
  it('sample: lists the HK unverified safe harbour facts and the simplifications; no JP-only noise when JP is absent', () => {
    const risks = keyRisks(projectGlobe(SAMPLE_GROUP), 'enacted', PACKS)
    const text = risks.map((r) => r.text).join('\n')
    expect(text).toMatch(/HK: no evidence that the 2027 safe harbour extension has been adopted/)
    expect(text).toMatch(/HK: law does not expressly apply/)
    expect(risks.filter((r) => r.kind === 'simplification')).toHaveLength(3)
    const noJp = keyRisks(projectGlobe(grp('2026-01-01', 'oecd', [])), 'oecd', PACKS)
    expect(noJp.some((r) => r.text.startsWith('JP'))).toBe(false)
    expect(noJp.some((r) => r.kind === 'basis')).toBe(true)
  })
  it('an assumption that changes the result is listed once, as an assumption', () => {
    const hk = ent({ id: 'hk', jurisdiction: 'HK', role: 'UPE', globeIncome: 10_000_000, coveredTaxes: 1_000_000 })
    const g = { ...grp('2026-01-01', 'enacted', [], [{ jurisdiction: 'HK', revenue: 50_000_000, profitBeforeTax: 10_000_000, simplifiedCoveredTaxes: 1_800_000 }]), entities: [hk] }
    const risks = keyRisks(projectGlobe(g), 'enacted', PACKS)
    expect(risks.filter((r) => r.kind === 'assumption')).toHaveLength(1)
    expect(risks.some((r) => r.text.startsWith('HK: law does not expressly apply'))).toBe(false)
  })
})
