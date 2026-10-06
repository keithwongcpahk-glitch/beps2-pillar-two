import type { CbcrInput, EntityInput, GroupInputV3 } from './globe'

/** Illustrative sample group (fictional numbers, EUR). Not a tax parameter. */
export const SAMPLE_GROUP: GroupInputV3 = {
  groupName: 'Harbour Holdings Group (sample)',
  consolidatedRevenueEur: 1_200_000_000,
  fiscalYearStart: '2026-01-01',
  applyTransitionalSafeHarbour: true,
  tcshBasis: 'enacted',
  entities: [
    { id: 'hk-upe', name: 'Harbour Holdings Ltd', jurisdiction: 'HK', role: 'UPE', ownershipPct: 100, globeIncome: 50_000_000, coveredTaxes: 4_000_000, deferredTaxExpense: 0, deferredTaxRate: 0.165, eligiblePayroll: 10_000_000, eligibleTangibleAssets: 20_000_000 },
    { id: 'hk-opco', name: 'Harbour Trading (HK) Ltd', jurisdiction: 'HK', role: 'CE', ownershipPct: 100, globeIncome: 30_000_000, coveredTaxes: 1_500_000, deferredTaxExpense: 0, deferredTaxRate: 0.165, eligiblePayroll: 5_000_000, eligibleTangibleAssets: 5_000_000 },
    { id: 'sg-sub', name: 'Harbour Asia Pte Ltd', jurisdiction: 'SG', role: 'CE', ownershipPct: 100, globeIncome: 40_000_000, coveredTaxes: 2_000_000, deferredTaxExpense: 400_000, deferredTaxRate: 0.2, eligiblePayroll: 8_000_000, eligibleTangibleAssets: 12_000_000 },
    { id: 'jp-sub', name: 'Harbour Japan KK', jurisdiction: 'JP', role: 'CE', ownershipPct: 80, globeIncome: 20_000_000, coveredTaxes: 1_500_000, deferredTaxExpense: 600_000, deferredTaxRate: 0.3, eligiblePayroll: 6_000_000, eligibleTangibleAssets: 10_000_000 },
    { id: 'other-dist', name: 'Harbour Distribution (other)', jurisdiction: 'OTHER', role: 'CE', ownershipPct: 100, globeIncome: 500_000, coveredTaxes: 25_000, deferredTaxExpense: 0, deferredTaxRate: 0, eligiblePayroll: 200_000, eligibleTangibleAssets: 100_000 },
  ] satisfies EntityInput[],
  cbcr: [
    { jurisdiction: 'HK', revenue: 400_000_000, profitBeforeTax: 85_000_000, simplifiedCoveredTaxes: 5_500_000 },
    { jurisdiction: 'SG', revenue: 200_000_000, profitBeforeTax: 42_000_000, simplifiedCoveredTaxes: 2_500_000 },
    { jurisdiction: 'JP', revenue: 120_000_000, profitBeforeTax: 21_000_000, simplifiedCoveredTaxes: 2_100_000 },
    { jurisdiction: 'OTHER', revenue: 6_000_000, profitBeforeTax: 500_000, simplifiedCoveredTaxes: 25_000 },
  ] satisfies CbcrInput[],
}

export const GROUP_STORAGE_KEY = 'p2-group-v1'
export const SCENARIO_A_KEY = 'p2-scenario-a-v1'

const ROLES = ['UPE', 'IPE', 'CE']
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

/** Defensive parse of a stored group; returns null when the shape is not usable. */
export function parseStoredGroup(raw: string | null | undefined): GroupInputV3 | null {
  if (!raw) return null
  try {
    const g = JSON.parse(raw) as Partial<GroupInputV3>
    if (!g || typeof g !== 'object') return null
    if (typeof g.groupName !== 'string' || !isNum(g.consolidatedRevenueEur) || typeof g.fiscalYearStart !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(g.fiscalYearStart)) return null
    if (!Array.isArray(g.entities) || !Array.isArray(g.cbcr)) return null
    const entities = g.entities.filter(
      (e): e is EntityInput =>
        !!e && typeof e.id === 'string' && typeof e.name === 'string' && typeof e.jurisdiction === 'string' && ROLES.includes(e.role) &&
        [e.ownershipPct, e.globeIncome, e.coveredTaxes, e.deferredTaxExpense, e.deferredTaxRate, e.eligiblePayroll, e.eligibleTangibleAssets].every(isNum),
    )
    const cbcr = g.cbcr.filter((c): c is CbcrInput => !!c && typeof c.jurisdiction === 'string' && [c.revenue, c.profitBeforeTax, c.simplifiedCoveredTaxes].every(isNum))
    const tcshBasis = g.tcshBasis === 'announced' || g.tcshBasis === 'oecd' ? g.tcshBasis : 'enacted'
    return { groupName: g.groupName, consolidatedRevenueEur: g.consolidatedRevenueEur, fiscalYearStart: g.fiscalYearStart, applyTransitionalSafeHarbour: g.applyTransitionalSafeHarbour !== false, tcshBasis, entities, cbcr }
  } catch {
    return null
  }
}
