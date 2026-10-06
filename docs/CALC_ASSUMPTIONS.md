# Calc assumptions: oecd-asia-v0.2

This is a simplified projection engine. **It is not tax advice, not a GIR, and not a claim of full OECD / IRD / IRAS / NTA compliance.**

## Ruleset resolution

| Item | Rule |
|---|---|
| Active ruleset | `oecd-asia-v0.2` (`src/rules/oecd-asia-v0.2.json`): minEtr 15%, revenue threshold EUR 750m, feature flags, and the `OTHER` bucket ("Other (non-QDMTT)") |
| HK / SG / JP presets | Built by `buildAsiaRuleset(fiscalYearStart)` from `src/rules/jurisdictions/{hk,sg,jp}.v1.json`. `hasQdmtt` is true only when the pack's QDMTT rule is `in-force` and `fiscalYearStart >= effectiveFrom` ("FY beginning on or after"). |
| Labels | Domestic top-up tax label = the pack's `domesticTopUpTax.shortName`: HKMTT / DTT / JP QDMTT |
| Default FY start | 2026-01-01 (scenario default, not a tax parameter). Editable on the Inputs page. |
| Legacy | `legacyRulesetV01` (`oecd-hk-simplified-v0.1`) is still accepted via `GroupInput.ruleset`. All 13 original golden tests run against it. |

## Routing golden cases

| Case | Result |
|---|---|
| HK, FY starting 2026-01-01, ETR 5% | Top-up to HKMTT |
| SG, FY starting 2026-01-01 | Top-up to DTT |
| HK / SG, FY starting 2024-07-01 (before 2025-01-01) | Residual shown as IIR |
| JP, FY starting 2026-01-01 | IIR (JP QDMTT applies only to FYs beginning on/after 2026-04-01). A note is added. |
| JP, FY starting 2026-04-01 | JP QDMTT |
| Other (non-QDMTT) | IIR |

## Scope test

| Item | Rule |
|---|---|
| Consolidated revenue | The group is in scope when `consolidatedRevenueEur >= revenueThresholdEur` (EUR 750,000,000 from rules JSON). |
| Out of scope | All jurisdictional top-up is forced to 0. |

## Per-jurisdiction formulas

| Formula | Definition |
|---|---|
| ETR | `Covered Taxes / GloBE Income`. If GloBE Income is 0, ETR is `null` and top-up is 0. |
| Top-up rate | `max(0, minEtr − ETR)` |
| Excess Profit | `max(0, GloBE Income − carve-out)` when the substance carve-out feature is on. The carve-out is a direct input; SBIE is not computed. |
| Jurisdictional top-up | `Top-up rate × Excess Profit` |
| Domestic top-up (QDMTT) | If the preset's `hasQdmtt` is true, the whole jurisdictional top-up is collected locally. |
| IIR | Otherwise the whole jurisdictional top-up is attributed to the UPE under the IIR (100% ownership assumed). |
| Transitional safe harbour | A manual flag. When true, the jurisdictional top-up is 0. The CbCR numeric tests are not computed. |

## Not modelled in v0.2

- UTPR allocation and the QDMTT → IIR → UTPR ordering across multiple parents
- Ownership percentages, minority interests, POPE / IPE
- SBIE computation and transition rates
- Transitional CbCR safe harbour numeric tests, Side-by-Side / UPE safe harbour, the JP tax-credit special measure
- Deferred tax detail, special entities, Pillar One
- National / local split of JP QDMTT (75.3% national + local corporate tax). Only the total is shown.

## Filing calendar (`src/rules/jurisdictions/calendar.ts`)

- The FY start is derived as FYE − 12 months + 1 day (12-month FY assumed).
- Month-end FYE maps to month-end (31 Dec + 15 months → 31 Mar).
- The "first year" checkbox switches to the pack's `firstYearMonthsAfterFye` (e.g. 18 months) and enables one-off items (e.g. SG registration).
- Floors (JP: no deadline before 30 Jun 2026) are applied and flagged.
- Payments are computed relative to the related return (HK payment is marked "earliest", because it also depends on the notice of assessment).
- Obligations whose rule had not started for that FY are listed as not applicable.
- Weekend / public-holiday roll-forward is **not** applied. All dates are indicative.

## How rules change

1. Edit or version a pack under `src/rules/jurisdictions/` or the base ruleset under `src/rules/`, keeping `sourceUrl` and `verified` on every field.
2. Bump the version (`packVersion` / `version`).
3. Update the golden tests (`asia.test.ts`, `packs.test.ts`).
4. Get human review before treating the change as demo-ready. Updates flagged "needs rule change" on the Latest updates page are a prompt for this process, not an automatic edit.
