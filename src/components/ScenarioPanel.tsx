import type { GroupInputV3, ProjectionV3 } from '../calc/globe'
import { parseStoredGroup } from '../calc/sampleGroup'
import { useState } from 'react'
import { compareProjections } from '../calc/scenarios'
import { comparisonCsvRows, toCsv, withBom } from '../export/csv'
import { downloadText } from '../export/download'
import { formatDate, JurBadge } from './ui'

const eur = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)
const signed = (n: number) => (Math.abs(n) < 0.5 ? '—' : `${n > 0 ? '+' : '−'}${eur(Math.abs(n))}`)
const pct = (n: number | null) => (n === null ? '—' : `${(n * 100).toFixed(2)}%`)

export function ScenarioPanel(props: {
  current: ProjectionV3
  currentInput: GroupInputV3
  scenarioA: ProjectionV3 | null
  saveA: () => void
  clearA: () => void
  importA: (g: GroupInputV3) => void
}) {
  const { current, scenarioA } = props
  const [importMsg, setImportMsg] = useState<string | null>(null)
  const onImport = async (file: File | undefined) => {
    if (!file) return
    try {
      const g = parseStoredGroup(await file.text())
      if (!g) throw new Error('not a group file')
      props.importA(g)
      setImportMsg(`Imported "${g.groupName}" as scenario A.`)
    } catch {
      setImportMsg('That file is not a valid group inputs JSON exported from this tool.')
    }
  }
  const c = scenarioA ? compareProjections(scenarioA, current, { a: `A: ${scenarioA.groupName}`, b: `B: ${current.groupName} (current)` }) : null
  return (
    <section className="panel">
      <div className="panel-head">
        <h3>Scenario A / B</h3>
        <div className="page-actions">
          <button type="button" className="secondary" onClick={props.saveA}>{scenarioA ? 'Replace A with current inputs' : 'Save current inputs as scenario A'}</button>
          {scenarioA && <button type="button" className="linkish neutral" onClick={props.clearA}>Clear A</button>}
          {c && <button type="button" className="secondary" onClick={() => downloadText('pillar-two-scenario-compare.csv', withBom(toCsv(comparisonCsvRows(c))))}>Export comparison CSV</button>}
          <button type="button" className="secondary" onClick={() => downloadText('pillar-two-group-inputs.json', JSON.stringify(props.currentInput, null, 2), 'application/json')}>Export inputs JSON</button>
          <label className="secondary file-btn">
            Import JSON as A
            <input type="file" accept="application/json,.json" onChange={(e) => { void onImport(e.target.files?.[0]); e.target.value = '' }} />
          </label>
        </div>
      </div>
      {importMsg && <p className="fine" role="status">{importMsg}</p>}
      {!c ? (
        <p className="fine">Save the current inputs as scenario A, change the group on the Group & entities page (e.g. FY start, ownership, taxes), then come back here to see B (current) against A. Scenario A is saved only in this browser.</p>
      ) : (
        <>
          <p className="fine">A: FY beginning {formatDate(c.a.fiscalYearStart)} · B (current): FY beginning {formatDate(c.b.fiscalYearStart)}</p>
          <div className="table-wrap">
            <table className="table sticky">
              <thead>
                <tr><th>Jurisdiction</th><th className="num">ETR A</th><th className="num">ETR B</th><th className="num">Top-up A</th><th className="num">Top-up B</th><th className="num">Δ top-up</th><th className="num">Δ domestic</th><th className="num">Δ IIR</th><th className="num">Δ UTPR residual</th></tr>
              </thead>
              <tbody>
                {c.rows.map((r) => (
                  <tr key={r.code}>
                    <td><JurBadge code={r.code} /></td>
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
        </>
      )}
    </section>
  )
}
