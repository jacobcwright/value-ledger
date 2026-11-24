# Additional value lenses

Market value only measures what owners keep. These lenses show the other ways value reaches people. Each lens is reported separately: lenses are **never added together** or added to market value. One file per leader goes at `research/lenses/<leader-id>.json`. Amazon (`jeff-bezos`) is included.

Everything in `research/BRIEF.md` and `research/SCHEMA.md` still applies: primary sources fetched this session, `hostType`, verbatim `quote`, the snapshot fiscal year from data.js `fy`, `null` rather than guess, no mirrors, and SEC requests through `$SEC_USER_AGENT`.

```jsonc
{
  "id": "tobias-lutke",
  "company": "Shopify",
  "fiscalYear": "FY2024",
  "fiscalYearEnd": "2024-12-31",
  "currency": "USD",
  "unit": "billions",

  "ecosystem": {                       // platforms only; null for everyone else
    "tier": "filing",                  // "filing" (10-K/20-F/annual report) | "company-commissioned" (a study the company paid for)
    "measure": {                       // the company's own name for the volume flowing through its platform
      "name": "Gross Merchandise Volume",
      "definition": { "quote": "<the company's own definition, verbatim>", "source": {...} },
      "value": <number>, "source": {...}
    },
    "platformRevenue": { "label": "Total revenues", "value": <number>, "source": {...} },  // the revenue figure the platform keeps, from the same filing
    "payouts": null,                   // ONLY if the filing reports money paid to partners, e.g. { "label": "Developer exchange fees paid to creators", "value": <number>, "source": {...} }
    "clientAssets": null,              // a stock, not a flow (e.g. AUM / client assets / assets under custody): { "label": "...", "value": <number>, "asOf": "...", "source": {...} }
    "studies": [                       // company-commissioned or independent ecosystem studies, max 2
      { "title": "...", "publisher": "Analysis Group", "commissionedBy": "Apple", "year": 2025,
        "claim": "verbatim headline claim", "value": <number or null>, "currency": "USD", "unit": "billions",
        "source": {...} }
    ],
    "notes": "how the measure is defined, what it includes/excludes, overlaps"
  },

  "taxes": { "cashTaxesPaid": { "value": <number>, "source": {...} } },          // cash income taxes paid (cash-flow supplemental / notes); null if not disclosed
  "rnd":   { "expense": { "value": <number>, "source": {...} } },                // research & development expense; null if the company reports none (banks etc.): say so in notes

  "notes": "",
  "researchedAt": "2026-11-23"
}
```

## Rules
- **Ecosystem wording.** Store the company's own definition of its volume measure. The site shows `platformRevenue / measure.value` as "the platform's share". It never calls the rest "partner earnings" unless `payouts` is reported. Gross bookings, GMV, TPV and GDV are not the same thing, so keep the company's term.
- **A stock is not a flow.** Client assets, assets under management and assets under custody go in `clientAssets` only.
- **Commissioned studies** are allowed only with `commissionedBy` filled in and a link to the study itself (not a press release, if the study is available). If you can't fetch the study, use the company's own press release about it, with `hostType: company`, and say so in the label.
- **No estimates.** If a platform doesn't disclose its flow volume (e.g. Amazon doesn't report GMV), leave `measure` null and use what it does report: third-party seller services revenue, the third-party unit share stated in earnings materials, or commissioned studies.
- **Taxes and R&D:** XBRL is ideal for SEC filers: `us-gaap:IncomeTaxesPaidNet` and `us-gaap:ResearchAndDevelopmentExpense`, or the company-specific equivalent, or `ifrs-full:IncomeTaxesPaidRefundClassifiedAsOperatingActivities` for IFRS. Include the `xbrl` object so the validator can re-check it.
