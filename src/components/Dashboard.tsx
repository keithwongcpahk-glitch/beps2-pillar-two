import type { JurisdictionResult } from '../calc/pillarTwo'

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
      <div className="kpi"><span className="kpi-label">In scope</span><strong>{inScope ? "Yes" : "No"}</strong></div>
      <div className="kpi"><span className="kpi-label">Total top-up</span><strong>{fmt(totalTopUp)}</strong></div>
      <div className="kpi"><span className="kpi-label">QDMTT / HKMTT</span><strong>{fmt(totalQdmtt)}</strong></div>
      <div className="kpi"><span className="kpi-label">IIR (to UPE)</span><strong>{fmt(totalIir)}</strong></div>
    </div>
  )
}

export function EtrChart(props: { rows: JurisdictionResult[] }) {
  const max = Math.max(0.15, ...props.rows.map((r) => r.etr ?? 0))
  return (
    <div className="panel">
      <h2>ETR by jurisdiction</h2>
      <div className="bars">
        {props.rows.map((r) => {
          const etr = r.etr ?? 0
          const width = max > 0 ? (etr / max) * 100 : 0
          const low = r.etr !== null && r.etr < 0.15
          return (
            <div className="bar-row" key={r.code}>
              <span className="bar-label">{r.code}</span>
              <div className="bar-track">
                <div className={"bar-fill" + (low ? " low" : "")} style={{ width: width + "%" }} />
                <div className="bar-mark" style={{ left: (0.15 / max) * 100 + "%" }} title="15% min ETR" />
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
      <h2>Top-up breakdown</h2>
      <table className="table">
        <thead>
          <tr>
            <th>Jurisdiction</th><th>ETR</th><th>Top-up rate</th><th>Excess profit</th><th>QDMTT</th><th>IIR</th>
          </tr>
        </thead>
        <tbody>
          {props.rows.map((r) => (
            <tr key={r.code}>
              <td>{r.label} ({r.code})</td>
              <td>{pct(r.etr)}</td>
              <td>{pct(r.topUpRate)}</td>
              <td>{fmt(r.excessProfit)}</td>
              <td>{fmt(r.qdmtt)}{r.qdmttLabel ? ` (${r.qdmttLabel})` : ""}</td>
              <td>{fmt(r.iir)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
