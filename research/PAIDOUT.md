# Paid out & sales enabled

One figure per company: the money it paid other people and businesses in its snapshot fiscal year, plus, for marketplaces only, the sales its platform created for third parties. Chosen after a pilot (`research/lenses/paidout/_pilot.json`), where it matched Biocon's own published "economic value distributed" within 0.5%.

## Formula (non-financial companies)

**Paid out = Revenue − Operating cash flow + Capital expenditures (+ interest paid, + income taxes paid, each only if the filer classifies it OUTSIDE operating cash flow).**

Why this works: operating cash flow is what's left of customers' payments after the company has paid employees, suppliers, partners, lenders (interest) and governments (taxes). So revenue minus operating cash flow is what it paid all of them. Capital spending pays builders and equipment makers.

- **Capex:** purchases of property, plant and equipment, plus intangible assets, gross of government incentives. Exclude acquisitions of businesses and vehicles or equipment leased out to customers (lease fleets). If a filer reports them only combined, use the combined line and say so.
- **Revenue:** total revenue as reported. Flag (`revenueIncludesExcise`) if it includes excise duties.
- **Flags** for known biases, recorded but not adjusted:
  - `financeReceivablesInOCF`: captive-finance loan growth inside operating cash flow (e.g. Toyota);
  - `interestDividendsReceivedInOCF` with the amount if disclosed;
  - `nonCashRevenue` if material.

## Financial companies

`sector: "bank" | "insurer" | "broker" | "asset-manager" | "payments" | "conglomerate-insurance"`.
- **Banks and brokers:** paidOut = null (`comparable: false`). Instead record `altPaidOut` = noninterest expense − D&A − stock comp + income taxes paid, plus `interestPaid` separately (that's money paid to depositors).
- **Pure insurers:** null, with a note.
- **Asset managers, payment networks and exchanges:** these have normal operating cash flow. Use the formula and flag the sector.
- **Berkshire:** formula with a caveat (`nonCashRevenue`).

## Sales enabled (marketplaces only)

`salesEnabled = ecosystem.measure.value − ecosystem.platformRevenue.value`, from `research/lenses/ecosystem/<id>.json`. Only where the measure's definition is third parties' sales or bookings ordered on the platform. Not payment volume, not client assets, not studies. Admitted: Shopify (GMV), Uber (Gross Bookings), Airbnb (GBV), eBay (GMV), MercadoLibre (GMV; check whether it includes first-party sales and subtract them if stated), Grab (GMV). Record the arithmetic and both inputs; don't re-source them.

## File: `research/lenses/paidout/<id>.json`
```jsonc
{
  "id": "...", "company": "...", "fiscalYear": "...", "fiscalYearEnd": "...", "currency": "USD", "unit": "billions",
  "sector": "industrial|tech|retail|...|bank|insurer|broker|asset-manager|payments|conglomerate-insurance",
  "comparable": true,
  "inputs": {
    "revenue":       { "value": <n>, "source": {...} },
    "operatingCashFlow": { "value": <n>, "source": {...} },
    "capex":         { "value": <n>, "components": ["PP&E 23.94", "intangibles 0.0"], "source": {...} },
    "interestPaid":  { "value": <n>, "inOCF": true, "source": {...} },
    "taxesPaid":     { "value": <n>, "inOCF": true, "source": {...} }
  },
  "paidOut": <n or null>,             // computed by formula
  "altPaidOut": null,                 // banks/brokers only, with its own inputs above (noninterestExpense, da, stockComp)
  "salesEnabled": null,               // marketplaces only: { "value": <n>, "measure": "Gross Merchandise Volume", "measureValue": <n>, "platformRevenue": <n> }
  "flags": { "financeReceivablesInOCF": false, "interestDividendsReceivedInOCF": null, "revenueIncludesExcise": false, "nonCashRevenue": null },
  "notes": "",
  "researchedAt": "2026-11-23"
}
```
Every input gets a `source` with a verbatim quote, plus an `xbrl` object where one exists. Use the snapshot fiscal year from `research/records/<id>.json`. Values are in billions of the reporting currency.

## FX (for a USD ranking)
`research/lenses/paidout/_fx.json` holds annual-average exchange rates for each non-USD reporting currency, for each fiscal year used. The source is the Federal Reserve's G.5A annual release (hostType `regulator`) or, if a currency isn't covered, the IRS yearly average rates (also `regulator`). Use the calendar-year average that covers most of the fiscal year, and state which in notes.
