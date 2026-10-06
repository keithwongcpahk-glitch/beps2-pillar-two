/**
 * Simplified Pillar Two / GloBE projection engine.
 * v0.2 (oecd-asia-v0.2): HK / SG / JP presets are derived from versioned jurisdiction packs
 * for the selected fiscal-year start. The legacy v0.1 ruleset remains usable via `legacyRulesetV01`.
 * Pure functions. Tax parameters come from versioned rules JSON.
 */
import legacyJson from '../rules/oecd-hk-simplified-v0.1.json'
import asiaJson from '../rules/oecd-asia-v0.2.json'
import { JURISDICTION_PACKS, PACK_CODES, presetFromPack } from '../rules/jurisdictions'
import type { JurisdictionPack, PackCode } from '../rules/jurisdictions'

export type JurisdictionCode = string

export interface JurisdictionMeta {
  code: string
  label: string
  hasQdmtt: boolean
  qdmttLabel: string | null
  /** Only for pack-derived presets. */
  qdmttEffectiveFrom?: string | null
  packId?: string
  presetNote?: string | null
}

export interface Ruleset {
  version: string
  minEtr: number
  revenueThresholdEur: number
  features: { substanceCarveOut: boolean; transitionalSafeHarbour: boolean }
  jurisdictions: Record<string, JurisdictionMeta>
  /** Fiscal-year start the pack presets were resolved for (v0.2+). */
  fiscalYearStart?: string
  packs?: string[]
}

export interface JurisdictionInput {
  code: JurisdictionCode
  globeIncome: number
  coveredTaxes: number
  carveOut?: number
  transitionalSafeHarbour?: boolean
}

export interface GroupInput {
  consolidatedRevenueEur: number
  jurisdictions: JurisdictionInput[]
  /** First day of the fiscal year being projected (YYYY-MM-DD). Drives pack presets (e.g. JP QDMTT from FY beginning ≥ 2026-04-01). */
  fiscalYearStart?: string
  /** Explicit ruleset overrides pack resolution (used for the legacy v0.1 path and tests). */
  ruleset?: Ruleset
}

export interface JurisdictionResult {
  code: string
  label: string
  etr: number | null
  topUpRate: number
  excessProfit: number
  jurisdictionalTopUp: number
  qdmtt: number
  iir: number
  hasQdmtt: boolean
  qdmttLabel: string | null
  notes: string[]
}

export interface ProjectionResult {
  rulesetVersion: string
  fiscalYearStart: string | null
  inScope: boolean
  totalTopUp: number
  totalQdmtt: number
  totalIir: number
  jurisdictions: JurisdictionResult[]
}

/** Scenario default only (not a tax parameter): calendar FY2026. */
export const DEFAULT_FISCAL_YEAR_START = '2026-01-01'

type BaseRuleset = Omit<Ruleset, 'fiscalYearStart'>

export const legacyRulesetV01 = legacyJson as Ruleset
const asiaBase = asiaJson as BaseRuleset

/** Merge HK/SG/JP pack presets for a fiscal year into the v0.2 base ruleset. Pure. */
export function buildAsiaRuleset(
  fiscalYearStart: string = DEFAULT_FISCAL_YEAR_START,
  packs: Record<PackCode, JurisdictionPack> = JURISDICTION_PACKS,
  base: BaseRuleset = asiaBase,
): Ruleset {
  const jurisdictions: Record<string, JurisdictionMeta> = {}
  for (const code of PACK_CODES) {
    const p = presetFromPack(packs[code], fiscalYearStart)
    jurisdictions[code] = {
      code: p.code,
      label: p.label,
      hasQdmtt: p.hasQdmtt,
      qdmttLabel: p.qdmttLabel,
      qdmttEffectiveFrom: p.qdmttEffectiveFrom,
      packId: p.packId,
      presetNote: p.presetNote,
    }
  }
  return {
    ...base,
    jurisdictions: { ...jurisdictions, ...base.jurisdictions },
    fiscalYearStart,
  }
}

