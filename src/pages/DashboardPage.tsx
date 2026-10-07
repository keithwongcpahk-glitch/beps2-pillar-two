import { useMemo, useState } from 'react'
import { GLOBE_VERSION, projectGlobe } from '../calc/globe'
import type { GroupInputV3, JurisdictionResultV3, ProjectionV3 } from '../calc/globe'
import {
  collectorSplit, dataReadiness, ETR_BUFFER, keyRisks, materialUpdates, MIN_RATE, nextDeadlines, RAG_RULES, summarize, summaryDelta,
  type DashboardSummary, type Rag, type RagResult, type SummaryDelta,
} from '../calc/dashboard'
import type { SavedScenario } from '../calc/scenarioStore'
import { formatDate, JurBadge, Tag } from '../components/ui'
import { DISCLAIMER } from '../defaults'
import { INTEL_ITEMS, INTEL_META } from '../intel/types'
import { effectiveStatus, parseStatusMap, REVIEW_STORAGE_KEY } from '../intel/review'
import { HOLIDAYS } from '../rules/jurisdictions/businessDays'
import { computeFilingCalendar } from '../rules/jurisdictions/calendar'
import { JURISDICTION_PACKS, PACK_CODES } from '../rules/jurisdictions'
import { href } from '../router'

const PACKS = PACK_CODES.map((c) => JURISDICTION_PACKS[c])
const RAG_LABEL: Record<Rag, string> = { red: 'Red', amber: 'Amber', green: 'Green', grey: 'n/a' }
const BASIS_LABEL: Record<string, string> = { enacted: 'enacted law only', announced: 'enacted + passed / announced', oecd: 'OECD terms' }

function eurShort(n: number): string {
  const a = Math.abs(n)
  const s = a >= 1e9 ? `${(a / 1e9).toFixed(2)}bn` : a >= 1e6 ? `${(a / 1e6).toFixed(2)}m` : a >= 1e3 ? `${(a / 1e3).toFixed(0)}k` : a.toFixed(0)
  return `${n < 0 ? '−' : ''}€${s}`
}
const pct = (n: number | null, dp = 1) => (n === null ? '—' : `${(n * 100).toFixed(dp)}%`)
const localToday = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function Delta({ v, money = true, invert = false }: { v: number | null | undefined; money?: boolean; invert?: boolean }) {
  if (v === undefined) return null
  if (v === null) return <span className="kd neutral">—</span>
  const zero = Math.abs(v) < (money ? 0.5 : 0.005)
  const good = invert ? v > 0 : v < 0
  const txt = zero ? 'no change' : `${v > 0 ? '+' : '−'}${money ? eurShort(Math.abs(v)).replace('−', '') : `${Math.abs(v).toFixed(2)}pp`}`
  return <span className={`kd ${zero ? 'neutral' : good ? 'good' : 'bad'}`}>{txt} vs comparison</span>
}

function RagDot({ rag }: { rag: Rag }) {
  return <span className={`rag rag-${rag}`}><span className="rag-dot" aria-hidden="true" />{RAG_LABEL[rag]}</span>
}

function shOutcome(j: JurisdictionResultV3): { text: string; tone: 'ok' | 'danger' | 'muted' | 'warn' } {
  if (j.topUpBeforeSafeHarbour <= 0) return { text: 'Not needed', tone: 'muted' }
  const sh = j.safeHarbour
  if (!sh.available) return { text: 'Unavailable', tone: 'warn' }
  if (sh.passed) {
    const which = sh.tests.deMinimis === 'pass' ? 'de minimis' : sh.tests.simplifiedEtr === 'pass' ? 'simplified ETR' : 'routine profits'
    return { text: `Pass · ${which}`, tone: 'ok' }
  }
  return { text: 'Fail', tone: 'danger' }
}

function collectedBy(j: JurisdictionResultV3): string {
  const parts: string[] = []
  if (j.domestic > 0) parts.push(j.domesticLabel ?? 'Domestic')
  if (j.iir > 0) parts.push(`IIR (${j.iirParentJurisdiction})`)
  if (j.utprResidual > 0) parts.push('UTPR residual')
  if (j.sbsExempt > 0) parts.push('SG IIR exempt (SbS)')
  return parts.length ? parts.join(' + ') : '—'
}

