/**
 * Deadline roll-forward from sourced computation-of-time rules (src/rules/holidays.v1.json). Pure.
 * HK: Cap. 1 s.71 (public holidays incl. Sundays). SG: Interpretation Act s.50 (Sundays + public holidays).
 * JP: National Tax General Act Art. 10(2) + Order Art. 2(2) (Sat/Sun, national & general holidays, 29–31 Dec).
 * Holiday lists cover 2026–2027 only; other years roll for weekly rest days and fixed statutory dates only.
 */
import holidaysJson from '../holidays.v1.json'
import type { PackCode } from './index'

export interface HolidayRule {
  rule: { value: string; sourceUrl: string; verified: boolean; note?: string }
  weeklyRestDays: number[]
  fixedMonthDays: string[]
  holidaySources: { name: string; url: string }[]
  holidays: { date: string; name: string }[]
}

export interface HolidayData {
  version: string
  researchedAsOf: string
  coveredYears: number[]
  note: string
  jurisdictions: Record<PackCode, HolidayRule>
}

export const HOLIDAYS = holidaysJson as HolidayData

const DOW = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

function dow(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay()
}

function nextDay(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10)
}

export function holidayCovered(iso: string, data: HolidayData = HOLIDAYS): boolean {
  return data.coveredYears.includes(Number(iso.slice(0, 4)))
}

/** Why a date is not a working day for deadline purposes, or null if it is one. */
export function nonWorkingReason(code: PackCode, iso: string, data: HolidayData = HOLIDAYS): string | null {
  const j = data.jurisdictions[code]
  const wd = dow(iso)
  const holiday = j.holidays.find((h) => h.date === iso)
  if (holiday) return `${holiday.name} (public holiday)`
  if (j.weeklyRestDays.includes(wd)) return DOW[wd]
  if (j.fixedMonthDays.includes(iso.slice(5))) return `${iso.slice(5)} (statutory non-working day)`
  return null
}

export interface RolledDate {
  statutory: string
  adjusted: string
  rolled: boolean
  /** e.g. "Sunday → next day" chain. */
  reasons: string[]
  /** False if any date checked falls outside the years with an official holiday list. */
  holidaysChecked: boolean
}

export function rollForward(code: PackCode, iso: string, data: HolidayData = HOLIDAYS): RolledDate {
  let d = iso
  const reasons: string[] = []
  let covered = holidayCovered(d, data)
  for (let i = 0; i < 31; i++) {
    const why = nonWorkingReason(code, d, data)
    if (!why) break
    reasons.push(`${d}: ${why}`)
    d = nextDay(d)
    covered = covered && holidayCovered(d, data)
  }
  return { statutory: iso, adjusted: d, rolled: d !== iso, reasons, holidaysChecked: covered }
}
