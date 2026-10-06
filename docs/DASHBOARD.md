# Executive dashboard (`#/dashboard`)

A one-page board view. It reads only the existing engine output (`projectGlobe`), the rule packs, the filing calendar and the intel feed. Aggregation and classification live in `src/calc/dashboard.ts` (pure, tested in `dashboard.test.ts`). There is **no new tax logic**.

## What it shows

| Block | Source | Notes |
|---|---|---|
| Headline KPIs | `ProjectionV3.totals`, `summarize()` | Total top-up; blended GloBE ETR vs 15% (Σ adjusted covered taxes ÷ Σ net GloBE income of profit-making jurisdictions, indicative); jurisdiction count and RAG counts; safe harbour passes out of exposed jurisdictions; domestic / IIR / UTPR residual. With a comparison scenario chosen, each KPI shows the change (`summaryDelta`, current − comparison). |
| Jurisdictions + RAG | `ragFor()` | Per jurisdiction: RAG status with its reason, GloBE ETR, top-up, safe harbour outcome, collecting tax. |
| ETR chart | engine ETRs | Bars against a dashed 15% line; bar colour = RAG. |
| Top-up by collecting tax | `collectorSplit()` | Domestic top-up taxes / IIR / UTPR residual / minority share not collected. |
| Next filing deadlines | `computeFilingCalendar()` + `nextDeadlines()` | Next five applicable deadlines on or after today, by **adjusted** date (weekend/holiday roll-forward). |
| Data readiness | `dataReadiness()` | Input completeness only: CbCR rows per jurisdiction, payroll/tangible assets per entity, booked rate where deferred tax is entered. |
| Regulatory updates | `materialUpdates()` | Three items: material first (affects calc = yes, or locally flagged "needs rule change"), then newest. |
| Key risks & assumptions | `keyRisks()` | Assumptions that change a result (e.g. the HKMTT safe harbour), a non-enacted safe harbour basis, unverified pack facts that matter (descriptive ones are only counted), engine warnings, the main simplifications. |

## RAG rule

Thresholds are presentation settings (`ETR_BUFFER` = 1pp), not tax parameters. The UI legend reads from `RAG_RULES`.

- **Red:** top-up tax due (any collector).
- **Amber:** no top-up, but only via (a) a safe harbour that relies on an assumption (local law silent), (b) an announced-but-not-enacted extension (detected by re-running the engine on the enacted basis), or (c) OECD terms where local adoption is not modelled; or the GloBE ETR is below 16% (within 1pp of 15%, or below 15% with the excess absorbed by the substance carve-out).
- **Green:** no top-up, and either the safe harbour passes under enacted local law with no assumption, or the GloBE ETR is 16% or more.
- **Grey (n/a):** no net GloBE income, or the group is out of scope.

## Print

"Print / Save PDF" uses a named `@page dash { size: A4 landscape }`. The dashboard is laid out at a fixed 1500px width and zoomed to fit one page. The sample, comparison and stress (extra risk items) views were each checked to print on exactly one A4 landscape page.

## Research takeaways (inspiration only; no vendor text, branding or images used)

| Element | Seen in | Public source |
|---|---|---|
| Additional tax, tax payable and safe harbour coverage by jurisdiction/entity; Pillar Two implementation status; calendar obligations tracker with alerts; data completeness monitoring | EY GloBE Engine | https://www.ey.com/en_gl/services/tax/globe-engine-global-minimum-tax-management-tool, https://www.ey.com/content/dam/ey-unified-site/ey-com/en-ch/services/tax/documents/ey-gl-globe-engine-slipsheet.pdf |
| Dashboards that pinpoint low-tax jurisdictions and show transitional safe harbour coverage; data-collection progress reports; year-over-year views | EY (ITqS technology update) | https://pub1.ey.com/content/dam/eysitesprogram/ey-csg/c1/documents/presentations/2025_ITqS_Technology_compliance_update.pdf |
| Results visualised by entity and jurisdiction, scenario simulation, traceable results, local QDMTT vs GIR differences | PwC Pillar Two Engine | https://www.pwc.com/gx/en/services/tax/pillar-two-readiness.html, https://store.pwc.fr/en/solutions/pillar-two-engine |
| Country tracker for adoption and compliance deadlines | PwC Pillar Two Country Tracker | https://www.pwc.com/gx/en/services/tax/pillar-two-readiness.html |
| Jurisdiction-by-jurisdiction filing obligations view; CbCR safe harbour applied early to skip low-risk jurisdictions; due-date tracker; Power BI dashboard comparing scenarios and year-over-year results | Orbitax GMT | https://orbitax.com/solutions/global-minimum-tax, https://orbitax.com/newsroom/solutions/global-minimum-tax-gmt/know-exactly-which-pillar-two-forms-your-organization-needs-to-file-with-orbitax, https://39783178.fs1.hubspotusercontent-na1.net/hubfs/39783178/Orbitax-GMT-Brochure%20(1).pdf |
| Workflow heat map of overdue / at-risk tasks | Thomson Reuters / Orbitax E.A.T. | https://tax.thomsonreuters.com/en/checkpoint/orbitax-international-tax-platform/executable-actions-tool |
| Results summaries, scenario comparisons and year-over-year changes in configurable visuals | Thomson Reuters (Orbitax GMT features) | https://www.thomsonreuters.co.nz/en/products-services/tax-accounting/global-minimum-tax/features.html |
| Interactive dashboard by region/country/status; real status tracking of deliverables | KPMG KBAT / Digital Gateway | https://kpmg.com/xx/en/our-insights/ai-and-technology/pillar-two-compliance-navigating-the-complexity.html |
| Dashboards for insights; data diagnostic identifying data gaps; impact visualisations | Deloitte Pillar Two Agent / Data Diagnostic | https://www.deloitte.com/uk/en/services/tax/services/pillar-two-global-compliance.html |

How these map here: headline top-up and collector split (EY "tax arising / payable"), jurisdiction RAG table (EY low-tax pinpointing plus the Orbitax/TR heat-map idea, applied to tax status instead of tasks), safe harbour coverage KPI (EY, Orbitax), next deadlines (EY calendar tracker, Orbitax due-date tracker, PwC country tracker), data readiness (EY data completeness, Deloitte data gaps), scenario comparison deltas (PwC simulation, Orbitax/TR scenario and YoY comparisons), regulatory updates and implementation status (EY implementation status, PwC tracker).
