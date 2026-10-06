/**
 * Pure helpers for the Latest updates page: filters and the local-only review status map.
 * The review status is a browser-local workflow aid. It never edits rules packs or the engine.
 */
import type { AffectsCalc, IntelItem, IntelJurisdiction, ReviewStatus } from './types'

export const REVIEW_STORAGE_KEY = 'p2-intel-review-status-v1'

export interface IntelFilters {
  jurisdiction: IntelJurisdiction | 'ALL'
  topic: string | 'ALL'
  affectsCalc: AffectsCalc | 'ALL'
}

export const NO_FILTERS: IntelFilters = { jurisdiction: 'ALL', topic: 'ALL', affectsCalc: 'ALL' }

export function applyFilters<T extends IntelItem>(items: readonly T[], f: IntelFilters): T[] {
  return items.filter(
    (i) =>
      (f.jurisdiction === 'ALL' || i.jurisdiction === f.jurisdiction) &&
      (f.topic === 'ALL' || i.topic === f.topic) &&
      (f.affectsCalc === 'ALL' || i.affectsCalc === f.affectsCalc),
  )
}

export function distinctTopics(items: readonly IntelItem[]): string[] {
  return [...new Set(items.map((i) => i.topic))].sort((a, b) => a.localeCompare(b))
}

const VALID: ReviewStatus[] = ['new', 'reviewed', 'needs-rule-change']

export type StatusMap = Record<string, ReviewStatus>

/** Parses the stored JSON defensively; unknown values are dropped. */
export function parseStatusMap(raw: string | null | undefined): StatusMap {
  if (!raw) return {}
  try {
    const obj: unknown = JSON.parse(raw)
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return {}
    const out: StatusMap = {}
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      if (typeof v === 'string' && (VALID as string[]).includes(v)) out[k] = v as ReviewStatus
    }
    return out
  } catch {
    return {}
  }
}

export function effectiveStatus(item: IntelItem, map: StatusMap): ReviewStatus {
  return map[item.id] ?? item.status
}

/** Returns a new map; resetting to the item's default status removes the override. */
export function setStatus(map: StatusMap, item: IntelItem, status: ReviewStatus): StatusMap {
  const next = { ...map }
  if (status === item.status) delete next[item.id]
  else next[item.id] = status
  return next
}

export function countByJurisdiction(items: readonly IntelItem[], jurisdictions: readonly IntelJurisdiction[]): Record<IntelJurisdiction, number> {
  const out = Object.fromEntries(jurisdictions.map((j) => [j, 0])) as Record<IntelJurisdiction, number>
  for (const i of items) if (i.jurisdiction in out) out[i.jurisdiction] += 1
  return out
}
