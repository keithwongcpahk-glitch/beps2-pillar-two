# Pillar Two Asia: HK · SG · JP global minimum tax projection

A Pillar Two (BEPS 2.0 / GloBE) projection and regulatory intelligence tool for groups operating in **Hong Kong, Singapore and Japan**.

Live: https://beps2-pillar-two.vercel.app

> **Disclaimer:** This is a simplified projection for planning only. It is not tax advice, not a GloBE Information Return (GIR), and not a claim of full OECD / IRD / IRAS / NTA compliance.

## What's in the app

| Page | Route | What it does |
|---|---|---|
| Overview | `#/overview` | KPIs, ETR chart, top-up breakdown, HK/SG/JP rule routing for the selected FY, latest-updates teaser |
| Inputs | `#/inputs` | Group revenue, **fiscal-year start**, per-jurisdiction GloBE income / covered taxes / carve-out / safe-harbour flag (HK, SG, JP, Other (non-QDMTT)) |
| Latest updates | `#/updates` | Curated 30-day feed of OECD / HK / SG / JP Pillar Two developments, each with a source link. Filters by jurisdiction, topic and calc impact, plus a separate "Earlier key milestones" list and a browser-local review status (new / reviewed / needs rule change) |
| Jurisdictions | `#/jurisdictions/{compare,hk,sg,jp,calendar}` | Sourced rule packs: rules in force, effective dates, OECD Central Record status, filing obligations, registration, local features, sources. Also a comparison table and an **indicative filing calendar** driven by fiscal year end |
| About | `#/about` | Scope, method, limitations, active versions |

## Scope (Asia)

- **Hong Kong:** HKMTT and IIR (FYs beginning on/after 1 Jan 2025). UTPR deferred.
- **Singapore:** DTT and MTT/IIR (FYs beginning on/after 1 Jan 2025). UTPR not implemented.
- **Japan:** IIR (FYs beginning on/after 1 Apr 2024). QDMTT and UTPR from FYs beginning on/after 1 Apr 2026.
- Any other jurisdiction goes in **Other (non-QDMTT)**, where the residual top-up is shown under the IIR.

These parameters are stored with source URLs in `src/rules/jurisdictions/*.v1.json`. Fields not verified against a primary source carry `"verified": false` and a note, and the UI flags them.

## Quick start

```
npm ci
npm run dev
npm test        # vitest (Node 20; vitest pinned to 3.2.4)
npm run build   # tsc -b && vite build
```

`vite.config.ts` and `vitest.config.ts` are kept separate on purpose. Merging them caused a type clash.

## Layout

- `src/calc/pillarTwo.ts`: pure calc engine. `buildAsiaRuleset(fyStart)` merges the HK/SG/JP pack presets into `src/rules/oecd-asia-v0.2.json`.
- `src/rules/oecd-asia-v0.2.json`: active engine ruleset (`oecd-asia-v0.2`)
- `src/rules/oecd-hk-simplified-v0.1.json`: legacy ruleset (still supported via `legacyRulesetV01`)
- `src/rules/jurisdictions/{hk,sg,jp}.v1.json`: sourced jurisdiction rule packs
- `src/rules/jurisdictions/index.ts`: pack loader, validation, `presetFromPack`
- `src/rules/jurisdictions/calendar.ts`: pure indicative filing-calendar calculator
- `src/intel/updates.json`, `src/intel/meta.json`: regulatory intel items and refresh metadata
- `src/intel/window.ts`, `src/intel/review.ts`: pure date-window, filter and review-status helpers
- `src/pages/*`, `src/components/*`, `src/router.ts`: UI (hash router, no extra dependencies)
- `docs/CALC_ASSUMPTIONS.md`, `docs/ROADMAP.md`, `docs/HANDOFF_PLAN.md`

## Tests

55 Vitest tests:
- Legacy v0.1 engine path (13)
- v0.2 Asia routing golden tests (10)
- Pack loader / validation / filing-calendar goldens (19)
- Intel window / dataset integrity / review helpers (12)
- Router (1)

## Changing rules

1. **Jurisdiction facts:** edit the pack JSON, bump `packVersion` (or add `xx.v2.json` and point the loader at it), keep `sourceUrl` and `verified` on every field, then update the goldens in `packs.test.ts` / `asia.test.ts`.
2. **Engine parameters:** add `src/rules/oecd-asia-v0.3.json`, point `pillarTwo.ts` at it, bump `version`, and extend the golden tests. The UI reads the version from the ruleset.
3. **News:** add items to `src/intel/updates.json` only after opening the source. Update `meta.json` (`lastRefreshed`, coverage notes). If a jurisdiction has nothing in the window, leave it empty: the UI shows "No new items in the last 30 days".
4. Never auto-rewrite rules from OECD / IRD / IRAS / NTA PDFs. A review status of "needs rule change" is only a flag for a human to act on.

## Architecture

Inputs (UI) → `buildAsiaRuleset(fiscalYearStart)` → `projectPillarTwo(group)` → `ProjectionResult` → Dashboard.
The calc stays pure. Tax parameters live in rules JSON, not in JSX.
