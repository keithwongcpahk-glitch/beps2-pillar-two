import { useEffect, useState, type ReactNode } from 'react'
import { GLOBE_PARAMS, SOURCE_URLS } from '../calc/globe'
import type { GroupInputV3, JurisdictionResultV3, ProjectionV3, TestOutcome } from '../calc/globe'
import { Callout, EmptyState, formatDate, JurBadge, PageHeader, SourceLink, Tag } from '../components/ui'
import { href } from '../router'
import { resultsCsvRows, toCsv, withBom } from '../export/csv'
import { downloadText, safeFilePart } from '../export/download'

const eur = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)
const pct = (n: number | null, dp = 2) => (n === null ? '—' : `${(n * 100).toFixed(dp)}%`)

function Outcome({ o, label }: { o: TestOutcome; label: string }) {
  const tone = o === 'pass' ? 'ok' : o === 'fail' ? 'danger' : 'muted'
  return <Tag tone={tone}>{label}: {o}</Tag>
}

function CollectedBy({ j }: { j: JurisdictionResultV3 }) {
  return (
    <span className="cell-stack">
      {j.domestic > 0 && <Tag tone="ok">{j.domesticLabel}</Tag>}
      {j.iir > 0 && <Tag tone="info">IIR · {j.iirParentJurisdiction}</Tag>}
      {j.utprResidual > 0 && <Tag tone="warn">UTPR residual (flagged)</Tag>}
      {j.sbsExempt > 0 && <Tag tone="warn">SG IIR exempt (Side-by-Side, not yet law)</Tag>}
      {j.minorityNotCollected > 0.5 && <Tag tone="muted">Minority share not collected</Tag>}
      {j.topUp === 0 && <Tag tone="muted">No top-up</Tag>}
    </span>
  )
}

function Waterfall({ j }: { j: JurisdictionResultV3 }) {
  const max = Math.max(j.netGlobeIncome, 1)
  const bar = (v: number, cls: string, label: string) => (
    <div className="wf-row">
      <span className="wf-label">{label}</span>
      <div className="wf-track"><div className={`wf-bar ${cls}`} style={{ width: `${Math.max(0, Math.min(100, (v / max) * 100))}%` }} /></div>
      <span className="wf-val">{eur(v)}</span>
    </div>
  )
  return (
    <div className="wf">
      {bar(j.netGlobeIncome, 'income', 'Net GloBE income')}
      {bar(Math.min(j.sbie, j.netGlobeIncome), 'sbie', '− SBIE')}
      {bar(j.excessProfit, 'excess', '= Excess profit')}
      {bar(j.topUpBeforeSafeHarbour, 'topup', `× ${pct(j.topUpPct)} = Top-up`)}
    </div>
  )
}

export interface ResultsPageProps {
  result: ProjectionV3
  input: GroupInputV3
  /** Saves the current inputs as a named scenario; returns the name used. */
  saveScenario: () => string
}

const BASIS_LABEL: Record<string, string> = { enacted: 'enacted law only', announced: 'enacted + passed / announced, not yet law', oecd: 'OECD terms for all' }

/** Opens every explanation-trail section so the browser's print / "Save as PDF" includes all steps. */
function openAllTrails() {
  document.querySelectorAll<HTMLDetailsElement>('details.trail').forEach((d) => (d.open = true))
}

