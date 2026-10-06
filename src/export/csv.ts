/**
 * Pure CSV builders for exports (results, scenario comparison, filing calendar).
 * Output is RFC 4180-style CSV; a UTF-8 BOM is prepended by `withBom` so Excel opens non-ASCII text correctly.
 */
import type { ProjectionV3 } from '../calc/globe'
import type { ScenarioComparison } from '../calc/scenarios'
import type { FilingCalendar } from '../rules/jurisdictions/calendar'

export type Cell = string | number | boolean | null | undefined
export const DISCLAIMER_ROW = 'Simplified projection for planning only. Not tax advice. Not a GloBE Information Return (GIR). Not a claim of full OECD / IRD / IRAS / NTA compliance.'

export function csvCell(v: Cell): string {
  if (v === null || v === undefined) return ''
  let s = typeof v === 'number' ? (Number.isFinite(v) ? String(Math.round(v * 100) / 100) : '') : String(v)
  // Neutralise spreadsheet formula injection for text cells.
  if (typeof v === 'string' && /^[=+\-@]/.test(s)) s = `'${s}`
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function toCsv(rows: Cell[][]): string {
  return rows.map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n'
}

export function withBom(csv: string): string {
  return '\uFEFF' + csv
}

const ratio = (n: number | null) => (n === null ? null : Math.round(n * 1e6) / 1e6)

export function resultsCsvRows(p: ProjectionV3): Cell[][] {
  const rows: Cell[][] = [
    ['Pillar Two Asia – GloBE results export'],
    ['Group', p.groupName],
    ['Fiscal year', `${p.fiscalYearStart} to ${p.fiscalYearEnd}`],
    ['Engine version', p.version],
    ['In scope', p.inScope ? 'yes' : 'no'],
    ['Disclaimer', DISCLAIMER_ROW],
    [],
    [
      'Jurisdiction', 'Entities', 'Net GloBE income', 'Adjusted covered taxes', 'Deferred tax adjustment', 'ETR', 'SBIE payroll rate', 'SBIE tangible rate', 'SBIE',
      'Excess profit', 'Top-up %', 'Top-up before safe harbour', 'TCSH de minimis', 'TCSH simplified ETR', 'TCSH routine profits', 'Top-up after safe harbour',
      'Domestic top-up tax', 'Domestic label', 'IIR', 'IIR parent', 'Minority share not collected', 'UTPR residual (flagged)',
    ],
  ]
  for (const j of p.jurisdictions) {
    rows.push([
      j.code, j.entityCount, j.netGlobeIncome, j.adjustedCoveredTaxes, j.deferredTaxAdjustment, ratio(j.etr), j.payrollRate, j.tangibleRate, j.sbie,
      j.excessProfit, ratio(j.topUpPct), j.topUpBeforeSafeHarbour, j.safeHarbour.tests.deMinimis, j.safeHarbour.tests.simplifiedEtr, j.safeHarbour.tests.routineProfits, j.topUp,
      j.domestic, j.domesticLabel, j.iir, j.iirParent, j.minorityNotCollected, j.utprResidual,
    ])
  }
  rows.push(['TOTAL', null, null, null, null, null, null, null, null, null, null, null, null, null, null, p.totals.topUp, p.totals.domestic, null, p.totals.iir, null, p.totals.minorityNotCollected, p.totals.utprResidual])
  rows.push([])
  rows.push(['Explanation trail'])
  rows.push(['Jurisdiction', 'Step', 'Formula / basis', 'Value', 'Rule reference', 'Source URL'])
  for (const j of p.jurisdictions) for (const s of j.trail) rows.push([j.code, s.step, s.formula, s.value, s.sourceRef, s.sourceUrl])
  return rows
}

export function comparisonCsvRows(c: ScenarioComparison): Cell[][] {
  const rows: Cell[][] = [
    ['Pillar Two Asia – scenario comparison'],
    ['Scenario A', c.a.label, `${c.a.fiscalYearStart}`],
    ['Scenario B', c.b.label, `${c.b.fiscalYearStart}`],
    ['Disclaimer', DISCLAIMER_ROW],
    [],
    ['Jurisdiction', 'Top-up A', 'Top-up B', 'Δ top-up', 'Domestic A', 'Domestic B', 'IIR A', 'IIR B', 'UTPR residual A', 'UTPR residual B', 'ETR A', 'ETR B'],
  ]
  for (const r of c.rows) rows.push([r.code, r.a.topUp, r.b.topUp, r.delta.topUp, r.a.domestic, r.b.domestic, r.a.iir, r.b.iir, r.a.utprResidual, r.b.utprResidual, ratio(r.a.etr), ratio(r.b.etr)])
  rows.push(['TOTAL', c.totals.a.topUp, c.totals.b.topUp, c.totals.delta.topUp, c.totals.a.domestic, c.totals.b.domestic, c.totals.a.iir, c.totals.b.iir, c.totals.a.utprResidual, c.totals.b.utprResidual])
  return rows
}

export function calendarCsvRows(cal: FilingCalendar): Cell[][] {
  const rows: Cell[][] = [
    ['Pillar Two Asia – indicative filing calendar'],
    ['Fiscal year', `${cal.fiscalYearStart} to ${cal.fiscalYearEnd}`],
    ['First in-scope year', cal.firstYear ? 'yes' : 'no'],
    ['Note', 'Indicative only. 12-month FY assumed. Adjusted due date rolls weekends/public holidays forward under each jurisdiction\'s computation-of-time rule; official holiday lists cover 2026–2027 only. Check each date against the source.'],
    ['Disclaimer', DISCLAIMER_ROW],
    [],
    ['Statutory due date', 'Adjusted due date', 'Rolled because', 'Holiday list checked', 'Jurisdiction', 'Obligation', 'Who', 'Kind', 'Applicable', 'Reason if not applicable', 'Earliest only', 'Floor applied', 'Basis', 'Source URL', 'Verified'],
  ]
  for (const r of cal.rows)
    rows.push([r.dueDate, r.adjustedDate, r.rollReasons.join('; ') || null, r.dueDate ? (r.holidaysChecked ? 'yes' : 'no (weekend rule only)') : null, r.jurisdiction, r.obligation, r.who, r.kind, r.applicable ? 'yes' : 'no', r.reason, r.earliestOnly ? 'yes' : 'no', r.floorApplied ? 'yes' : 'no', r.basis, r.sourceUrl, r.verified ? 'yes' : 'no'])
  return rows
}
