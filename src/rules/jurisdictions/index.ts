/**
 * Loader for versioned jurisdiction rule packs (HK / SG / JP).
 * Packs hold sourced facts only; every leaf fact has value + sourceUrl + verified.
 * Pure functions: no I/O beyond the static JSON imports.
 */
import hkJson from './hk.v1.json'
import sgJson from './sg.v1.json'
import jpJson from './jp.v1.json'

export type PackCode = 'HK' | 'SG' | 'JP'
export type RuleKind = 'QDMTT' | 'IIR' | 'UTPR'
export type RuleStatus = 'in-force' | 'deferred' | 'not-implemented'

export interface SourcedFact {
  value: string
  sourceUrl: string
  verified: boolean
  note?: string
}

export interface RuleEntry extends SourcedFact {
  localName: string
  status: RuleStatus
  /** First day of the first fiscal year the rule applies to ("FY beginning on or after"). */
  effectiveFrom: string | null
}

export interface QualifiedEntry extends SourcedFact {
  effectiveFrom: string
}

export interface FilingObligation extends SourcedFact {
  id: string
  obligation: string
  who: string
  kind: 'filing' | 'payment'
  appliesTo: 'GloBE' | RuleKind
  effectiveFrom: string
  monthsAfterFye?: number
  firstYearMonthsAfterFye?: number | null
  firstYearOnly?: boolean
  floorDate?: string
  relativeTo?: string
  monthsAfterRelated?: number
  earliestOnly?: boolean
}

export interface LocalFeature extends SourcedFact {
  title: string
}

export interface PackSource {
  name: string
  url: string
  type: 'official' | 'secondary'
}

export interface TcshPeriod {
  fyBeginsOnOrBefore: string
  fyEndsOnOrBefore: string
}

/** Local adoption of the OECD Transitional CbCR Safe Harbour (TCSH). */
export interface PackTcsh {
  /** Does the TCSH zero the jurisdiction's IIR (GloBE) top-up? */
  appliesToIir: SourcedFact & { applies: boolean }
  /** Does the TCSH zero the domestic top-up tax? null = not expressly stated (engine assumes yes and flags it). */
  appliesToDomestic: SourcedFact & { applies: boolean | null }
  /** Transition period as originally enacted locally. */
  enactedPeriod: SourcedFact & TcshPeriod
  /** OECD one-year extension (SbS Package, Jan 2026) and its local status. */
  extension: SourcedFact & TcshPeriod & { status: 'enacted' | 'announced' | 'not-announced' }
}

/** Legal status of a measure, used with the legislative status basis (v0.5). */
export type LegalStatus = 'enacted' | 'passed-not-enacted' | 'announced'

/**
 * Side-by-Side Safe Harbour (OECD SbS package, Jan 2026) as adopted locally (v0.5: SG only).
 * Exempts qualifying (US-parented) groups from the local IIR; the domestic top-up tax is unaffected.
 */
export interface PackSideBySide extends SourcedFact {
  legalStatus: LegalStatus
  appliesTo: 'IIR'
  /** First day of the first fiscal year covered ("FY commencing on or after"). */
  effectiveFrom: string
  bill: SourcedFact
  effectiveDate: SourcedFact
  qualifyingGroups: SourcedFact
  domesticUnaffected: SourcedFact
}

export interface JurisdictionPack {
  packId: string
  jurisdiction: PackCode
  name: string
  packVersion: string
  researchedAsOf: string
  legislation: SourcedFact
  enactment: SourcedFact
  headlineCitRate: SourcedFact
  domesticTopUpTax: SourcedFact & { localName: string; shortName: string }
  rules: Record<RuleKind, RuleEntry>
  qualifiedStatus: { asAt: string; IIR: QualifiedEntry; QDMTT: QualifiedEntry; QDMTTSafeHarbour: QualifiedEntry }
  filing: FilingObligation[]
  registration: SourcedFact[]
  safeHarbours: SourcedFact
  /** Only present where the pack sources a local Side-by-Side adoption (SG from 1.2.0). */
  sideBySideSafeHarbour?: PackSideBySide
  transitionalCbcrSafeHarbour: PackTcsh
  portal: SourcedFact
  localFeatures: LocalFeature[]
  sources: PackSource[]
}

export const JURISDICTION_PACKS: Record<PackCode, JurisdictionPack> = {
  HK: hkJson as JurisdictionPack,
  SG: sgJson as JurisdictionPack,
  JP: jpJson as JurisdictionPack,
}

export const PACK_CODES: PackCode[] = ['HK', 'SG', 'JP']

export function isPackCode(code: string): code is PackCode {
  return (PACK_CODES as string[]).includes(code)
}

