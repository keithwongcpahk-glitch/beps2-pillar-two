/**
 * Executive dashboard helpers. Pure functions that only aggregate and classify existing
 * engine results, pack facts, calendar rows and intel items. No tax logic lives here:
 * every amount comes from projectGlobe(); the RAG thresholds are presentation settings.
 */
import type { GroupInputV3, JurisdictionResultV3, ProjectionV3 } from './globe'
import { GLOBE_PARAMS } from './globe'
import type { CalendarRow, FilingCalendar } from '../rules/jurisdictions/calendar'
import type { JurisdictionPack, TcshBasis } from '../rules/jurisdictions'
import { listUnverified } from '../rules/jurisdictions'
import type { IntelItem, ReviewStatus } from '../intel/types'

export type Rag = 'red' | 'amber' | 'green' | 'grey'

/** Presentation setting: an ETR within this margin above the 15% minimum is treated as "close". */
export const ETR_BUFFER = 0.01
export const MIN_RATE = GLOBE_PARAMS.minimumRate.value

/** RAG rule, shown verbatim in the UI legend so the classification is never a black box. */
export const RAG_RULES: Record<Rag, string> = {
  red: 'Top-up tax due (any collector).',
  amber: `No top-up, but only via an assumed, announced-not-enacted or OECD-terms safe harbour; or GloBE ETR below ${pct(MIN_RATE + ETR_BUFFER, 0)} (within ${ETR_BUFFER * 100}pp of 15%, or under 15% and covered by the substance carve-out).`,
  green: `No top-up: safe harbour passes under enacted local law with no assumption, or GloBE ETR ${pct(MIN_RATE + ETR_BUFFER, 0)} or more.`,
  grey: 'No net GloBE income (loss or nil), or the group is out of scope.',
}

function pct(n: number, dp = 1): string {
  return `${(n * 100).toFixed(dp)}%`
}

export interface RagResult {
  code: string
  rag: Rag
  reason: string
}

/**
 * Classifies one jurisdiction.
 * @param enactedPass whether the safe harbour also passes when re-run on the "enacted" basis
 *   (pass `undefined` when the current run already uses the enacted basis).
 */
export function ragFor(j: JurisdictionResultV3, enactedPass?: boolean): RagResult {
  const code = j.code
  if (j.topUp > 0) return { code, rag: 'red', reason: `Top-up ${Math.round(j.topUp).toLocaleString('en-US')} due` }
  const comfortable = j.etr !== null && j.etr >= MIN_RATE + ETR_BUFFER
  const sh = j.safeHarbour
  if (sh.passed && j.topUpBeforeSafeHarbour > 0) {
    if (comfortable) return { code, rag: 'green', reason: `ETR ${pct(j.etr as number)} and safe harbour passed` }
    if (sh.assumption) return { code, rag: 'amber', reason: 'Safe harbour pass relies on an assumption (local law silent)' }
    if (enactedPass === false) return { code, rag: 'amber', reason: 'Safe harbour pass relies on an extension that is not enacted locally' }
    if (/^OECD terms/.test(sh.basisLabel)) return { code, rag: 'amber', reason: 'Safe harbour pass on OECD terms (local adoption not modelled)' }
    return { code, rag: 'green', reason: 'Safe harbour passed under enacted local law' }
  }
  if (j.etr === null) return { code, rag: 'grey', reason: 'No net GloBE income' }
  if (comfortable) return { code, rag: 'green', reason: `ETR ${pct(j.etr)} ≥ ${pct(MIN_RATE + ETR_BUFFER, 0)}` }
  if (j.etr < MIN_RATE) return { code, rag: 'amber', reason: `ETR ${pct(j.etr)} below 15%; no top-up only because of the substance carve-out` }
  return { code, rag: 'amber', reason: `ETR ${pct(j.etr)} within ${ETR_BUFFER * 100}pp of 15%` }
}

/** Blended GloBE ETR across jurisdictions with positive net GloBE income (Σ adjusted covered taxes ÷ Σ net GloBE income). Indicative. */
export function blendedEtr(p: ProjectionV3): number | null {
  const rows = p.jurisdictions.filter((j) => j.netGlobeIncome > 0)
  const income = rows.reduce((s, j) => s + j.netGlobeIncome, 0)
  if (income <= 0) return null
  return rows.reduce((s, j) => s + j.adjustedCoveredTaxes, 0) / income
}

