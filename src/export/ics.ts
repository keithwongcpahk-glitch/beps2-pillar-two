/**
 * RFC 5545 (iCalendar) export of the indicative filing calendar. Pure: the caller passes `now`.
 * One all-day VEVENT per applicable obligation on its adjusted (rolled) due date, with a 14-day reminder.
 */
import type { FilingCalendar } from '../rules/jurisdictions/calendar'
import { DISCLAIMER_ROW } from './csv'

/** Escape TEXT values (RFC 5545 §3.3.11). */
export function icsEscape(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')
}

/** Fold content lines longer than 75 octets (RFC 5545 §3.1), never splitting a UTF-8 character. */
export function icsFold(line: string): string {
  const enc = new TextEncoder()
  if (enc.encode(line).length <= 75) return line
  const out: string[] = []
  let cur = ''
  let curLen = 0
  let limit = 75
  for (const ch of line) {
    const n = enc.encode(ch).length
    if (curLen + n > limit) {
      out.push(cur)
      cur = ''
      curLen = 0
      limit = 74 // continuation lines start with a space
    }
    cur += ch
    curLen += n
  }
  out.push(cur)
  return out.join('\r\n ')
}

const compact = (iso: string) => iso.replace(/-/g, '')

function nextDay(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10)
}

function stamp(now: Date): string {
  return now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

export function calendarToIcs(cal: FilingCalendar, now: Date): string {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Pillar Two Asia//Indicative filing calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${icsEscape(`Pillar Two filing calendar (FYE ${cal.fiscalYearEnd})`)}`,
  ]
  for (const r of cal.rows) {
    if (!r.applicable || !r.adjustedDate || !r.dueDate) continue
    const desc = [
      `Indicative only. FY ${cal.fiscalYearStart} to ${cal.fiscalYearEnd}${cal.firstYear ? ' (first in-scope year)' : ''}.`,
      `Who: ${r.who}.`,
      `Basis: ${r.basis}`,
      `Statutory date: ${r.dueDate}${r.rolled ? `; rolled to ${r.adjustedDate} (${r.rollReasons.join('; ')})` : ''}.`,
      r.holidaysChecked ? '' : 'Public holidays not checked for this year (official list covers 2026–2027); weekend rule only.',
      r.earliestOnly ? 'Earliest possible date only.' : '',
      `Source: ${r.sourceUrl}${r.verified ? '' : ' (unverified)'}`,
      DISCLAIMER_ROW,
    ].filter(Boolean).join('\n')
    lines.push(
      'BEGIN:VEVENT',
      `UID:${r.jurisdiction.toLowerCase()}-${r.obligationId}-${compact(cal.fiscalYearEnd)}@pillar-two-asia`,
      `DTSTAMP:${stamp(now)}`,
      `DTSTART;VALUE=DATE:${compact(r.adjustedDate)}`,
      `DTEND;VALUE=DATE:${compact(nextDay(r.adjustedDate))}`,
      `SUMMARY:${icsEscape(`[${r.jurisdiction}] ${r.obligation} (indicative)`)}`,
      `DESCRIPTION:${icsEscape(desc)}`,
      `URL:${r.sourceUrl}`,
      'TRANSP:TRANSPARENT',
      `CATEGORIES:Pillar Two,${r.jurisdiction},${r.kind}`,
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      `DESCRIPTION:${icsEscape(`${r.jurisdiction}: ${r.obligation} due in 14 days`)}`,
      'TRIGGER:-P14D',
      'END:VALARM',
      'END:VEVENT',
    )
  }
  lines.push('END:VCALENDAR')
  return lines.map(icsFold).join('\r\n') + '\r\n'
}
