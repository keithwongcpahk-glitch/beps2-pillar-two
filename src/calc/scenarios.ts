/** Scenario A/B comparison. Pure. */
import type { ProjectionV3 } from './globe'

export interface Figures {
  topUp: number
  domestic: number
  iir: number
  utprResidual: number
  etr: number | null
}

export interface ComparisonRow {
  code: string
  a: Figures
  b: Figures
  delta: { topUp: number; domestic: number; iir: number; utprResidual: number }
}

export interface ScenarioComparison {
  a: { label: string; fiscalYearStart: string }
  b: { label: string; fiscalYearStart: string }
  rows: ComparisonRow[]
  totals: { a: Omit<Figures, 'etr'>; b: Omit<Figures, 'etr'>; delta: Omit<Figures, 'etr'> }
}

const ZERO: Figures = { topUp: 0, domestic: 0, iir: 0, utprResidual: 0, etr: null }

function figures(p: ProjectionV3, code: string): Figures {
  const j = p.jurisdictions.find((x) => x.code === code)
  return j ? { topUp: j.topUp, domestic: j.domestic, iir: j.iir, utprResidual: j.utprResidual, etr: j.etr } : ZERO
}

export function compareProjections(a: ProjectionV3, b: ProjectionV3, labels: { a: string; b: string } = { a: 'Scenario A', b: 'Scenario B' }): ScenarioComparison {
  const order = ['HK', 'SG', 'JP', 'OTHER']
  const codes = [...new Set([...a.jurisdictions.map((j) => j.code), ...b.jurisdictions.map((j) => j.code)])].sort(
    (x, y) => (order.indexOf(x) < 0 ? 99 : order.indexOf(x)) - (order.indexOf(y) < 0 ? 99 : order.indexOf(y)),
  )
  const rows = codes.map((code) => {
    const fa = figures(a, code)
    const fb = figures(b, code)
    return { code, a: fa, b: fb, delta: { topUp: fb.topUp - fa.topUp, domestic: fb.domestic - fa.domestic, iir: fb.iir - fa.iir, utprResidual: fb.utprResidual - fa.utprResidual } }
  })
  const t = (p: ProjectionV3) => ({ topUp: p.totals.topUp, domestic: p.totals.domestic, iir: p.totals.iir, utprResidual: p.totals.utprResidual })
  const ta = t(a)
  const tb = t(b)
  return {
    a: { label: labels.a, fiscalYearStart: a.fiscalYearStart },
    b: { label: labels.b, fiscalYearStart: b.fiscalYearStart },
    rows,
    totals: { a: ta, b: tb, delta: { topUp: tb.topUp - ta.topUp, domestic: tb.domestic - ta.domestic, iir: tb.iir - ta.iir, utprResidual: tb.utprResidual - ta.utprResidual } },
  }
}
