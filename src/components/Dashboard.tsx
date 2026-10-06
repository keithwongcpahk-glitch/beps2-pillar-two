import type { JurisdictionResult } from '../calc/pillarTwo'
import { JurBadge, Tag } from './ui'

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)
}

function pct(n: number | null) {
  if (n === null) return '—'
  return (n * 100).toFixed(1) + '%'
}

export function KpiCards(props: { totalTopUp: number; totalQdmtt: number; totalIir: number; inScope: boolean }) {
  const { totalTopUp, totalQdmtt, totalIir, inScope } = props
  return (
    <div className="kpi-grid">
      <div className="kpi"><span className="kpi-label">In scope (≥ EUR 750m)</span><strong>{inScope ? 'Yes' : 'No'}</strong></div>
      <div className="kpi accent"><span className="kpi-label">Total top-up</span><strong>{fmt(totalTopUp)}</strong></div>
      <div className="kpi"><span className="kpi-label">Domestic top-up (HKMTT / DTT / QDMTT)</span><strong>{fmt(totalQdmtt)}</strong></div>
      <div className="kpi"><span className="kpi-label">IIR (to UPE)</span><strong>{fmt(totalIir)}</strong></div>
    </div>
  )
}

export function EtrChart(props: { rows: JurisdictionResult[]; minEtr: number }) {
  const { minEtr } = props
  const max = Math.max(minEtr, ...props.rows.map((r) => r.etr ?? 0))
  return (
    <div className="panel">
      <div className="panel-head"><h3>ETR by jurisdiction</h3><span className="fine">Marker = {(minEtr * 100).toFixed(0)}% minimum</span></div>
      <div className="bars">
        {props.rows.map((r, i) => {
          const etr = r.etr ?? 0
          const width = max > 0 ? (etr / max) * 100 : 0
          const low = r.etr !== null && r.etr < minEtr
          return (
            <div className="bar-row" key={r.code + i}>
              <span className="bar-label">{r.code}</span>
              <div className="bar-track">
                <div className={'bar-fill' + (low ? ' low' : '')} style={{ width: width + '%' }} />
                <div className="bar-mark" style={{ left: (minEtr / max) * 100 + '%' }} title={`${minEtr * 100}% min ETR`} />
              </div>
              <span className="bar-value">{pct(r.etr)}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function TopUpBreakdown(props: { rows: JurisdictionResult[] }) {
  return (
    <div className="panel">
      <h3>Top-up breakdown</h3>
      <div className="table-wrap">
        <table className="table sticky">
          <thead>
            <tr>
              <th>Jurisdiction</th><th className="num">ETR</th><th className="num">Top-up rate</th><th className="num">Excess profit</th><th className="num">Domestic top-up</th><th className="num">IIR</th><th>Routing</th>
            </tr>
          </thead>
          <tbody>
            {props.rows.map((r, i) => (
              <tr key={r.code + i}>
                <td><JurBadge code={r.code} /> {r.label}</td>
                <td className="num">{pct(r.etr)}</td>
                <td className="num">{pct(r.topUpRate)}</td>
                <td className="num">{fmt(r.excessProfit)}</td>
                <td className="num">{fmt(r.qdmtt)}</td>
                <td className="num">{fmt(r.iir)}</td>
                <td>
                  {r.hasQdmtt ? <Tag tone="ok">{r.qdmttLabel ?? 'QDMTT'}</Tag> : <Tag tone="muted">IIR</Tag>}
                  {r.notes.length > 0 && <div className="fine notes">{r.notes.join(' · ')}</div>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