export function getPack(code: string): JurisdictionPack | undefined {
  return isPackCode(code) ? JURISDICTION_PACKS[code] : undefined
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

/** True if the rule is in force for a fiscal year that begins on `fiscalYearStart`. */
export function ruleAppliesForFy(rule: RuleEntry, fiscalYearStart: string): boolean {
  if (rule.status !== 'in-force' || !rule.effectiveFrom) return false
  return fiscalYearStart >= rule.effectiveFrom
}

export interface PackPreset {
  code: PackCode
  label: string
  hasQdmtt: boolean
  qdmttLabel: string | null
  qdmttEffectiveFrom: string | null
  iirInForce: boolean
  utprInForce: boolean
  packId: string
  presetNote: string | null
}

/**
 * Engine preset for one jurisdiction and fiscal year.
 * hasQdmtt is true only when the domestic top-up tax is in force for that FY.
 */
export function presetFromPack(pack: JurisdictionPack, fiscalYearStart: string): PackPreset {
  if (!ISO_DATE.test(fiscalYearStart)) throw new Error(`Invalid fiscal year start: ${fiscalYearStart}`)
  const q = pack.rules.QDMTT
  const hasQdmtt = ruleAppliesForFy(q, fiscalYearStart)
  let presetNote: string | null = null
  if (!hasQdmtt && q.status === 'in-force' && q.effectiveFrom) {
    presetNote = `${pack.domesticTopUpTax.shortName} applies to FYs beginning on or after ${q.effectiveFrom}; residual top-up shown under IIR for this FY.`
  }
  return {
    code: pack.jurisdiction,
    label: pack.name,
    hasQdmtt,
    qdmttLabel: pack.domesticTopUpTax.shortName,
    qdmttEffectiveFrom: q.effectiveFrom,
    iirInForce: ruleAppliesForFy(pack.rules.IIR, fiscalYearStart),
    utprInForce: ruleAppliesForFy(pack.rules.UTPR, fiscalYearStart),
    packId: pack.packId,
    presetNote,
  }
}

export interface FactRef {
  path: string
  fact: SourcedFact
}

/** Flattens every sourced fact in a pack (for validation and the "unverified" list). */
export function listFacts(pack: JurisdictionPack): FactRef[] {
  const out: FactRef[] = []
  const push = (path: string, fact: SourcedFact) => out.push({ path, fact })
  push('legislation', pack.legislation)
  push('enactment', pack.enactment)
  push('headlineCitRate', pack.headlineCitRate)
  push('domesticTopUpTax', pack.domesticTopUpTax)
  for (const k of ['QDMTT', 'IIR', 'UTPR'] as RuleKind[]) push(`rules.${k}`, pack.rules[k])
  push('qualifiedStatus.IIR', pack.qualifiedStatus.IIR)
  push('qualifiedStatus.QDMTT', pack.qualifiedStatus.QDMTT)
  push('qualifiedStatus.QDMTTSafeHarbour', pack.qualifiedStatus.QDMTTSafeHarbour)
  pack.filing.forEach((f) => push(`filing.${f.id}`, f))
  pack.registration.forEach((r, i) => push(`registration[${i}]`, r))
  push('safeHarbours', pack.safeHarbours)
  const sbs = pack.sideBySideSafeHarbour
  if (sbs) {
    push('sideBySideSafeHarbour', sbs)
    push('sideBySideSafeHarbour.bill', sbs.bill)
    push('sideBySideSafeHarbour.effectiveDate', sbs.effectiveDate)
    push('sideBySideSafeHarbour.qualifyingGroups', sbs.qualifyingGroups)
    push('sideBySideSafeHarbour.domesticUnaffected', sbs.domesticUnaffected)
  }
  const t = pack.transitionalCbcrSafeHarbour
  push('transitionalCbcrSafeHarbour.appliesToIir', t.appliesToIir)
  push('transitionalCbcrSafeHarbour.appliesToDomestic', t.appliesToDomestic)
  push('transitionalCbcrSafeHarbour.enactedPeriod', t.enactedPeriod)
  push('transitionalCbcrSafeHarbour.extension', t.extension)
  push('portal', pack.portal)
  pack.localFeatures.forEach((f) => push(`localFeatures.${f.title}`, f))
  return out
}

export function listUnverified(pack: JurisdictionPack): FactRef[] {
  return listFacts(pack).filter((r) => !r.fact.verified)
}

/** Structural checks. Returns a list of problems (empty = valid). */
export function validatePack(pack: JurisdictionPack): string[] {
  const errors: string[] = []
  if (!pack.packId || !/^[a-z]{2}\.v\d+$/.test(pack.packId)) errors.push(`bad packId: ${pack.packId}`)
  if (!ISO_DATE.test(pack.researchedAsOf)) errors.push('researchedAsOf must be YYYY-MM-DD')
  for (const { path, fact } of listFacts(pack)) {
    if (!fact.value || typeof fact.value !== 'string') errors.push(`${path}: missing value`)
    if (typeof fact.sourceUrl !== 'string' || !fact.sourceUrl.startsWith('https://')) errors.push(`${path}: sourceUrl must be https`)
    if (typeof fact.verified !== 'boolean') errors.push(`${path}: verified must be boolean`)
    if (fact.verified === false && !fact.note) errors.push(`${path}: unverified facts need a note`)
  }
  for (const k of ['QDMTT', 'IIR', 'UTPR'] as RuleKind[]) {
    const r = pack.rules[k]
    if (r.status === 'in-force' && (!r.effectiveFrom || !ISO_DATE.test(r.effectiveFrom))) errors.push(`rules.${k}: in-force needs effectiveFrom`)
    if (r.status !== 'in-force' && r.effectiveFrom !== null) errors.push(`rules.${k}: only in-force rules carry effectiveFrom`)
  }
  const t = pack.transitionalCbcrSafeHarbour
  if (!t) errors.push('transitionalCbcrSafeHarbour missing')
  else
    for (const [k, per] of [['enactedPeriod', t.enactedPeriod], ['extension', t.extension]] as const) {
      if (!ISO_DATE.test(per.fyBeginsOnOrBefore) || !ISO_DATE.test(per.fyEndsOnOrBefore)) errors.push(`transitionalCbcrSafeHarbour.${k}: dates must be YYYY-MM-DD`)
    }
  const sbs = pack.sideBySideSafeHarbour
  if (sbs) {
    if (!['enacted', 'passed-not-enacted', 'announced'].includes(sbs.legalStatus)) errors.push(`sideBySideSafeHarbour: bad legalStatus ${sbs.legalStatus}`)
    if (!ISO_DATE.test(sbs.effectiveFrom)) errors.push('sideBySideSafeHarbour.effectiveFrom must be YYYY-MM-DD')
    if (sbs.appliesTo !== 'IIR') errors.push('sideBySideSafeHarbour.appliesTo must be IIR')
  }
  const ids = new Set<string>()
  for (const f of pack.filing) {
    if (ids.has(f.id)) errors.push(`duplicate filing id ${f.id}`)
    ids.add(f.id)
    if (f.kind === 'filing' && typeof f.monthsAfterFye !== 'number') errors.push(`filing.${f.id}: monthsAfterFye required`)
    if (f.kind === 'payment' && (!f.relativeTo || typeof f.monthsAfterRelated !== 'number')) errors.push(`filing.${f.id}: payment needs relativeTo + monthsAfterRelated`)
  }
  for (const f of pack.filing) {
    if (f.relativeTo && !ids.has(f.relativeTo)) errors.push(`filing.${f.id}: unknown relativeTo ${f.relativeTo}`)
  }
  return errors
}

/**
 * Legislative status basis (named "TCSH basis" before v0.5; the stored field is still `tcshBasis`).
 * - enacted: only enacted local law;
 * - announced: also measures passed by the legislature or officially announced but not yet law;
 * - oecd: OECD terms for every jurisdiction.
 * Applies to the TCSH transition period (v0.4) and Singapore's Side-by-Side Safe Harbour (v0.5).
 */
export type TcshBasis = 'enacted' | 'announced' | 'oecd'
export type LegislativeBasis = TcshBasis

/** Whether a measure with this legal status counts under the basis. */
export function measureCounts(status: LegalStatus, basis: LegislativeBasis): boolean {
  return status === 'enacted' || basis !== 'enacted'
}

/**
 * Local TCSH transition period for a pack under a given basis:
 * - enacted: the extension counts only if enacted locally;
 * - announced: also counts an officially announced (not yet enacted) extension;
 * - oecd: callers should use the OECD period instead (returns null).
 */
export function localTcshPeriod(pack: JurisdictionPack, basis: TcshBasis): (TcshPeriod & { source: 'enacted' | 'extension-enacted' | 'extension-announced' }) | null {
  if (basis === 'oecd') return null
  const t = pack.transitionalCbcrSafeHarbour
  const ext = t.extension
  if (ext.status === 'enacted') return { fyBeginsOnOrBefore: ext.fyBeginsOnOrBefore, fyEndsOnOrBefore: ext.fyEndsOnOrBefore, source: 'extension-enacted' }
  if (basis === 'announced' && ext.status === 'announced') return { fyBeginsOnOrBefore: ext.fyBeginsOnOrBefore, fyEndsOnOrBefore: ext.fyEndsOnOrBefore, source: 'extension-announced' }
  return { fyBeginsOnOrBefore: t.enactedPeriod.fyBeginsOnOrBefore, fyEndsOnOrBefore: t.enactedPeriod.fyEndsOnOrBefore, source: 'enacted' }
}
