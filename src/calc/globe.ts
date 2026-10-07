/**
 * Entity-level GloBE engine (oecd-asia-v0.5). Pure functions only.
 * OECD parameters: src/rules/globe-params.v0.5.json. HK / SG / JP rule timing, local TCSH adoption and
 * Singapore's Side-by-Side Safe Harbour (US-parented groups, MTT/IIR only): jurisdiction packs.
 * Simplified projection: not tax advice, not a GIR, not a claim of full OECD / IRD / IRAS / NTA compliance.
 */
import paramsJson from '../rules/globe-params.v0.5.json'
import { getPack, localTcshPeriod, measureCounts, ruleAppliesForFy } from '../rules/jurisdictions'
import type { JurisdictionPack, LegalStatus, LegislativeBasis, TcshBasis } from '../rules/jurisdictions'

export type { LegislativeBasis, TcshBasis }

export type GlobeParams = typeof paramsJson
export const GLOBE_PARAMS: GlobeParams = paramsJson
export const GLOBE_VERSION = paramsJson.version

export type EntityRole = 'UPE' | 'IPE' | 'CE'

export interface EntityInput {
  id: string
  name: string
  jurisdiction: string
  role: EntityRole
  /** UPE's effective ownership interest in this entity, 0–100 (used as the Inclusion Ratio). */
  ownershipPct: number
  minorityOwned?: boolean
  investmentEntity?: boolean
  globeIncome: number
  /** Current Adjusted Covered Taxes (excluding deferred tax). */
  coveredTaxes: number
  /** Deferred tax expense booked in the accounts (positive = expense). */
  deferredTaxExpense: number
  /** Rate at which the deferred tax was booked (e.g. 0.25). */
  deferredTaxRate: number
  eligiblePayroll: number
  eligibleTangibleAssets: number
}

export interface CbcrInput {
  jurisdiction: string
  revenue: number
  profitBeforeTax: number
  simplifiedCoveredTaxes: number
}

export interface GroupInputV3 {
  groupName: string
  consolidatedRevenueEur: number
  /** First day of the fiscal year (YYYY-MM-DD). 12-month FY assumed. */
  fiscalYearStart: string
  applyTransitionalSafeHarbour: boolean
  /**
   * Legislative status basis (v0.5; field name kept from v0.4 for saved data). Default 'enacted': only enacted law.
   * 'announced' also counts measures passed or officially announced but not yet law; 'oecd' applies OECD terms everywhere.
   * Drives the TCSH transition period (v0.4) and Singapore's Side-by-Side Safe Harbour (v0.5).
   */
  tcshBasis?: TcshBasis
  /** v0.5: the UPE is a US entity (US-parented group), the proxy for a qualified side-by-side regime. Default false. */
  usParented?: boolean
  entities: EntityInput[]
  cbcr: CbcrInput[]
}

export type SourceKey = 'minimumRate' | 'threshold' | 'sbie' | 'tcsh' | 'tcshExtension' | 'deferredTax' | 'ordering' | 'investmentEntities' | 'pack'

export interface TrailStep {
  step: string
  formula: string
  value: string
  sourceRef: string
  sourceUrl: string
}

export type TestOutcome = 'pass' | 'fail' | 'n/a'

export interface SafeHarbourResult {
  available: boolean
  reason: string | null
  hasCbcrData: boolean
  transitionRate: number | null
  simplifiedEtr: number | null
  tests: { deMinimis: TestOutcome; simplifiedEtr: TestOutcome; routineProfits: TestOutcome }
  passed: boolean
  /** Whose rules decided availability, e.g. "Hong Kong law (HKMTT)" or "OECD terms". */
  basisLabel: string
  /** Transition period applied. */
  period: { fyBeginsOnOrBefore: string; fyEndsOnOrBefore: string }
  /** Assumption made because local law is silent (flagged in the UI). */
  assumption: string | null
  sourceUrl: string
}

export interface TcshLaw {
  label: string
  period: { fyBeginsOnOrBefore: string; fyEndsOnOrBefore: string }
  /** Set when the collecting jurisdiction does not apply the TCSH at all. */
  blocked: string | null
  assumption: string | null
  /** Extra context when the local period is shorter than the OECD one. */
  periodNote: string | null
  sourceUrl: string
}

export type Collector = 'QDMTT' | 'IIR' | 'UTPR residual' | 'SbS exempt' | 'None'

export interface EntityAllocation {
  entityId: string
  name: string
  topUp: number
  inclusionRatio: number
  iir: number
  minorityShare: number
}

export interface JurisdictionResultV3 {
  code: string
  label: string
  entityCount: number
  excludedEntities: string[]
  globeIncome: number
  netGlobeIncome: number
  currentCoveredTaxes: number
  deferredTaxAdjustment: number
  adjustedCoveredTaxes: number
  etr: number | null
  payrollRate: number
  tangibleRate: number
  sbiePayroll: number
  sbieTangible: number
  sbie: number
  excessProfit: number
  topUpPct: number
  topUpBeforeSafeHarbour: number
  safeHarbour: SafeHarbourResult
  topUp: number
  domestic: number
  domesticLabel: string | null
  qdmttInForce: boolean
  qdmttSafeHarbour: boolean
  iir: number
  iirParent: string | null
  iirParentJurisdiction: string | null
  minorityNotCollected: number
  utprResidual: number
  /** v0.5: residual top-up not charged because Singapore's Side-by-Side Safe Harbour exempts the SG IIR (excluded from topUp). */
  sbsExempt: number
  collectors: Collector[]
  allocations: EntityAllocation[]
  notes: string[]
  trail: TrailStep[]
}

