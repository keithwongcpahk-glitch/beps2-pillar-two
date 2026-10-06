import { useEffect, useMemo, useState } from 'react'
import { GLOBE_VERSION, projectGlobe } from './calc/globe'
import type { GroupInputV3 } from './calc/globe'
import { buildAsiaRuleset, RULESET_VERSION, projectPillarTwo } from './calc/pillarTwo'
import { GROUP_STORAGE_KEY, parseStoredGroup, SAMPLE_GROUP, SCENARIO_A_KEY } from './calc/sampleGroup'
import { DEFAULT_FY_START, DEFAULT_GROUP_REVENUE, DEFAULT_JURISDICTIONS, DISCLAIMER, type EditableJurisdiction } from './defaults'
import { INTEL_ITEMS, INTEL_META } from './intel/types'
import { calendarDateAt, filterByWindow, windowFor } from './intel/window'
import { AboutPage } from './pages/AboutPage'
import { GroupPage } from './pages/GroupPage'
import { ResultsPage } from './pages/ResultsPage'
import { InputsPage } from './pages/InputsPage'
import { JurisdictionsPage } from './pages/JurisdictionsPage'
import { OverviewPage } from './pages/OverviewPage'
import { UpdatesPage } from './pages/UpdatesPage'
import { href, useHashRoute, type Page } from './router'

const NAV: { page: Page; label: string; group: string }[] = [
  { page: 'results', label: 'GloBE results', group: 'Calculator' },
  { page: 'group', label: 'Group & entities', group: 'Calculator' },
  { page: 'overview', label: 'Overview', group: 'Quick estimate' },
  { page: 'inputs', label: 'Inputs', group: 'Quick estimate' },
  { page: 'updates', label: 'Latest updates', group: 'Intelligence' },
  { page: 'jurisdictions', label: 'Jurisdictions', group: 'Intelligence' },
  { page: 'about', label: 'About', group: 'Product' },
]

const IN_WINDOW_COUNT = filterByWindow(INTEL_ITEMS, windowFor(calendarDateAt(INTEL_META.lastRefreshed), INTEL_META.windowDays)).length

function loadGroup(): { group: GroupInputV3; ok: boolean } {
  try {
    return { group: parseStoredGroup(window.localStorage.getItem(GROUP_STORAGE_KEY)) ?? SAMPLE_GROUP, ok: true }
  } catch {
    return { group: SAMPLE_GROUP, ok: false }
  }
}

