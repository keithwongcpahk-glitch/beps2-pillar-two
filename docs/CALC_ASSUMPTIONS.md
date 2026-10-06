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
- Weekend / public-holiday roll-forward is applied from `holidays.v1` (see "Filing calendar roll-forward" in the v0.4 section). The statutory date is kept alongside the adjusted date. All dates are indicative.

## How rules change

1. Edit or version a pack under `src/rules/jurisdictions/` or the base ruleset under `src/rules/`, keeping `sourceUrl` and `verified` on every field.
2. Bump the version (`packVersion` / `version`).
3. Update the golden tests (`asia.test.ts`, `packs.test.ts`).
4. Get human review before treating the change as demo-ready. Updates flagged "needs rule change" on the Latest updates page are a prompt for this process, not an automatic edit.

---

# Entity-level engine: oecd-asia-v0.3 (Phase 3)

Code: `src/calc/globe.ts` (pure). Parameters: `src/rules/globe-params.v0.3.json`; every block has an OECD `sourceUrl`, an article reference and `verified: true`. HK / SG / JP timing (QDMTT / IIR / UTPR effective dates, QDMTT Safe Harbour status) is read from `src/rules/jurisdictions/*.v1.json`. Golden tests: `src/calc/globe.test.ts` (27 tests).

**This is a simplified projection. It is not tax advice, not a GIR, and not a claim of full OECD / IRD / IRAS / NTA compliance.**

## Sourced parameters

| Parameter | Value | Source |
|---|---|---|
| Minimum Rate | 15% | Model Rules Art. 10.1 |
| Revenue threshold | EUR 750m | Model Rules Art. 1.1.1 (the two-of-four-years test is simplified to one input) |
| SBIE payroll / tangible rates | 2023 10.0/8.0 · 2024 9.8/7.8 · 2025 9.6/7.6 · 2026 9.4/7.4 · 2027 9.2/7.2 · 2028 9.0/7.0 · 2029 8.2/6.6 · 2030 7.4/6.2 · 2031 6.6/5.8 · 2032 5.8/5.4 · 2033+ 5/5 (%) | Model Rules Art. 5.3.3, 5.3.4, 9.2 (by the calendar year in which the FY begins) |
| TCSH de minimis | Revenue < EUR 10m **and** PBT < EUR 1m | Safe Harbours and Penalty Relief (Dec 2022), box 1.1 para 1(a) |
| TCSH Transition Rate | 2023–24: 15% · 2025: 16% · 2026: 17% · 2027: 17% | Dec 2022 box 1.1; 2027 added by the Side-by-Side Package (Jan 2026) ch. 3 |
| TCSH Transition Period | FYs beginning ≤ 31 Dec 2027 and ending ≤ 30 Jun 2029 | Side-by-Side Package ch. 3 (originally ≤ 31 Dec 2026 / 30 Jun 2028) |
| Routine profits test | PBT ≤ SBIE; a loss or zero profit always passes | Dec 2022 box 1.1 para 1(c), para 30 |
| Deferred tax | Recast at 15% where booked above 15% | Model Rules Art. 4.4.1 |
| Investment Entities | Excluded from ETR, Net GloBE Income and SBIE | Model Rules Art. 5.1.3, 5.3.2 |

## Calculation steps (per jurisdiction)