export interface ProjectionV3 {
  version: string
  groupName: string
  fiscalYearStart: string
  fiscalYearEnd: string
  inScope: boolean
  upe: { name: string; jurisdiction: string } | null
  totals: { topUp: number; domestic: number; iir: number; utprResidual: number; minorityNotCollected: number; sbsExempt: number }
  utprInForceIn: string[]
  /** v0.5: Singapore Side-by-Side Safe Harbour outcome for the group. */
  sideBySide: SideBySideOutcome
  jurisdictions: JurisdictionResultV3[]
  warnings: string[]
}

/**
 * - 'n/a': not US-parented, FY before the effective date, or no SG parent applies the IIR;
 * - 'applied': the SG IIR is not charged (basis includes passed / announced law, or the measure is enacted);
 * - 'pending': enacted-only basis and the measure is not yet law, so the SG IIR is still charged;
 * - 'ignored': flagged US-parented but the UPE is located in HK / SG / JP.
 */
export type SideBySideStatus = 'n/a' | 'applied' | 'pending' | 'ignored'

export interface SideBySideOutcome {
  status: SideBySideStatus
  legalStatus: LegalStatus | null
  /** SG parent whose IIR is exempt (or would be, when pending). */
  exemptParent: string | null
  /** Non-SG IPE that applies the IIR instead, if any. */
  fallbackParent: string | null
  /** Top-up the SG IIR would otherwise have collected and that no other modelled parent collects. */
  exempt: number
  /** IIR still charged at the SG parent because the measure is not yet law (status 'pending'). */
  chargedPending: number
  text: string | null
  sourceUrl: string | null
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
const MODEL_RULES_URL = paramsJson.minimumRate.sourceUrl

export const SOURCE_URLS: Record<SourceKey, string> = {
  minimumRate: paramsJson.minimumRate.sourceUrl,
  threshold: paramsJson.revenueThresholdEur.sourceUrl,
  sbie: paramsJson.sbie.sourceUrl,
  tcsh: paramsJson.transitionalCbcrSafeHarbour.sourceUrl,
  tcshExtension: paramsJson.transitionalCbcrSafeHarbour.extensionSourceUrl,
  deferredTax: paramsJson.deferredTax.sourceUrl,
  ordering: paramsJson.ordering.sourceUrl,
  investmentEntities: paramsJson.investmentEntities.sourceUrl,
  pack: MODEL_RULES_URL,
}

/* ---------- small pure helpers ---------- */

function parseDate(d: string): { y: number; m: number; day: number } {
  if (!ISO_DATE.test(d)) throw new Error(`Invalid date: ${d}`)
  const [y, m, day] = d.split('-').map(Number)
  const t = new Date(Date.UTC(y, m - 1, day))
  if (t.getUTCFullYear() !== y || t.getUTCMonth() !== m - 1 || t.getUTCDate() !== day) throw new Error(`Invalid date: ${d}`)
  return { y, m, day }
}

/** Last day of a 12-month fiscal year beginning on `start`. */
export function fiscalYearEndFromStart(start: string): string {
  const { y, m, day } = parseDate(start)
  const t = new Date(Date.UTC(y + 1, m - 1, day - 1))
  return t.toISOString().slice(0, 10)
}

export function sbieRates(fiscalYearStart: string, params: GlobeParams = GLOBE_PARAMS): { payroll: number; tangible: number; note: string | null } {
  const year = parseDate(fiscalYearStart).y
  const table = params.sbie.transitionRates
  const row = table.find((r) => r.fyBeginsIn === year)
  if (row) return { payroll: row.payroll, tangible: row.tangible, note: null }
  const first = table[0]
  const last = table[table.length - 1]
  if (year < first.fyBeginsIn) return { payroll: first.payroll, tangible: first.tangible, note: `FY begins before ${first.fyBeginsIn}; ${first.fyBeginsIn} rates used (GloBE not expected to apply).` }
  if (year > last.fyBeginsIn) return { payroll: params.sbie.permanentPayrollRate, tangible: params.sbie.permanentTangibleRate, note: null }
  throw new Error(`No SBIE rate for ${year}`)
}

export function tcshTransitionRate(fiscalYearStart: string, params: GlobeParams = GLOBE_PARAMS): number | null {
  const year = parseDate(fiscalYearStart).y
  return params.transitionalCbcrSafeHarbour.transitionRates.find((r) => r.fyBeginsIn === year)?.rate ?? null
}

export function inTcshTransitionPeriod(fiscalYearStart: string, params: GlobeParams = GLOBE_PARAMS): boolean {
  const p = params.transitionalCbcrSafeHarbour.transitionPeriod
  const end = fiscalYearEndFromStart(fiscalYearStart)
  return fiscalYearStart <= p.fyBeginsOnOrBefore && end <= p.fyEndsOnOrBefore && tcshTransitionRate(fiscalYearStart, params) !== null
}

/** Art. 4.4.1 simplified: deferred tax expense recast at 15% where booked above 15%. */
export function deferredTaxAdjustment(amount: number, bookedRate: number, minimumRate = GLOBE_PARAMS.minimumRate.value): number {
  if (!amount) return 0
  if (!(bookedRate > minimumRate)) return amount
  return amount * (minimumRate / bookedRate)
}

export function oecdTcshLaw(params: GlobeParams = GLOBE_PARAMS, label = 'OECD terms'): TcshLaw {
  const p = params.transitionalCbcrSafeHarbour.transitionPeriod
  return { label, period: { fyBeginsOnOrBefore: p.fyBeginsOnOrBefore, fyEndsOnOrBefore: p.fyEndsOnOrBefore }, blocked: null, assumption: null, periodNote: null, sourceUrl: params.transitionalCbcrSafeHarbour.sourceUrl }
}

/**
 * Whose TCSH rules decide availability for a jurisdiction (v0.4):
 * the domestic top-up tax law if one is in force, else the IIR parent's law, else OECD terms.
 */
export function resolveTcshLaw(
  pack: JurisdictionPack | undefined,
  qdmttInForce: boolean,
  iirParentJurisdiction: string | null,
  basis: TcshBasis,
  params: GlobeParams = GLOBE_PARAMS,
  iirParentName?: string,
): TcshLaw {
  if (basis === 'oecd') return oecdTcshLaw(params, 'OECD terms (basis: OECD for all jurisdictions)')
  let lawPack: JurisdictionPack | undefined
  let label = ''
  let blocked: string | null = null
  let assumption: string | null = null
  let factUrl = ''
  if (qdmttInForce && pack) {
    lawPack = pack
    const f = pack.transitionalCbcrSafeHarbour.appliesToDomestic
    label = `${pack.name} law (${pack.domesticTopUpTax.shortName})`
    factUrl = f.sourceUrl
    if (f.applies === false) blocked = `${pack.name} does not apply the TCSH to ${pack.domesticTopUpTax.shortName}`
    if (f.applies === null) assumption = `Assumed: ${pack.name} law does not expressly state that the TCSH also zeroes ${pack.domesticTopUpTax.shortName} (unverified)`
  } else if (iirParentJurisdiction) {
    lawPack = getPack(iirParentJurisdiction)
    if (lawPack) {
      const f = lawPack.transitionalCbcrSafeHarbour.appliesToIir
      label = `${lawPack.name} law (IIR${iirParentName ? ` at ${iirParentName}` : ''})`
      factUrl = f.sourceUrl
      if (!f.applies) blocked = `${lawPack.name} does not apply the TCSH to its IIR`
    }
  }
  if (!lawPack) return oecdTcshLaw(params, 'OECD terms (no modelled collecting jurisdiction)')
  const per = localTcshPeriod(lawPack, basis) as NonNullable<ReturnType<typeof localTcshPeriod>>
  const ext = lawPack.transitionalCbcrSafeHarbour.extension
  let periodNote: string | null = null
  if (per.source === 'enacted') {
    periodNote = ext.status === 'announced'
      ? `${lawPack.name} has announced, but not yet enacted, the OECD one-year extension (FYs beginning on or before ${ext.fyBeginsOnOrBefore}). Choose the "enacted + announced" basis to include it.`
      : `The OECD one-year extension (FYs beginning on or before ${ext.fyBeginsOnOrBefore}) has not been adopted in ${lawPack.name} law (unverified absence of an announcement).`
  } else if (per.source === 'extension-announced') {
    periodNote = `Includes the extension ${lawPack.name} has announced but not yet enacted.`
  }
  const sourceUrl = per.source === 'enacted' ? lawPack.transitionalCbcrSafeHarbour.enactedPeriod.sourceUrl : ext.sourceUrl
  return { label, period: { fyBeginsOnOrBefore: per.fyBeginsOnOrBefore, fyEndsOnOrBefore: per.fyEndsOnOrBefore }, blocked, assumption, periodNote, sourceUrl: sourceUrl || factUrl }
}

export function evaluateTcsh(
  cbcr: CbcrInput | undefined,
  sbie: number,
  fiscalYearStart: string,
  enabled: boolean,
  params: GlobeParams = GLOBE_PARAMS,
  law: TcshLaw = oecdTcshLaw(params),
): SafeHarbourResult {
  const none: SafeHarbourResult['tests'] = { deMinimis: 'n/a', simplifiedEtr: 'n/a', routineProfits: 'n/a' }
  const rate = tcshTransitionRate(fiscalYearStart, params)
  const base = { hasCbcrData: !!cbcr, transitionRate: rate, simplifiedEtr: null, tests: none, passed: false, basisLabel: law.label, period: law.period, assumption: law.assumption, sourceUrl: law.sourceUrl }
  if (!enabled) return { ...base, available: false, reason: 'Transitional CbCR safe harbour not applied (switched off)' }
  if (law.blocked) return { ...base, available: false, reason: law.blocked }
  const fyEnd = fiscalYearEndFromStart(fiscalYearStart)
  const inPeriod = fiscalYearStart <= law.period.fyBeginsOnOrBefore && fyEnd <= law.period.fyEndsOnOrBefore && inTcshTransitionPeriod(fiscalYearStart, params)
  if (!inPeriod) {
    const why = `Outside the transition period under ${law.label} (FYs beginning on or before ${law.period.fyBeginsOnOrBefore} and ending on or before ${law.period.fyEndsOnOrBefore})`
    return { ...base, available: false, reason: law.periodNote ? `${why}. ${law.periodNote}` : why }
  }
  if (!cbcr) return { ...base, available: false, reason: 'No CbCR data entered for this jurisdiction' }
  const dm = params.transitionalCbcrSafeHarbour.deMinimis
  const deMinimis: TestOutcome = cbcr.revenue < dm.revenueBelowEur && cbcr.profitBeforeTax < dm.profitBeforeTaxBelowEur ? 'pass' : 'fail'
  const simplifiedEtrValue = cbcr.profitBeforeTax > 0 ? cbcr.simplifiedCoveredTaxes / cbcr.profitBeforeTax : null
  const simplifiedEtr: TestOutcome = simplifiedEtrValue === null ? 'n/a' : simplifiedEtrValue >= (rate as number) ? 'pass' : 'fail'
  const routineProfits: TestOutcome = cbcr.profitBeforeTax <= sbie ? 'pass' : 'fail'
  const tests = { deMinimis, simplifiedEtr, routineProfits }
  return { ...base, available: true, reason: null, simplifiedEtr: simplifiedEtrValue, tests, passed: Object.values(tests).includes('pass') }
}

function qdmttStatus(pack: JurisdictionPack | undefined, fiscalYearStart: string): { inForce: boolean; safeHarbour: boolean; label: string | null } {
  if (!pack) return { inForce: false, safeHarbour: false, label: null }
  const inForce = ruleAppliesForFy(pack.rules.QDMTT, fiscalYearStart)
  const sh = pack.qualifiedStatus.QDMTTSafeHarbour
  const safeHarbour = inForce && /\byes\b/i.test(sh.value) && fiscalYearStart >= sh.effectiveFrom
  return { inForce, safeHarbour, label: pack.domesticTopUpTax.shortName }
}

function iirInForce(jurisdiction: string, fiscalYearStart: string): boolean {
  const pack = getPack(jurisdiction)
  return !!pack && ruleAppliesForFy(pack.rules.IIR, fiscalYearStart)
}

const LABELS: Record<string, string> = { HK: 'Hong Kong SAR', SG: 'Singapore', JP: 'Japan', OTHER: 'Other (non-QDMTT)' }
const pct = (n: number | null, dp = 2) => (n === null ? '—' : `${(n * 100).toFixed(dp)}%`)
const num = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 0 })

