import type { ScenarioComparison } from '../calc/scenarios'
import { JurBadge } from './ui'

const eur = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)
const signed = (n: number) => (Math.abs(n) < 0.5 ? '—' : `${n > 0 ? '+' : '−'}${eur(Math.abs(n))}`)
const pct = (n: number | null) => (n === null ? '—' : `${(n * 100).toFixed(2)}%`)

export function ComparisonTable({ c }: { c: ScenarioComparison }) {
  return (
    <div className="table-wrap">
      <table className="table sticky">
        <caption className="sr-only">Scenario comparison: A is {c.a.label}, B is {c.b.label}</caption>
        <thead>
          <tr><th scope="col">Jurisdiction</th><th scope="col" className="num">ETR A</th><th scope="col" className="num">ETR B</th><th scope="col" className="num">Top-up A</th><th scope="col" className="num">Top-up B</th><th scope="col" className="num">Δ top-up</th><th scope="col" className="num">Δ domestic</th><th scope="col" className="num">Δ IIR</th><th scope="col" className="num">Δ UTPR residual</th></tr>
        </thead>
        <tbody>
          {c.rows.map((r) => (
            <tr key={r.code}>
              <th scope="row"><JurBadge code={r.code} /></th>
              <td className="num">{pct(r.a.etr)}</td>
              <td className="num">{pct(r.b.etr)}</td>
              <td className="num">{eur(r.a.topUp)}</td>
              <td className="num">{eur(r.b.topUp)}</td>
              <td className="num"><strong>{signed(r.delta.topUp)}</strong></td>
              <td className="num">{signed(r.delta.domestic)}</td>
              <td className="num">{signed(r.delta.iir)}</td>
              <td className="num">{signed(r.delta.utprResidual)}</td>
            </tr>
          ))}
          <tr className="row-strong">
            <th scope="row">Total</th><td /><td />
            <td className="num">{eur(c.totals.a.topUp)}</td>
            <td className="num">{eur(c.totals.b.topUp)}</td>
            <td className="num">{signed(c.totals.delta.topUp)}</td>
            <td className="num">{signed(c.totals.delta.domestic)}</td>
            <td className="num">{signed(c.totals.delta.iir)}</td>
            <td className="num">{signed(c.totals.delta.utprResidual)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}