| # | Step | Formula |
|---|---|---|
| 1 | Net GloBE income | max(0, Σ GloBE income of CEs, excluding Investment Entities) (Art. 5.1.2) |
| 2 | Deferred tax adjustment | Σ DT × min(1, 15% ÷ booked rate) (Art. 4.4.1, simplified) |
| 3 | Adjusted covered taxes | Σ current covered taxes + step 2 |
| 4 | ETR | step 3 ÷ step 1 (undefined if step 1 = 0) (Art. 5.1.1) |
| 5 | SBIE | Σ payroll × payroll rate(FY) + Σ tangible assets × tangible rate(FY) (Art. 5.3 / 9.2) |
| 6 | Excess profit | max(0, step 1 − step 5) (Art. 5.2.2) |
| 7 | Top-up % | max(0, 15% − ETR) (Art. 5.2.1) |
| 8 | Jurisdictional top-up | step 7 × step 6 (Art. 5.2.3, without Additional Current Top-up Tax); 0 if the group is out of scope |
| 9 | Transitional CbCR SH | Only in the Transition Period and when CbCR data is entered. If any of the three tests passes, the top-up is deemed 0 |
| 10 | Domestic top-up tax | If the pack's QDMTT is in force for an FY beginning on/after its effective date, it collects the whole top-up (HKMTT / DTT / JP QDMTT). Where Central Record QDMTT SH status applies, IIR/UTPR is deemed 0; otherwise the QDMTT is credited (Art. 5.2.3), with the same result in this model |
| 11 | IIR | The UPE applies the IIR if its jurisdiction's pack has an IIR in force for the FY. Otherwise the first IPE whose jurisdiction has one does (Art. 2.1.3). It applies only to CEs **outside** the parent's jurisdiction (Art. 2.1.6). Top-up is allocated to CEs pro rata to positive GloBE income (Art. 5.2.4) × inclusion ratio = UPE ownership % (Art. 2.2, simplified) |
| 12 | Minority share | CE top-up × (1 − inclusion ratio). Shown as "not collected" because Art. 2.5.2 sets the UTPR to 0 when a parent applies a Qualified IIR (simplification: assumes all UPE interests are held through that parent) |
| 13 | UTPR residual | Top-up left after steps 10–11 when no IIR applies. **Flagged only; allocation (Art. 2.6) is out of scope.** The results page lists group jurisdictions with a UTPR in force for the FY (JP from FYs beginning on/after 1 Apr 2026) |

## Worked example 1: sample group (FY 1 Jan – 31 Dec 2026)

FY2026 rates: payroll 9.4%, tangible 7.4%, TCSH Transition Rate 17%, in the Transition Period. The UPE is Harbour Holdings Ltd (HK). The HK IIR is in force (FYs beginning on/after 1 Jan 2025).

| Entity | Jur. | Own. % | GloBE income | Covered taxes | DT (booked rate) | Payroll | Tangible |
|---|---|---|---|---|---|---|---|
| Harbour Holdings Ltd (UPE) | HK | 100 | 50,000,000 | 4,000,000 | 0 | 10,000,000 | 20,000,000 |
| Harbour Trading (HK) Ltd | HK | 100 | 30,000,000 | 1,500,000 | 0 | 5,000,000 | 5,000,000 |
| Harbour Asia Pte Ltd | SG | 100 | 40,000,000 | 2,000,000 | 400,000 (20%) | 8,000,000 | 12,000,000 |
| Harbour Japan KK | JP | 80 | 20,000,000 | 1,500,000 | 600,000 (30%) | 6,000,000 | 10,000,000 |
| Harbour Distribution | OTHER | 100 | 500,000 | 25,000 | 0 | 200,000 | 100,000 |

| Step | HK | SG | JP | OTHER |
|---|---|---|---|---|
| Net GloBE income | 80,000,000 | 40,000,000 | 20,000,000 | 500,000 |
| DT adjustment | 0 | 400,000 × 15/20 = 300,000 | 600,000 × 15/30 = 300,000 | 0 |
| Adjusted covered taxes | 5,500,000 | 2,300,000 | 1,800,000 | 25,000 |
| ETR | 6.875% | 5.75% | 9.00% | 5.00% |
| SBIE payroll | 15,000,000 × 9.4% = 1,410,000 | 752,000 | 564,000 | 18,800 |
| SBIE tangible | 25,000,000 × 7.4% = 1,850,000 | 888,000 | 740,000 | 7,400 |
| SBIE | 3,260,000 | 1,640,000 | 1,304,000 | 26,200 |
| Excess profit | 76,740,000 | 38,360,000 | 18,696,000 | 473,800 |
| Top-up % | 8.125% | 9.25% | 6.00% | 10.00% |
| Top-up before SH | 6,235,125 | 3,548,300 | 1,121,760 | 47,380 |
| TCSH (CbCR rev / PBT / SCT) | 400m / 85m / 5.5m → SETR 6.47% < 17%: fail; routine 85m > 3.26m: fail | 200m / 42m / 2.5m → 5.95%: fail | 120m / 21m / 2.1m → 10%: fail | 6m / 0.5m → **de minimis pass** |
| Top-up after SH | 6,235,125 | 3,548,300 | 1,121,760 | 0 |
| Domestic top-up | **HKMTT 6,235,125** | **DTT 3,548,300** | 0 (JP QDMTT only from FYs beginning ≥ 1 Apr 2026) | n/a |
| IIR at HK UPE | 0 | 0 | 1,121,760 × 80% = **897,408** | 0 |
| Minority not collected | 0 | 0 | 224,352 | 0 |
| UTPR residual | 0 | 0 | 0 | 0 |