export default function App() {
  const route = useHashRoute()
  const [group, setGroupState] = useState<GroupInputV3>(() => loadGroup().group)
  const [savedLocally, setSavedLocally] = useState(true)
  useEffect(() => {
    try {
      window.localStorage.setItem(GROUP_STORAGE_KEY, JSON.stringify(group))
      setSavedLocally(true)
    } catch {
      setSavedLocally(false)
    }
  }, [group])
  const globeResult = useMemo(() => {
    try {
      return projectGlobe(group)
    } catch {
      return projectGlobe({ ...group, fiscalYearStart: SAMPLE_GROUP.fiscalYearStart })
    }
  }, [group])
  const [scenarioAGroup, setScenarioAGroup] = useState<GroupInputV3 | null>(() => {
    try {
      return parseStoredGroup(window.localStorage.getItem(SCENARIO_A_KEY))
    } catch {
      return null
    }
  })
  useEffect(() => {
    try {
      if (scenarioAGroup) window.localStorage.setItem(SCENARIO_A_KEY, JSON.stringify(scenarioAGroup))
      else window.localStorage.removeItem(SCENARIO_A_KEY)
    } catch {
      /* storage unavailable */
    }
  }, [scenarioAGroup])
  const scenarioAResult = useMemo(() => {
    if (!scenarioAGroup) return null
    try {
      return projectGlobe(scenarioAGroup)
    } catch {
      return null
    }
  }, [scenarioAGroup])
  const setGroup = (updater: (g: GroupInputV3) => GroupInputV3) => setGroupState((g) => updater(g))
  const [revenue, setRevenue] = useState(DEFAULT_GROUP_REVENUE)
  const [fiscalYearStart, setFiscalYearStart] = useState(DEFAULT_FY_START)
  const [rows, setRows] = useState<EditableJurisdiction[]>(DEFAULT_JURISDICTIONS)

  const ruleset = useMemo(() => {
    try {
      return buildAsiaRuleset(fiscalYearStart)
    } catch {
      return buildAsiaRuleset(DEFAULT_FY_START)
    }
  }, [fiscalYearStart])

  const result = useMemo(
    () =>
      projectPillarTwo({
        consolidatedRevenueEur: revenue,
        ruleset,
        jurisdictions: rows.map(({ code, globeIncome, coveredTaxes, carveOut, transitionalSafeHarbour }) => ({ code, globeIncome, coveredTaxes, carveOut, transitionalSafeHarbour })),
      }),
    [revenue, rows, ruleset],
  )

  const updateRow = (id: string, patch: Partial<EditableJurisdiction>) => setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)))
  const addRow = () => setRows((prev) => [...prev, { id: String(Date.now()), code: 'OTHER', globeIncome: 0, coveredTaxes: 0, carveOut: 0, transitionalSafeHarbour: false }])
  const removeRow = (id: string) => setRows((prev) => prev.filter((r) => r.id !== id))

  let lastGroup = ''
  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <span className="logo" aria-hidden="true">P2</span>
          <div>
            <h1>Pillar Two Asia</h1>
            <p>HK · SG · JP global minimum tax</p>
          </div>
        </div>
        <nav aria-label="Main">
          {NAV.map((n) => {
            const header = n.group !== lastGroup ? <span className="nav-group" key={`g-${n.group}`}>{n.group}</span> : null
            lastGroup = n.group
            return [
              header,
              <a key={n.page} href={href(n.page)} className={route.page === n.page ? 'active' : ''} aria-current={route.page === n.page ? 'page' : undefined}>
                <span>{n.label}</span>
                {n.page === 'updates' && IN_WINDOW_COUNT > 0 && <span className="nav-count">{IN_WINDOW_COUNT}</span>}
              </a>,
            ]
          })}
        </nav>
        <div className="sidebar-meta">
          <span className="chip" title="Entity-level GloBE engine parameters">{GLOBE_VERSION}</span>
          <span className="fine">Quick estimate: {RULESET_VERSION}</span>
          <p className="fine">{DISCLAIMER}</p>
        </div>
      </aside>
      <main className="main">
        {route.page === 'results' && <ResultsPage result={globeResult} input={group} importA={setScenarioAGroup} scenarioA={scenarioAResult} saveA={() => setScenarioAGroup(group)} clearA={() => setScenarioAGroup(null)} />}
        {route.page === 'group' && <GroupPage group={group} setGroup={setGroup} resetSample={() => setGroupState(SAMPLE_GROUP)} savedLocally={savedLocally} />}
        {route.page === 'overview' && <OverviewPage result={result} ruleset={ruleset} fiscalYearStart={fiscalYearStart} />}
        {route.page === 'inputs' && (
          <InputsPage
            revenue={revenue}
            setRevenue={setRevenue}
            fiscalYearStart={fiscalYearStart}
            setFiscalYearStart={setFiscalYearStart}
            rows={rows}
            updateRow={updateRow}
            addRow={addRow}
            removeRow={removeRow}
            result={result}
            ruleset={ruleset}
          />
        )}
        {route.page === 'updates' && <UpdatesPage />}
        {route.page === 'jurisdictions' && <JurisdictionsPage sub={route.sub} />}
        {route.page === 'about' && <AboutPage />}
        <footer className="footer fine">{DISCLAIMER} Engine {GLOBE_VERSION} · quick estimate {RULESET_VERSION}.</footer>
      </main>
    </div>
  )
}