export interface DashboardSummary {
  totalTopUp: number
  blendedEtr: number | null
  inScope: boolean
  jurisdictionCount: number
  /** Jurisdictions with a top-up before safe harbours (where a safe harbour would matter). */
  exposedCount: number
  safeHarbourPassed: number
  collectors: { domestic: number; iir: number; utprResidual: number; minorityNotCollected: number }
  rag: RagResult[]
  ragCounts: Record<Rag, number>
}

export function summarize(p: ProjectionV3, enacted?: ProjectionV3): DashboardSummary {
  const rag = p.jurisdictions.map((j): RagResult => {
    if (!p.inScope) return { code: j.code, rag: 'grey', reason: 'Group below the EUR 750m threshold: out of scope' }
    const e = enacted?.jurisdictions.find((x) => x.code === j.code)
    return ragFor(j, e ? e.safeHarbour.passed : undefined)
  })
  const ragCounts: Record<Rag, number> = { red: 0, amber: 0, green: 0, grey: 0 }
  rag.forEach((r) => (ragCounts[r.rag] += 1))
  const exposed = p.jurisdictions.filter((j) => j.topUpBeforeSafeHarbour > 0)
  return {
    totalTopUp: p.totals.topUp,
    blendedEtr: blendedEtr(p),
    inScope: p.inScope,
    jurisdictionCount: p.jurisdictions.length,
    exposedCount: exposed.length,
    safeHarbourPassed: exposed.filter((j) => j.safeHarbour.passed).length,
    collectors: { domestic: p.totals.domestic, iir: p.totals.iir, utprResidual: p.totals.utprResidual, minorityNotCollected: p.totals.minorityNotCollected },
    rag,
    ragCounts,
  }
}

export interface SummaryDelta {
  totalTopUp: number
  blendedEtrPp: number | null
  domestic: number
  iir: number
  utprResidual: number
  safeHarbourPassed: number
}

/** current − comparison. */
export function summaryDelta(current: DashboardSummary, comparison: DashboardSummary): SummaryDelta {
  return {
    totalTopUp: current.totalTopUp - comparison.totalTopUp,
    blendedEtrPp: current.blendedEtr === null || comparison.blendedEtr === null ? null : (current.blendedEtr - comparison.blendedEtr) * 100,
    domestic: current.collectors.domestic - comparison.collectors.domestic,
    iir: current.collectors.iir - comparison.collectors.iir,
    utprResidual: current.collectors.utprResidual - comparison.collectors.utprResidual,
    safeHarbourPassed: current.safeHarbourPassed - comparison.safeHarbourPassed,
  }
}

/** Share of the total top-up by collecting tax, in the order shown in the chart. */
export function collectorSplit(s: DashboardSummary): { key: 'domestic' | 'iir' | 'utprResidual' | 'minorityNotCollected'; label: string; amount: number; share: number }[] {
  const parts = [
    { key: 'domestic' as const, label: 'Domestic top-up taxes', amount: s.collectors.domestic },
    { key: 'iir' as const, label: 'IIR', amount: s.collectors.iir },
    { key: 'utprResidual' as const, label: 'UTPR residual (flagged)', amount: s.collectors.utprResidual },
    { key: 'minorityNotCollected' as const, label: 'Minority share not collected', amount: s.collectors.minorityNotCollected },
  ]
  const total = parts.reduce((a, b) => a + b.amount, 0)
  return parts.map((p) => ({ ...p, share: total > 0 ? p.amount / total : 0 }))
}

/** Next applicable deadlines on or after `today` (ISO date), by adjusted date. */
export function nextDeadlines(cal: FilingCalendar, today: string, n = 5): CalendarRow[] {
  return cal.rows
    .filter((r) => r.applicable && r.adjustedDate !== null && r.adjustedDate >= today)
    .sort((a, b) => (a.adjustedDate as string).localeCompare(b.adjustedDate as string) || a.jurisdiction.localeCompare(b.jurisdiction))
    .slice(0, n)
}

/** Material first (affects calc = yes, or review status "needs rule change"), then newest. */
export function materialUpdates(items: readonly IntelItem[], status: (i: IntelItem) => ReviewStatus, n = 3): (IntelItem & { material: boolean })[] {
  return items
    .map((i) => ({ ...i, material: i.affectsCalc === 'yes' || status(i) === 'needs-rule-change' }))
    .sort((a, b) => Number(b.material) - Number(a.material) || b.date.localeCompare(a.date))
    .slice(0, n)
}

export interface ReadinessCheck {
  label: string
  done: number
  total: number
  missing: string[]
}

