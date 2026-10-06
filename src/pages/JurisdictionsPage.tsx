import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { JURISDICTION_PACKS, listUnverified, PACK_CODES } from '../rules/jurisdictions'
import type { JurisdictionPack, PackCode, RuleKind, RuleStatus, SourcedFact } from '../rules/jurisdictions'
import { computeFilingCalendar } from '../rules/jurisdictions/calendar'
import { Callout, EmptyState, formatDate, JurBadge, PageHeader, SourceLink, SourceTypeTag, Tag, VerifiedTag } from '../components/ui'
import { href } from '../router'

const STATUS_TEXT: Record<RuleStatus, string> = { 'in-force': 'In force', deferred: 'Deferred', 'not-implemented': 'Not implemented' }
const RULE_KINDS: RuleKind[] = ['QDMTT', 'IIR', 'UTPR']
const ALL_PACKS = PACK_CODES.map((c) => JURISDICTION_PACKS[c])

function RuleStatusTag(props: { status: RuleStatus }) {
  const tone = props.status === 'in-force' ? 'ok' : props.status === 'deferred' ? 'warn' : 'muted'
  return <Tag tone={tone}>{STATUS_TEXT[props.status]}</Tag>
}

function Fact(props: { label: string; fact: SourcedFact }) {
  return (
    <div className="fact">
      <dt>{props.label}</dt>
      <dd>
        <span>{props.fact.value}</span>
        <span className="fact-meta">
          <VerifiedTag verified={props.fact.verified} note={props.fact.note} />
          <SourceLink url={props.fact.sourceUrl} />
        </span>
        {props.fact.note && <span className="fine fact-note">{props.fact.note}</span>}
      </dd>
    </div>
  )
}