Group totals: top-up 10,905,185 = domestic 9,783,425 + IIR 897,408 + minority 224,352.

## Worked example 2: same group, FY beginning 1 Apr 2026

The rates are unchanged (the FY still begins in 2026). JP QDMTT is now in force and Central Record QDMTT SH status applies from 1 Apr 2026, so the JP top-up of 1,121,760 goes to **JP QDMTT** and the IIR is 0. The results page notes that the UTPR is in force in JP.

## Worked example 3: FY beginning 1 Jan 2028 (TCSH expired)

The FY begins after 31 Dec 2027, so the TCSH is not available. 2028 rates: payroll 9.0%, tangible 7.0%. OTHER: SBIE = 200,000 × 9% + 100,000 × 7% = 25,000. Excess profit = 475,000. Top-up = 10% × 475,000 = **47,500**, collected by the IIR at the HK UPE (100% owned).

## Worked example 4: UPE outside HK/SG/JP

OTHER UPE (GloBE income 10m, taxes 2.5m) and JP CE (10m, taxes 1m, no payroll/assets), FY2026. JP ETR 10% → top-up 5% × 10m = 500,000. JP QDMTT is not in force for an FY beginning 1 Jan 2026, and no parent has a known IIR, so the 500,000 is a **flagged UTPR residual**.
Add an SG intermediate parent (SG IIR in force from 2025) and set JP ownership to 60%. The IIR at the SG IPE is 500,000 × 60% = **300,000**, and 200,000 is shown as minority share not collected.

## Worked example 5: allocation to CEs (Art. 5.2.4)

HK UPE (100m income, 20m tax) owns two OTHER CEs: A (3m income, 100%) and B (1m, 50%), with no tax or substance. OTHER top-up = 15% × 4m = 600,000. It is allocated A 450,000 and B 150,000. IIR = 450,000 × 100% + 150,000 × 50% = **525,000**.

## Worked example 6: safe harbour boundaries (FY2026)

- De minimis: revenue 9,999,999 / PBT 999,999 → pass. Revenue 10,000,000 → fail (the test is strictly "less than").
- Simplified ETR: taxes 1,700,000 / PBT 10,000,000 = 17.0% → pass. 1,690,000 (16.9%) → fail. In FY2025 (16%), 1,600,000 → pass.
- Routine profits: PBT 2,000,000 vs SBIE 2,000,000 → pass. PBT 2,000,001 → fail. PBT −3,000,000 → pass (para 30), and the simplified ETR is n/a.

## Other golden cases

- Deferred tax: 100 booked at 25% → 60; at 15% → 100; at 10% → 100; −50 at 30% → −25.
- Investment entity: an HK fund with 90m income is excluded. HK = UPE only (10m income, 1m tax) → top-up 500,000, and the fund's payroll is excluded from SBIE.
- Loss: SG −5m → Net GloBE income 0, ETR undefined, no top-up.
- Out of scope: revenue 700m → all top-up 0, with a warning.
- Pre-2025: JP UPE, SG CE (FY beginning 1 Apr 2024). The SG DTT is not in force, so the IIR at the JP UPE (in force from 1 Apr 2024) collects 1,000,000.

## Simplifications (v0.3)

