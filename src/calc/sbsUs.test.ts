import { describe, expect, it } from 'vitest'
import { projectGlobe, sgSideBySide } from './globe'
import type { EntityInput, GroupInputV3, TcshBasis } from './globe'
import { keyRisks, ragFor } from './dashboard'
import { parseStoredGroup } from './sampleGroup'
import { JURISDICTION_PACKS, PACK_CODES, measureCounts, validatePack } from '../rules/jurisdictions'

/**
 * v0.5 golden tests: Singapore's Side-by-Side Safe Harbour for US-parented groups (MTT / IIR only).
 * Hand-worked in docs/CALC_ASSUMPTIONS.md, "v0.5 worked examples 10–14".
 */
const ent = (p: Partial<EntityInput> & Pick<EntityInput, 'id' | 'jurisdiction'>): EntityInput => ({
  name: p.id, role: 'CE', ownershipPct: 100, globeIncome: 0, coveredTaxes: 0, deferredTaxExpense: 0, deferredTaxRate: 0, eligiblePayroll: 0, eligibleTangibleAssets: 0, ...p,
})
// US UPE (in "Other") taxed at 21%: no top-up in its own jurisdiction.
const usUpe = ent({ id: 'us', name: 'US Parent Inc', jurisdiction: 'OTHER', role: 'UPE', globeIncome: 20_000_000, coveredTaxes: 4_200_000 })
// SG intermediate parent, GloBE ETR 10% on 10m, SBIE 0 → SG top-up 500,000 (collected by SG DTT).
const sgIpe = ent({ id: 'sg', name: 'Asia HoldCo Pte Ltd', jurisdiction: 'SG', role: 'IPE', globeIncome: 10_000_000, coveredTaxes: 1_000_000 })
// JP sub, 80% held, GloBE ETR 10% on 20m, SBIE 0 → JP top-up 1,000,000. JP QDMTT not in force for an FY starting 1 Jan 2026.
const jpSub = ent({ id: 'jp', name: 'Nippon KK', jurisdiction: 'JP', ownershipPct: 80, globeIncome: 20_000_000, coveredTaxes: 2_000_000 })
const grp = (basis: TcshBasis, usParented: boolean, extra: Partial<GroupInputV3> = {}, entities: EntityInput[] = [usUpe, sgIpe, jpSub]): GroupInputV3 => ({
  groupName: 'US group', consolidatedRevenueEur: 1_000_000_000, fiscalYearStart: '2026-01-01', applyTransitionalSafeHarbour: false, tcshBasis: basis, usParented, entities, cbcr: [], ...extra,
})
const jur = (r: ReturnType<typeof projectGlobe>, c: string) => r.jurisdictions.find((j) => j.code === c)!

