import { describe, expect, it } from 'vitest'
import { projectGlobe } from '../calc/globe'
import { SAMPLE_GROUP } from '../calc/sampleGroup'
import { compareProjections } from '../calc/scenarios'
import { JURISDICTION_PACKS, PACK_CODES } from '../rules/jurisdictions'
import { computeFilingCalendar } from '../rules/jurisdictions/calendar'
import { calendarCsvRows, comparisonCsvRows, csvCell, resultsCsvRows, toCsv, withBom, DISCLAIMER_ROW } from './csv'

describe('CSV primitives', () => {
  it('escapes quotes, commas and newlines; blanks nulls; rounds numbers to 2dp', () => {
    expect(csvCell('a,b')).toBe('"a,b"')
    expect(csvCell('say "hi"')).toBe('"say ""hi"""')
    expect(csvCell('line\nbreak')).toBe('"line\nbreak"')
    expect(csvCell(null)).toBe('')
    expect(csvCell(1234.5678)).toBe('1234.57')
    expect(csvCell(-5)).toBe('-5')
  })
  it('neutralises formula injection in text cells', () => {
    expect(csvCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`)
    expect(csvCell('+1')).toBe("'+1")
  })
  it('joins rows with CRLF and adds a BOM on request', () => {
    expect(toCsv([['a', 1], ['b', 2]])).toBe('a,1\r\nb,2\r\n')
    expect(withBom('x').charCodeAt(0)).toBe(0xfeff)
  })
})

describe('exports', () => {
  const p = projectGlobe(SAMPLE_GROUP)

  it('results CSV carries version, disclaimer, one row per jurisdiction and reconciled totals', () => {
    const rows = resultsCsvRows(p)
    const csv = toCsv(rows)
    expect(csv).toContain('oecd-asia-v0.5')
    expect(csv).toContain(DISCLAIMER_ROW)
    const header = rows.findIndex((r) => r[0] === 'Jurisdiction')
    expect(rows.slice(header + 1, header + 5).map((r) => r[0])).toEqual(['HK', 'SG', 'JP', 'OTHER'])
    const total = rows.find((r) => r[0] === 'TOTAL')!
    expect(total[15]).toBeCloseTo(10_905_185, 2)
    expect(total[18]).toBeCloseTo(897_408, 2)
    expect(csv).toContain('Explanation trail')
  })

  it('scenario comparison: JP moves from IIR to JP QDMTT when the FY starts 1 Apr 2026', () => {
    const b = projectGlobe({ ...SAMPLE_GROUP, fiscalYearStart: '2026-04-01' })
    const c = compareProjections(p, b, { a: 'Calendar FY2026', b: 'FY from 1 Apr 2026' })
    const jp = c.rows.find((r) => r.code === 'JP')!
    expect(jp.delta.iir).toBeCloseTo(-897_408, 2)
    expect(jp.delta.domestic).toBeCloseTo(1_121_760, 2)
    expect(c.totals.delta.topUp).toBeCloseTo(0, 2) // jurisdictional top-up unchanged
    expect(c.totals.delta.domestic + c.totals.delta.iir).toBeCloseTo(224_352, 2) // minority share now collected locally
    const csv = toCsv(comparisonCsvRows(c))
    expect(csv).toContain('FY from 1 Apr 2026')
  })

  it('comparison handles jurisdictions present in only one scenario', () => {
    const b = projectGlobe({ ...SAMPLE_GROUP, entities: SAMPLE_GROUP.entities.filter((e) => e.jurisdiction !== 'SG') })
    const c = compareProjections(p, b)
    const sg = c.rows.find((r) => r.code === 'SG')!
    expect(sg.b.topUp).toBe(0)
    expect(sg.delta.topUp).toBeCloseTo(-3_548_300, 2)
  })

  it('filing calendar CSV lists every obligation with its source and the indicative note', () => {
    const cal = computeFilingCalendar('2025-12-31', PACK_CODES.map((c) => JURISDICTION_PACKS[c]), { firstYear: true })
    const rows = calendarCsvRows(cal)
    const header = rows.findIndex((r) => r[0] === 'Statutory due date')
    expect(rows.length - header - 1).toBe(cal.rows.length)
    expect(toCsv(rows)).toContain('Indicative only')
    expect(rows[header + 1][0]).toBe('2026-06-30')
  })
})

/** Minimal RFC 4180 parser used only to round-trip our own output in tests. */
function parseCsv(text: string): string[][] {
  const out: string[][] = []
  let row: string[] = []
  let cell = ''
  let q = false
  const t = text.replace(/^\uFEFF/, '')
  for (let i = 0; i < t.length; i++) {
    const ch = t[i]
    if (q) {
      if (ch === '"' && t[i + 1] === '"') { cell += '"'; i++ } else if (ch === '"') q = false
      else cell += ch
    } else if (ch === '"') q = true
    else if (ch === ',') { row.push(cell); cell = '' }
    else if (ch === '\r' && t[i + 1] === '\n') { row.push(cell); out.push(row); row = []; cell = ''; i++ }
    else cell += ch
  }
  if (cell !== '' || row.length) { row.push(cell); out.push(row) }
  return out
}

describe('round-trip', () => {
  it('results CSV → parse gives the same per-jurisdiction and total top-up figures', () => {
    const p = projectGlobe(SAMPLE_GROUP)
    const parsed = parseCsv(withBom(toCsv(resultsCsvRows(p))))
    const header = parsed.findIndex((r) => r[0] === 'Jurisdiction')
    const col = parsed[header].indexOf('Top-up after safe harbour')
    const body = parsed.slice(header + 1, header + 1 + p.jurisdictions.length)
    const sum = body.reduce((s, r) => s + Number(r[col]), 0)
    const total = parsed.find((r) => r[0] === 'TOTAL')!
    expect(sum).toBeCloseTo(p.totals.topUp, 1)
    expect(Number(total[col])).toBeCloseTo(10_905_185, 1)
    expect(body.map((r) => r[0])).toEqual(p.jurisdictions.map((j) => j.code))
  })
})

describe('scenario inputs JSON', () => {
  it('exported group inputs re-import to an identical projection', async () => {
    const { parseStoredGroup } = await import('../calc/sampleGroup')
    const g = parseStoredGroup(JSON.stringify(SAMPLE_GROUP, null, 2))
    expect(g).not.toBeNull()
    expect(projectGlobe(g!).totals).toEqual(projectGlobe(SAMPLE_GROUP).totals)
    expect(parseStoredGroup('{"not":"a group"}')).toBeNull()
  })
})

describe('ICS export', () => {
  it('produces a valid VCALENDAR: CRLF, folded ≤75 octets, one VEVENT per applicable row on the adjusted date', async () => {
    const { calendarToIcs, icsEscape } = await import('./ics')
    const cal = computeFilingCalendar('2025-09-30', [JURISDICTION_PACKS.JP], { firstYear: false })
    const ics = calendarToIcs(cal, new Date(Date.UTC(2026, 9, 6, 3, 0, 0)))
    expect(ics.startsWith('BEGIN:VCALENDAR\r\nVERSION:2.0\r\n')).toBe(true)
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true)
    expect(ics.replace(/\r\n/g, '')).not.toMatch(/\n/)
    const enc = new TextEncoder()
    for (const line of ics.split('\r\n')) expect(enc.encode(line).length).toBeLessThanOrEqual(75)
    const unfolded = ics.replace(/\r\n /g, '')
    const applicable = cal.rows.filter((r) => r.applicable)
    expect((unfolded.match(/BEGIN:VEVENT/g) ?? []).length).toBe(applicable.length)
    expect((unfolded.match(/END:VEVENT/g) ?? []).length).toBe(applicable.length)
    expect(unfolded).toContain('UID:jp-jp-gir-20250930@pillar-two-asia')
    expect(unfolded).toContain('DTSTART;VALUE=DATE:20270104')
    expect(unfolded).toContain('DTEND;VALUE=DATE:20270105')
    expect(unfolded).toContain('DTSTAMP:20261006T030000Z')
    expect(unfolded).toContain('TRIGGER:-P14D')
    expect(unfolded).toContain('Indicative only')
    expect(icsEscape('a,b;c\\d\ne')).toBe('a\\,b\\;c\\\\d\\ne')
  })
})
