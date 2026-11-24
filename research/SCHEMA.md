# Company value-sharing records

Each company in The Business 100 gets one JSON file in `research/records/<leader-id>.json` (the leader `id` from `dist/data.js`). The site renders the "Who shares in the value?" module from these records.

## The non-negotiable rule

Every figure comes from a primary source that you fetched in this session: a company filing (10-K, 20-F, 40-F, annual report, DEF 14A proxy, Schedule 13D/G, Form 4, exchange shareholding disclosure) or the SEC XBRL API. Each figure carries the exact URL, the as-of date and a verbatim quote of the line it came from. **If you cannot find a figure in a source you actually fetched, set it to `null` and explain why in `notes`. Never fill a value from memory, a news article, a data aggregator or an estimate.**

## Shape

```jsonc
{
  "id": "mark-zuckerberg",              // leader id from data.js
  "company": "Meta Platforms",
  "fiscalYear": "FY2024",               // the latest full fiscal year you used
  "fiscalYearEnd": "2024-12-31",
  "currency": "USD",                    // reporting currency of the cash/workers/geography figures (ISO code)
  "unit": "billions",                   // always billions of `currency`

  "ownership": {
    "basis": "economic",                // percentages are % of total shares outstanding (all classes), not votes
    "asOf": "2025-03-31",               // the record date the percentages refer to
    "leader": {
      "name": "Mark Zuckerberg",
      "relation": "founder",            // founder | co-founder | founding-family | estate | ceo | former-ceo | chair | investor
      "status": "holds",                // holds | deceased | no-reported-stake | not-disclosed
      "pctEconomic": <number>,              // % of all shares outstanding beneficially owned; null if not disclosed
      "pctVoting": <number>,                // % of total voting power if the company reports it (dual class); else null
      "family": null,                   // optional { "label": "Walton family", "pctEconomic": <number>, "source": {...} } when a founding family or estate is the relevant holder
      "source": { "url": "...", "label": "2025 proxy statement, security ownership table", "quote": "verbatim line(s)" }
    },
    "largestHolders": [                 // up to 3 largest disclosed non-leader holders (e.g. the 5%+ owners table in a proxy, or the major-shareholders section of an annual report)
      { "name": "The Vanguard Group", "type": "asset-manager", "pctEconomic": <number>,
        "source": { "url": "...", "label": "...", "quote": "..." } }
      // type: asset-manager | index-fund | pension | sovereign | government | family | company | employees | other
    ],
    "structure": {
      "dualClass": true,
      "controlled": false,              // true if one person/family/entity holds >50% of votes
      "note": "Class B shares carry ten votes each."   // plain-language, sourced from the filing
    }
  },

  "cash": {                             // latest fiscal year, from the cash-flow statement
    "dividends": { "value": <number>, "source": { ... } },     // cash dividends paid to shareholders; 0 if none paid
    "buybacks":  { "value": <number>, "source": { ... } },    // cash paid to repurchase stock; 0 if none
  },

  "workers": {
    "stockComp": { "value": <number>, "source": { ... } },    // share-based compensation expense
    "plan": null                         // optional sourced sentence about an employee stock purchase plan or broad-based grants, with "quote"
  },

  "geography": {                        // revenue by geography exactly as the company reports it (segment note); null if not reported
    "basis": "Revenue by user geography",  // copy the company's own basis phrase
    "segments": [ { "name": "United States and Canada", "value": <number> }, { "name": "Europe", "value": <number> } ],
    "total": <number>,
    "source": { "url": "...", "label": "...", "quote": "..." }
  },

  "notes": "Anything the reader or a checker needs: missing figures and why, currency, fiscal-year quirks.",
  "researchedAt": "2026-11-23"
}
```

`source` objects always have `url` (https, a direct link to the document, not a search page), `label` (short human label, e.g. "FY2024 Form 10-K, cash flow statement") and `quote` (verbatim text from the document containing the number, max ~300 characters). For figures taken from the SEC XBRL API, also add `"xbrl": {"cik": "0001326801", "concept": "us-gaap:PaymentsForRepurchaseOfCommonStock", "end": "2024-12-31", "value": 29750000000}`; the `url` should still be the human-readable filing.

## Rules of judgment

- **Percentages are economic** (share of all shares outstanding). Report voting power separately in `pctVoting` only if the filing states it.
- **Deceased founders**: `status: "deceased"`, `pctEconomic: null`. If the filing shows a founding family, foundation or estate holding, put it in `family` with its source. Don't add one if none is disclosed.
- **Hired or former executives**: report their disclosed beneficial ownership even if tiny (it will be <1%). Proxies show "*" for less than 1%: then set `pctEconomic: null`, `status: "holds"` and put "less than 1% (marked * in the proxy)" in notes; also record `shares` if given.
- Former executives no longer listed in the latest proxy: `status: "no-reported-stake"`.
- **Never compute "everyone else"**: the site computes it. Don't sum holders; only record what the documents say.
- **Fiscal year: match the site's snapshot.** Use the fiscal year that ends in the month shown in the leader's `fy` field in `dist/data.js` (e.g. `Dec 2024` → FY2024, `Mar 2025` → the year ended March 2025). Do NOT use later years even though they exist. Ownership percentages come from the proxy / annual report published right after that fiscal year (usually 2025). The example values in this file are placeholders, not data.
- Values in `cash`, `workers`, `geography` are in **billions of the reporting currency**, rounded to 2 decimals as stated (convert from millions/thousands exactly, no FX conversion).
- Revenue geography: copy the company's own segment names. If the company reports only "United States" and "International", that's fine.
