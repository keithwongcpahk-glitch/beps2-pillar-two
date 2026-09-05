# BEPS 2.0 — Handoff Plan for Parallel Work (Grok)

Self-contained plan. Grok does **not** need access to the author’s desktop — paste this file (or the whole repo) into the other bot’s context.

---

## Context

**Product:** Pillar Two (BEPS 2.0) projection tool — Hong Kong HKMTT (QDMTT) + OECD 15% baseline.

**Stack:** Vite + React + TypeScript.

**Key paths:**

| What | Path |
|---|---|
| Calc engine | `src/calc/pillarTwo.ts` |
| Calc tests | `src/calc/pillarTwo.test.ts` |
| Dashboard UI | `src/App.tsx` |
| Charts / KPI | `src/components/` |
| Defaults | `src/defaults.ts` |
| Styles | `src/index.css` |
| README | `README.md` |

**Status:** Phase 1 MVP works. Dashboard exists. Calc is simplified (not full GloBE).

**Hard constraint:** Do **not** auto-rewrite tax logic from 200-page OECD/IRD PDFs. Rules change via versioned config + human review + golden tests.

**Disclaimer (keep in UI/docs):** Simplified projection, not tax advice, not a GloBE Information Return (GIR).

---

## Already done (do not rebuild)

- Calc engine `RULESET_VERSION = oecd-hk-simplified-v0.1`
- Unit tests (6 cases) for ETR / QDMTT / IIR / carve-out / safe harbour / out-of-scope
- Dashboard: sidebar, KPI cards, ETR chart, Top-up breakdown, inputs, about
- Jurisdiction presets (HK, SG, CN, GB, IE, US, OTHER)

**Local commands (if you have the repo):**

```bash
npm install
npm run dev      # http://localhost:5173/
npm test
npm run build
```

---

## Goal (next 2–4 weeks)

Make the product **demo-ready for tax / FP&A users**:

1. Stronger confidence in calc (golden tests + assumptions doc)
2. Rules as data (JSON ruleset, not hard-coded magic numbers only)
3. Scenario compare + Excel/CSV export
4. Lightweight Reg Intel board (monitor → flag impact → human approve; **no auto code change**)

---

## Parallel workstreams

Pick one stream at a time. Avoid editing the same files as another bot.

### Stream A — Calc confidence (highest priority)

**Do:**

1. Add `docs/CALC_ASSUMPTIONS.md` listing every formula, what is included, what is excluded.
2. Expand golden tests in `src/calc/pillarTwo.test.ts` (and optionally `src/calc/fixtures/*.json`):
   - HK low ETR → all top-up to QDMTT / HKMTT
   - Non-QDMTT jurisdiction → IIR residual to UPE
   - ETR ≥ 15% → zero top-up
   - Substance carve-out reduces Excess Profit
   - Transitional safe harbour flag → zero top-up
   - Out of scope revenue → zero top-up
   - Multi-jurisdiction mix (HK + SG + IE style)
3. Optional: JSON fixtures so a human can paste Excel expected outputs later.

**Touch:** `src/calc/**`, `docs/CALC_ASSUMPTIONS.md`  
**Avoid:** major `App.tsx` rewrites  

**Done when:**

- [ ] ≥12 tests pass
- [ ] Each listed assumption has at least one test
- [ ] README links to `docs/CALC_ASSUMPTIONS.md`

---

### Stream B — Rule Registry (versioned config)

**Do:**

1. Create `src/rules/oecd-hk-simplified-v0.1.json` with:
   - `minEtr`, `revenueThreshold`
   - jurisdiction defaults (`hasQdmtt`, labels)
   - feature flags: carve-out, transitional safe harbour
2. Load rules in the engine instead of hard-coded constants where practical.
3. Keep ruleset version visible in UI (already partially shown).
4. Document how to bump to `v0.2` without rewriting UI.

**Touch:** `src/rules/**`, thin changes in `src/calc/pillarTwo.ts`, `src/defaults.ts`  
**Avoid:** Reg Intel scraping  

**Done when:**

- [ ] Changing JSON changes calc behavior
- [ ] Tests still pass
- [ ] Bump path documented in README

---

### Stream C — Product UX: Scenarios + Excel/CSV

**Do:**

1. **Scenario A vs B:** duplicate current group inputs; show side-by-side KPI delta (Δ total top-up, Δ QDMTT, Δ IIR).
2. **Export:** download current inputs + results as CSV (Excel-openable). CSV first; XLSX optional.
3. Keep dashboard layout; add a “Scenarios” nav item.