export function ResultsPage({ result, input, saveScenario }: ResultsPageProps) {
  const [saved, setSaved] = useState<string | null>(null)
  useEffect(() => {
    window.addEventListener('beforeprint', openAllTrails)
    return () => window.removeEventListener('beforeprint', openAllTrails)
  }, [])
  const printResults = () => {
    openAllTrails()
    window.print()
  }
  const exportCsv = () => downloadText(`pillar-two-results-${safeFilePart(result.groupName)}-${result.fiscalYearStart}.csv`, withBom(toCsv(resultsCsvRows(result))))
  const rows: { label: string; cell: (j: JurisdictionResultV3) => ReactNode; strong?: boolean }[] = [
    { label: 'Entities (excluded)', cell: (j) => `${j.entityCount}${j.excludedEntities.length ? ` (${j.excludedEntities.length} inv. entity)` : ''}` },
    { label: 'Net GloBE income', cell: (j) => eur(j.netGlobeIncome) },
    { label: 'Adjusted covered taxes', cell: (j) => <>{eur(j.adjustedCoveredTaxes)}{j.deferredTaxAdjustment !== 0 && <div className="fine">incl. deferred {eur(j.deferredTaxAdjustment)}</div>}</> },
    { label: 'ETR', cell: (j) => <strong className={j.etr !== null && j.etr < 0.15 ? 'neg' : ''}>{pct(j.etr)}</strong> },
    { label: 'SBIE (payroll + tangible)', cell: (j) => <>{eur(j.sbie)}<div className="fine">{eur(j.sbiePayroll)} + {eur(j.sbieTangible)}</div></> },
    { label: 'Excess profit', cell: (j) => eur(j.excessProfit) },
    { label: 'Top-up %', cell: (j) => pct(j.topUpPct) },
    { label: 'Top-up before safe harbour', cell: (j) => eur(j.topUpBeforeSafeHarbour) },
    {
      label: 'Transitional CbCR safe harbour',
      cell: (j) =>
        j.safeHarbour.available ? (
          <span className="cell-stack">
            <Outcome o={j.safeHarbour.tests.deMinimis} label="De minimis" />
            <Outcome o={j.safeHarbour.tests.simplifiedEtr} label={`ETR ${pct(j.safeHarbour.simplifiedEtr, 1)} vs ${pct(j.safeHarbour.transitionRate, 0)}`} />
            <Outcome o={j.safeHarbour.tests.routineProfits} label="Routine profits" />
            <span className="fine">Basis: {j.safeHarbour.basisLabel}{j.safeHarbour.assumption ? ' (assumed)' : ''}</span>
          </span>
        ) : (
          <span className="fine">{j.safeHarbour.reason}</span>
        ),
    },
    { label: 'Top-up after safe harbour', cell: (j) => eur(j.topUp), strong: true },
    { label: 'Domestic top-up tax', cell: (j) => (j.domestic > 0 ? <>{eur(j.domestic)} <span className="fine">{j.domesticLabel}{j.qdmttSafeHarbour ? ' · QDMTT SH' : ''}</span></> : '—') },
    { label: 'IIR', cell: (j) => (j.iir > 0 ? <>{eur(j.iir)} <span className="fine">at {j.iirParent}</span></> : '—') },
    { label: 'Minority share (not collected)', cell: (j) => (j.minorityNotCollected > 0.5 ? eur(j.minorityNotCollected) : '—') },
    { label: 'UTPR residual (out of scope)', cell: (j) => (j.utprResidual > 0 ? eur(j.utprResidual) : '—') },
    ...(result.totals.sbsExempt > 0 ? [{ label: 'SG IIR exempt (Side-by-Side)', cell: (j: JurisdictionResultV3) => (j.sbsExempt > 0 ? eur(j.sbsExempt) : '—') }] : []),
    { label: 'Collected by', cell: (j) => <CollectedBy j={j} /> },
  ]
  const t = result.totals
  const sb = GLOBE_PARAMS.transitionalCbcrSafeHarbour
  return (
    <>
      <PageHeader
        eyebrow="Calculator"
        title="GloBE results"
        subtitle={`${result.groupName}: fiscal year ${formatDate(result.fiscalYearStart)} – ${formatDate(result.fiscalYearEnd)}. Jurisdictional blending, SBIE, transitional safe harbour, then domestic top-up tax → IIR → UTPR residual.`}
        actions={
          <>
            <button type="button" className="secondary" onClick={() => setSaved(saveScenario())}>Save as scenario</button>
            <button type="button" className="secondary" onClick={exportCsv}>Export CSV</button>
            <button type="button" className="secondary" onClick={printResults}>Print / save PDF</button>
            <a className="btn" href={href('group')}>Edit group</a>
          </>
        }
      />
      <div className="print-only print-meta">
        <strong>Pillar Two Asia: GloBE results</strong> · {result.groupName} · FY {result.fiscalYearStart} to {result.fiscalYearEnd} · engine {result.version} · legislative status basis: {BASIS_LABEL[input.tcshBasis ?? 'enacted']}{input.usParented ? ' · US-parented group' : ''}
        <br />
        {GLOBE_PARAMS.disclaimer}
      </div>
      {saved && (
        <p className="fine save-status" role="status">
          Saved as "{saved}". <a href={href('scenarios')}>Open Scenarios</a> to rename it or compare it with another scenario.
        </p>
      )}
      {input.entities.length === 0 && (
        <EmptyState title="No entities to calculate">
          Add entities on the <a href={href('group')}>Group & entities</a> page, or reset to the sample group there.
        </EmptyState>
      )}
      <div className="kpi-grid five">
        <div className="kpi accent"><span className="kpi-label">Total top-up</span><strong>{eur(t.topUp)}</strong></div>
        <div className="kpi"><span className="kpi-label">Domestic (HKMTT / DTT / JP QDMTT)</span><strong>{eur(t.domestic)}</strong></div>
        <div className="kpi"><span className="kpi-label">IIR {result.upe ? `(UPE ${result.upe.jurisdiction})` : ''}</span><strong>{eur(t.iir)}</strong></div>
        <div className="kpi"><span className="kpi-label">UTPR residual (flagged)</span><strong>{eur(t.utprResidual)}</strong></div>
        <div className="kpi"><span className="kpi-label">Minority share not collected</span><strong>{eur(t.minorityNotCollected)}</strong></div>
      </div>
      {(result.sideBySide.status === 'applied' || result.sideBySide.status === 'pending') && (
        <Callout tone="warn">
          <strong>{result.sideBySide.status === 'applied' ? 'Relies on passed-not-yet-enacted law.' : 'Side-by-Side exemption not applied (enacted law only).'}</strong>{' '}
          {result.sideBySide.text}.{' '}
          {result.sideBySide.status === 'applied'
            ? `Excluded from the total top-up: ${eur(result.totals.sbsExempt)}.`
            : `SG IIR still charged: ${eur(result.sideBySide.chargedPending)}.`}{' '}
          Finance (Income Taxes) Bill 2026 (Bill No. 22/2026) passed Parliament on 6 Oct 2026; presidential assent, gazetting and the regulations are pending. Singapore's DTT is unaffected.{' '}
          {result.sideBySide.sourceUrl && <SourceLink url={result.sideBySide.sourceUrl} label="MOF second reading speech, 6 Oct 2026" />}
        </Callout>
      )}
      {!result.inScope && <Callout tone="warn">The group is below the EUR 750m threshold, so it is out of scope and every top-up amount is zero.</Callout>}
      {result.warnings.length > 0 && (
        <Callout tone="warn">
          <ul className="plain">{result.warnings.map((w) => <li key={w}>{w}</li>)}</ul>
        </Callout>
      )}
      {result.utprInForceIn.length > 0 && (
        <Callout tone="info">A UTPR is in force for this FY in: {result.utprInForceIn.join(', ')}. The engine flags any residual but does not allocate UTPR (Art. 2.6 is out of scope).</Callout>
      )}

      <section className="panel">
        <div className="panel-head">
          <h3>Jurisdictional waterfall</h3>
          <span className="fine">Ruleset {result.version} · SBIE rates {pct(result.jurisdictions[0]?.payrollRate ?? null, 1)} payroll / {pct(result.jurisdictions[0]?.tangibleRate ?? null, 1)} tangible</span>
        </div>
        {result.jurisdictions.length === 0 ? (
          <EmptyState title="No jurisdictions yet">Add entities on the <a href={href('group')}>Group & entities</a> page.</EmptyState>
        ) : (
          <div className="table-wrap tall">
            <table className="table sticky compare results">
              <thead>
                <tr>
                  <th>Step</th>
                  {result.jurisdictions.map((j) => <th key={j.code}><JurBadge code={j.code} /> {j.label}</th>)}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.label} className={r.strong ? 'row-strong' : ''}>
                    <th scope="row">{r.label}</th>
                    {result.jurisdictions.map((j) => <td key={j.code} className="num-ish">{r.cell(j)}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="grid-auto">
        {result.jurisdictions.map((j) => (
          <section className="panel" key={j.code}>
            <div className="panel-head"><h3><JurBadge code={j.code} /> {j.label}</h3><CollectedBy j={j} /></div>
            <Waterfall j={j} />
          </section>
        ))}
      </div>

      <section className="panel">
        <h3>Explanation trail</h3>
        <p className="fine">Each step shows the formula, the value, and the rule it comes from. Expand a jurisdiction to see its steps.</p>
        {result.jurisdictions.map((j, i) => (
          <details key={j.code} className="trail" open={i === 0}>
            <summary><JurBadge code={j.code} /> {j.label}: top-up {eur(j.topUp)}</summary>
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>#</th><th>Step</th><th>Formula / basis</th><th className="num">Value</th><th>Rule source</th></tr></thead>
                <tbody>
                  {j.trail.map((s, k) => (
                    <tr key={k}>
                      <td>{k + 1}</td>
                      <td><strong>{s.step}</strong></td>
                      <td className="fine">{s.formula}</td>
                      <td className="num">{s.value}</td>
                      <td><SourceLink url={s.sourceUrl} label={s.sourceRef} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {j.allocations.length > 0 && (
              <p className="fine">
                Allocation to CEs (Art. 5.2.4): {j.allocations.map((a) => `${a.name} ${eur(a.topUp)} × ${pct(a.inclusionRatio, 0)} = ${eur(a.iir)}`).join(' · ')}
              </p>
            )}
            {j.notes.length > 0 && <ul className="notes-list">{j.notes.map((n) => <li key={n}>{n}</li>)}</ul>}
          </details>
        ))}
      </section>

      <section className="panel">
        <h3>Parameters and simplifications</h3>
        <ul className="sources">
          <li><SourceLink url={SOURCE_URLS.sbie} label="SBIE: Model Rules Art. 5.3 and Art. 9.2 transition rates" /></li>
          <li><SourceLink url={SOURCE_URLS.tcsh} label="Transitional CbCR safe harbour: OECD Safe Harbours and Penalty Relief (Dec 2022)" /></li>
          <li><SourceLink url={SOURCE_URLS.tcshExtension} label="Extension to FYs beginning by 31 Dec 2027: Side-by-Side Package (Jan 2026), ch. 3" /></li>
          <li><SourceLink url={SOURCE_URLS.deferredTax} label="Deferred tax recast: Model Rules Art. 4.4.1" /></li>
        </ul>
        <p className="fine">{sb.localAdoptionNote} Current legislative status basis: <strong>{BASIS_LABEL[input.tcshBasis ?? 'enacted']}</strong> (change it on the Group & entities page). The same basis decides whether Singapore's Side-by-Side exemption for US-parented groups applies (v0.5).</p>
        <p className="fine">{GLOBE_PARAMS.deferredTax.simplification} {GLOBE_PARAMS.investmentEntities.simplification}</p>
        <p className="fine">Not modelled: Additional Current Top-up Tax, Art. 5.6 minority-owned blending, POPE / split ownership, IIR offset (Art. 2.3), UTPR allocation (Art. 2.6), the UPE safe harbour, Side-by-Side safe harbours other than Singapore's MTT exemption for US-parented groups (Japan's is sourced in its pack but not modelled; Hong Kong has none sourced), the Simplified ETR Safe Harbour, and local deviations in HK / SG / JP law.</p>
      </section>
    </>
  )
}
