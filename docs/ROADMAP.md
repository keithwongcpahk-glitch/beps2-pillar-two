# Roadmap: Pillar Two Asia (HK · SG · JP)

Status as of 2026-10-06. This is a simplified projection tool: it is not tax advice, not a GIR, and not a claim of full OECD / IRD / IRAS / NTA compliance.
Ground rules for every phase:
- No invented tax facts. Every parameter has a `sourceUrl` and a `verified` flag.
- The calc stays pure. Parameters live in versioned JSON.
- Rules are never auto-rewritten from PDFs.
- Every behaviour change ships with golden tests.

## Done

### Phase 1: Regulatory intel ("Latest updates"), shipped
- `src/intel/updates.json` and `meta.json`, plus the pure window helper (`window.ts`) and review helpers (`review.ts`), with tests.
- Latest updates page: jurisdiction, topic and affects-calc filters, newest-first ordering, official/secondary tags, source links, last-refreshed stamp, 30-day window computed from `meta.lastRefreshed`, an empty state per jurisdiction, an "Earlier key milestones" section, and a localStorage review status that never edits rules.

### Phase 2: Jurisdiction rule packs, shipped
- `hk.v1.json`, `sg.v1.json`, `jp.v1.json`, plus a loader with validation (`index.ts`) and an indicative filing calendar (`calendar.ts`).
- Engine `oecd-asia-v0.2`: HK/SG/JP presets come from the packs, depending on the fiscal-year start. The legacy v0.1 path still works.
- Jurisdictions page: one tab per country, a comparison table, and the filing calendar. Inputs are narrowed to HK / SG / JP / Other (non-QDMTT).
- 55 tests.

### Phase 3: Fuller engine (`oecd-asia-v0.3`), shipped 2026-10-06
- `src/calc/globe.ts` and `src/rules/globe-params.v0.3.json` (all parameters sourced to the OECD Model Rules, the Dec 2022 Safe Harbours document and the Jan 2026 Side-by-Side Package).
- Entity-level inputs (3.1), SBIE with Art. 9.2 transition rates (3.2), transitional CbCR safe harbour with the 2027 extension (3.3), ownership % as the inclusion ratio (3.4), QDMTT → IIR → UTPR residual ordering with pack-driven timing (3.5), deferred tax recast basics (3.6).
- UI: Group & entities page (persisted in localStorage, preloaded sample group) and a GloBE results page with a waterfall and an explanation trail.
- 27 new golden tests, hand-worked in `docs/CALC_ASSUMPTIONS.md`.
- Still open from Phase 3: **3.7** (pack hardening: holiday calendar, unverified fields) and **3.8** (intel refresh routine). The acceptance criteria below are kept for reference.

## Phase 3: Fuller engine (original plan and acceptance criteria)

