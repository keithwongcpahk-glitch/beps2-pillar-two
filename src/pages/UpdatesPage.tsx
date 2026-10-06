import { useEffect, useMemo, useState } from 'react'
import { INTEL_ITEMS, INTEL_JURISDICTIONS, INTEL_META, REVIEW_STATUSES } from '../intel/types'
import type { AffectsCalc, IntelItem, IntelJurisdiction, ReviewStatus } from '../intel/types'
import { beforeWindow, calendarDateAt, filterByWindow, windowFor } from '../intel/window'
import { applyFilters, countByJurisdiction, distinctTopics, effectiveStatus, NO_FILTERS, parseStatusMap, REVIEW_STORAGE_KEY, setStatus } from '../intel/review'
import type { IntelFilters, StatusMap } from '../intel/review'
import { EmptyState, formatDate, JurBadge, PageHeader, Segmented, SourceLink, SourceTypeTag, Tag } from '../components/ui'

const STATUS_LABEL: Record<ReviewStatus, string> = { new: 'New', reviewed: 'Reviewed', 'needs-rule-change': 'Needs rule change' }
const AFFECTS_LABEL: Record<AffectsCalc, string> = { yes: 'Affects calc', no: 'No calc impact', unknown: 'Calc impact unknown' }
const JUR_LONG: Record<IntelJurisdiction, string> = { OECD: 'OECD / Inclusive Framework', HK: 'Hong Kong', SG: 'Singapore', JP: 'Japan' }

function loadStatus(): StatusMap {
  try {
    return parseStatusMap(window.localStorage.getItem(REVIEW_STORAGE_KEY))
  } catch {
    return {}
  }
}

function formatStamp(iso: string): string {
  const d = calendarDateAt(iso)
  const t = new Date(Date.parse(iso) + 8 * 3600_000).toISOString().slice(11, 16)
  return `${formatDate(d)}, ${t} HKT`
}

function ItemCard(props: { item: IntelItem; status: ReviewStatus; onStatus: (s: ReviewStatus) => void }) {
  const { item } = props
  return (
    <article className={`intel-card status-${props.status}`}>
      <div className="intel-meta">
        <time dateTime={item.date} className="intel-date">{formatDate(item.date)}</time>
        <JurBadge code={item.jurisdiction} />
        <Tag tone="muted">{item.topic}</Tag>
        <SourceTypeTag type={item.sourceType} />
        <Tag tone={item.affectsCalc === 'yes' ? 'danger' : item.affectsCalc === 'unknown' ? 'warn' : 'muted'}>{AFFECTS_LABEL[item.affectsCalc]}</Tag>
        {!item.verified && <Tag tone="warn">Unverified</Tag>}
      </div>
      <h3>{item.title}</h3>
      <p>{item.summary}</p>
      {item.dateNote && <p className="fine">Date note: {item.dateNote}</p>}
      {item.verificationNote && <p className="fine">Verification: {item.verificationNote}</p>}
      <dl className="intel-impact">
        <dt>Ruleset impact</dt>
        <dd>{item.impactNote}</dd>
      </dl>
      <div className="intel-foot">
        <div className="intel-sources">
          <SourceLink url={item.sourceUrl} label={item.sourceName} />
          {item.secondarySourceUrl && (
            <span className="fine">
              {' '}· Secondary: <SourceLink url={item.secondarySourceUrl} label={item.secondarySourceName} />
            </span>
          )}
        </div>
        <Segmented<ReviewStatus>
          size="sm"
          label={`Review status for ${item.title}`}
          value={props.status}
          onChange={props.onStatus}
          options={REVIEW_STATUSES.map((s) => ({ value: s, label: STATUS_LABEL[s] }))}
        />
      </div>
    </article>
  )
}