function PackView(props: { pack: JurisdictionPack }) {
  const p = props.pack
  const unverified = listUnverified(p)
  return (
    <div className="stack">
      <div className="panel pack-hero">
        <div>
          <span className="eyebrow">Rule pack <code>{p.packId}</code> · v{p.packVersion} · researched {formatDate(p.researchedAsOf)}</span>
          <h2><JurBadge code={p.jurisdiction} /> {p.name}</h2>
          <p className="lede">{p.domesticTopUpTax.localName}</p>
        </div>
        <div className="hero-tags">
          {RULE_KINDS.map((k) => (
            <span key={k} className="hero-rule">
              <strong>{k}</strong>
              <RuleStatusTag status={p.rules[k].status} />
              <span className="fine">{p.rules[k].effectiveFrom ? `FY ≥ ${p.rules[k].effectiveFrom}` : '—'}</span>
            </span>
          ))}
        </div>
      </div>

      <div className="grid-2 even">
        <section className="panel">
          <h3>Legislation</h3>
          <dl className="facts">
            <Fact label="Legislation" fact={p.legislation} />
            <Fact label="Enactment" fact={p.enactment} />
            <Fact label="Headline CIT rate" fact={p.headlineCitRate} />
            <Fact label="Domestic top-up tax" fact={p.domesticTopUpTax} />
          </dl>
        </section>
        <section className="panel">
          <h3>Qualified status <span className="fine">(OECD Central Record as at {formatDate(p.qualifiedStatus.asAt)})</span></h3>
          <dl className="facts">
            <Fact label="IIR" fact={p.qualifiedStatus.IIR} />
            <Fact label="QDMTT" fact={p.qualifiedStatus.QDMTT} />
            <Fact label="QDMTT Safe Harbour" fact={p.qualifiedStatus.QDMTTSafeHarbour} />
          </dl>
        </section>
      </div>

      <section className="panel">
        <h3>Rules in force</h3>
        <div className="table-wrap">
          <table className="table sticky">
            <thead>
              <tr><th>Rule</th><th>Local name</th><th>Status</th><th>Applies to FYs beginning on/after</th><th>Detail</th><th>Source</th></tr>
            </thead>
            <tbody>
              {RULE_KINDS.map((k) => {
                const r = p.rules[k]
                return (
                  <tr key={k}>
                    <th scope="row">{k}</th>
                    <td>{r.localName}</td>
                    <td><RuleStatusTag status={r.status} /></td>
                    <td className="nowrap">{r.effectiveFrom ? formatDate(r.effectiveFrom) : '—'}</td>
                    <td>{r.value}</td>
                    <td><span className="cell-stack"><VerifiedTag verified={r.verified} note={r.note} /><SourceLink url={r.sourceUrl} /></span></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h3>Filing obligations</h3>
          <a className="fine" href={href('jurisdictions', 'calendar')}>Open filing calendar →</a>
        </div>
        <div className="table-wrap">
          <table className="table sticky">
            <thead>
              <tr><th>Obligation</th><th>Who</th><th>Deadline rule</th><th>From</th><th>Source</th></tr>
            </thead>
            <tbody>
              {p.filing.map((f) => (
                <tr key={f.id}>
                  <td><strong>{f.obligation}</strong><div className="fine">{f.kind === 'payment' ? 'Payment' : 'Filing'} · {f.appliesTo}</div></td>
                  <td>{f.who}</td>
                  <td>{f.value}</td>
                  <td className="nowrap">{formatDate(f.effectiveFrom)}</td>
                  <td><span className="cell-stack"><VerifiedTag verified={f.verified} note={f.note} /><SourceLink url={f.sourceUrl} /></span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid-2 even">
        <section className="panel">
          <h3>Registration and portal</h3>
          <dl className="facts">
            {p.registration.map((r, i) => <Fact key={i} label={`Registration ${p.registration.length > 1 ? i + 1 : ''}`.trim()} fact={r} />)}
            <Fact label="Portal" fact={p.portal} />
            <Fact label="Safe harbours" fact={p.safeHarbours} />
          </dl>
        </section>
        <section className="panel">
          <h3>Notable local features</h3>
          <ul className="features">
            {p.localFeatures.map((f) => (
              <li key={f.title}>
                <div className="feature-head"><strong>{f.title}</strong><VerifiedTag verified={f.verified} note={f.note} /></div>
                <p>{f.value}</p>
                {f.note && <p className="fine">{f.note}</p>}
                <SourceLink url={f.sourceUrl} />
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="panel">
        <h3>Sources</h3>
        <ul className="sources">
          {p.sources.map((s) => (
            <li key={s.url}><SourceTypeTag type={s.type} /> <SourceLink url={s.url} label={s.name} /></li>
          ))}
        </ul>
        {unverified.length > 0 ? (
          <Callout tone="warn">
            <strong>{unverified.length} field{unverified.length === 1 ? '' : 's'} not verified against a primary source:</strong>{' '}
            {unverified.map((u) => u.path).join(', ')}. Confirm these with an adviser before relying on them.
          </Callout>
        ) : (
          <p className="fine">All fields in this pack are marked verified against the linked sources.</p>
        )}
      </section>
    </div>
  )
}

function fy(p: JurisdictionPack, k: RuleKind) {
  const r = p.rules[k]
  return r.status === 'in-force' && r.effectiveFrom ? `${STATUS_TEXT[r.status]} · FY ≥ ${formatDate(r.effectiveFrom)}` : STATUS_TEXT[r.status]
}

function filingSummary(p: JurisdictionPack, appliesTo: string[], exclude: string[] = []) {
  return p.filing
    .filter((f) => f.kind === 'filing' && appliesTo.some((a) => f.id.includes(a)) && !exclude.some((x) => f.id.includes(x)))
    .map((f) => `${f.obligation.split(' (')[0]}: ${f.monthsAfterFye} months${f.firstYearMonthsAfterFye ? ` (${f.firstYearMonthsAfterFye} first year)` : ''}${f.firstYearOnly ? ' (first year only)' : ''}`)
    .join('; ') || '—'
}

function CompareView() {
  const rows: { label: string; cell: (p: JurisdictionPack) => ReactNode }[] = [
    { label: 'Domestic top-up tax', cell: (p) => <><strong>{p.domesticTopUpTax.shortName}</strong><div className="fine">{p.domesticTopUpTax.localName}</div></> },
    { label: 'QDMTT', cell: (p) => fy(p, 'QDMTT') },
    { label: 'IIR', cell: (p) => fy(p, 'IIR') },
    { label: 'UTPR', cell: (p) => fy(p, 'UTPR') },
    { label: 'Central Record (QDMTT SH)', cell: (p) => p.qualifiedStatus.QDMTTSafeHarbour.value },
    { label: 'Headline CIT rate', cell: (p) => p.headlineCitRate.value },
    { label: 'Notification / registration', cell: (p) => filingSummary(p, ['notification', 'registration']) },
    { label: 'GIR / information returns', cell: (p) => filingSummary(p, ['gir', 'qdmtt-info']) },
    { label: 'Top-up tax return(s)', cell: (p) => filingSummary(p, ['return'], ['gir']) },
    { label: 'Payment', cell: (p) => p.filing.filter((f) => f.kind === 'payment').map((f) => f.value).join(' ') || 'With the return (see filing obligations)' },
    { label: 'Portal', cell: (p) => p.portal.value },
    { label: 'Unverified fields', cell: (p) => { const n = listUnverified(p).length; return n ? <Tag tone="warn">{n} unverified</Tag> : <Tag tone="ok">None</Tag> } },
  ]
  return (
    <section className="panel">
      <div className="panel-head">
        <h3>HK / SG / JP comparison</h3>
        <span className="fine">Summarised from the rule packs. Open a country tab for sources.</span>
      </div>
      <div className="table-wrap tall">
        <table className="table sticky compare">
          <thead>
            <tr>
              <th>Item</th>
              {ALL_PACKS.map((p) => <th key={p.jurisdiction}><JurBadge code={p.jurisdiction} /> {p.name}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label}>
                <th scope="row">{r.label}</th>
                {ALL_PACKS.map((p) => <td key={p.jurisdiction}>{r.cell(p)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function CalendarView() {
  const [fye, setFye] = useState('2025-12-31')
  const [firstYear, setFirstYear] = useState(true)
  const [only, setOnly] = useState<PackCode | 'ALL'>('ALL')
  const cal = useMemo(() => {
    try {
      return computeFilingCalendar(fye, only === 'ALL' ? ALL_PACKS : [JURISDICTION_PACKS[only]], { firstYear })
    } catch {
      return null
    }
  }, [fye, firstYear, only])
  const due = cal?.rows.filter((r) => r.dueDate) ?? []
  const na = cal?.rows.filter((r) => !r.dueDate) ?? []
  return (
    <div className="stack">
      <Callout tone="warn">
        <strong>Indicative only.</strong> Dates come from the deadline rules in each pack and assume a 12-month fiscal year. Weekend and public-holiday roll-forward is not
        applied (Japan rolls deadlines to the next business day), and group-specific exemptions (e.g. GIR filed via the UPE jurisdiction) are not modelled. Check every date
        against the linked source.
      </Callout>
      <div className="panel filters">
        <label>
          Fiscal year end
          <input type="date" value={fye} onChange={(e) => setFye(e.target.value)} />
        </label>
        <label>
          Jurisdiction
          <select value={only} onChange={(e) => setOnly(e.target.value as PackCode | 'ALL')}>
            <option value="ALL">HK, SG and JP</option>
            {PACK_CODES.map((c) => <option key={c} value={c}>{JURISDICTION_PACKS[c].name}</option>)}
          </select>
        </label>
        <label className="check">
          <input type="checkbox" checked={firstYear} onChange={(e) => setFirstYear(e.target.checked)} />
          First in-scope (transition) year
        </label>
        {cal && <div className="filter-summary fine"><span>FY {formatDate(cal.fiscalYearStart)} – {formatDate(cal.fiscalYearEnd)}</span></div>}
      </div>
      {!cal ? (
        <EmptyState title="Enter a valid fiscal year end date" />
      ) : (
        <>
          <section className="panel">
            <div className="panel-head"><h3>Due dates</h3><span className="fine">{due.length} obligations</span></div>
            {due.length === 0 ? (
              <EmptyState title="No obligations apply for this fiscal year">The Pillar Two rules in these packs had not started for a FY beginning {formatDate(cal.fiscalYearStart)}.</EmptyState>
            ) : (
              <div className="table-wrap tall">
                <table className="table sticky">
                  <thead><tr><th>Due (indicative)</th><th>Jurisdiction</th><th>Obligation</th><th>Basis</th><th>Source</th></tr></thead>
                  <tbody>
                    {due.map((r) => (
                      <tr key={r.obligationId}>
                        <td className="nowrap"><strong>{formatDate(r.dueDate as string)}</strong>
                          {r.earliestOnly && <div><Tag tone="info" title="Actual date is the later of this and a date tied to the assessment notice">Earliest</Tag></div>}
                          {r.floorApplied && <div><Tag tone="info">Floor date applied</Tag></div>}
                        </td>
                        <td><JurBadge code={r.jurisdiction} /></td>
                        <td><strong>{r.obligation}</strong><div className="fine">{r.who}</div></td>
                        <td className="fine">{r.basis}</td>
                        <td><span className="cell-stack"><VerifiedTag verified={r.verified} /><SourceLink url={r.sourceUrl} /></span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
          {na.length > 0 && (
            <section className="panel">
              <h3>Not applicable for this fiscal year</h3>
              <ul className="na-list">
                {na.map((r) => (
                  <li key={r.obligationId}><JurBadge code={r.jurisdiction} /> <strong>{r.obligation}</strong> <span className="fine">{r.reason}</span></li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  )
}

const TABS: { id: string; label: string }[] = [
  { id: 'compare', label: 'Compare' },
  { id: 'hk', label: 'Hong Kong' },
  { id: 'sg', label: 'Singapore' },
  { id: 'jp', label: 'Japan' },
  { id: 'calendar', label: 'Filing calendar' },
]

export function JurisdictionsPage(props: { sub: string | null }) {
  const tab = TABS.some((t) => t.id === props.sub) ? (props.sub as string) : 'compare'
  return (
    <>
      <PageHeader
        eyebrow="Rule packs"
        title="Jurisdictions"
        subtitle="Pillar Two implementation in Hong Kong, Singapore and Japan. Every field links to the source it came from and carries a verified flag."
      />
      <nav className="tabs" aria-label="Jurisdiction views">
        {TABS.map((t) => (
          <a key={t.id} href={href('jurisdictions', t.id)} className={tab === t.id ? 'on' : ''} aria-current={tab === t.id ? 'page' : undefined}>{t.label}</a>
        ))}
      </nav>
      {tab === 'compare' && <CompareView />}
      {tab === 'hk' && <PackView pack={JURISDICTION_PACKS.HK} />}
      {tab === 'sg' && <PackView pack={JURISDICTION_PACKS.SG} />}
      {tab === 'jp' && <PackView pack={JURISDICTION_PACKS.JP} />}
      {tab === 'calendar' && <CalendarView />}
    </>
  )
}