- **Inputs:** GloBE income and covered taxes are entered directly. Chapter 3 / 4 adjustments are not computed.
- **Deferred tax:** a single amount per entity, recast with min(1, 15% ÷ rate). Art. 4.4.2–4.4.7 (exclusions, recapture, DTA elections) and the GloBE Loss Election are not modelled.
- **Not modelled:** Additional Current Top-up Tax, Art. 5.6 minority-owned blending (flag only), IIR offset (Art. 2.3), POPE / split ownership, UTPR allocation (Art. 2.6), Art. 9.3 initial-phase exclusion, Side-by-Side / UPE / Simplified ETR safe harbours, JP tax-credit special measure, the national/local split of JP QDMTT.
- **Assumptions:** a 12-month FY is assumed. The inclusion ratio is taken as the UPE ownership % of each entity.
- **Local adoption:** superseded in v0.4. The TCSH period now follows the collecting jurisdiction's law (see below).


# v0.4: local adoption of the transitional CbCR safe harbour (Phase 4)

Parameters: `src/rules/globe-params.v0.4.json` (OECD values unchanged from v0.3) and the `transitionalCbcrSafeHarbour` block in each pack (`hk/sg/jp.v1.json`, packVersion 1.1.0). Tests: `src/calc/tcshLocal.test.ts`.

## Whose transition period applies

The OECD tests (de minimis, simplified ETR at the 15/16/17/17/17% transition rates, routine profits) are unchanged. What changes is the **transition period**, which now comes from the law of the jurisdiction that would collect the top-up:

1. If a domestic top-up tax (HKMTT / DTT / JP QDMTT) is in force for that FY, that jurisdiction's law applies.
2. Otherwise, the law of the IIR parent's jurisdiction (HK, SG or JP) applies.
3. Otherwise, OECD terms apply (FYs beginning on or before 31 Dec 2027 and ending on or before 30 Jun 2029, per the Jan 2026 Side-by-Side Package).

The `tcshBasis` group input decides which local periods count:

| Basis | Counts | HK | SG | JP |
|---|---|---|---|---|
| `enacted` (default) | Enacted law only | FY begins ≤ 31 Dec 2026, ends ≤ 30 Jun 2028 (Ord. 21/2025 Sch. 61 Pt 3 Div. 2 s.2) | FY begins ≤ 31 Dec 2026, ends ≤ 30 Jun 2028 (MMT Regulations reg. 70, IRAS Module 6) | FY begins ≤ 31 Dec 2027 (Act No. 12 of 2026, extension enacted) |
| `announced` | Enacted law plus officially announced extensions | as enacted (no extension announced) | FY begins ≤ 31 Dec 2027, ends ≤ 30 Jun 2029 (IRAS: amendments by end-2026, subject to Parliament) | as enacted |
| `oecd` | OECD terms everywhere | OECD | OECD | OECD |

- **HKMTT assumption (unverified):** HK law expressly provides the TCSH for the GloBE rules (IIR). Sch. 62 (HKMTT) applies "the GloBE rules (Chapter 2 excepted)" but does not expressly mention the TCSH. The engine assumes it also applies to the HKMTT and adds an "Assumed" note to the trail.
- **JP end limb:** the MOF explanation of the 2026 reform does not quote the "ending on or before 30 Jun 2029" limb. The value is taken from the OECD and noted as such.

## Worked example 7: SG DTT, FY beginning 1 Jan 2027

HK UPE (10,000,000 income, 2,000,000 tax, 20% ETR, so no HK top-up) holds 100% of an SG CE.

| Step | Value |
|---|---|
| SG GloBE income / covered taxes | 10,000,000 / 1,000,000 → ETR 10% |
| SBIE | 0 (no payroll or tangible assets) |
| Top-up before safe harbour | (15% − 10%) × 10,000,000 = **500,000** |
| CbCR simplified ETR | 1,800,000 / 10,000,000 = 18% ≥ 17% (2027 rate) |
| `enacted`: SG period ends with FYs beginning 2026 | TCSH unavailable ("announced, but not yet enacted") → DTT **500,000** |
| `announced` / `oecd` | TCSH passes → top-up **0** |
| FY beginning 1 Jan 2026 | passes under every basis → **0** |

## Worked example 8: JP QDMTT, FY beginning 1 Apr 2027

Same structure with a JP CE (10,000,000 income, 1,000,000 tax; CbCR 18%).