describe('SG pack 1.2.0: Side-by-Side Safe Harbour fact', () => {
  it('records the Bill as passed, not enacted, effective for FYs commencing on or after 1 Jan 2026, with sources', () => {
    const sg = JURISDICTION_PACKS.SG
    expect(sg.packVersion).toBe('1.2.0')
    expect(validatePack(sg)).toEqual([])
    const s = sg.sideBySideSafeHarbour!
    expect(s.legalStatus).toBe('passed-not-enacted')
    expect(s.appliesTo).toBe('IIR')
    expect(s.effectiveFrom).toBe('2026-01-01')
    expect(s.effectiveDate.value).toMatch(/financial years commencing on or after 1 January 2026/)
    expect(s.bill.value).toMatch(/passed by Parliament 6 Oct 2026; presidential assent and gazetting pending/)
    for (const f of [s, s.bill, s.effectiveDate, s.qualifyingGroups, s.domesticUnaffected]) {
      expect(f.sourceUrl).toMatch(/^https:\/\//)
      expect(typeof f.verified).toBe('boolean')
    }
    expect(s.sourceUrl).toContain('mof.gov.sg')
    expect(s.qualifyingGroups.sourceUrl).toContain('sso.agc.gov.sg')
  })
  it('HK and JP packs carry no modelled Side-by-Side block', () => {
    for (const c of PACK_CODES.filter((x) => x !== 'SG')) expect(JURISDICTION_PACKS[c].sideBySideSafeHarbour).toBeUndefined()
  })
  it('legislative status basis: passed / announced measures count only beyond "enacted"', () => {
    expect(measureCounts('passed-not-enacted', 'enacted')).toBe(false)
    expect(measureCounts('passed-not-enacted', 'announced')).toBe(true)
    expect(measureCounts('passed-not-enacted', 'oecd')).toBe(true)
    expect(measureCounts('enacted', 'enacted')).toBe(true)
  })
})

describe('v0.5 golden: US-parented group with an SG parent', () => {
  it('Example 10: enacted-only basis: SG IIR still charged, with a "would be exempt once enacted" note', () => {
    const r = projectGlobe(grp('enacted', true))
    expect(r.sideBySide.status).toBe('pending')
    expect(jur(r, 'SG').domestic).toBeCloseTo(500_000, 2)
    const jp = jur(r, 'JP')
    expect(jp.iir).toBeCloseTo(800_000, 2)
    expect(jp.iirParent).toBe('Asia HoldCo Pte Ltd')
    expect(jp.minorityNotCollected).toBeCloseTo(200_000, 2)
    expect(jp.sbsExempt).toBe(0)
    expect(r.totals.topUp).toBeCloseTo(1_500_000, 2)
    expect(r.sideBySide.chargedPending).toBeCloseTo(800_000, 2)
    expect(jp.trail.some((t) => t.step === 'Side-by-Side exemption (not applied)' && /would be exempt once enacted/.test(t.formula))).toBe(true)
    expect(r.warnings.some((w) => /would be exempt once/.test(w))).toBe(true)
  })

  it('Example 11: enacted + passed/announced basis: SG IIR exempt, SG DTT still charged', () => {
    const r = projectGlobe(grp('announced', true))
    expect(r.sideBySide.status).toBe('applied')
    expect(jur(r, 'SG').domestic).toBeCloseTo(500_000, 2)
    const jp = jur(r, 'JP')
    expect(jp.iir).toBe(0)
    expect(jp.utprResidual).toBe(0)
    expect(jp.minorityNotCollected).toBe(0)
    expect(jp.sbsExempt).toBeCloseTo(1_000_000, 2)
    expect(jp.topUp).toBe(0)
    expect(jp.topUpBeforeSafeHarbour).toBeCloseTo(1_000_000, 2)
    expect(jp.collectors).toEqual(['SbS exempt'])
    expect(r.totals.topUp).toBeCloseTo(500_000, 2)
    expect(r.totals.sbsExempt).toBeCloseTo(1_000_000, 2)
    const step = jp.trail.find((t) => t.step.startsWith('SG IIR exempt under the Side-by-Side package'))!
    expect(step.step).toBe('SG IIR exempt under the Side-by-Side package (passed, not yet law)')
    expect(step.sourceUrl).toBe(JURISDICTION_PACKS.SG.sideBySideSafeHarbour!.sourceUrl)
    expect(jur(r, 'SG').trail.some((t) => t.step === 'Side-by-Side: DTT unaffected')).toBe(true)
  })

  it('Example 12: OECD-terms basis: exemption applies as well', () => {
    const r = projectGlobe(grp('oecd', true))
    expect(r.sideBySide.status).toBe('applied')
    expect(jur(r, 'JP').sbsExempt).toBeCloseTo(1_000_000, 2)
    expect(jur(r, 'SG').domestic).toBeCloseTo(500_000, 2)
  })

  it('Example 13: a non-US group is unchanged on every basis', () => {
    for (const b of ['enacted', 'announced', 'oecd'] as TcshBasis[]) {
      const r = projectGlobe(grp(b, false))
      expect(r.sideBySide.status).toBe('n/a')
      expect(jur(r, 'JP').iir).toBeCloseTo(800_000, 2)
      expect(jur(r, 'JP').sbsExempt).toBe(0)
      expect(r.totals.topUp).toBeCloseTo(1_500_000, 2)
      expect(r.warnings.some((w) => /Side-by-Side/.test(w))).toBe(false)
      expect(jur(r, 'JP').trail.some((t) => /Side-by-Side/.test(t.step))).toBe(false)
    }
  })

  it('Example 14: a non-SG intermediate parent with an IIR in force takes over (HK IPE)', () => {
    const hkIpe = ent({ id: 'hk', name: 'HK Holdings Ltd', jurisdiction: 'HK', role: 'IPE' })
    const r = projectGlobe(grp('announced', true, {}, [usUpe, sgIpe, hkIpe, jpSub]))
    expect(r.sideBySide).toMatchObject({ status: 'applied', fallbackParent: 'HK Holdings Ltd', exempt: 0 })
    const jp = jur(r, 'JP')
    expect(jp.iir).toBeCloseTo(800_000, 2)
    expect(jp.iirParent).toBe('HK Holdings Ltd')
    expect(jp.sbsExempt).toBe(0)
    expect(r.warnings.some((w) => /No Hong Kong Side-by-Side equivalent/.test(w))).toBe(true)
  })

  it('FY beginning before 1 Jan 2026 is not covered; UPE in SG/HK/JP is ignored with a warning', () => {
    const early = projectGlobe(grp('announced', true, { fiscalYearStart: '2025-01-01' }))
    expect(early.sideBySide.status).toBe('n/a')
    expect(jur(early, 'JP').iir).toBeGreaterThan(0)
    const sgUpe = { ...sgIpe, role: 'UPE' as const }
    const r = projectGlobe(grp('announced', true, {}, [sgUpe, jpSub]))
    expect(r.sideBySide.status).toBe('ignored')
    expect(jur(r, 'JP').iir).toBeCloseTo(800_000, 2)
    expect(sgSideBySide(grp('announced', false), usUpe, sgIpe, 'announced').status).toBe('n/a')
  })
})

describe('v0.5 dashboard and storage', () => {
  it('risk box: amber "relies on passed-not-yet-enacted law" line only when the exemption is relied on', () => {
    const applied = projectGlobe(grp('announced', true))
    const risks = keyRisks(applied, 'announced', [JURISDICTION_PACKS.SG, JURISDICTION_PACKS.JP])
    const leg = risks.filter((r) => r.kind === 'legislative')
    expect(leg).toHaveLength(1)
    expect(leg[0].text).toMatch(/^Relies on passed-not-yet-enacted law/)
    expect(leg[0].url).toContain('mof.gov.sg')
    expect(risks.some((r) => r.kind === 'warning' && /^SG IIR exempt/.test(r.text))).toBe(false)
    const pending = keyRisks(projectGlobe(grp('enacted', true)), 'enacted', [])
    expect(pending.some((r) => r.kind === 'legislative')).toBe(false)
    expect(pending.some((r) => r.kind === 'basis' && /would be exempt once/.test(r.text))).toBe(true)
    expect(keyRisks(projectGlobe(grp('announced', false)), 'announced', []).some((r) => r.kind === 'legislative')).toBe(false)
  })
  it('RAG: JP is amber (not red) when its top-up is exempt only under the SbS package', () => {
    expect(ragFor(jur(projectGlobe(grp('announced', true)), 'JP')).rag).toBe('amber')
    expect(ragFor(jur(projectGlobe(grp('enacted', true)), 'JP')).rag).toBe('red')
  })
  it('usParented is saved and restored (default off)', () => {
    expect(parseStoredGroup(JSON.stringify(grp('announced', true)))?.usParented).toBe(true)
    const { usParented: _omit, ...legacy } = grp('enacted', true)
    void _omit
    expect(parseStoredGroup(JSON.stringify(legacy))?.usParented).toBe(false)
  })
})