export function UpdatesPage() {
  const [filters, setFilters] = useState<IntelFilters>(NO_FILTERS)
  const [statusMap, setStatusMap] = useState<StatusMap>(loadStatus)
  const [showEarlier, setShowEarlier] = useState(true)

  useEffect(() => {
    try {
      window.localStorage.setItem(REVIEW_STORAGE_KEY, JSON.stringify(statusMap))
    } catch {
      /* storage unavailable: status stays in memory */
    }
  }, [statusMap])

  const win = useMemo(() => windowFor(calendarDateAt(INTEL_META.lastRefreshed), INTEL_META.windowDays), [])
  const inWindow = useMemo(() => filterByWindow(INTEL_ITEMS, win), [win])
  const earlier = useMemo(() => beforeWindow(INTEL_ITEMS, win), [win])
  const topics = useMemo(() => distinctTopics(INTEL_ITEMS), [])
  const counts = countByJurisdiction(inWindow, INTEL_JURISDICTIONS)
  const shown = applyFilters(inWindow, filters)
  const shownEarlier = applyFilters(earlier, filters)
  const needsRule = INTEL_ITEMS.filter((i) => effectiveStatus(i, statusMap) === 'needs-rule-change').length
  const unreviewed = inWindow.filter((i) => effectiveStatus(i, statusMap) === 'new').length

  const jurisdictionsToShowEmpty: IntelJurisdiction[] = (filters.jurisdiction === 'ALL' ? INTEL_JURISDICTIONS : [filters.jurisdiction]).filter((j) => counts[j] === 0)

  const onStatus = (item: IntelItem) => (s: ReviewStatus) => setStatusMap((m) => setStatus(m, item, s))

  return (
    <>
      <PageHeader
        eyebrow="Regulatory intel"
        title="Latest updates"
        subtitle={`BEPS 2.0 / Pillar Two developments for the OECD, Hong Kong, Singapore and Japan over the last ${INTEL_META.windowDays} days, each linked to its source.`}
        actions={
          <div className="stamp">
            <span>Last refreshed</span>
            <strong>{formatStamp(INTEL_META.lastRefreshed)}</strong>
            <span>Window {formatDate(win.start)} – {formatDate(win.end)}</span>
          </div>
        }
      />

      <div className="kpi-grid">
        {INTEL_JURISDICTIONS.map((j) => (
          <button key={j} type="button" className={`kpi kpi-button${filters.jurisdiction === j ? ' selected' : ''}`} onClick={() => setFilters((f) => ({ ...f, jurisdiction: f.jurisdiction === j ? 'ALL' : j }))}>
            <span className="kpi-label"><JurBadge code={j} /> {JUR_LONG[j]}</span>
            <strong>{counts[j]}</strong>
            <span className="fine">{counts[j] === 0 ? 'No new items in the last 30 days' : `item${counts[j] === 1 ? '' : 's'} in window`}</span>
          </button>
        ))}
      </div>

      <div className="panel filters">
        <label>
          Jurisdiction
          <select value={filters.jurisdiction} onChange={(e) => setFilters((f) => ({ ...f, jurisdiction: e.target.value as IntelFilters['jurisdiction'] }))}>
            <option value="ALL">All</option>
            {INTEL_JURISDICTIONS.map((j) => <option key={j} value={j}>{JUR_LONG[j]}</option>)}
          </select>
        </label>
        <label>
          Topic
          <select value={filters.topic} onChange={(e) => setFilters((f) => ({ ...f, topic: e.target.value }))}>
            <option value="ALL">All topics</option>
            {topics.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
        <label>
          Affects calc
          <select value={filters.affectsCalc} onChange={(e) => setFilters((f) => ({ ...f, affectsCalc: e.target.value as IntelFilters['affectsCalc'] }))}>
            <option value="ALL">Any</option>
            <option value="yes">Yes</option>
            <option value="no">No</option>
            <option value="unknown">Unknown</option>
          </select>
        </label>
        <div className="filter-summary fine">
          <span>{unreviewed} unreviewed in window</span>
          <span>{needsRule} flagged “needs rule change”</span>
          {(filters.jurisdiction !== 'ALL' || filters.topic !== 'ALL' || filters.affectsCalc !== 'ALL') && (
            <button type="button" className="linkish neutral" onClick={() => setFilters(NO_FILTERS)}>Clear filters</button>
          )}
        </div>
      </div>

      <section className="panel">
        <div className="panel-head">
          <h2>Last {INTEL_META.windowDays} days</h2>
          <span className="fine">{shown.length} of {inWindow.length} items · newest first</span>
        </div>
        {shown.length === 0 && jurisdictionsToShowEmpty.length === 0 && <EmptyState title="No items match these filters" />}
        <div className="intel-list">
          {shown.map((i) => (
            <ItemCard key={i.id} item={i} status={effectiveStatus(i, statusMap)} onStatus={onStatus(i)} />
          ))}
        </div>
        {filters.topic === 'ALL' && filters.affectsCalc === 'ALL' &&
          jurisdictionsToShowEmpty.map((j) => (
            <EmptyState key={j} title={`${JUR_LONG[j]}: no new items in the last ${INTEL_META.windowDays} days`}>
              {INTEL_META.coverage[j]}
            </EmptyState>
          ))}
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>Earlier key milestones</h2>
          <button type="button" className="secondary" onClick={() => setShowEarlier((v) => !v)}>{showEarlier ? 'Hide' : 'Show'} ({shownEarlier.length})</button>
        </div>
        <p className="fine">Background only. These are dated before {formatDate(win.start)}, so they sit outside the {INTEL_META.windowDays}-day window.</p>
        {showEarlier && (
          <div className="intel-list">
            {shownEarlier.length === 0 && <EmptyState title="No earlier milestones match these filters" />}
            {shownEarlier.map((i) => (
              <ItemCard key={i.id} item={i} status={effectiveStatus(i, statusMap)} onStatus={onStatus(i)} />
            ))}
          </div>
        )}
      </section>

      <p className="fine">
        Review status is saved only in this browser (localStorage). It is a triage aid and never changes the rule packs or the calculation. Rule changes go through a versioned pack
        bump and golden tests. Method: {INTEL_META.method}
      </p>
    </>
  )
}
