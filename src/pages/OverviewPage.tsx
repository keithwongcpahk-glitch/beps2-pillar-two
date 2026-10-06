import type { ProjectionResult, Ruleset } from '../calc/pillarTwo'
import { EtrChart, KpiCards, TopUpBreakdown } from '../components/Dashboard'
import { formatDate, JurBadge, PageHeader, SourceLink, Tag } from '../components/ui'
import { INTEL_ITEMS, INTEL_META } from '../intel/types'
import { calendarDateAt, filterByWindow, windowFor } from '../intel/window'
import { JURISDICTION_PACKS, PACK_CODES } from '../rules/jurisdictions'
import { href } from '../router'

export function OverviewPage(props: { result: ProjectionResult; ruleset: Ruleset; fiscalYearStart: string }) {
  const { result, ruleset, fiscalYearStart } = props
  const win = windowFor(calendarDateAt(INTEL_META.lastRefreshed), INTEL_META.windowDays)
  const recent = filterByWindow(INTEL_ITEMS, win)
  return (
    <>
      <PageHeader
        eyebrow="Projection"
        title="Group overview"
        subtitle={`Simplified GloBE top-up projection for the fiscal year beginning ${formatDate(fiscalYearStart)}. HK, SG and JP routing comes from the jurisdiction rule packs.`}
        actions={<a className="btn" href={href('inputs')}>Edit inputs</a>}
      />
      <KpiCards totalTopUp={result.totalTopUp} totalQdmtt={result.totalQdmtt} totalIir={result.totalIir} inScope={result.inScope} />
      <div className="grid-2">
        <EtrChart rows={result.jurisdictions} minEtr={ruleset.minEtr} />
        <section className="panel">
          <div className="panel-head">
            <h3>Rule routing for this FY</h3>
            <a className="fine" href={href('jurisdictions')}>Rule packs →</a>
          </div>
          <table className="table compact">
            <thead><tr><th>Jurisdiction</th><th>Top-up collected via</th><th>Pack</th></tr></thead>
            <tbody>
              {PACK_CODES.map((c) => {
                const m = ruleset.jurisdictions[c]
                return (
                  <tr key={c}>
                    <td><JurBadge code={c} /> {JURISDICTION_PACKS[c].name}</td>
                    <td>
                      {m.hasQdmtt ? <Tag tone="ok">{m.qdmttLabel}</Tag> : <Tag tone="muted">IIR (UPE)</Tag>}
                      {m.presetNote && <div className="fine">{m.presetNote}</div>}
                    </td>
                    <td><code>{m.packId}</code></td>
                  </tr>
                )
              })}
              <tr>
                <td><JurBadge code="OTHER" /> {ruleset.jurisdictions.OTHER.label}</td>
                <td><Tag tone="muted">IIR (UPE)</Tag></td>
                <td><code>{ruleset.version}</code></td>
              </tr>
            </tbody>
          </table>
        </section>
      </div>
      <TopUpBreakdown rows={result.jurisdictions} />
      <section className="panel">
        <div className="panel-head">
          <h3>Latest regulatory updates</h3>
          <a className="fine" href={href('updates')}>All updates →</a>
        </div>
        <ul className="mini-feed">
          {recent.slice(0, 4).map((i) => (
            <li key={i.id}>
              <time className="intel-date">{formatDate(i.date)}</time> <JurBadge code={i.jurisdiction} /> <span>{i.title}</span> <SourceLink url={i.sourceUrl} />
            </li>
          ))}
        </ul>
      </section>
    </>
  )
}