/** Input completeness (not tax logic): which data points the engine needs are present. */
export function dataReadiness(g: GroupInputV3): ReadinessCheck[] {
  const jurs = [...new Set(g.entities.map((e) => e.jurisdiction))]
  const cbcr = new Set(g.cbcr.map((c) => c.jurisdiction))
  const sbieMissing = g.entities.filter((e) => !(e.eligiblePayroll > 0) && !(e.eligibleTangibleAssets > 0))
  const dt = g.entities.filter((e) => e.deferredTaxExpense !== 0)
  const dtMissing = dt.filter((e) => !(e.deferredTaxRate > 0))
  return [
    { label: 'CbCR data for the safe harbour', done: jurs.filter((j) => cbcr.has(j)).length, total: jurs.length, missing: jurs.filter((j) => !cbcr.has(j)) },
    { label: 'Payroll / tangible assets (substance carve-out)', done: g.entities.length - sbieMissing.length, total: g.entities.length, missing: sbieMissing.map((e) => e.name) },
    { label: 'Booked rate for deferred tax', done: dt.length - dtMissing.length, total: dt.length, missing: dtMissing.map((e) => e.name) },
  ]
}

export interface RiskItem {
  kind: 'assumption' | 'unverified' | 'basis' | 'warning' | 'simplification'
  text: string
  url?: string
}

const FACT_LABELS: Record<string, string> = {
  'transitionalCbcrSafeHarbour.appliesToDomestic': 'law does not expressly apply the transitional CbCR safe harbour to the domestic top-up tax; the engine assumes it does',
  'transitionalCbcrSafeHarbour.appliesToIir': 'application of the transitional CbCR safe harbour to the IIR not verified',
  'transitionalCbcrSafeHarbour.extension': 'no evidence that the 2027 safe harbour extension has been adopted (absence of evidence only)',
  'transitionalCbcrSafeHarbour.enactedPeriod': 'safe harbour transition period not verified',
}
const MATERIAL_FACT = /^(transitionalCbcrSafeHarbour|rules\.|qualifiedStatus|domesticTopUpTax|filing\.)/

export const MAIN_SIMPLIFICATIONS = [
  'GloBE income and covered taxes are inputs (no Chapter 3/4 adjustments); deferred tax recast is basic only.',
  'Inclusion ratio = ownership %; minority share shown as not collected; no UTPR allocation, POPE or Art. 5.6 blending.',
  '12-month fiscal year; local-law deviations beyond the rule packs are not modelled.',
]

const BASIS_TEXT: Record<TcshBasis, string> = {
  enacted: '',
  announced: 'Safe harbour basis is "enacted + announced": results count extensions that are announced but not yet law.',
  oecd: 'Safe harbour basis is "OECD terms": local adoption is ignored, so results may be more favourable than local law.',
}

/** Unverified facts that matter, assumptions the engine made, and the main simplifications. */
export function keyRisks(p: ProjectionV3, basis: TcshBasis, packs: readonly JurisdictionPack[]): RiskItem[] {
  const out: RiskItem[] = []
  for (const j of p.jurisdictions) {
    if (j.safeHarbour.assumption && j.safeHarbour.passed && j.topUpBeforeSafeHarbour > 0) out.push({ kind: 'assumption', text: `${j.code}: no top-up only because of an assumption. ${j.safeHarbour.assumption}`, url: j.safeHarbour.sourceUrl })
  }
  if (BASIS_TEXT[basis]) out.push({ kind: 'basis', text: BASIS_TEXT[basis] })
  const present = new Set(p.jurisdictions.map((j) => j.code))
  for (const pack of packs) {
    if (!present.has(pack.jurisdiction)) continue
    const unv = listUnverified(pack)
    const material = unv.filter((f) => MATERIAL_FACT.test(f.path))
    for (const f of material) {
      // The HKMTT assumption is already listed above when it changes a result.
      if (f.path === 'transitionalCbcrSafeHarbour.appliesToDomestic' && out.some((o) => o.kind === 'assumption' && o.text.startsWith(pack.jurisdiction))) continue
      out.push({ kind: 'unverified', text: `${pack.jurisdiction}: ${FACT_LABELS[f.path] ?? `${f.path} not verified`}`, url: f.fact.sourceUrl })
    }
    const other = unv.length - material.length
    if (other > 0) out.push({ kind: 'unverified', text: `${pack.jurisdiction}: ${other} descriptive field${other > 1 ? 's' : ''} unverified (no effect on amounts)` })
  }
  p.warnings.forEach((w) => out.push({ kind: 'warning', text: w }))
  MAIN_SIMPLIFICATIONS.forEach((t) => out.push({ kind: 'simplification', text: t }))
  return out
}
