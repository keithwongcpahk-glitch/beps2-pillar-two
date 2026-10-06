import type { CbcrInput, EntityInput, EntityRole, GroupInputV3, TcshBasis } from '../calc/globe'
import { Callout, EmptyState, PageHeader, Tag } from '../components/ui'
import { href } from '../router'

const JURS = [
  { code: 'HK', label: 'HK — Hong Kong SAR' },
  { code: 'SG', label: 'SG — Singapore' },
  { code: 'JP', label: 'JP — Japan' },
  { code: 'OTHER', label: 'Other (non-QDMTT)' },
]
const BASES: { value: TcshBasis; label: string }[] = [
  { value: 'enacted', label: 'Enacted local law (default)' },
  { value: 'announced', label: 'Enacted + officially announced extensions' },
  { value: 'oecd', label: 'OECD terms for all jurisdictions' },
]
const ROLES: { value: EntityRole; label: string }[] = [
  { value: 'UPE', label: 'UPE' },
  { value: 'IPE', label: 'Intermediate parent' },
  { value: 'CE', label: 'Constituent entity' },
]

function NumIn(props: { value: number; onChange: (n: number) => void; label: string; step?: string; className?: string }) {
  return (
    <input
      type="number"
      className={props.className}
      step={props.step ?? 'any'}
      value={Number.isFinite(props.value) ? props.value : 0}
      aria-label={props.label}
      onChange={(e) => props.onChange(e.target.value === '' ? 0 : Number(e.target.value))}
    />
  )
}

export interface GroupPageProps {
  group: GroupInputV3
  setGroup: (updater: (g: GroupInputV3) => GroupInputV3) => void
  resetSample: () => void
  savedLocally: boolean
}

