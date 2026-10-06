import { useMemo, useState, type FormEvent } from 'react'
import { projectGlobe } from '../calc/globe'
import type { GroupInputV3, ProjectionV3 } from '../calc/globe'
import { compareProjections } from '../calc/scenarios'
import { deleteScenario, duplicateScenario, importScenarios, renameScenario, scenariosToJson, uniqueName, type SavedScenario } from '../calc/scenarioStore'
import { ComparisonTable } from '../components/ComparisonTable'
import { Callout, EmptyState, formatDate, PageHeader } from '../components/ui'
import { comparisonCsvRows, toCsv, withBom } from '../export/csv'
import { downloadText, safeFilePart } from '../export/download'
import { href } from '../router'

const eur = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)
const CURRENT = '__current__'

function safeProject(g: GroupInputV3): ProjectionV3 | null {
  try {
    return projectGlobe(g)
  } catch {
    return null
  }
}

function savedLabel(iso: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export interface ScenariosPageProps {
  scenarios: SavedScenario[]
  setScenarios: (updater: (l: SavedScenario[]) => SavedScenario[]) => void
  current: GroupInputV3
  saveCurrent: (name: string) => string
  loadIntoEditor: (g: GroupInputV3) => void
  storageOk: boolean
}

export function ScenariosPage({ scenarios, setScenarios, current, saveCurrent, loadIntoEditor, storageOk }: ScenariosPageProps) {
  const [name, setName] = useState('')
  const [status, setStatus] = useState<string | null>(null)
  const [renaming, setRenaming] = useState<{ id: string; value: string } | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [aId, setAId] = useState<string>(scenarios[0]?.id ?? CURRENT)
  const [bId, setBId] = useState<string>(CURRENT)
  const now = () => new Date().toISOString()
  const newId = () => `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`

  const projections = useMemo(() => new Map(scenarios.map((s) => [s.id, safeProject(s.input)])), [scenarios])
  const currentProjection = useMemo(() => safeProject(current), [current])
  const pick = (id: string): { label: string; p: ProjectionV3 | null } => {
    if (id === CURRENT) return { label: 'Current inputs', p: currentProjection }
    const s = scenarios.find((x) => x.id === id)
    return s ? { label: s.name, p: projections.get(s.id) ?? null } : { label: 'Current inputs', p: currentProjection }
  }
  const A = pick(scenarios.some((s) => s.id === aId) ? aId : CURRENT)
  const B = pick(scenarios.some((s) => s.id === bId) ? bId : CURRENT)
  const comparison = A.p && B.p ? compareProjections(A.p, B.p, { a: A.label, b: B.label }) : null

  const onSave = (e: FormEvent) => {
    e.preventDefault()
    const used = saveCurrent(name || `${current.groupName} · FY ${current.fiscalYearStart}`)
    setName('')
    setStatus(`Saved current inputs as "${used}".`)
  }
  const onImport = async (file: File | undefined) => {
    if (!file) return
    const text = await file.text()
    const r = importScenarios(scenarios, text, now(), (i) => `${newId()}${i}`)
    if (r.added) setScenarios(() => r.list)
    setStatus(r.added ? `Imported ${r.added} scenario(s).` : 'No valid scenarios found in that file (expected a scenarios export or a group inputs JSON from this tool).')
  }
  const options = [{ id: CURRENT, label: 'Current inputs (editor)' }, ...scenarios.map((s) => ({ id: s.id, label: s.name }))]

  return (
    <>
      <PageHeader
        eyebrow="Calculator"
        title="Scenarios"
        subtitle="Save named versions of the group inputs, then compare any two side by side. Scenarios are stored only in this browser (localStorage) and are recalculated with the current engine."
        actions={
          <>
            <button type="button" className="secondary" disabled={!scenarios.length} onClick={() => downloadText('pillar-two-scenarios.json', scenariosToJson(scenarios, now()), 'application/json')}>Export all (JSON)</button>
            <label className="secondary file-btn">
              Import JSON
              <input type="file" accept="application/json,.json" onChange={(e) => { void onImport(e.target.files?.[0]); e.target.value = '' }} />
            </label>
          </>
        }
      />
      {!storageOk && <Callout tone="warn">Browser storage is unavailable, so scenarios will be lost when you close this tab. Use Export all (JSON) to keep a copy.</Callout>}

      <section className="panel">
        <h3>Save the current inputs</h3>
        <form className="inline-form" onSubmit={onSave}>
          <label className="field grow">
            Scenario name
            <input type="text" value={name} maxLength={80} placeholder={`${current.groupName} · FY ${current.fiscalYearStart}`} onChange={(e) => setName(e.target.value)} />
          </label>
          <button type="submit" className="btn">Save scenario</button>
        </form>
        {status && <p className="fine" role="status">{status}</p>}
      </section>

      <section className="panel">
        <div className="panel-head">
          <h3>Saved scenarios <span className="fine">({scenarios.length})</span></h3>
        </div>
        {scenarios.length === 0 ? (
          <EmptyState title="No saved scenarios yet">
            Save the current inputs above (or use "Save as scenario" on <a href={href('results')}>GloBE results</a>), then change the group on{' '}
            <a href={href('group')}>Group & entities</a> and save again to compare.
          </EmptyState>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr><th scope="col">Name</th><th scope="col">FY beginning</th><th scope="col">TCSH basis</th><th scope="col" className="num">Total top-up</th><th scope="col">Saved</th><th scope="col">Actions</th></tr>
              </thead>
              <tbody>
                {scenarios.map((s) => {
                  const p = projections.get(s.id)
                  const isRenaming = renaming?.id === s.id
                  return (
                    <tr key={s.id}>
                      <td>
                        {isRenaming ? (
                          <form
                            className="inline-form"
                            onSubmit={(e) => {
                              e.preventDefault()
                              setScenarios((l) => renameScenario(l, s.id, renaming.value))
                              setRenaming(null)
                            }}
                          >
                            <input type="text" autoFocus aria-label={`New name for ${s.name}`} value={renaming.value} maxLength={80} onChange={(e) => setRenaming({ id: s.id, value: e.target.value })} />
                            <button type="submit" className="secondary">Save</button>
                            <button type="button" className="linkish neutral" onClick={() => setRenaming(null)}>Cancel</button>
                          </form>
                        ) : (
                          <strong>{s.name}</strong>
                        )}
                      </td>
                      <td>{formatDate(s.input.fiscalYearStart)}</td>
                      <td className="fine">{s.input.applyTransitionalSafeHarbour ? s.input.tcshBasis ?? 'enacted' : 'TCSH off'}</td>
                      <td className="num">{p ? eur(p.totals.topUp) : <span className="neg">Invalid inputs</span>}</td>
                      <td className="fine">{savedLabel(s.savedAt)}</td>
                      <td>
                        <div className="row-actions">
                          <button type="button" className="secondary" onClick={() => { loadIntoEditor(s.input); setStatus(`Loaded "${s.name}" into the editor.`) }} aria-label={`Load ${s.name} into the editor`}>Load</button>
                          <button type="button" className="secondary" onClick={() => setRenaming({ id: s.id, value: s.name })} aria-label={`Rename ${s.name}`}>Rename</button>
                          <button type="button" className="secondary" onClick={() => setScenarios((l) => duplicateScenario(l, s.id, now(), newId()))} aria-label={`Duplicate ${s.name}`}>Duplicate</button>
                          <button type="button" className="secondary" onClick={() => downloadText(`pillar-two-${safeFilePart(s.name)}.json`, JSON.stringify(s.input, null, 2), 'application/json')} aria-label={`Export ${s.name} inputs as JSON`}>JSON</button>
                          {confirmDelete === s.id ? (
                            <>
                              <button type="button" className="linkish" onClick={() => { setScenarios((l) => deleteScenario(l, s.id)); setConfirmDelete(null) }}>Confirm delete</button>
                              <button type="button" className="linkish neutral" onClick={() => setConfirmDelete(null)}>Keep</button>
                            </>
                          ) : (
                            <button type="button" className="linkish" onClick={() => setConfirmDelete(s.id)} aria-label={`Delete ${s.name}`}>Delete</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="panel">
        <div className="panel-head">
          <h3>Compare</h3>
          {comparison && (
            <button type="button" className="secondary" onClick={() => downloadText(`pillar-two-compare-${safeFilePart(A.label)}-vs-${safeFilePart(B.label)}.csv`, withBom(toCsv(comparisonCsvRows(comparison))))}>Export comparison CSV</button>
          )}
        </div>
        <div className="input-grid two">
          <label className="field">
            Scenario A
            <select value={scenarios.some((s) => s.id === aId) ? aId : CURRENT} onChange={(e) => setAId(e.target.value)}>
              {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
          </label>
          <label className="field">
            Scenario B
            <select value={scenarios.some((s) => s.id === bId) ? bId : CURRENT} onChange={(e) => setBId(e.target.value)}>
              {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
          </label>
        </div>
        {comparison ? (
          <>
            <p className="fine">
              A: <strong>{A.label}</strong> (FY beginning {formatDate(comparison.a.fiscalYearStart)}) · B: <strong>{B.label}</strong> (FY beginning {formatDate(comparison.b.fiscalYearStart)}). Δ = B − A.
            </p>
            <ComparisonTable c={comparison} />
          </>
        ) : (
          <EmptyState title="Cannot compare">One of the selected scenarios has inputs the engine cannot read (for example an invalid date). Load it into the editor to fix it.</EmptyState>
        )}
      </section>
    </>
  )
}

export function defaultScenarioName(list: SavedScenario[], g: GroupInputV3): string {
  return uniqueName(list, `${g.groupName} · FY ${g.fiscalYearStart}`)
}