const LEGAL_STATUS_TEXT: Record<LegalStatus, string> = { enacted: 'enacted', 'passed-not-enacted': 'passed, not yet law', announced: 'announced, not yet law' }

/**
 * Singapore Side-by-Side Safe Harbour (v0.5). Pure: decides whether the SG IIR is exempt for this group and FY.
 * Qualifying test used: group flagged US-parented, UPE outside HK / SG / JP, IIR parent located in SG,
 * FY beginning on or after the pack's effective date, and the measure counts under the legislative status basis.
 */
export function sgSideBySide(group: GroupInputV3, upe: EntityInput | null, iirParent: EntityInput | null, basis: LegislativeBasis): { status: SideBySideStatus; legalStatus: LegalStatus | null; reason: string | null; sourceUrl: string | null } {
  const sbs = getPack('SG')?.sideBySideSafeHarbour
  if (!group.usParented || !sbs) return { status: 'n/a', legalStatus: sbs?.legalStatus ?? null, reason: null, sourceUrl: null }
  if (upe && getPack(upe.jurisdiction)) return { status: 'ignored', legalStatus: sbs.legalStatus, reason: `The group is flagged as US-parented, but the UPE (${upe.name}) is located in ${upe.jurisdiction}. The Side-by-Side exemption is not applied. Locate the US UPE in "Other".`, sourceUrl: sbs.sourceUrl }
  if (!iirParent || iirParent.jurisdiction !== 'SG') return { status: 'n/a', legalStatus: sbs.legalStatus, reason: null, sourceUrl: sbs.sourceUrl }
  if (group.fiscalYearStart < sbs.effectiveFrom) return { status: 'n/a', legalStatus: sbs.legalStatus, reason: `Singapore's Side-by-Side exemption covers ${sbs.effectiveDate.value.toLowerCase()}. This FY begins earlier, so the SG IIR applies.`, sourceUrl: sbs.sourceUrl }
  return { status: measureCounts(sbs.legalStatus, basis) ? 'applied' : 'pending', legalStatus: sbs.legalStatus, reason: null, sourceUrl: sbs.sourceUrl }
}

