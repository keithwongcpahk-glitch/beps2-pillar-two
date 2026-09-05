# Pillar Two projection (HK HKMTT + OECD 15%)

Simplified BEPS 2.0 / GloBE projection tool for tax / FP&A demos.

**Disclaimer:** Simplified projection. Not tax advice. Not a GloBE Information Return (GIR). Not full OECD / IRD compliance.

## Quick start

Use the project scripts: `dev`, `test`, and `build` via the local package manager.

## Layout

- `src/calc/pillarTwo.ts` — pure calc engine
- `src/calc/pillarTwo.test.ts` — golden tests (12+)
- `src/rules/oecd-hk-simplified-v0.1.json` — versioned rules
- `src/App.tsx` — dashboard shell
- `src/components/` — KPI / ETR chart / breakdown
- `docs/CALC_ASSUMPTIONS.md` — formula assumptions
- `docs/HANDOFF_PLAN.md` — parallel workstreams plan

## In scope (v0.1)

- ETR, top-up rate, excess profit
- QDMTT / HKMTT vs IIR by jurisdiction
- Substance carve-out + transitional safe harbour flags
- EUR 750m revenue scope test
- Rules as versioned JSON

## Out of scope

- Pillar One
- Deferred tax / ownership chains / UTPR allocation
- Full CbCR safe harbour numeric tests
- Auto-applying law PDFs to production calc
- Auth / multi-tenant SaaS

## Bumping the ruleset to v0.2

1. Copy `src/rules/oecd-hk-simplified-v0.1.json` to `oecd-hk-simplified-v0.2.json`.
2. Change parameters (`minEtr`, `revenueThresholdEur`, jurisdiction flags, feature flags).
3. Update the import in `src/calc/pillarTwo.ts` (or add a thin loader) and set `version`.
4. Extend golden tests for any behaviour change.
5. Keep UI reading `rulesetVersion` from the projection result — no UI rewrite required for parameter bumps.

Changing the JSON (and reloading it in the engine) changes calc behaviour; the UI only displays the version string.

## Architecture

Inputs (UI) then `projectPillarTwo(group, ruleset?)` then `ProjectionResult` then Dashboard.

Calc stays pure. Tax parameters live in rules JSON, not in JSX.
