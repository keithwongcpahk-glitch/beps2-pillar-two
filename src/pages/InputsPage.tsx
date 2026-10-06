import type { ProjectionResult, Ruleset } from '../calc/pillarTwo'
import { PageHeader, Tag } from '../components/ui'
import { JURISDICTION_OPTIONS, type EditableJurisdiction } from '../defaults'

function money(n: number) {
  return n.toLocaleString('en-US', { maximumFractionDigits: 0 })
}

export interface InputsProps {
  revenue: number
  setRevenue: (n: number) => void
  fiscalYearStart: string
  setFiscalYearStart: (s: string) => void
  rows: EditableJurisdiction[]
  updateRow: (id: string, patch: Partial<EditableJurisdiction>) => void
  addRow: () => void
  removeRow: (id: string) => void
  result: ProjectionResult
  ruleset: Ruleset
}

export function InputsPage(p: InputsProps) {
  return (
    <>
      <PageHeader eyebrow="Quick estimate" title="Quick estimate inputs" subtitle="Jurisdiction-level inputs for when entity data is not yet available. Amounts in EUR. The projection updates as you type. The fiscal-year start sets which HK / SG / JP rules apply." />
      <div className="panel input-grid">
        <label className="field">
          Consolidated revenue (EUR)
          <input type="number" value={p.revenue} onChange={(e) => p.setRevenue(Number(e.target.value))} />
          <span className="fine">Scope threshold EUR {money(p.ruleset.revenueThresholdEur)} (from ruleset)</span>
        </label>
        <label className="field">
          Fiscal year beginning
          <input type="date" value={p.fiscalYearStart} onChange={(e) => e.target.value && p.setFiscalYearStart(e.target.value)} />
          <span className="fine">Example: Japan's QDMTT applies only to FYs beginning on or after 1 Apr 2026.</span>
        </label>
      </div>
      <div className="panel">
        <div className="panel-head">
          <h3>Jurisdictions</h3>
          <button type="button" className="secondary" onClick={p.addRow}>Add row</button>
        </div>
        <div className="table-wrap">
          <table className="table inputs sticky">
            <thead>
              <tr>
                <th>Jurisdiction</th><th>GloBE income</th><th>Covered taxes</th><th>Carve-out</th><th>Safe harbour</th><th>Routing</th><th />
              </tr>
            </thead>
            <tbody>
              {p.rows.map((r, idx) => {
                const res = p.result.jurisdictions[idx]
                return (
                  <tr key={r.id}>
                    <td>
                      <select value={r.code} onChange={(e) => p.updateRow(r.id, { code: e.target.value })} aria-label="Jurisdiction">
                        {JURISDICTION_OPTIONS.map((j) => (
                          <option key={j.code} value={j.code}>{j.code === 'OTHER' ? j.label : `${j.code} — ${j.label}`}</option>
                        ))}
                      </select>
                    </td>
                    <td><input type="number" value={r.globeIncome} onChange={(e) => p.updateRow(r.id, { globeIncome: Number(e.target.value) })} aria-label="GloBE income" /></td>
                    <td><input type="number" value={r.coveredTaxes} onChange={(e) => p.updateRow(r.id, { coveredTaxes: Number(e.target.value) })} aria-label="Covered taxes" /></td>
                    <td><input type="number" value={r.carveOut ?? 0} onChange={(e) => p.updateRow(r.id, { carveOut: Number(e.target.value) })} aria-label="Carve-out" /></td>
                    <td className="center"><input type="checkbox" checked={!!r.transitionalSafeHarbour} onChange={(e) => p.updateRow(r.id, { transitionalSafeHarbour: e.target.checked })} aria-label="Transitional safe harbour" /></td>
                    <td>{res && (res.hasQdmtt ? <Tag tone="ok">{res.qdmttLabel}</Tag> : <Tag tone="muted">IIR</Tag>)}</td>
                    <td><button type="button" className="linkish" onClick={() => p.removeRow(r.id)}>Remove</button></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <p className="fine">
          Live total top-up: <strong>EUR {money(p.result.totalTopUp)}</strong>. Scope is Asia-focused: Hong Kong, Singapore and Japan come from sourced rule packs. Any other jurisdiction
          goes in “Other (non-QDMTT)”, where the residual top-up is shown under the IIR.
        </p>
      </div>
    </>
  )
}
