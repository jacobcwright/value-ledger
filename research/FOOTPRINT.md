# Footprint lens: where each company creates value

Amazon's profile shows where its value lands: sales by market, a U.S. map of jobs, investment and estimated GDP contribution by state, and selected sites. This lens extends the same idea to every company, using only what each company or its filings publish.

Write one file per leader at `research/lenses/footprint/<id>.json`. All the rules in `research/BRIEF.md` apply: primary documents fetched this session, `hostType`, a verbatim `quote` that contains the number, no mirrors, no estimates, and `null` rather than a guess. SEC requests go through `zsh -c 'curl -A "$SEC_USER_AGENT" …'`; sleep at least 1.5s between SEC requests, because 10 agents share the limit.

```jsonc
{
  "id": "sam-walton",
  "company": "Walmart",
  "metrics": {                         // define every measure once; rows reference these keys
    "stores":    { "label": "Retail units", "unit": "count", "period": "as of Jan 31, 2025", "tier": "filing",
                   "definition": "<what the company counts, from its own wording>" },
    "employees": { "label": "Associates", "unit": "people", "period": "as of …", "tier": "company-published", "definition": "…" },
    "taxes":     { "label": "Income taxes paid", "unit": "currency-millions", "currency": "EUR", "period": "FY2024", "tier": "company-published", "definition": "…" }
    // unit: count | people | currency-millions | currency-billions | percent
    // tier: filing (10-K/20-F/annual report) | company-published (the company's own site or report) | company-commissioned (a study it paid for)
  },
  "usStates": [                        // U.S. states and DC, postal codes; null if nothing is published by state
    { "state": "AR", "values": { "stores": 136, "employees": 56000 }, "plus": {},   // plus: { "employees": true } when the source says "56,000+"
      "source": { "hostType": "…", "url": "…", "label": "…", "quote": "<the row or sentence with these numbers>" } }
  ],
  "countries": [                       // ISO 3166-1 alpha-2 codes; use for non-U.S. breakdowns, and for U.S. companies' international data
    { "iso2": "MX", "name": "Mexico", "values": { "stores": 3000 }, "plus": {}, "source": { … } }
  ],
  "regions": [                         // only when the company reports a region, not countries
    { "name": "Europe", "countries": null, "values": { "employees": 12000 }, "plus": {}, "source": { … } }
    // countries: an ISO list ONLY if the filing itself defines the region's countries; otherwise null
  ],
  "sites": [                           // up to 12 notable sites the company itself describes (HQ, largest plants, campuses, data centers)
    { "name": "Home Office", "place": "Bentonville, AR", "state": "AR", "iso2": "US", "type": "headquarters",
      "description": "<the company's own words, short>", "source": { … } }
  ],
  "notes": "what exists, what doesn't, overlaps, and periods",
  "researchedAt": "2026-11-23"
}
```

## What to look for, in priority order
1. **A company-published U.S. or country impact report with a state or country breakdown.** Examples: an economic impact report with state pages, "<Company> in your state" fact sheets, host or driver earnings by state, jobs and investment by state, taxes by country. Use tier `company-published`; use `company-commissioned` if a consultancy wrote it for the company. Read the state pages themselves (each has its own quote). The fifty-state structure matters most; it is what makes the map.
2. **10-K Item 2 (Properties) and similar.** Stores, restaurants, plants, branches, offices or data centers by state or country. Many retailers and restaurant chains publish a full table by state or country (tier `filing`).
3. **Employees by country or region**, from the annual report or the sustainability/ESG report (tier `company-published`, or `filing` if it's in the 20-F/annual report).
4. **Taxes paid by country** (country-by-country tax reports or tax-contribution reports, common for European companies). Tier `company-published`.
5. **Sites:** the company's own HQ, its largest facilities and campuses, as it describes them.

Don't repeat company-wide revenue by geography; the records already have it.

## Rules
- Every row needs a `source` with its own quote. A table row as extracted ("Arkansas 136 …") is fine.
- Use the snapshot year where you can: FY2024 or the most recent edition before mid-2025. If a state report is undated or newer, say so in the metric's `period`.
- Never derive state values from national totals. Never treat a commissioned estimate as a filing.
- If nothing usable exists, write the file with `usStates`, `countries`, `regions` and `sites` set to null and explain in `notes` what you checked. That is a valid result.
- Validate before finishing: every row's numbers must appear in its quote; state codes must be valid; iso2 values must be 2 letters; and each metric key used in a row must exist in `metrics`.