| # | Work item | Acceptance criteria |
|---|---|---|
| 3.1 | **Entity-level inputs.** A constituent-entity table (name, jurisdiction, entity type, owner, ownership %, financial accounting net income, adjustments, current tax, deferred tax), aggregated to jurisdiction level. | The jurisdiction totals from entity rows equal the v0.2 jurisdiction inputs in a golden test. The UI can switch between jurisdiction-level and entity-level input without losing data. Validation flags entities with no jurisdiction or owner. |
| 3.2 | **SBIE computation.** Payroll carve-out plus tangible-asset carve-out, with the transition-rate table stored in rules JSON and sourced (OECD Model Rules Art. 9.2 and each pack's local equivalent). The rate is selected from the FY start. | Rates are not hard-coded in TS. Golden tests cover at least FY2025, FY2026 and FY2033 rate years for both payroll and tangible assets. A manual carve-out override is still available and clearly labelled. |
| 3.3 | **Transitional CbCR safe harbour tests.** Three tests: de minimis (revenue < EUR 10m and profit < EUR 1m), simplified ETR (transition rate by year), and routine profits (profit ≤ SBIE). The JP extension to FYs ending by 31 Dec 2027 (FY2026 reform) is sourced in the JP pack. | Each test has pass/fail golden cases, including boundary values. The UI shows which test passed per jurisdiction. The existing manual flag becomes "override" with an audit note. All thresholds and rates live in JSON with `sourceUrl`. |
| 3.4 | **Ownership % for the IIR.** The UPE's inclusion ratio on top-up allocated from low-taxed constituent entities, with an allocable share under 100%. | Golden test: 80% ownership gives an IIR of 80% of the entity top-up (after any QDMTT credit). Minority share shown separately. |
| 3.5 | **QDMTT → IIR → UTPR ordering.** QDMTT is credited first, then the IIR (top-down approach, POPE split-ownership basic case), then the UTPR residual. UTPR is shown only where a pack has it in force (JP from FYs beginning on/after 2026-04-01; HK deferred; SG none). | Golden tests: (a) a qualified QDMTT jurisdiction gives zero IIR when the QDMTT Safe Harbour applies; (b) a non-QDMTT jurisdiction gives an IIR at the UPE; (c) the UTPR residual is allocated only when no IIR applies. Results show the rule source per amount. |
| 3.6 | **Deferred tax basics.** Adjusted covered taxes = current tax + deferred tax movement recast at 15%, with a simple recapture flag. | Golden tests for a deferred tax liability recast at 25% → 15% and a deferred tax asset recast. A documented list of what is excluded. |
| 3.7 | **Pack hardening.** Resolve each `verified: false` field (HK territorial × HKMTT inference, JP registration, SG assent date). Add a holiday calendar per jurisdiction (sourced) to the filing calendar. | `listUnverified` drops to 0, or each remaining item has an adviser-confirmed note. Calendar tests cover a weekend roll-forward for JP. |
| 3.8 | **Intel refresh routine.** A documented checklist plus a script that lists candidate items. A human confirms each item before it goes into `updates.json`. | `meta.lastRefreshed` is updated on each run. A dataset integrity test still passes. No item is added without a fetched `sourceUrl`. |

**Phase 3 exit:** at least 90 tests and `npm run build` green. CALC_ASSUMPTIONS updated, and a v0.3 golden scenario is documented end-to-end (entity inputs → SBIE → safe harbour → QDMTT/IIR/UTPR).

## Phase 4: Scenarios, exports, polish

**Status (6 Oct 2026): shipped.**
- **4.1:** multiple named scenarios in localStorage (`p2-scenarios-v1`): save, rename, duplicate, delete, load into the editor, compare any two (or one against the current inputs), comparison CSV, JSON export/import. The legacy single "scenario A" is migrated automatically. Tests: `scenarioStore.test.ts`, `export.test.ts`.
- **4.2:** CSV results export with versions, FY, disclaimer and trail; round-trip tested. XLSX is deliberately not added: no small dependency could be justified, and Excel opens the UTF-8 BOM CSV directly.
- **4.3:** calendar CSV and `.ics` export. Deadlines roll forward under each jurisdiction's sourced computation-of-time rule, with official 2026–2027 holiday lists (`holidays.v1.json`). Tests: `calendarRoll.test.ts`, `export.test.ts`.
- **4.4:** landing/overview page, consistent page headers (eyebrow = navigation group), empty states, a page-level error boundary, a print stylesheet (results → Save as PDF), a skip link, focus outlines, focus moved to the page on navigation, labelled controls, and contrast checked. At 375px there is no horizontal overflow outside table wrappers on any page.
- **4.5:** "Ruleset & changes" page built from `src/rules/changelog.v1.json`. Every pack and ruleset version has an entry with at least one source (tested).
- Also shipped: engine `oecd-asia-v0.4`, in which the TCSH transition period follows local law (see CALC_ASSUMPTIONS).

| # | Work item | Acceptance criteria |
|---|---|---|
| 4.1 | **Scenario A/B.** Two (or more) named scenarios (e.g. "Base FY2026" and "JP FY2026-04 start / incentive change") with a side-by-side delta view. | Scenarios persist in localStorage and can be exported/imported as JSON. The delta table shows top-up by jurisdiction and by rule (QDMTT / IIR / UTPR). A golden test covers the delta calculation. |
| 4.2 | **CSV / XLSX export.** Export projection results, inputs, and the ruleset/pack versions used. | The export includes the ruleset version, pack IDs, FY start and a disclaimer row. XLSX uses a small, justified dependency or a hand-written CSV fallback. Round-trip test: export → parse gives the same totals. |
| 4.3 | **Filing calendar export.** ICS (calendar) and CSV export of indicative due dates. | Each event includes the jurisdiction, obligation, basis text, source URL and an "indicative" note. An ICS validation test checks the generated file structure. |
| 4.4 | **Polish.** Print-friendly report view, accessibility pass (keyboard nav, contrast), mobile QA at 375px, empty/error states, a performance budget (<300 kB gzip JS). | Lighthouse accessibility ≥ 95 on Overview, Updates and Jurisdictions. No horizontal overflow at 375px except inside table wrappers. |
| 4.5 | **Change log.** A "What changed" panel listing pack and ruleset version history, with links to the intel items that triggered each change. | Every pack version bump has a changelog entry referencing at least one source. |

**4.6 Executive dashboard (shipped 6 Oct 2026):** `#/dashboard`, a one-page A4-landscape board view built only from engine output (`src/calc/dashboard.ts`, 20 tests). See `docs/DASHBOARD.md` for the RAG rule and the vendor research.

**Phase 4 exit:** exports verified by tests, scenario A/B usable on mobile, and a production deploy READY on Vercel.