function Kpis({ s, d, p }: { s: DashboardSummary; d?: SummaryDelta; p: ProjectionV3 }) {
  const etrPos = s.blendedEtr === null ? 0 : Math.min(100, (s.blendedEtr / 0.3) * 100)
  return (
    <div className="dash-kpis">
      <div className="dk dk-main">
        <span className="dk-label">Total top-up tax</span>
        <strong>{eurShort(s.totalTopUp)}</strong>
        <Delta v={d?.totalTopUp} />
      </div>
      <div className="dk">
        <span className="dk-label">Blended GloBE ETR vs 15%</span>
        <strong className={s.blendedEtr !== null && s.blendedEtr < MIN_RATE ? 'neg' : ''}>{pct(s.blendedEtr, 2)}</strong>
        <span className="etr-gauge" aria-hidden="true"><span className="etr-fill" style={{ width: `${etrPos}%` }} /><span className="etr-min" style={{ left: `${(MIN_RATE / 0.3) * 100}%` }} /></span>
        <Delta v={d ? d.blendedEtrPp : undefined} money={false} invert />
      </div>
      <div className="dk">
        <span className="dk-label">Jurisdictions</span>
        <strong>{s.jurisdictionCount}</strong>
        <span className="dk-sub">{p.inScope ? 'Group in scope (≥ €750m)' : 'Group out of scope'} · {s.ragCounts.red} red · {s.ragCounts.amber} amber · {s.ragCounts.green} green</span>
      </div>
      <div className="dk">
        <span className="dk-label">Safe harbour</span>
        <strong>{s.safeHarbourPassed} of {s.exposedCount}</strong>
        <span className="dk-sub">exposed jurisdictions pass the transitional CbCR test</span>
        <Delta v={d?.safeHarbourPassed} money={false} invert />
      </div>
      <div className="dk">
        <span className="dk-label">Domestic top-up taxes</span>
        <strong>{eurShort(s.collectors.domestic)}</strong>
        <Delta v={d?.domestic} />
      </div>
      <div className="dk">
        <span className="dk-label">IIR</span>
        <strong>{eurShort(s.collectors.iir)}</strong>
        <Delta v={d?.iir} />
      </div>
      <div className="dk">
        <span className="dk-label">UTPR residual (flagged)</span>
        <strong>{eurShort(s.collectors.utprResidual)}</strong>
        <Delta v={d?.utprResidual} />
      </div>
    </div>
  )
}

function EtrBars({ p, rag }: { p: ProjectionV3; rag: RagResult[] }) {
  const max = Math.max(0.3, ...p.jurisdictions.map((j) => j.etr ?? 0))
  const pos = (v: number) => `${Math.max(0, Math.min(100, (v / max) * 100))}%`
  return (
    <div className="etr-bars" role="img" aria-label={`ETR by jurisdiction: ${p.jurisdictions.map((j) => `${j.code} ${pct(j.etr)}`).join(', ')}; minimum 15%`}>
      {p.jurisdictions.map((j) => {
        const r = rag.find((x) => x.code === j.code)?.rag ?? 'grey'
        return (
          <div className="eb-row" key={j.code}>
            <span className="eb-label">{j.code}</span>
            <span className="eb-track">
              <span className={`eb-bar bar-${r}`} style={{ width: j.etr === null ? 0 : pos(j.etr) }} />
              <span className="eb-min" style={{ left: pos(MIN_RATE) }} />
            </span>
            <span className="eb-val">{pct(j.etr)}</span>
          </div>
        )
      })}
      <div className="eb-axis"><span className="eb-label" /><span className="eb-track axis"><span style={{ left: pos(MIN_RATE) }}>15% minimum</span></span><span className="eb-val" /></div>
    </div>
  )
}

function CollectorSplit({ s }: { s: DashboardSummary }) {
  const split = collectorSplit(s)
  const total = split.reduce((a, b) => a + b.amount, 0)
  return (
    <div>
      <div className="split-bar" role="img" aria-label={split.map((x) => `${x.label} ${eurShort(x.amount)}`).join(', ')}>
        {total > 0 ? split.filter((x) => x.amount > 0).map((x) => <span key={x.key} className={`sb sb-${x.key}`} style={{ width: `${x.share * 100}%` }} />) : <span className="sb sb-none" style={{ width: '100%' }} />}
      </div>
      <ul className="split-legend">
        {split.map((x) => (
          <li key={x.key}><span className={`sw sb-${x.key}`} aria-hidden="true" />{x.label}<span className="num">{eurShort(x.amount)}</span><span className="num fine">{(x.share * 100).toFixed(0)}%</span></li>
        ))}
      </ul>
    </div>
  )
}