| Case | Result |
|---|---|
| FY 1 Apr 2027 – 31 Mar 2028, `enacted` | JP QDMTT in force. Japan law: begins ≤ 31 Dec 2027 and ends ≤ 30 Jun 2029 → TCSH passes → **0** |
| FY beginning 1 Jan 2028 | outside every transition period → JP QDMTT **500,000** |

## Worked example 9: non-pack jurisdiction under the HK IIR, FY beginning 1 Jan 2027

OTHER CE: 500,000 income, 25,000 tax (5%), SBIE 0 → top-up (15% − 5%) × 500,000 = **50,000**. CbCR revenue 6,000,000 < 10m and profit 500,000 < 1m, so the de minimis test passes.

| Basis | Result |
|---|---|
| `enacted` | No QDMTT, so the IIR parent's (HK) law applies. HK has not adopted the extension → no TCSH → IIR **50,000** |
| `oecd` | de minimis passes → **0** |

## Filing calendar roll-forward (`businessDays.ts`, `holidays.v1.json`)

Each deadline is first computed as the statutory date (unchanged from v0.2), then rolled forward under the jurisdiction's general computation-of-time rule:

| Jurisdiction | Rule | Non-working days | Source |
|---|---|---|---|
| HK | Interpretation and General Clauses Ordinance (Cap. 1) s.71(1)(b)/(c) | General holidays under Cap. 149, which include every Sunday. Saturdays are **not** excluded unless they are a general holiday. | [Cap. 1 s.71](https://www.elegislation.gov.hk/hk/cap1!en?xpid=ID_1438402527839_002) |
| SG | Interpretation Act 1965 s.50 | Sundays and public holidays. Saturday is not excluded. Holidays Act s.4(2): a holiday falling on a Sunday makes the next day a public holiday. | Interpretation Act s.50, Holidays Act s.4(2) |
| JP | National Tax General Act (国税通則法) Art. 10(2) + Order Art. 2(2) | Saturdays, Sundays, national holidays, 1–3 Jan (general holidays, NTA circular 10-4) and 29–31 Dec | 国税通則法 Art. 10 |

Holiday lists for 2026–2027 come only from official sources: GovHK general holidays 2026 / 2027 and the 1823 data set (HK, 34 dates); Ministry of Manpower public holidays, updated 19 Jun 2026 (SG, 26 dates, including the s.4(2) Mondays); Cabinet Office national holidays CSV (JP, 35 dates). Dates outside 2026–2027 get the weekly-rest-day and fixed-date rules only and are flagged "holidays not checked". Most FY2026 deadlines fall in 2028, so they carry that flag.

Golden cases (`calendarRoll.test.ts`):

| Statutory | Adjusted | Why |
|---|---|---|
| HK Sun 28 Jun 2026 | Mon 29 Jun 2026 | Sunday |
| HK Fri 26 Mar 2027 | Tue 30 Mar 2027 | Good Friday, the day after Good Friday, Sunday, Easter Monday |
| HK Sat 26 Dec 2026 | Mon 28 Dec 2026 | first weekday after Christmas is a general holiday, then Sunday |
| SG Sat 1 May 2027 | Mon 3 May 2027 | Labour Day on Saturday, then Sunday (Saturday itself is not excluded) |
| SG Sun 9 Aug 2026 | Tue 11 Aug 2026 | National Day on Sunday, then the s.4(2) Monday holiday |
| JP Thu 31 Dec 2026 | Mon 4 Jan 2027 | 31 Dec, 1–3 Jan, then the weekend |
| JP GIR, FYE 30 Sep 2025 | 31 Dec 2026 → 4 Jan 2027 | calendar integration |

Not modelled: HK gale-warning and black-rainstorm extensions (s.71(1)(c)), which cannot be known in advance; group-specific exemptions. Payment deadlines are computed from the **statutory** filing date and then rolled forward themselves.

The `.ics` export (`src/export/ics.ts`) writes one all-day event per applicable obligation on the adjusted date. Each event has a stable UID, a 14-day reminder, and the basis, source URL, statutory date and disclaimer in its description. Lines are folded at 75 octets (RFC 5545).