export function GroupPage({ group, setGroup, resetSample, savedLocally }: GroupPageProps) {
  const upEnt = (id: string, patch: Partial<EntityInput>) => setGroup((g) => ({ ...g, entities: g.entities.map((e) => (e.id === id ? { ...e, ...patch } : e)) }))
  const addEnt = () =>
    setGroup((g) => ({
      ...g,
      entities: [...g.entities, { id: `e${Date.now()}`, name: `New entity ${g.entities.length + 1}`, jurisdiction: 'OTHER', role: 'CE', ownershipPct: 100, globeIncome: 0, coveredTaxes: 0, deferredTaxExpense: 0, deferredTaxRate: 0, eligiblePayroll: 0, eligibleTangibleAssets: 0 }],
    }))
  const rmEnt = (id: string) => setGroup((g) => ({ ...g, entities: g.entities.filter((e) => e.id !== id) }))
  const jurisdictionsInUse = [...new Set(group.entities.map((e) => e.jurisdiction))]
  const cbcrFor = (code: string): CbcrInput => group.cbcr.find((c) => c.jurisdiction === code) ?? { jurisdiction: code, revenue: 0, profitBeforeTax: 0, simplifiedCoveredTaxes: 0 }
  const hasCbcr = (code: string) => group.cbcr.some((c) => c.jurisdiction === code)
  const upCbcr = (code: string, patch: Partial<CbcrInput>) =>
    setGroup((g) => {
      const exists = g.cbcr.some((c) => c.jurisdiction === code)
      const cbcr = exists ? g.cbcr.map((c) => (c.jurisdiction === code ? { ...c, ...patch } : c)) : [...g.cbcr, { ...cbcrFor(code), ...patch }]
      return { ...g, cbcr }
    })
  const rmCbcr = (code: string) => setGroup((g) => ({ ...g, cbcr: g.cbcr.filter((c) => c.jurisdiction !== code) }))
  const upeCount = group.entities.filter((e) => e.role === 'UPE').length

  return (
    <>
      <PageHeader
        eyebrow="Calculator"
        title="Group & entities"
        subtitle="Constituent entities, ownership, GloBE income, taxes and substance, plus CbCR data for the transitional safe harbour. All amounts in EUR."
        actions={
          <>
            <span className="fine">{savedLocally ? 'Saved in this browser' : 'Not saved (storage unavailable)'}</span>
            <button type="button" className="secondary" onClick={resetSample}>Reset to sample</button>
            <a className="btn" href={href('results')}>View results →</a>
          </>
        }
      />

      <div className="panel input-grid">
        <label className="field">
          Group name
          <input type="text" value={group.groupName} onChange={(e) => setGroup((g) => ({ ...g, groupName: e.target.value }))} />
        </label>
        <label className="field">
          Consolidated revenue (EUR)
          <input type="number" value={group.consolidatedRevenueEur} onChange={(e) => setGroup((g) => ({ ...g, consolidatedRevenueEur: Number(e.target.value) }))} />
          <span className="fine">Scope test: EUR 750m (Model Rules Art. 1.1.1)</span>
        </label>
        <label className="field">
          Fiscal year beginning
          <input type="date" value={group.fiscalYearStart} onChange={(e) => e.target.value && setGroup((g) => ({ ...g, fiscalYearStart: e.target.value }))} />
          <span className="fine">Sets the SBIE rates, the safe harbour rate and which HK / SG / JP rules apply</span>
        </label>
        <label className="field check-field">
          <span>
            <input type="checkbox" checked={group.applyTransitionalSafeHarbour} onChange={(e) => setGroup((g) => ({ ...g, applyTransitionalSafeHarbour: e.target.checked }))} /> Apply transitional CbCR safe harbour
          </span>
          <span className="fine">Uses the CbCR data below. Only available in the Transition Period.</span>
        </label>
        <label className="field">
          Safe harbour transition period basis
          <select value={group.tcshBasis ?? 'enacted'} onChange={(e) => setGroup((g) => ({ ...g, tcshBasis: e.target.value as TcshBasis }))} disabled={!group.applyTransitionalSafeHarbour}>
            {BASES.map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}
          </select>
          <span className="fine">The OECD extended the safe harbour to FYs beginning in 2027. Japan has enacted the extension, Singapore has announced it, and Hong Kong has not adopted it (see Jurisdictions).</span>
        </label>
      </div>

      {upeCount !== 1 && <Callout tone="warn">Flag exactly one entity as the UPE. {upeCount === 0 ? 'None is flagged.' : `${upeCount} are flagged.`}</Callout>}

      <section className="panel">
        <div className="panel-head">
          <h3>Constituent entities <span className="fine">({group.entities.length})</span></h3>
          <button type="button" className="secondary" onClick={addEnt}>Add entity</button>
        </div>
        {group.entities.length === 0 ? (
          <EmptyState title="No entities yet">
            Add at least one entity and flag one as the UPE, or{' '}
            <button type="button" className="linkish neutral" onClick={resetSample}>load the sample group</button>.
          </EmptyState>
        ) : (
        <div className="table-wrap tall">
          <table className="table inputs sticky entities">
            <thead>
              <tr>
                <th>Entity</th><th>Jurisdiction</th><th>Role</th><th className="num">UPE ownership %</th><th className="num">GloBE income</th><th className="num">Covered taxes (current)</th>
                <th className="num">Deferred tax expense</th><th className="num">DT booked rate %</th><th className="num">Eligible payroll</th><th className="num">Eligible tangible assets</th><th>Flags</th><th />
              </tr>
            </thead>
            <tbody>
              {group.entities.map((e, idx) => (
                <tr key={e.id}>
                  <td><input type="text" value={e.name} aria-label={`Entity name (row ${idx + 1})`} onChange={(ev) => upEnt(e.id, { name: ev.target.value })} /></td>
                  <td>
                    <select value={e.jurisdiction} aria-label={`${e.name}: jurisdiction`} onChange={(ev) => upEnt(e.id, { jurisdiction: ev.target.value })}>
                      {JURS.map((j) => <option key={j.code} value={j.code}>{j.label}</option>)}
                    </select>
                  </td>
                  <td>
                    <select value={e.role} aria-label={`${e.name}: role`} onChange={(ev) => upEnt(e.id, { role: ev.target.value as EntityRole, ownershipPct: ev.target.value === 'UPE' ? 100 : e.ownershipPct })}>
                      {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                    </select>
                  </td>
                  <td><NumIn className="narrow" label={`${e.name}: Ownership %`} value={e.ownershipPct} onChange={(n) => upEnt(e.id, { ownershipPct: Math.min(100, Math.max(0, n)) })} /></td>
                  <td><NumIn label={`${e.name}: GloBE income`} value={e.globeIncome} onChange={(n) => upEnt(e.id, { globeIncome: n })} /></td>
                  <td><NumIn label={`${e.name}: Covered taxes`} value={e.coveredTaxes} onChange={(n) => upEnt(e.id, { coveredTaxes: n })} /></td>
                  <td><NumIn label={`${e.name}: Deferred tax expense`} value={e.deferredTaxExpense} onChange={(n) => upEnt(e.id, { deferredTaxExpense: n })} /></td>
                  <td><NumIn className="narrow" label={`${e.name}: Deferred tax booked rate %`} value={Math.round(e.deferredTaxRate * 10000) / 100} onChange={(n) => upEnt(e.id, { deferredTaxRate: n / 100 })} /></td>
                  <td><NumIn label={`${e.name}: Eligible payroll`} value={e.eligiblePayroll} onChange={(n) => upEnt(e.id, { eligiblePayroll: n })} /></td>
                  <td><NumIn label={`${e.name}: Eligible tangible assets`} value={e.eligibleTangibleAssets} onChange={(n) => upEnt(e.id, { eligibleTangibleAssets: n })} /></td>
                  <td className="flags">
                    <label title="Minority-Owned Constituent Entity (Art. 5.6 not modelled)"><input type="checkbox" checked={!!e.minorityOwned} onChange={(ev) => upEnt(e.id, { minorityOwned: ev.target.checked })} /> Minority-owned</label>
                    <label title="Investment Entity: excluded from blending and SBIE"><input type="checkbox" checked={!!e.investmentEntity} onChange={(ev) => upEnt(e.id, { investmentEntity: ev.target.checked })} /> Investment entity</label>
                  </td>
                  <td><button type="button" className="linkish" onClick={() => rmEnt(e.id)} aria-label={`Remove ${e.name}`}>Remove</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        )}
        <p className="fine">
          <strong>Ownership %</strong> is the UPE's effective ownership interest and is used as the IIR inclusion ratio (Art. 2.2). <strong>Deferred tax</strong> is recast at 15% where it was booked at a higher rate (Art. 4.4.1,
          simplified). Investment entities are excluded. Minority-owned entities are blended with a note.
        </p>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h3>CbCR data for the transitional safe harbour</h3>
          <span className="fine">Per jurisdiction: Qualified CbC Report revenue and profit (loss) before income tax, plus simplified covered taxes from the Qualified Financial Statements</span>
        </div>
        <div className="table-wrap">
          <table className="table inputs sticky">
            <thead><tr><th>Jurisdiction</th><th className="num">Total revenue</th><th className="num">Profit (loss) before tax</th><th className="num">Simplified covered taxes</th><th>Status</th><th /></tr></thead>
            <tbody>
              {jurisdictionsInUse.length === 0 && (
                <tr><td colSpan={6} className="fine">Add entities first: one CbCR row is shown per jurisdiction in use.</td></tr>
              )}
              {jurisdictionsInUse.map((code) => {
                const c = cbcrFor(code)
                return (
                  <tr key={code}>
                    <th scope="row">{JURS.find((j) => j.code === code)?.label ?? code}</th>
                    <td><NumIn label={`${code}: CbCR revenue`} value={c.revenue} onChange={(n) => upCbcr(code, { revenue: n })} /></td>
                    <td><NumIn label={`${code}: CbCR profit before tax`} value={c.profitBeforeTax} onChange={(n) => upCbcr(code, { profitBeforeTax: n })} /></td>
                    <td><NumIn label={`${code}: Simplified covered taxes`} value={c.simplifiedCoveredTaxes} onChange={(n) => upCbcr(code, { simplifiedCoveredTaxes: n })} /></td>
                    <td>{hasCbcr(code) ? <Tag tone="ok">Entered</Tag> : <Tag tone="muted">No data: safe harbour not tested</Tag>}</td>
                    <td>{hasCbcr(code) && <button type="button" className="linkish" onClick={() => rmCbcr(code)} aria-label={`Clear CbCR data for ${code}`}>Clear</button>}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>
    </>
  )
}