const DASHBOARD_VIEW_KEY = 'p2-dashboard-view-v1'
interface DashboardView { sourceId: string; compareId: string; firstYear: boolean }
function loadView(): DashboardView {
  const d: DashboardView = { sourceId: 'current', compareId: 'none', firstYear: true }
  try {
    const raw = JSON.parse(window.localStorage.getItem(DASHBOARD_VIEW_KEY) ?? 'null') as Partial<DashboardView> | null
    if (!raw || typeof raw !== 'object') return d
    return {
      sourceId: typeof raw.sourceId === 'string' ? raw.sourceId : d.sourceId,
      compareId: typeof raw.compareId === 'string' ? raw.compareId : d.compareId,
      firstYear: typeof raw.firstYear === 'boolean' ? raw.firstYear : d.firstYear,
    }
  } catch {
    return d
  }
}

export function DashboardPage(props: { current: GroupInputV3; scenarios: SavedScenario[] }) {
  const { current, scenarios } = props
  const [view, setView] = useState<DashboardView>(loadView)
  const update = (patch: Partial<DashboardView>) => setView((v) => {
    const next = { ...v, ...patch }
    try {
      window.localStorage.setItem(DASHBOARD_VIEW_KEY, JSON.stringify(next))
    } catch {
      /* storage unavailable: keep in memory */
    }
    return next
  })
  const valid = (id: string) => id === 'current' || id === 'none' || scenarios.some((sc) => sc.id === id)
  const sourceId = valid(view.sourceId) && view.sourceId !== 'none' ? view.sourceId : 'current'
  const compareId = valid(view.compareId) && view.compareId !== sourceId ? view.compareId : 'none'
  const firstYear = view.firstYear
  const setSourceId = (id: string) => update({ sourceId: id })
  const setCompareId = (id: string) => update({ compareId: id })
  const setFirstYear = (b: boolean) => update({ firstYear: b })
  const pick = (id: string): { name: string; input: GroupInputV3 } | null =>
    id === 'current' ? { name: 'Current inputs', input: current } : (scenarios.find((s) => s.id === id) && { name: scenarios.find((s) => s.id === id)!.name, input: scenarios.find((s) => s.id === id)!.input }) || null
  const source = pick(sourceId) ?? { name: 'Current inputs', input: current }
  const comparison = compareId === 'none' ? null : pick(compareId)

  const model = useMemo(() => {
    const g = source.input
    const basis = g.tcshBasis ?? 'enacted'
    const p = projectGlobe(g)
    const enacted = basis === 'enacted' ? undefined : projectGlobe({ ...g, tcshBasis: 'enacted' })
    const s = summarize(p, enacted)
    return { g, basis, p, s, risks: keyRisks(p, basis, PACKS), readiness: dataReadiness(g) }
  }, [source.input])
  const cmp = useMemo(() => {
    if (!comparison) return null
    const g = comparison.input
    const p = projectGlobe(g)
    const basis = g.tcshBasis ?? 'enacted'
    const s = summarize(p, basis === 'enacted' ? undefined : projectGlobe({ ...g, tcshBasis: 'enacted' }))
    return { name: comparison.name, p, s, d: summaryDelta(model.s, s) }
  }, [comparison, model.s])

  const { p, s, g } = model
  const today = localToday()
  const cal = useMemo(() => computeFilingCalendar(p.fiscalYearEnd, PACKS, { firstYear }), [p.fiscalYearEnd, firstYear])
  const deadlines = nextDeadlines(cal, today, 5)
  const statusMap = useMemo(() => {
    try {
      return parseStatusMap(window.localStorage.getItem(REVIEW_STORAGE_KEY))
    } catch {
      return {}
    }
  }, [])
  const updates = materialUpdates(INTEL_ITEMS, (i) => effectiveStatus(i, statusMap), 3)
  const risksTop = model.risks.filter((r) => r.kind !== 'simplification')
  const simplifications = model.risks.filter((r) => r.kind === 'simplification')
  const empty = g.entities.length === 0

  return (
    <div className="dashboard">
      <header className="dash-head">
        <div>
          <span className="eyebrow">Start · Executive dashboard</span>
          <h2>Pillar Two at a glance: {p.groupName}</h2>
          <p className="dash-meta">
            FY {formatDate(p.fiscalYearStart)} – {formatDate(p.fiscalYearEnd)} · source: <strong>{source.name}</strong>
            {cmp && <> · compared with <strong>{cmp.name}</strong></>} · legislative status basis: {BASIS_LABEL[model.basis]} · engine <code>{GLOBE_VERSION}</code>
          </p>
        </div>
        <div className="dash-controls no-print">
          <label className="mini-field">Show
            <select value={sourceId} onChange={(e) => setSourceId(e.target.value)}>
              <option value="current">Current inputs</option>
              {scenarios.map((sc) => <option key={sc.id} value={sc.id}>{sc.name}</option>)}
            </select>
          </label>
          <label className="mini-field">Compare with
            <select value={compareId} onChange={(e) => setCompareId(e.target.value)}>
              <option value="none">No comparison</option>
              {sourceId !== 'current' && <option value="current">Current inputs</option>}
              {scenarios.filter((sc) => sc.id !== sourceId).map((sc) => <option key={sc.id} value={sc.id}>{sc.name}</option>)}
            </select>
          </label>
          <button type="button" className="btn-solid" onClick={() => window.print()}>Print / Save PDF</button>
        </div>
      </header>

      {empty ? (
        <section className="panel"><p><strong>No entities yet.</strong> Add the group's entities on <a href={href('group')}>Group &amp; entities</a> to populate the dashboard.</p></section>
      ) : (
        <>
          <Kpis s={s} d={cmp?.d} p={p} />

          <div className="dash-grid">
            <section className="dp dp-jur">
              <div className="dp-head"><h3>Jurisdictions</h3><a className="fine no-print" href={href('results')}>Full results →</a></div>
              <div className="table-wrap flat">
                <table className="table dash-table">
                  <thead><tr><th scope="col">Jurisdiction</th><th scope="col">Status</th><th scope="col" className="r">GloBE ETR</th><th scope="col" className="r">Top-up</th><th scope="col">Safe harbour</th><th scope="col">Collected by</th></tr></thead>
                  <tbody>
                    {p.jurisdictions.map((j) => {
                      const r = s.rag.find((x) => x.code === j.code)!
                      const o = shOutcome(j)
                      return (
                        <tr key={j.code} className={`row-${r.rag}`}>
                          <th scope="row"><span className="jcell"><JurBadge code={j.code} /> <span className="jname">{j.label.replace(' (non-QDMTT)', '')}</span></span></th>
                          <td><RagDot rag={r.rag} /><span className="why">{r.reason}</span></td>
                          <td className={`r num ${j.etr !== null && j.etr < MIN_RATE ? 'neg' : ''}`}>{pct(j.etr, 2)}</td>
                          <td className="r num">{eurShort(j.topUp)}</td>
                          <td><Tag tone={o.tone}>{o.text}</Tag></td>
                          <td>{collectedBy(j)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="dp dp-charts">
              <div className="dp-head"><h3>ETR by jurisdiction vs 15%</h3><span className="fine">bar colour = RAG</span></div>
              <EtrBars p={p} rag={s.rag} />
              <div className="dp-head sub"><h3>Top-up by collecting tax</h3><span className="fine">{eurShort(s.totalTopUp)}</span></div>
              <CollectorSplit s={s} />
            </section>

            <section className="dp dp-cal">
              <div className="dp-head">
                <h3>Next filing deadlines</h3>
                <a className="fine no-print" href={href('jurisdictions', 'calendar')}>Calendar →</a>
              </div>
              <p className="fine">FY ending {formatDate(p.fiscalYearEnd)}{firstYear ? ', first in-scope year' : ''}; adjusted for weekends and public holidays.
                <label className="inline-check no-print"><input type="checkbox" checked={firstYear} onChange={(e) => setFirstYear(e.target.checked)} /> first year</label>
              </p>
              {deadlines.length === 0 ? <p className="fine">No upcoming deadlines for this fiscal year.</p> : (
                <ol className="deadlines">
                  {deadlines.map((r) => (
                    <li key={`${r.jurisdiction}-${r.obligationId}`}>
                      <span className="dl-date">{formatDate(r.adjustedDate as string)}</span>
                      <span className="dl-what"><JurBadge code={r.jurisdiction} /> {r.obligation.replace(/\s*\(.*?\)\s*/g, ' ').replace(/\s+,/g, ',').trim()}
                        {(r.rolled || !r.holidaysChecked || r.earliestOnly) && <span className="fine"> {r.rolled ? '· rolled' : ''}{!r.holidaysChecked ? ' · holidays not checked' : ''}{r.earliestOnly ? ' · earliest' : ''}</span>}
                      </span>
                    </li>
                  ))}
                </ol>
              )}
              <div className="dp-head sub"><h3>Data readiness</h3><a className="fine no-print" href={href('group')}>Inputs →</a></div>
              <ul className="readiness">
                {model.readiness.map((c) => {
                  const ok = c.done === c.total
                  return (
                    <li key={c.label}>
                      <span className={`rd ${ok ? 'ok' : 'gap'}`} aria-hidden="true">{ok ? '✓' : '!'}</span>
                      <span>{c.label}</span>
                      <span className="num">{c.total === 0 ? 'n/a' : `${c.done}/${c.total}`}</span>
                      {!ok && c.missing.length > 0 && <span className="fine rd-miss">Missing: {c.missing.slice(0, 3).join(', ')}{c.missing.length > 3 ? '…' : ''}</span>}
                    </li>
                  )
                })}
              </ul>
            </section>
          </div>

          <div className="dash-grid two">
            <section className="dp">
              <div className="dp-head"><h3>Regulatory updates to note</h3><a className="fine no-print" href={href('updates')}>All updates →</a></div>
              <ul className="dash-updates">
                {updates.map((u) => (
                  <li key={u.id}>
                    <span className="du-date">{formatDate(u.date)}</span>
                    <JurBadge code={u.jurisdiction} />
                    {u.material ? <Tag tone="warn">Affects calc</Tag> : <Tag tone="muted">For awareness</Tag>}
                    <a href={u.sourceUrl} target="_blank" rel="noopener noreferrer">{u.title}<span className="sr-only"> (opens in a new tab)</span></a>
                  </li>
                ))}
              </ul>
            </section>
            <section className="dp dp-risks">
              <div className="dp-head"><h3>Key risks &amp; assumptions</h3><a className="fine no-print" href={href('changes')}>Ruleset →</a></div>
              <ul className="risks">
                {risksTop.map((r, i) => (
                  <li key={i} className={`risk-${r.kind}`}>
                    <Tag tone={r.kind === 'assumption' || r.kind === 'basis' || r.kind === 'legislative' ? 'warn' : r.kind === 'warning' ? 'danger' : 'info'}>{r.kind === 'unverified' ? 'Unverified' : r.kind === 'assumption' ? 'Assumption' : r.kind === 'basis' ? 'Basis' : r.kind === 'legislative' ? 'Not yet law' : 'Warning'}</Tag>
                    {r.url ? <a href={r.url} target="_blank" rel="noopener noreferrer">{r.text}<span className="sr-only"> (opens in a new tab)</span></a> : <span>{r.text}</span>}
                  </li>
                ))}
                {simplifications.length > 0 && <li className="risk-simplification"><Tag tone="muted">Simplified</Tag><span>{simplifications.map((r) => r.text).join(' ')}</span></li>}
              </ul>
            </section>
          </div>
        </>
      )}

      {!empty && (
        <section className="dash-legend" aria-label="RAG status rule">
          <span className="dl-title">RAG rule</span>
          <dl className="rag-legend">
            {(['red', 'amber', 'green', 'grey'] as Rag[]).map((k) => (
              <div key={k}><dt><RagDot rag={k} /></dt><dd>{RAG_RULES[k]}</dd></div>
            ))}
          </dl>
        </section>
      )}
      <footer className="dash-foot">
        <span>Engine <code>{GLOBE_VERSION}</code> · packs {PACKS.map((pk) => `${pk.packId} ${pk.packVersion}`).join(', ')} · holidays <code>{HOLIDAYS.version}</code></span>
        <span>Regulatory feed refreshed {formatDate(INTEL_META.lastRefreshed.slice(0, 10))} · generated {formatDate(today)} · amounts in EUR · RAG margin {ETR_BUFFER * 100}pp</span>
        <span className="dash-disc">{DISCLAIMER}</span>
      </footer>
    </div>
  )
}
