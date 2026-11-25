# Ventures lens: serial founders' other companies

For a few serial founders, "Value created" adds up the market value of every company they founded, not just the one the list names. Everything else on the profile (cash, workers, paid out, footprint) stays about the primary company.

One file per qualifying leader: `research/lenses/ventures/<id>.json`. All the rules in `research/BRIEF.md` and `research/REFRESH-BRIEF.md` apply: primary documents fetched this session, `hostType`, verbatim quotes containing the number, no aggregators, and `null` rather than a guess.

## Who qualifies
A leader qualifies when they founded or co-founded another company that meets all three tests:
1. It is listed today, so it has a market value.
2. It is not already on the list under another leader (PayPal stays with Dan Schulman).
3. It is not majority-owned by a company that is already counted, which would count the same value twice.

Founded companies that are private (no market value) are listed in `notCounted`, with no number.

## Shape
```jsonc
{
  "id": "elon-musk",
  "ventures": [                       // listed companies beyond the primary one (the primary stays in research/lenses/marketcap)
    {
      "company": "SpaceX",
      "ticker": "SPCX",
      "founded": { "year": 2002, "role": "founder", "source": { /* the company's own filing or site, verbatim, naming the leader as founder */ } },
      "includes": "xAI (acquired February 2026), which owns X",   // optional: notable businesses inside it, in the filing's words
      "classes": [ /* exactly as in research/lenses/marketcap: label, shares, sharesAsOf, pricedAs, perListedUnit, pricedAsReason, source */ ],
      "leaderStake": {                // the leader's own (or family's, say which in label) economic share of this company
        "label": "Elon Musk",         // or "Murdoch family trust" etc.
        "pctEconomic": 0,             // % of all shares outstanding; null if not disclosed
        "pctVoting": null,
        "asOf": "2026-…",
        "source": { /* proxy / S-1 / 10-K beneficial ownership table, verbatim */ }
      },
      "notes": ""
    }
  ],
  "notCounted": [                     // companies they founded that have no market value (private) or are already counted elsewhere
    { "company": "Neuralink", "reason": "Private company with no market price", "founded": { "year": 2016, "role": "co-founder", "source": { … } } }
  ],
  "notes": "",
  "researchedAt": "2026-11-24"
}
```

## Rules
- **Prices:** share counts come from the latest filing cover page or interim report, exactly as in the marketcap lens. Prices are the Nov 20, 2026 close, and `scripts/refresh-prices.mjs` fetches them for every `pricedAs` symbol, so only symbols are needed.
- **Founding:** the source must name the leader as founder or co-founder. Use the company's own filing or website.
- **Leader stake:**
  - use the latest beneficial-ownership table;
  - for a trust or family holding, say so in the label;
  - if a family holding includes the leader, don't add the two together.
- **Private companies:** no valuation of any kind goes in the file. That excludes funding-round figures reported by the press, secondary-market estimates and aggregator pages. Name the company and its founding source only.