**Touch:** `src/App.tsx`, new `src/components/ScenarioCompare.tsx`, `src/export/csv.ts`, CSS  
**Avoid:** rewriting `pillarTwo.ts` formulas  

**Done when:**

- [ ] User can compare two scenarios
- [ ] User can download CSV
- [ ] Layout still usable on mobile width

---

### Stream D — Reg Intel MVP (monitor board, not auto-calc)

**Do:**

1. Static/mock data first (no fragile scraping required for v1):
   - `src/intel/mockEvents.ts` — 5–8 sample HK IRD / OECD-style updates
2. Board UI with tags:
   - `jurisdiction`, `topic`, `affects_calc?` (yes / no / unknown), `confidence`, `status` (new / reviewed / needs-rule-change)
3. Detail drawer: summary + “proposed ruleset impact” notes (text only).
4. **Explicit non-goal:** do not auto-edit `pillarTwo.ts` or rules JSON without human approval (checkbox + status change only is OK).

**Touch:** `src/intel/**`, `src/components/IntelBoard.tsx`, nav in `App.tsx`  
**Avoid:** production scrapers / API keys / credentials  

**Done when:**

- [ ] Board filters by `affects_calc`
- [ ] Status workflow works
- [ ] README explains Phase 2 real sources (IRD, OECD)

---

### Stream E — Deploy + polish (optional)

**Do:**

1. Deploy notes (Vercel / Netlify static).
2. Persist last inputs in `localStorage`.
3. Empty states / small UX polish (keep existing visual language).

**Touch:** `README.md`, small App/CSS, maybe `src/storage.ts`  

**Done when:**

- [ ] Reload restores last session
- [ ] One-click deploy docs exist

---

## Suggested split (two bots)

| Agent | Owns | Why |
|---|---|---|
| **Grok** | Stream A → then B | Calc / tests / rules — fewer UI merge conflicts |
| **Other agent (Cursor)** | Stream C → then D | Dashboard / UX |
| Either | Stream E | After A–D stable |

If **only Grok** runs: do **A → B → C**, then D.

---

## Architecture rules (must follow)

```
Inputs (UI)
  → projectPillarTwo(group, ruleset?)
  → ProjectionResult
  → Dashboard / CSV / Scenario delta
```

1. Calc stays **pure functions** (easy to test).
2. Tax parameters live in **rules JSON**, not scattered in JSX.
3. Never claim full OECD / IRD compliance in UI copy.
4. Prefer small commits / diffs per stream.
5. Do not feed entire 200-page law PDFs and “rewrite the engine”. Use short rules + numeric golden examples.

### Current simplified formulas (v0.1)

```
ETR = Covered Taxes / GloBE Income
Top-up rate = max(0, 15% − ETR)
Excess Profit = GloBE Income − carve-out (if enabled)
Jurisdictional Top-up = Top-up rate × Excess Profit
If hasQdmtt → QDMTT; else → IIR (attributed to UPE)
Transitional safe harbour flag → treat top-up as 0
Out of scope (revenue threshold) → all top-up 0
```

**Not modelled in v0.1:** deferred tax detail, ownership %, UTPR allocation, full CbCR safe harbour numeric tests, special entities, Pillar One.

---

## Out of scope (reject for this phase)

- Pillar One
- Full deferred tax / ownership chains / UTPR allocation
- Auto-apply law PDFs to production calc
- Real auth / multi-tenant SaaS
- Replacing Big4 filing software

---

## Overall acceptance checklist

- [ ] `npm test` green (≥12 tests after Stream A)
- [ ] `npm run build` green
- [ ] Dashboard: overview + inputs + about still work
- [ ] Ruleset version visible
- [ ] CSV export **or** Scenario A/B **or** Reg Intel board (at least one of C/D shipped)
- [ ] `docs/CALC_ASSUMPTIONS.md` exists
- [ ] README updated: in-scope / out-of-scope

---

## Prompt to paste into Grok

```text
You are working on the BEPS2.0 repo (Vite + React + TypeScript).
Phase 1 MVP already exists. Read docs/HANDOFF_PLAN.md, README.md, and
src/calc/pillarTwo.ts first.

Your job: Stream A (calc golden tests + docs/CALC_ASSUMPTIONS.md), then
Stream B (rule registry JSON). Do not rebuild the dashboard. Do not
auto-scrape tax law. Keep calc as pure functions. Prefer minimal diffs.
Run npm test && npm run build before finishing. Follow architecture rules
and out-of-scope list in the handoff plan.
```

---

## After both bots finish

1. Merge Stream A/B first (foundation).
2. Then C (UX) and D (Intel).
3. Best correctness lock: one Excel sheet with **input → expected output** converted into a golden JSON fixture.