export const defaultRuleset: Ruleset = buildAsiaRuleset(DEFAULT_FISCAL_YEAR_START)
export const RULESET_VERSION = defaultRuleset.version

function safeDiv(num: number, den: number): number | null {
  if (den === 0) return null
  return num / den
}

export function projectJurisdiction(input: JurisdictionInput, rules: Ruleset = defaultRuleset): JurisdictionResult {
  const meta: JurisdictionMeta = rules.jurisdictions[input.code] ?? {
    code: String(input.code),
    label: String(input.code),
    hasQdmtt: false,
    qdmttLabel: null,
  }
  const notes: string[] = []
  const etr = safeDiv(input.coveredTaxes, input.globeIncome)
  const minEtr = rules.minEtr
  let topUpRate = 0
  if (etr === null) {
    notes.push('GloBE Income is zero — ETR undefined; top-up treated as 0')
  } else {
    topUpRate = Math.max(0, minEtr - etr)
  }
  const carveEnabled = rules.features.substanceCarveOut
  const carve = carveEnabled ? Math.max(0, input.carveOut ?? 0) : 0
  if (!carveEnabled && (input.carveOut ?? 0) > 0) {
    notes.push('Substance carve-out disabled by ruleset features')
  }
  const excessProfit = Math.max(0, input.globeIncome - carve)
  let jurisdictionalTopUp = topUpRate * excessProfit
  const shEnabled = rules.features.transitionalSafeHarbour
  if (shEnabled && input.transitionalSafeHarbour) {
    jurisdictionalTopUp = 0
    notes.push('Transitional safe harbour applied — top-up set to 0')
  } else if (!shEnabled && input.transitionalSafeHarbour) {
    notes.push('Transitional safe harbour flag ignored (feature disabled)')
  }
  if (meta.presetNote) notes.push(meta.presetNote)
  let qdmtt = 0
  let iir = 0
  if (meta.hasQdmtt) qdmtt = jurisdictionalTopUp
  else iir = jurisdictionalTopUp
  return { code: meta.code, label: meta.label, etr, topUpRate, excessProfit, jurisdictionalTopUp, qdmtt, iir, hasQdmtt: meta.hasQdmtt, qdmttLabel: meta.qdmttLabel, notes }
}

export function resolveRuleset(group: Pick<GroupInput, 'ruleset' | 'fiscalYearStart'>): Ruleset {
  if (group.ruleset) return group.ruleset
  return buildAsiaRuleset(group.fiscalYearStart ?? DEFAULT_FISCAL_YEAR_START)
}

export function projectPillarTwo(group: GroupInput): ProjectionResult {
  const rules = resolveRuleset(group)
  const fiscalYearStart = rules.fiscalYearStart ?? null
  const inScope = group.consolidatedRevenueEur >= rules.revenueThresholdEur
  if (!inScope) {
    const jurisdictions = group.jurisdictions.map((j) => {
      const base = projectJurisdiction(j, rules)
      return { ...base, topUpRate: 0, jurisdictionalTopUp: 0, qdmtt: 0, iir: 0, notes: [...base.notes, 'Group out of scope (revenue threshold) — top-up set to 0'] }
    })
    return { rulesetVersion: rules.version, fiscalYearStart, inScope: false, totalTopUp: 0, totalQdmtt: 0, totalIir: 0, jurisdictions }
  }
  const jurisdictions = group.jurisdictions.map((j) => projectJurisdiction(j, rules))
  const totalQdmtt = jurisdictions.reduce((s, j) => s + j.qdmtt, 0)
  const totalIir = jurisdictions.reduce((s, j) => s + j.iir, 0)
  return { rulesetVersion: rules.version, fiscalYearStart, inScope: true, totalTopUp: totalQdmtt + totalIir, totalQdmtt, totalIir, jurisdictions }
}
