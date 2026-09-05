# Calc assumptions — oecd-hk-simplified-v0.1

Simplified projection engine. **Not tax advice. Not a GIR. Not full OECD / IRD compliance.**

## Scope test

| Item | Rule |
|---|---|
| Consolidated revenue | Group is in scope when `consolidatedRevenueEur >= revenueThresholdEur` (default EUR 750,000,000 from rules JSON). |
| Out of scope | All jurisdictional top-up forced to 0; KPIs show inScope=false. |

## Per-jurisdiction formulas

| Formula | Definition |
|---|---|
| ETR | `Covered Taxes / GloBE Income`. If GloBE Income is 0, ETR is `null` and top-up is 0. |
| Top-up rate | `max(0, minEtr − ETR)` with `minEtr` from rules (default 15%). |
| Excess Profit | `max(0, GloBE Income − carve-out)` when substance carve-out feature is enabled; otherwise carve-out input is ignored. |
| Jurisdictional top-up | `Top-up rate × Excess Profit`. |
| QDMTT / HKMTT | If jurisdiction `hasQdmtt` is true, entire jurisdictional top-up is QDMTT (HK label = HKMTT). |
| IIR | If `hasQdmtt` is false, entire jurisdictional top-up is attributed as IIR to the UPE (no ownership % modelled). |
| Transitional safe harbour | When feature enabled and flag true for the jurisdiction, jurisdictional top-up is set to 0. |

## Included in v0.1

- Revenue scope test
- ETR / top-up rate / excess profit
- QDMTT vs IIR split by jurisdiction flag
- Optional substance carve-out
- Optional transitional safe harbour boolean (not full CbCR numeric tests)
- Multi-jurisdiction aggregation
- Versioned rules JSON (`src/rules/oecd-hk-simplified-v0.1.json`)

## Excluded in v0.1

- Deferred tax detail
- Ownership percentage chains
- UTPR allocation
- Full CbCR transitional safe harbour numeric tests
- Special entities / investment entities
- Pillar One
- Auto-rewrite of calc from law PDFs

## How rules change

1. Edit or add a JSON file under `src/rules/`.
2. Point the engine import (or loader) at the new file and bump `version`.
3. Add / update golden tests in `src/calc/pillarTwo.test.ts`.
4. Human review before treating as demo-ready.

Each row above has at least one golden test in `pillarTwo.test.ts`.
