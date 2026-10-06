/**
 * Pure helpers for the "Latest updates" 30-day review window.
 * Dates are plain ISO calendar dates (YYYY-MM-DD) so the result does not
 * depend on the viewer's time zone.
 */

export interface DatedItem {
  date: string
}

export interface DateWindow {
  start: string
  end: string
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

function toUtcDay(isoDate: string): number {
  if (!ISO_DATE.test(isoDate)) throw new Error(`Invalid ISO date: ${isoDate}`)
  const [y, m, d] = isoDate.split('-').map(Number)
  const t = Date.UTC(y, m - 1, d)
  const back = new Date(t)
  if (back.getUTCFullYear() !== y || back.getUTCMonth() !== m - 1 || back.getUTCDate() !== d) {
    throw new Error(`Invalid calendar date: ${isoDate}`)
  }
  return t
}

function fromUtcDay(t: number): string {
  return new Date(t).toISOString().slice(0, 10)
}

/**
 * Extracts the calendar date of an ISO timestamp in a fixed UTC offset
 * (default +08:00, Asia/Hong_Kong). "2026-10-05T18:30:00Z" -> "2026-10-06".
 */
export function calendarDateAt(isoTimestamp: string, offsetMinutes = 480): string {
  const t = Date.parse(isoTimestamp)
  if (Number.isNaN(t)) throw new Error(`Invalid timestamp: ${isoTimestamp}`)
  return fromUtcDay(t + offsetMinutes * 60_000)
}

/** Window of `days` days ending on (and including) `endDate`; start = end - days. */
export function windowFor(endDate: string, days: number): DateWindow {
  if (!Number.isInteger(days) || days < 0) throw new Error(`Invalid window length: ${days}`)
  const end = toUtcDay(endDate)
  return { start: fromUtcDay(end - days * 86_400_000), end: endDate }
}

export function isInWindow(date: string, w: DateWindow): boolean {
  const t = toUtcDay(date)
  return t >= toUtcDay(w.start) && t <= toUtcDay(w.end)
}

/** Items whose date falls inside the window (inclusive), newest first. */
export function filterByWindow<T extends DatedItem>(items: readonly T[], w: DateWindow): T[] {
  return items.filter((i) => isInWindow(i.date, w)).sort(byDateDesc)
}

/** Items dated before the window start, newest first. */
export function beforeWindow<T extends DatedItem>(items: readonly T[], w: DateWindow): T[] {
  const start = toUtcDay(w.start)
  return items.filter((i) => toUtcDay(i.date) < start).sort(byDateDesc)
}

export function byDateDesc(a: DatedItem, b: DatedItem): number {
  return a.date < b.date ? 1 : a.date > b.date ? -1 : 0
}
