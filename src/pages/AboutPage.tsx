import { GLOBE_VERSION } from '../calc/globe'
import { RULESET_VERSION } from '../calc/pillarTwo'
import { PageHeader, SourceLink } from '../components/ui'
import { DISCLAIMER } from '../defaults'
import { JURISDICTION_PACKS, PACK_CODES } from '../rules/jurisdictions'

export function AboutPage() {
  return (
    <>
      <PageHeader eyebrow="Product" title="About" subtitle="Scope, method and limitations of this Asia-focused Pillar Two projection tool." />
      <div className="panel about">
        <p className="disclaimer-box">{DISCLAIMER}</p>
        <h3>Scope: Asia (Hong Kong, Singapore, Japan)</h3>
        <ul>
          <li>GloBE calculator (engine <code>{GLOBE_VERSION}</code>): entity-level inputs blended by jurisdiction, SBIE with OECD Art. 9.2 transition rates, transitional CbCR safe harbour tests (incl. the 2027 extension), deferred tax recast at 15%, then domestic top-up tax → IIR (× ownership %) → flagged UTPR residual, with an explanation trail</li>
          <li>Quick estimate: jurisdiction-level ETR, top-up rate, excess profit, and whether the top-up is collected via the domestic top-up tax (HKMTT / DTT / JP QDMTT) or the IIR</li>
          <li>HK, SG and JP routing and labels come from versioned, sourced rule packs and depend on the fiscal-year start (e.g. Japan's QDMTT applies to FYs beginning on or after 1 Apr 2026)</li>
          <li>Other jurisdictions are grouped as “Other (non-QDMTT)”</li>
          <li>Latest updates: a curated 30-day feed of OECD / HK / SG / JP developments, each with its source, plus a local review workflow</li>
          <li>Jurisdictions: rules in force, qualified status, filing obligations, a local-features comparison, and an indicative filing calendar</li>
        </ul>
        <h3>Not modelled (yet)</h3>
        <ul>
          <li>Chapter 3 / 4 adjustments (GloBE income and covered taxes are direct inputs), Additional Current Top-up Tax, Art. 5.6 minority-owned blending, IIR offset, POPE / split ownership, UTPR allocation</li>
          <li>Detailed deferred tax rules (recapture, exclusions, elections), special entities (Art. 7.4), Side-by-Side / UPE / Simplified ETR safe harbours, Pillar One</li>
          <li>Weekend and public-holiday adjustments in the filing calendar</li>
        </ul>
        <h3>Method</h3>
        <ul>
          <li>The calculation engine is pure functions. Tax parameters live in versioned JSON (<code>src/rules/</code>), never in UI code.</li>
          <li>Every rule-pack field records a source URL and a verified flag. Unverified fields are shown with a warning.</li>
          <li>News items are added only after the source page has been opened and checked. Status changes on the updates page are browser-local and never edit rules.</li>
          <li>The rules are not rewritten automatically from OECD / IRD / IRAS / NTA documents. Changes go through a pack version bump and golden tests.</li>
        </ul>
        <h3>Active versions</h3>
        <p>GloBE engine <code>{GLOBE_VERSION}</code> · quick estimate <code>{RULESET_VERSION}</code> · packs {PACK_CODES.map((c) => <code key={c}>{JURISDICTION_PACKS[c].packId}</code>)}</p>
        <p className="fine">Legacy ruleset <code>oecd-hk-simplified-v0.1</code> is kept in the repo and covered by tests.</p>
        <h3>Primary references</h3>
        <ul>
          <li><SourceLink url="https://www.ird.gov.hk/eng/tax/bus_beps.htm" label="HK IRD – BEPS / global minimum tax" /></li>
          <li><SourceLink url="https://www.iras.gov.sg/taxes/pillar-2-top-up-taxes/global-anti-base-erosion-(globe)-rules-and-domestic-top-up-tax-(dtt)" label="IRAS – GloBE rules and DTT" /></li>
          <li><SourceLink url="https://www.mof.go.jp/tax_policy/tax_reform/outline/fy2026/20260123kokusai.htm" label="MOF – FY2026 reform outline (global minimum tax)" /></li>
          <li><SourceLink url="https://www.oecd.org/content/dam/oecd/en/topics/policy-sub-issues/global-minimum-tax/updated-central-record-for-purposes-of-the-global-minimum-tax.pdf" label="OECD – Central Record of legislation with transitional qualified status" /></li>
        </ul>
      </div>
    </>
  )
}
