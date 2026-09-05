import { defaultRuleset, type JurisdictionInput } from './calc/pillarTwo'

export const JURISDICTION_OPTIONS = Object.values(defaultRuleset.jurisdictions)

export interface EditableJurisdiction extends JurisdictionInput {
  id: string
}

export const DEFAULT_GROUP_REVENUE = 1_200_000_000

export const DEFAULT_JURISDICTIONS: EditableJurisdiction[] = [
  { id: '1', code: 'HK', globeIncome: 80_000_000, coveredTaxes: 4_000_000, carveOut: 5_000_000, transitionalSafeHarbour: false },
  { id: '2', code: 'SG', globeIncome: 40_000_000, coveredTaxes: 3_000_000, carveOut: 2_000_000, transitionalSafeHarbour: false },
  { id: '3', code: 'IE', globeIncome: 60_000_000, coveredTaxes: 7_500_000, carveOut: 3_000_000, transitionalSafeHarbour: false },
  { id: '4', code: 'US', globeIncome: 100_000_000, coveredTaxes: 8_000_000, carveOut: 10_000_000, transitionalSafeHarbour: false },
]

export const DISCLAIMER = 'Simplified projection for demo / FP&A planning. Not tax advice. Not a GloBE Information Return (GIR). Not full OECD / IRD compliance.'
