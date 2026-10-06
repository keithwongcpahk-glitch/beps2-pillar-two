import { GLOBE_VERSION } from '../calc/globe'
import { RULESET_VERSION } from '../calc/pillarTwo'
import { formatDate, JurBadge, PageHeader, SourceLink, Tag } from '../components/ui'
import { INTEL_ITEMS } from '../intel/types'
import { CHANGELOG, REPO_COMMIT_URL, type ChangeKind } from '../rules/changelog'
import { HOLIDAYS } from '../rules/jurisdictions/businessDays'
import { JURISDICTION_PACKS, listUnverified, PACK_CODES } from '../rules/jurisdictions'
import { href } from '../router'

const KIND: Record<ChangeKind, { label: string; tone: 'info' | 'ok' | 'muted' }> = {
  engine: { label: 'Calculation ruleset', tone: 'info' },
  pack: { label: 'Jurisdiction pack', tone: 'ok' },
  calendar: { label: 'Calendar data', tone: 'muted' },
}

export function ChangesPage() {
  const intel = new Map(INTEL_ITEMS.map((i) => [i.id, i]))
  return (
    <>
      <PageHeader
        eyebrow="Product"
        title="Ruleset & changes"
        subtitle="Which rule versions this build uses, what changed in each version, and the sources behind every change."
      />
      <section className="panel">
        <h3>Versions in this build</h3>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th scope="col">Component</th><th scope="col">Version</th><th scope="col">Researched as of</th><th scope="col" className="num">Unverified facts</th></tr></thead>
            <tbody>
              <tr><th scope="row">Entity-level GloBE engine (<a href={href('results')}>GloBE results</a>)</th><td><code>{GLOBE_VERSION}</code></td><td>—</td><td className="num">—</td></tr>
              <tr><th scope="row">Quick estimate (<a href={href('overview')}>Quick estimate</a>)</th><td><code>{RULESET_VERSION}</code></td><td>—</td><td className="num">—</td></tr>
              {PACK_CODES.map((c) => {
                const p = JURISDICTION_PACKS[c]
                return (
                  <tr key={c}>
                    <th scope="row"><JurBadge code={c} /> <a href={href('jurisdictions', c.toLowerCase())}>{p.name} rule pack</a></th>
                    <td><code>{p.packId}</code> v{p.packVersion}</td>
                    <td>{formatDate(p.researchedAsOf)}</td>
                    <td className="num">{listUnverified(p).length}</td>
                  </tr>
                )
              })}
              <tr><th scope="row">Deadline roll-forward and public holidays</th><td><code>{HOLIDAYS.version}</code> ({HOLIDAYS.coveredYears.join('–')})</td><td>{formatDate(HOLIDAYS.researchedAsOf)}</td><td className="num">0</td></tr>
            </tbody>
          </table>
        </div>
        <p className="fine">{CHANGELOG.note}</p>
      </section>

      <ol className="changelog">
        {CHANGELOG.entries.map((e) => (
          <li key={e.id} className="panel change">
            <div className="panel-head">
              <h3><code>{e.version}</code> · {e.title}</h3>
              <span className="cell-stack">
                <Tag tone={KIND[e.kind].tone}>{KIND[e.kind].label}</Tag>
                <span className="fine">{formatDate(e.date)}</span>
                {e.commit && <a className="fine" href={`${REPO_COMMIT_URL}${e.commit}`} target="_blank" rel="noopener noreferrer">commit {e.commit}</a>}
              </span>
            </div>
            <ul>{e.changes.map((c) => <li key={c}>{c}</li>)}</ul>
            <div className="change-sources">
              <strong className="fine">Sources:</strong>
              <ul className="sources">{e.sources.map((s) => <li key={s.url}><SourceLink url={s.url} label={s.label} /></li>)}</ul>
            </div>
            {e.intel.length > 0 && (
              <p className="fine">
                Related updates:{' '}
                {e.intel.map((id, i) => {
                  const it = intel.get(id)
                  return (
                    <span key={id}>
                      {i > 0 && ' · '}
                      {it ? <><JurBadge code={it.jurisdiction} /> <a href={it.sourceUrl} target="_blank" rel="noopener noreferrer">{it.title}</a> ({formatDate(it.date)})</> : id}
                    </span>
                  )
                })}
              </p>
            )}
          </li>
        ))}
      </ol>
    </>
  )
}
