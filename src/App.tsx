import { useEffect, useMemo, useRef, useState } from 'react'
import { GLOBE_VERSION, projectGlobe } from './calc/globe'
import type { GroupInputV3 } from './calc/globe'
import { buildAsiaRuleset, RULESET_VERSION, projectPillarTwo } from './calc/pillarTwo'
import { GROUP_STORAGE_KEY, parseStoredGroup, SAMPLE_GROUP, SCENARIO_A_KEY } from './calc/sampleGroup'
import { addScenario, migrateLegacyScenarioA, parseScenarios, SCENARIOS_KEY, uniqueName, type SavedScenario } from './calc/scenarioStore'
import { ErrorBoundary } from './components/ErrorBoundary'
import { ChangesPage } from './pages/ChangesPage'
import { HomePage } from './pages/HomePage'
import { DashboardPage } from './pages/DashboardPage'
import { ScenariosPage } from './pages/ScenariosPage'
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
  { page: 'home', label: 'Overview', group: 'Start' },
  { page: 'dashboard', label: 'Executive dashboard', group: 'Start' },
  { page: 'group', label: 'Group & entities', group: 'Calculator' },
  { page: 'results', label: 'GloBE results', group: 'Calculator' },
  { page: 'scenarios', label: 'Scenarios', group: 'Calculator' },
  { page: 'overview', label: 'Summary', group: 'Quick estimate' },
  { page: 'inputs', label: 'Inputs', group: 'Quick estimate' },
  { page: 'updates', label: 'Latest updates', group: 'Intelligence' },
  { page: 'jurisdictions', label: 'Jurisdictions', group: 'Intelligence' },
  { page: 'changes', label: 'Ruleset & changes', group: 'Product' },
  { page: 'about', label: 'About', group: 'Product' },
]

function loadScenarios(): SavedScenario[] {
  try {
    const raw = window.localStorage.getItem(SCENARIOS_KEY)
    if (raw !== null) return parseScenarios(raw)
    return migrateLegacyScenarioA(window.localStorage.getItem(SCENARIO_A_KEY), new Date().toISOString())
  } catch {
    return []
  }
}

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
  const firstRender = useRef(true)
  useEffect(() => {
    const label = NAV.find((n) => n.page === route.page)?.label ?? 'Overview'
    document.title = `${route.page === 'home' ? 'Overview' : label} · Pillar Two Asia (HK / SG / JP)`
    if (firstRender.current) {
      firstRender.current = false
      return
    }
    // Move focus to the new page for keyboard and screen-reader users.
    window.scrollTo(0, 0)
    document.getElementById('main')?.focus({ preventScroll: true })
  }, [route.page])
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
  const [scenarios, setScenariosState] = useState<SavedScenario[]>(loadScenarios)
  const [scenarioStorageOk, setScenarioStorageOk] = useState(true)
  useEffect(() => {
    try {
      window.localStorage.setItem(SCENARIOS_KEY, JSON.stringify(scenarios))
      window.localStorage.removeItem(SCENARIO_A_KEY)
      setScenarioStorageOk(true)
    } catch {
      setScenarioStorageOk(false)
    }
  }, [scenarios])
  const setScenarios = (updater: (l: SavedScenario[]) => SavedScenario[]) => setScenariosState((l) => updater(l))
  const saveCurrentScenario = (name: string): string => {
    const finalName = uniqueName(scenarios, name)
    setScenariosState((l) => addScenario(l, finalName, group, new Date().toISOString(), `s${Date.now().toString(36)}`))
    return finalName
  }
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
      <a className="skip-link" href="#main" onClick={(e) => { e.preventDefault(); document.getElementById('main')?.focus() }}>Skip to content</a>
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
      <main className="main" id="main" tabIndex={-1}>
        <ErrorBoundary resetKey={route.page} onReset={() => setGroupState(SAMPLE_GROUP)}>
        {route.page === 'home' && <HomePage result={globeResult} />}
        {route.page === 'dashboard' && <DashboardPage current={group} scenarios={scenarios} />}
        {route.page === 'results' && <ResultsPage result={globeResult} input={group} saveScenario={() => saveCurrentScenario(`${group.groupName} · FY ${group.fiscalYearStart}`)} />}
        {route.page === 'group' && <GroupPage group={group} setGroup={setGroup} resetSample={() => setGroupState(SAMPLE_GROUP)} savedLocally={savedLocally} />}
        {route.page === 'scenarios' && (
          <ScenariosPage scenarios={scenarios} setScenarios={setScenarios} current={group} saveCurrent={saveCurrentScenario} loadIntoEditor={(g) => setGroupState(g)} storageOk={scenarioStorageOk} />
        )}
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
        {route.page === 'changes' && <ChangesPage />}
        {route.page === 'about' && <AboutPage />}
        </ErrorBoundary>
        <footer className="footer fine">{DISCLAIMER} Engine {GLOBE_VERSION} · quick estimate {RULESET_VERSION}.</footer>
      </main>
    </div>
  )
}