/* ---------- main projection ---------- */

export function projectGlobe(group: GroupInputV3, params: GlobeParams = GLOBE_PARAMS): ProjectionV3 {
  const fyStart = group.fiscalYearStart
  const fyEnd = fiscalYearEndFromStart(fyStart)
  const minRate = params.minimumRate.value
  const warnings: string[] = []
  const upes = group.entities.filter((e) => e.role === 'UPE')
  if (upes.length !== 1) warnings.push(upes.length === 0 ? 'No UPE flagged: the IIR cannot be applied at the top of the group.' : 'More than one UPE flagged: the first one is used.')
  const upe = upes[0] ?? null
  const inScope = group.consolidatedRevenueEur >= params.revenueThresholdEur.value
  if (!inScope) warnings.push(`Consolidated revenue below EUR ${num(params.revenueThresholdEur.value)}: the group is out of scope, so all top-up is shown as zero.`)
  const rates = sbieRates(fyStart, params)
  if (rates.note) warnings.push(rates.note)

  // Parent applying the IIR (Art. 2.1.1 / 2.1.3): UPE if its jurisdiction has an IIR in force, else first IPE that does.
  let iirParent: EntityInput | null = null
  if (upe && iirInForce(upe.jurisdiction, fyStart)) iirParent = upe
  else {
    iirParent = group.entities.find((e) => e.role === 'IPE' && iirInForce(e.jurisdiction, fyStart)) ?? null
    if (iirParent) warnings.push(`The UPE's jurisdiction has no IIR in force for this FY. ${iirParent.name} (IPE, ${iirParent.jurisdiction}) applies the IIR. Simplification: its inclusion ratio is taken as the UPE ownership %.`)
  }

  // v0.5: Singapore Side-by-Side Safe Harbour (MTT/IIR only; DTT unaffected).
  const basis: LegislativeBasis = group.tcshBasis ?? 'enacted'
  const sgSbs = sgSideBySide(group, upe, iirParent, basis)
  const sbsFact = getPack('SG')?.sideBySideSafeHarbour
  const sbsLabel = sgSbs.legalStatus ? LEGAL_STATUS_TEXT[sgSbs.legalStatus] : ''
  const exemptParent = sgSbs.status === 'applied' || sgSbs.status === 'pending' ? iirParent : null
  let fallbackParent: EntityInput | null = null
  if (sgSbs.status === 'applied') {
    // The SG IPE no longer applies the IIR, so drop the "IPE applies the IIR" warning; the SbS warning explains.
    const ipeIdx = warnings.findIndex((w) => w.startsWith("The UPE's jurisdiction has no IIR in force"))
    if (ipeIdx >= 0) warnings.splice(ipeIdx, 1)
    fallbackParent = group.entities.find((e) => e.role === 'IPE' && e.jurisdiction !== 'SG' && iirInForce(e.jurisdiction, fyStart)) ?? null
    warnings.push(`SG IIR exempt under the Side-by-Side package (${sbsLabel}): ${iirParent?.name} does not charge Singapore's MTT for this US-parented group.${fallbackParent ? ` ${fallbackParent.name} (IPE, ${fallbackParent.jurisdiction}) applies its IIR instead.` : ''} Singapore's DTT still applies.`)
  } else if (sgSbs.status === 'pending') {
    warnings.push(`The SG IIR at ${iirParent?.name} is still charged under enacted law. It would be exempt once Singapore's Side-by-Side amendments are enacted (Finance (Income Taxes) Bill 2026: ${sbsLabel}). Choose the "enacted + passed / announced" basis to see the effect.`)
  } else if (sgSbs.reason) warnings.push(sgSbs.reason)
  // Parent that actually applies the IIR after the exemption (null = nobody modelled).
  const effParent: EntityInput | null = sgSbs.status === 'applied' ? fallbackParent : iirParent
  if (group.usParented && effParent && effParent.jurisdiction === 'JP' && iirInForce('JP', fyStart)) warnings.push(`Japan's Side-by-Side exemption for its IIR (FY2026 reform; the US designation is reported in the JP pack) is not modelled in v0.5, so the IIR at ${effParent.name} is still shown.`)
  if (group.usParented && effParent && effParent.jurisdiction === 'HK') warnings.push(`No Hong Kong Side-by-Side equivalent is sourced in the HK pack, so the IIR at ${effParent.name} is still shown.`)

  const codes = [...new Set(group.entities.map((e) => e.jurisdiction))]
  const jurisdictions: JurisdictionResultV3[] = codes.map((code) => {
    const all = group.entities.filter((e) => e.jurisdiction === code)
    const included = all.filter((e) => !e.investmentEntity)
    const excluded = all.filter((e) => e.investmentEntity).map((e) => e.name)
    const notes: string[] = []
    const trail: TrailStep[] = []
    const pack = getPack(code)
    if (excluded.length) notes.push(`Investment Entities excluded from blending and SBIE: ${excluded.join(', ')} (Art. 5.1.3 / 5.3.2). Art. 7.4 is not modelled.`)
    all.filter((e) => e.minorityOwned).forEach((e) => notes.push(`${e.name} is flagged minority-owned. Separate blending under Art. 5.6 is not modelled, so it is blended with the jurisdiction.`))

    const globeIncome = included.reduce((s, e) => s + e.globeIncome, 0)
    const netGlobeIncome = Math.max(0, globeIncome)
    const currentCoveredTaxes = included.reduce((s, e) => s + e.coveredTaxes, 0)
    const deferredTaxAdj = included.reduce((s, e) => s + deferredTaxAdjustment(e.deferredTaxExpense, e.deferredTaxRate, minRate), 0)
    const adjustedCoveredTaxes = currentCoveredTaxes + deferredTaxAdj
    const etr = netGlobeIncome > 0 ? adjustedCoveredTaxes / netGlobeIncome : null
    const payroll = included.reduce((s, e) => s + e.eligiblePayroll, 0)
    const tangible = included.reduce((s, e) => s + e.eligibleTangibleAssets, 0)
    const sbiePayroll = payroll * rates.payroll
    const sbieTangible = tangible * rates.tangible
    const sbie = sbiePayroll + sbieTangible
    const excessProfit = Math.max(0, netGlobeIncome - sbie)
    const topUpPct = etr === null ? 0 : Math.max(0, minRate - etr)
    const topUpBeforeSafeHarbour = inScope ? topUpPct * excessProfit : 0

    const R = (key: SourceKey) => SOURCE_URLS[key]
    trail.push({ step: 'GloBE income (net)', formula: `Σ GloBE income of ${included.length} CE(s); Net = max(0, Σ)`, value: num(netGlobeIncome), sourceRef: 'Art. 5.1.2', sourceUrl: R('ordering') })
    trail.push({ step: 'Deferred tax adjustment', formula: 'Σ deferred tax × min(1, 15% ÷ booked rate)', value: num(deferredTaxAdj), sourceRef: 'Art. 4.4.1 (simplified)', sourceUrl: R('deferredTax') })
    trail.push({ step: 'Adjusted covered taxes', formula: `current ${num(currentCoveredTaxes)} + deferred adj. ${num(deferredTaxAdj)}`, value: num(adjustedCoveredTaxes), sourceRef: 'Art. 4.1 / 4.4 (simplified)', sourceUrl: R('deferredTax') })
    trail.push({ step: 'ETR', formula: 'Adjusted covered taxes ÷ Net GloBE income', value: pct(etr), sourceRef: 'Art. 5.1.1', sourceUrl: R('ordering') })
    trail.push({ step: 'SBIE', formula: `payroll ${num(payroll)} × ${pct(rates.payroll, 1)} + tangible assets ${num(tangible)} × ${pct(rates.tangible, 1)} (FY beginning ${fyStart.slice(0, 4)})`, value: num(sbie), sourceRef: 'Art. 5.3.3 / 5.3.4 / 9.2', sourceUrl: R('sbie') })
    trail.push({ step: 'Excess profit', formula: 'max(0, Net GloBE income − SBIE)', value: num(excessProfit), sourceRef: 'Art. 5.2.2', sourceUrl: R('ordering') })
    trail.push({ step: 'Top-up %', formula: `max(0, ${pct(minRate, 0)} − ETR)`, value: pct(topUpPct), sourceRef: 'Art. 5.2.1', sourceUrl: R('minimumRate') })
    trail.push({ step: 'Jurisdictional top-up', formula: 'Top-up % × Excess profit', value: num(topUpBeforeSafeHarbour), sourceRef: 'Art. 5.2.3 (excl. Additional Current Top-up Tax)', sourceUrl: R('ordering') })

    const cb = group.cbcr.find((c) => c.jurisdiction === code)
    const q = qdmttStatus(pack, fyStart)
    // TCSH law: the parent that collects after the SbS exemption; if nobody does, the original parent's law.
    const tcshParent = effParent ?? iirParent
    const parentJur = tcshParent && tcshParent.jurisdiction !== code ? tcshParent.jurisdiction : null
    const law = resolveTcshLaw(pack, q.inForce, parentJur, basis, params, tcshParent?.name)
    const sh = evaluateTcsh(cb, sbie, fyStart, group.applyTransitionalSafeHarbour, params, law)
    const shText = sh.available
      ? `de minimis ${sh.tests.deMinimis}, simplified ETR ${pct(sh.simplifiedEtr)} vs ${pct(sh.transitionRate, 0)} ${sh.tests.simplifiedEtr}, routine profits ${sh.tests.routineProfits}. Basis: ${sh.basisLabel}, FY beginning ≤ ${sh.period.fyBeginsOnOrBefore} and ending ≤ ${sh.period.fyEndsOnOrBefore}`
      : (sh.reason as string)
    trail.push({ step: 'Transitional CbCR safe harbour', formula: shText, value: sh.passed ? 'Passed: top-up deemed zero' : 'Not passed', sourceRef: 'Safe Harbours (Dec 2022) box 1.1; SbS Package ch. 3', sourceUrl: R('tcsh') })
    if (sh.basisLabel && !sh.basisLabel.startsWith('OECD')) trail.push({ step: 'TCSH local adoption', formula: `${sh.basisLabel}: transition period FY beginning ≤ ${sh.period.fyBeginsOnOrBefore}, ending ≤ ${sh.period.fyEndsOnOrBefore}${law.periodNote && !sh.available ? `. ${law.periodNote}` : ''}`, value: law.blocked ? 'Not available' : 'Applied', sourceRef: 'Rule pack: transitionalCbcrSafeHarbour', sourceUrl: sh.sourceUrl })
    if (sh.assumption && group.applyTransitionalSafeHarbour) notes.push(sh.assumption)
    let topUp = sh.passed ? 0 : topUpBeforeSafeHarbour

    // 1) Domestic top-up tax
    let domestic = 0
    let residual = topUp
    if (q.inForce && topUp > 0) {
      domestic = topUp
      residual = 0
      trail.push({ step: `Domestic top-up (${q.label})`, formula: `${q.label} in force for FYs beginning on or after ${pack?.rules.QDMTT.effectiveFrom}; collects the jurisdictional top-up${q.safeHarbour ? '. The QDMTT Safe Harbour (Central Record) deems IIR/UTPR top-up zero' : '. Credited against IIR/UTPR'}`, value: num(domestic), sourceRef: `Art. 5.2.3; ${pack?.packId}`, sourceUrl: pack?.rules.QDMTT.sourceUrl ?? MODEL_RULES_URL })
    } else if (pack && !q.inForce && topUp > 0) {
      notes.push(`${pack.domesticTopUpTax.shortName} does not apply for this FY (it applies to FYs beginning on or after ${pack.rules.QDMTT.effectiveFrom ?? 'n/a'}).`)
    }

    // 2) IIR at the parent (only for CEs outside the parent's jurisdiction, Art. 2.1.6)
    const allocations: EntityAllocation[] = []
    let iir = 0
    let minorityNotCollected = 0
    let utprResidual = 0
    let sbsExempt = 0
    const sgWouldApply = !!exemptParent && exemptParent.jurisdiction !== code
    if (code === 'SG' && (sgSbs.status === 'applied' || sgSbs.status === 'pending') && sbsFact) {
      trail.push({ step: 'Side-by-Side: DTT unaffected', formula: sbsFact.domesticUnaffected.value, value: num(domestic), sourceRef: `${pack?.packId} sideBySideSafeHarbour`, sourceUrl: sbsFact.domesticUnaffected.sourceUrl })
    }
    if (residual > 0 && sgWouldApply && sbsFact) {
      if (sgSbs.status === 'applied') {
        trail.push({ step: `SG IIR exempt under the Side-by-Side package (${sbsLabel})`, formula: `US-parented group; ${exemptParent?.name} (SG) would apply the IIR for ${sbsFact.effectiveDate.value.toLowerCase()}. Finance (Income Taxes) Bill 2026 cl. 38 / 49(b); conditions to follow in regulations.${fallbackParent ? ` The IIR passes to ${fallbackParent.name} (${fallbackParent.jurisdiction}).` : ' No other modelled parent applies an IIR.'}`, value: fallbackParent ? 'SG IIR: 0' : num(residual), sourceRef: `${pack?.packId ?? 'sg.v1'} → sg.v1 sideBySideSafeHarbour`, sourceUrl: sbsFact.sourceUrl })
        if (!fallbackParent) notes.push(`Top-up of ${num(residual)} is not charged: the SG IIR is exempt under the Side-by-Side package (${sbsLabel}). The OECD Side-by-Side Safe Harbour also switches off the UTPR where it is adopted. Other jurisdictions' UTPR is not modelled.`)
      } else {
        trail.push({ step: 'Side-by-Side exemption (not applied)', formula: `US-parented group: the SG IIR at ${exemptParent?.name} would be exempt once enacted (Finance (Income Taxes) Bill 2026: ${sbsLabel}). Basis: enacted law only.`, value: 'SG IIR still charged', sourceRef: 'sg.v1 sideBySideSafeHarbour', sourceUrl: sbsFact.sourceUrl })
        notes.push(`The SG IIR on this jurisdiction would be exempt once Singapore's Side-by-Side amendments are enacted (${sbsLabel}). It is still charged on the enacted-law basis.`)
      }
    }
    if (residual > 0 && sgSbs.status === 'applied' && sgWouldApply && !fallbackParent) {
      sbsExempt = residual
      topUp -= residual
      residual = 0
    }
    if (residual > 0) {
      const positive = included.filter((e) => e.globeIncome > 0)
      const totalPositive = positive.reduce((s, e) => s + e.globeIncome, 0)
      const parentApplies = !!effParent && effParent.jurisdiction !== code
      for (const e of positive) {
        const ceTopUp = totalPositive > 0 ? residual * (e.globeIncome / totalPositive) : 0
        const ratio = parentApplies && e.id !== effParent?.id ? Math.min(1, Math.max(0, e.ownershipPct / 100)) : 0
        const share = ceTopUp * ratio
        allocations.push({ entityId: e.id, name: e.name, topUp: ceTopUp, inclusionRatio: ratio, iir: share, minorityShare: parentApplies ? ceTopUp - share : 0 })
      }
      if (parentApplies) {
        iir = allocations.reduce((s, a) => s + a.iir, 0)
        minorityNotCollected = allocations.reduce((s, a) => s + a.minorityShare, 0)
        trail.push({ step: `IIR at ${effParent?.name} (${effParent?.jurisdiction})`, formula: 'Σ CE top-up (pro rata GloBE income) × inclusion ratio (ownership %)', value: num(iir), sourceRef: 'Art. 2.1 / 2.2 / 5.2.4', sourceUrl: getPack(effParent?.jurisdiction ?? '')?.rules.IIR.sourceUrl ?? MODEL_RULES_URL })
        if (minorityNotCollected > 0.005) notes.push(`Minority owners' share (${num(minorityNotCollected)}) is outside the parent's Allocable Share. Art. 2.5.2 reduces the UTPR to zero where the UPE's interests are held by parents applying a Qualified IIR, so this amount is shown as not collected.`)
      } else {
        utprResidual = residual
        const why = !effParent ? 'no parent entity has an IIR in force for this FY' : `the IIR parent is in the same jurisdiction (Art. 2.1.6 applies the IIR only to CEs outside it)`
        trail.push({ step: 'UTPR residual (flagged)', formula: `Top-up not collected by a domestic top-up tax or the IIR because ${why}`, value: num(utprResidual), sourceRef: 'Art. 2.5 (allocation under Art. 2.6 out of scope)', sourceUrl: R('ordering') })
        notes.push('UTPR residual shown for information only. Allocation across UTPR jurisdictions (Art. 2.6) is out of scope.')
      }
    }

    const collectors: Collector[] = []
    if (domestic > 0) collectors.push('QDMTT')
    if (iir > 0) collectors.push('IIR')
    if (utprResidual > 0) collectors.push('UTPR residual')
    if (sbsExempt > 0) collectors.push('SbS exempt')
    if (!collectors.length) collectors.push('None')

    return {
      code,
      label: LABELS[code] ?? code,
      entityCount: all.length,
      excludedEntities: excluded,
      globeIncome,
      netGlobeIncome,
      currentCoveredTaxes,
      deferredTaxAdjustment: deferredTaxAdj,
      adjustedCoveredTaxes,
      etr,
      payrollRate: rates.payroll,
      tangibleRate: rates.tangible,
      sbiePayroll,
      sbieTangible,
      sbie,
      excessProfit,
      topUpPct,
      topUpBeforeSafeHarbour,
      safeHarbour: sh,
      topUp,
      domestic,
      domesticLabel: q.label,
      qdmttInForce: q.inForce,
      qdmttSafeHarbour: q.safeHarbour,
      iir,
      iirParent: iir > 0 ? effParent?.name ?? null : null,
      iirParentJurisdiction: iir > 0 ? effParent?.jurisdiction ?? null : null,
      minorityNotCollected,
      utprResidual,
      sbsExempt,
      collectors,
      allocations,
      notes,
      trail,
    }
  })

  const order = ['HK', 'SG', 'JP', 'OTHER']
  jurisdictions.sort((a, b) => (order.indexOf(a.code) + 99 * +(order.indexOf(a.code) < 0)) - (order.indexOf(b.code) + 99 * +(order.indexOf(b.code) < 0)))
  const sum = (f: (j: JurisdictionResultV3) => number) => jurisdictions.reduce((s, j) => s + f(j), 0)
  const utprInForceIn = codes.filter((c) => {
    const p = getPack(c)
    return !!p && ruleAppliesForFy(p.rules.UTPR, fyStart)
  })
  return {
    version: params.version,
    groupName: group.groupName,
    fiscalYearStart: fyStart,
    fiscalYearEnd: fyEnd,
    inScope,
    upe: upe ? { name: upe.name, jurisdiction: upe.jurisdiction } : null,
    totals: { topUp: sum((j) => j.topUp), domestic: sum((j) => j.domestic), iir: sum((j) => j.iir), utprResidual: sum((j) => j.utprResidual), minorityNotCollected: sum((j) => j.minorityNotCollected), sbsExempt: sum((j) => j.sbsExempt) },
    utprInForceIn,
    sideBySide: {
      status: sgSbs.status,
      legalStatus: sgSbs.legalStatus,
      exemptParent: exemptParent?.name ?? null,
      fallbackParent: fallbackParent?.name ?? null,
      exempt: sum((j) => j.sbsExempt),
      chargedPending: sgSbs.status === 'pending' ? sum((j) => (j.iirParentJurisdiction === 'SG' ? j.iir : 0)) : 0,
      text: sgSbs.status === 'applied' ? `SG IIR exempt under the Side-by-Side package (${sbsLabel})` : sgSbs.status === 'pending' ? `SG IIR still charged under enacted law; would be exempt once enacted (${sbsLabel})` : sgSbs.reason,
      sourceUrl: sgSbs.sourceUrl,
    },
    jurisdictions,
    warnings,
  }
}
