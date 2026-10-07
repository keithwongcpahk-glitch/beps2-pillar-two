import type { ProjectionV3 } from '../calc/globe'
import { GLOBE_VERSION } from '../calc/globe'
import { formatDate, JurBadge, PageHeader, Tag } from '../components/ui'
import { DISCLAIMER } from '../defaults'
import { JURISDICTION_PACKS, PACK_CODES, type RuleEntry } from '../rules/jurisdictions'
import { href, type Page } from '../router'

const eur = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)
const ruleText = (r: RuleEntry) => (r.status === 'in-force' && r.effectiveFrom ? `FYs from ${formatDate(r.effectiveFrom)}` : r.status === 'deferred' ? 'Deferred' : 'Not implemented')
const EXT: Record<string, { text: string; tone: 'ok' | 'info' | 'warn' }> = {
  enacted: { text: 'enacted', tone: 'ok' },
  announced: { text: 'announced', tone: 'info' },
  'not-announced': { text: 'not adopted', tone: 'warn' },
}

const PAGES: { page: Page; title: string; what: string }[] = [
  { page: 'dashboard', title: 'Executive dashboard', what: 'One-page board view: headline KPIs, jurisdiction RAG status, ETR vs 15%, who collects, next deadlines, regulatory updates, key risks. Prints on one A4 landscape page.' },
  { page: 'group', title: 'Group & entities', what: 'Enter entities, ownership, GloBE income, taxes, payroll, tangible assets and CbCR data. A sample group is preloaded.' },
  { page: 'results', title: 'GloBE results', what: 'Jurisdiction-by-jurisdiction waterfall, safe harbour tests, who collects, and an explanation trail with rule links. Export to CSV or print to PDF.' },
  { page: 'scenarios', title: 'Scenarios', what: 'Save, rename, duplicate and delete named scenarios, then compare any two side by side.' },
  { page: 'jurisdictions', title: 'Jurisdictions', what: 'HK / SG / JP rules in force, qualified status, safe harbour adoption, and a filing calendar with weekend/holiday roll-forward and .ics export.' },
  { page: 'updates', title: 'Latest updates', what: 'Curated 30-day feed of OECD, HK, SG and JP developments, each linked to its source.' },
  { page: 'changes', title: 'Ruleset & changes', what: 'Rule versions in this build, what changed in each, and the sources.' },
  { page: 'overview', title: 'Quick estimate', what: 'Jurisdiction-level shortcut when you do not have entity data yet.' },
]

