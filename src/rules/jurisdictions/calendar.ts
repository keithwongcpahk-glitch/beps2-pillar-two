/**
 * Indicative filing calendar built from jurisdiction packs. Pure functions.
 * Limitations: assumes a 12-month fiscal year, does NOT roll weekends/public holidays,
 * and does not model group-specific exemptions (e.g. filing via UPE jurisdiction exchange).
 */
import type { FilingObligation, JurisdictionPack, PackCode } from './index'

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

function parse(date: string): { y: number; m: number; d: number } {
  if (!ISO_DATE.test(date)) throw new Error(`Invalid date: ${date}`)
  const [y, m, d] = date.split('-').map(Number)
  const probe = new Date(Date.UTC(y, m - 1, d))
  if (probe.getUTCFullYear() !== y || probe.getUTCMonth() !== m - 1 || probe.getUTCDate() !== d) {
    throw new Error(`Invalid date: ${date}`)
  }
  return { y, m, d }
}

function fmt(y: number, m: number, d: number): string {
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate()
}

/**
 * Adds calendar months. A month-end date maps to the month-end of the target month
 * (31 Dec + 6 → 30 Jun); other days are clamped to the target month length.
 */
export function addMonths(date: string, months: number): string {
  const { y, m, d } = parse(date)
  const isMonthEnd = d === daysInMonth(y, m)
  const idx = y * 12 + (m - 1) + months
  const ty = Math.floor(idx / 12)
  const tm = (idx % 12) + 1
  const dim = daysInMonth(ty, tm)
  return fmt(ty, tm, isMonthEnd ? dim : Math.min(d, dim))
}

export function addDays(date: string, days: number): string {
  const { y, m, d } = parse(date)
  const t = new Date(Date.UTC(y, m - 1, d + days))
  return fmt(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate())
}

/** First day of a 12-month fiscal year ending on `fye`. */
export function fiscalYearStartFromEnd(fye: string): string {
  return addDays(addMonths(fye, -12), 1)
}

export interface CalendarRow {
  jurisdiction: PackCode
  obligationId: string
  obligation: string
  who: string
  kind: 'filing' | 'payment'
  appliesTo: FilingObligation['appliesTo']
  applicable: boolean
  dueDate: string | null
  reason: string | null
  /** Human-readable basis copied from the pack. */
  basis: string
  floorApplied: boolean
  earliestOnly: boolean
  sourceUrl: string
  verified: boolean
}

export interface CalendarOptions {
  /** Treat this as the group's first in-scope (transition) year → longer first-year deadlines and one-off items. */
  firstYear: boolean
}

export interface FilingCalendar {
  fiscalYearEnd: string
  fiscalYearStart: string
  firstYear: boolean
  rows: CalendarRow[]
}

function ruleActive(pack: JurisdictionPack, o: FilingObligation, fyStart: string): string | null {
  if (fyStart < o.effectiveFrom) return `Not yet effective: applies to FYs beginning on or after ${o.effectiveFrom}`
  if (o.appliesTo !== 'GloBE') {
    const r = pack.rules[o.appliesTo]
    if (r.status !== 'in-force' || !r.effectiveFrom) return `${o.appliesTo} not in force in ${pack.name}`
    if (fyStart < r.effectiveFrom) return `${o.appliesTo} applies to FYs beginning on or after ${r.effectiveFrom}`
  }
  return null
}

export function computeFilingCalendar(
  fiscalYearEnd: string,
  packs: JurisdictionPack[],
  options: CalendarOptions,
): FilingCalendar {
  const fyStart = fiscalYearStartFromEnd(fiscalYearEnd)
  const rows: CalendarRow[] = []
  for (const pack of packs) {
    const due = new Map<string, string>()
    // Filings first so payments can reference them.
    const ordered = [...pack.filing].sort((a, b) => (a.kind === b.kind ? 0 : a.kind === 'filing' ? -1 : 1))
    for (const o of ordered) {
      const base: Omit<CalendarRow, 'applicable' | 'dueDate' | 'reason' | 'floorApplied'> = {
        jurisdiction: pack.jurisdiction,
        obligationId: o.id,
        obligation: o.obligation,
        who: o.who,
        kind: o.kind,
        appliesTo: o.appliesTo,
        basis: o.value,
        earliestOnly: Boolean(o.earliestOnly),
        sourceUrl: o.sourceUrl,
        verified: o.verified,
      }
      let reason = ruleActive(pack, o, fyStart)
      if (!reason && o.firstYearOnly && !options.firstYear) reason = 'One-off: only for the first in-scope fiscal year'
      if (reason) {
        rows.push({ ...base, applicable: false, dueDate: null, reason, floorApplied: false })
        continue
      }
      let date: string | null = null
      if (o.kind === 'filing' && typeof o.monthsAfterFye === 'number') {
        const months = options.firstYear && o.firstYearMonthsAfterFye ? o.firstYearMonthsAfterFye : o.monthsAfterFye
        date = addMonths(fiscalYearEnd, months)
      } else if (o.kind === 'payment' && o.relativeTo && typeof o.monthsAfterRelated === 'number') {
        const rel = due.get(o.relativeTo)
        date = rel ? addMonths(rel, o.monthsAfterRelated) : null
      }
      let floorApplied = false
      if (date && o.floorDate && date < o.floorDate) {
        date = o.floorDate
        floorApplied = true
      }
      if (date) due.set(o.id, date)
      rows.push({
        ...base,
        applicable: date !== null,
        dueDate: date,
        reason: date ? null : 'Could not compute (related deadline not applicable)',
        floorApplied,
      })
    }
  }
  rows.sort((a, b) => {
    if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate) || a.jurisdiction.localeCompare(b.jurisdiction)
    if (a.dueDate) return -1
    if (b.dueDate) return 1
    return a.jurisdiction.localeCompare(b.jurisdiction)
  })
  return { fiscalYearEnd, fiscalYearStart: fyStart, firstYear: options.firstYear, rows }
}
