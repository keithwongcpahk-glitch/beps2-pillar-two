import { useMemo, useState } from 'react'
import { RULESET_VERSION, projectPillarTwo } from './calc/pillarTwo'
import { KpiCards, EtrChart, TopUpBreakdown } from './components/Dashboard'
import {
  DEFAULT_GROUP_REVENUE,
  DEFAULT_JURISDICTIONS,
  DISCLAIMER,
  JURISDICTION_OPTIONS,
  type EditableJurisdiction,
} from './defaults'

type Nav = 'overview' | 'inputs' | 'about'

function money(n: number) {
  return n.toLocaleString('en-US')
}

export default function App() {
  const [nav, setNav] = useState<Nav>('overview')
  const [revenue, setRevenue] = useState(DEFAULT_GROUP_REVENUE)
  const [rows, setRows] = useState<EditableJurisdiction[]>(DEFAULT_JURISDICTIONS)

  const result = useMemo(
    () =>
      projectPillarTwo({
        consolidatedRevenueEur: revenue,
        jurisdictions: rows.map(({ code, globeIncome, coveredTaxes, carveOut, transitionalSafeHarbour }) => ({
          code,
          globeIncome,
          coveredTaxes,
          carveOut,
          transitionalSafeHarbour,
        })),
      }),
    [revenue, rows],
  )

  function updateRow(id: string, patch: Partial<EditableJurisdiction>) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)))
  }

  function addRow() {
    setRows((prev) => [...prev, { id: String(Date.now()), code: 'OTHER', globeIncome: 0, coveredTaxes: 0, carveOut: 0, transitionalSafeHarbour: false }])
  }

  function removeRow(id: string) {
    setRows((prev) => prev.filter((r) => r.id !== id))
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <h1>Pillar Two</h1>
          <p>HK HKMTT + OECD 15%</p>
        </div>
        <nav>
          <button className={nav === 'overview' ? 'active' : ''} onClick={() => setNav('overview')}>Overview</button>
          <button className={nav === 'inputs' ? 'active' : ''} onClick={() => setNav('inputs')}>Inputs</button>
          <button className={nav === 'about' ? 'active' : ''} onClick={() => setNav('about')}>About</button>
        </nav>
        <div className="sidebar-meta">
          <span className="chip">{RULESET_VERSION}</span>
          <p className="fine">{DISCLAIMER}</p>
        </div>
      </aside>
      <main className="main">
        {nav === 'overview' && (
          <>
            <header className="page-header">
              <h2>Projection overview</h2>
              <p>Simplified GloBE top-up projection for planning conversations.</p>
            </header>
            <KpiCards totalTopUp={result.totalTopUp} totalQdmtt={result.totalQdmtt} totalIir={result.totalIir} inScope={result.inScope} />
            <div className="grid-2">
              <EtrChart rows={result.jurisdictions} />
              <TopUpBreakdown rows={result.jurisdictions} />
            </div>
          </>
        )}
        {nav === 'inputs' && (
          <>
            <header className="page-header">
              <h2>Group inputs</h2>
              <p>Amounts in EUR. Change values to refresh the projection.</p>
            </header>
            <div className="panel">
              <label className="field">
                Consolidated revenue (EUR)
                <input type="number" value={revenue} onChange={(e) => setRevenue(Number(e.target.value))} />
              </label>
              <p className="fine">Threshold: EUR 750,000,000 (from ruleset)</p>
            </div>
            <div className="panel">
              <div className="panel-head">
                <h2>Jurisdictions</h2>
                <button type="button" className="secondary" onClick={addRow}>Add</button>
              </div>
              <div className="inputs-table-wrap">
                <table className="table inputs">
                  <thead>
                    <tr>
                      <th>Code</th><th>GloBE income</th><th>Covered taxes</th><th>Carve-out</th><th>Safe harbour</th><th />
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.id}>
                        <td>
                          <select value={r.code} onChange={(e) => updateRow(r.id, { code: e.target.value })}>
                            {JURISDICTION_OPTIONS.map((j) => (
                              <option key={j.code} value={j.code}>{j.code} — {j.label}</option>
                            ))}
                          </select>
                        </td>
                        <td><input type="number" value={r.globeIncome} onChange={(e) => updateRow(r.id, { globeIncome: Number(e.target.value) })} /></td>
                        <td><input type="number" value={r.coveredTaxes} onChange={(e) => updateRow(r.id, { coveredTaxes: Number(e.target.value) })} /></td>
                        <td><input type="number" value={r.carveOut ?? 0} onChange={(e) => updateRow(r.id, { carveOut: Number(e.target.value) })} /></td>
                        <td><input type="checkbox" checked={!!r.transitionalSafeHarbour} onChange={(e) => updateRow(r.id, { transitionalSafeHarbour: e.target.checked })} /></td>
                        <td><button type="button" className="linkish" onClick={() => removeRow(r.id)}>Remove</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="fine">Live total top-up: EUR {money(result.totalTopUp)}</p>
            </div>
          </>
        )}
        {nav === 'about' && (
          <div className="panel about">
            <h2>About this tool</h2>
            <p>{DISCLAIMER}</p>
            <h3>In scope (v0.1)</h3>
            <ul>
              <li>ETR, top-up rate, excess profit, QDMTT/HKMTT vs IIR</li>
              <li>Substance carve-out and transitional safe harbour flags</li>
              <li>EUR 750m revenue scope test</li>
              <li>Versioned rules JSON (`src/rules/`)</li>
            </ul>
            <h3>Out of scope</h3>
            <ul>
              <li>Pillar One, deferred tax detail, ownership %, UTPR allocation</li>
              <li>Full CbCR safe harbour numeric tests, special entities</li>
              <li>Auto-applying OECD/IRD PDFs to production calc</li>
            </ul>
            <h3>Ruleset</h3>
            <p>Active: <code>{RULESET_VERSION}</code>. See README for how to bump to v0.2.</p>
            <p>Assumptions: <code>docs/CALC_ASSUMPTIONS.md</code></p>
          </div>
        )}
      </main>
    </div>
  )
}
