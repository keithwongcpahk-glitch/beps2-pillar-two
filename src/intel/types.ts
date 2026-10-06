import updatesJson from './updates.json'
import metaJson from './meta.json'

export type IntelJurisdiction = 'OECD' | 'HK' | 'SG' | 'JP'
export type AffectsCalc = 'yes' | 'no' | 'unknown'
export type ReviewStatus = 'new' | 'reviewed' | 'needs-rule-change'

export interface IntelItem {
  id: string
  date: string
  dateNote?: string
  jurisdiction: IntelJurisdiction
  title: string
  summary: string
  topic: string
  sourceUrl: string
  sourceName: string
  sourceType: 'official' | 'secondary'
  secondarySourceUrl?: string
  secondarySourceName?: string
  affectsCalc: AffectsCalc
  impactNote: string
  status: ReviewStatus
  verified: boolean
  verificationNote?: string
}

export interface IntelMeta {
  lastRefreshed: string
  windowDays: number
  method: string
  coverage: Record<IntelJurisdiction, string>
}

export const INTEL_ITEMS = updatesJson as IntelItem[]
export const INTEL_META = metaJson as IntelMeta
export const INTEL_JURISDICTIONS: IntelJurisdiction[] = ['OECD', 'HK', 'SG', 'JP']
export const REVIEW_STATUSES: ReviewStatus[] = ['new', 'reviewed', 'needs-rule-change']
