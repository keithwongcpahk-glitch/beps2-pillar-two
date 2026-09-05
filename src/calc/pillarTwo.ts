/**
 * Simplified Pillar Two / GloBE projection engine (v0.1).
 * Pure functions. Tax parameters come from the versioned rules JSON.
 */
import rulesetJson from '../rules/oecd-hk-simplified-v0.1.json'

export const RULESET_VERSION = rulesetJson.version as string

export type JurisdictionCode = string

export interface Ruleset {
  version: string
  minEtr: number
  revenueThresholdEur: number
  features: { substanceCarveOut: boolean; transitionalSafeHarbour: boolean }
  jurisdictions: Record<string, { code: string; label: string; hasQdmtt: boolean; qdmttLabel: string | null }>
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
  inScope: boolean
  totalTopUp: number
  totalQdmtt: number
  totalIir: number
  jurisdictions: JurisdictionResult[]
}

export const defaultRuleset = rulesetJson as Ruleset

function safeDiv(num: number, den: number): number | null {
  if (den === 0) return null
  return num / den
}

export function projectJurisdiction(input: JurisdictionInput, rules: Ruleset = defaultRuleset): JurisdictionResult {
  const meta = rules.jurisdictions[input.code] ?? {
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
  let qdmtt = 0
  let iir = 0
  if (meta.hasQdmtt) qdmtt = jurisdictionalTopUp
  else iir = jurisdictionalTopUp
  return { code: meta.code, label: meta.label, etr, topUpRate, excessProfit, jurisdictionalTopUp, qdmtt, iir, hasQdmtt: meta.hasQdmtt, qdmttLabel: meta.qdmttLabel, notes }
}

export function projectPillarTwo(group: GroupInput): ProjectionResult {
  const rules = group.ruleset ?? defaultRuleset
  const inScope = group.consolidatedRevenueEur >= rules.revenueThresholdEur
  if (!inScope) {
    const jurisdictions = group.jurisdictions.map((j) => {
      const base = projectJurisdiction(j, rules)
      return { ...base, topUpRate: 0, jurisdictionalTopUp: 0, qdmtt: 0, iir: 0, notes: [...base.notes, 'Group out of scope (revenue threshold) — top-up set to 0'] }
    })
    return { rulesetVersion: rules.version, inScope: false, totalTopUp: 0, totalQdmtt: 0, totalIir: 0, jurisdictions }
  }
  const jurisdictions = group.jurisdictions.map((j) => projectJurisdiction(j, rules))
  const totalQdmtt = jurisdictions.reduce((s, j) => s + j.qdmtt, 0)
  const totalIir = jurisdictions.reduce((s, j) => s + j.iir, 0)
  return { rulesetVersion: rules.version, inScope: true, totalTopUp: totalQdmtt + totalIir, totalQdmtt, totalIir, jurisdictions }
}