export function HomePage({ result }: { result: ProjectionV3 }) {
  const t = result.totals
  return (
    <>
      <PageHeader
        eyebrow="Start"
        title="Pillar Two Asia"
        subtitle="Estimate the 15% global minimum tax (OECD Pillar Two) for a multinational group with entities in Hong Kong, Singapore and Japan: how much top-up tax arises, who collects it, when filings are due, and the rule source behind every number."
        actions={<><a className="btn" href={href('dashboard')}>Executive dashboard</a><a className="btn ghost" href={href('group')}>Enter your group</a><a className="btn ghost" href={href('results')}>See sample results</a></>}
      />

      <ol className="steps" aria-label="How it works">
        <li className="panel step"><span className="step-n" aria-hidden="true">1</span><div><strong>Describe the group</strong><p className="fine">One row per entity: jurisdiction, ownership, GloBE income, covered taxes, payroll and tangible assets.</p></div></li>
        <li className="panel step"><span className="step-n" aria-hidden="true">2</span><div><strong>Read the waterfall</strong><p className="fine">ETR, substance carve-out, safe harbours, then domestic top-up tax → IIR → UTPR residual, step by step.</p></div></li>
        <li className="panel step"><span className="step-n" aria-hidden="true">3</span><div><strong>Compare and export</strong><p className="fine">Save scenarios, compare any two, export CSV / JSON / .ics, or print the results to PDF.</p></div></li>
      </ol>

      <section className="panel">
        <div className="panel-head">
          <h3>Current inputs at a glance</h3>
          <span className="fine">{result.groupName} · FY beginning {formatDate(result.fiscalYearStart)} · engine <code>{GLOBE_VERSION}</code></span>
        </div>
        <div className="kpi-grid four">
          <div className="kpi accent"><span className="kpi-label">Total top-up</span><strong>{eur(t.topUp)}</strong></div>
          <div className="kpi"><span className="kpi-label">Domestic top-up taxes</span><strong>{eur(t.domestic)}</strong></div>
          <div className="kpi"><span className="kpi-label">IIR</span><strong>{eur(t.iir)}</strong></div>
          <div className="kpi"><span className="kpi-label">UTPR residual (flagged)</span><strong>{eur(t.utprResidual)}</strong></div>
        </div>
      </section>

      <section className="panel">
        <div className="panel-head"><h3>Scope: Hong Kong, Singapore, Japan</h3><a className="fine" href={href('jurisdictions')}>Details and sources →</a></div>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th scope="col">Jurisdiction</th><th scope="col">Domestic top-up tax</th><th scope="col">IIR</th><th scope="col">UTPR</th><th scope="col">CbCR safe harbour 2027 extension</th></tr></thead>
            <tbody>
              {PACK_CODES.map((c) => {
                const p = JURISDICTION_PACKS[c]
                const ext = EXT[p.transitionalCbcrSafeHarbour.extension.status]
                return (
                  <tr key={c}>
                    <th scope="row"><JurBadge code={c} /> {p.name}</th>
                    <td><strong>{p.domesticTopUpTax.shortName}</strong> <span className="fine">{ruleText(p.rules.QDMTT)}</span></td>
                    <td className="fine">{ruleText(p.rules.IIR)}</td>
                    <td className="fine">{ruleText(p.rules.UTPR)}</td>
                    <td><Tag tone={ext.tone}>{ext.text}</Tag></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <p className="fine">Entities elsewhere can be entered as "Other (non-QDMTT)". Their top-up is collected by the IIR or shown as a flagged UTPR residual.</p>
      </section>

      <div className="grid-2 even">
        <section className="panel">
          <h3>Modelled</h3>
          <ul className="checklist">
            <li>Jurisdictional blending of entity GloBE income and covered taxes; ETR vs 15%</li>
            <li>Substance-based income exclusion with the OECD Art. 9.2 transition rates by fiscal year</li>
            <li>Transitional CbCR safe harbour tests, with each jurisdiction's adopted transition period</li>
            <li>QDMTT first (HKMTT / DTT / JP QDMTT), then the IIR × ownership %, then a flagged UTPR residual</li>
            <li>Simplified deferred tax recast at 15%</li>
            <li>Indicative filing calendar with sourced weekend/holiday roll-forward</li>
          </ul>
        </section>
        <section className="panel">
          <h3>Not modelled</h3>
          <ul className="crosslist">
            <li>Chapter 3 / 4 adjustments (GloBE income and covered taxes are inputs)</li>
            <li>Additional Current Top-up Tax, Art. 5.6 minority-owned blending, POPEs, IIR offset</li>
            <li>UTPR allocation across jurisdictions (Art. 2.6)</li>
            <li>UPE and Simplified ETR safe harbours; Side-by-Side other than Singapore's MTT exemption for US-parented groups; special entities (Art. 7.4)</li>
            <li>Local-law deviations beyond what the rule packs record</li>
          </ul>
        </section>
      </div>

      <section className="panel">
        <h3>Pages</h3>
        <ul className="page-links">
          {PAGES.map((p) => (
            <li key={p.page}><a href={href(p.page)}><strong>{p.title}</strong></a><span className="fine">{p.what}</span></li>
          ))}
        </ul>
      </section>
      <p className="disclaimer-box">{DISCLAIMER}</p>
    </>
  )
}
