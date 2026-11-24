# Refresh spec: from the 2024–25 snapshot to the latest reported year

Status: proposal, Nov 24, 2026. Nothing has been changed yet.

## What "up to date" can mean today

A uniform FY2026 isn't possible yet. Calendar-year companies close FY2026 on Dec 31, 2026 and file in Feb–Apr 2027. As of today, every company has at least one newer annual report than the site uses:

| Latest annual report available | Companies | Examples |
|---|---|---|
| Year ended Dec 2025 (FY2025) | 70 | Amazon, Alphabet, Meta, Tesla, banks, most non-U.S. |
| Year ended in 2026 (FY2026) | 30 | Apple (Sep 2026), Microsoft (Jun 2026), NVIDIA and Walmart (Jan 2026), Oracle, Nike, Toyota, Sony, Infosys, Reliance |

All 85 SEC filers were checked against the EDGAR submissions API today. The 15 non-SEC companies are inferred from their year-end month and normal filing lag, and get confirmed in the pilot. Nine companies jump two years: they are on a 2024 year end now, and their 2026 report is already out.

**Recommendation:** each company shows its latest reported fiscal year, labelled as it is now ("FY2025", "FY2026, year ended Sep 2026"). Point-in-time figures share one recent as-of date. The site title becomes "2025–26 edition" (or "Nov 2026").

**Rejected:** trailing twelve months from quarterly reports. It works only for SEC filers (the others report half-yearly), quarterly filings don't have head counts, ownership or geography, and stitching four quarters together breaks the "one quote contains the number" gate.

## Two kinds of figures, two clocks

| Kind | Figures | Clock |
|---|---|---|
| Flows | cash to shareholders, stock pay, paid out, taxes, R&D, revenue by geography, employees | the fiscal year of each company |
| Point-in-time | value created (market cap), net worth, ownership % | one stated date per edition |

Ownership % comes from the proxy or annual report filed after the fiscal year (spring 2026 for most). Market cap and net worth use the edition date. Anything that multiplies cap by ownership shows both dates.

## Work breakdown

| Layer | Quotes now | How | Notes |
|---|---|---|---|
| Cash, stock pay, paid-out inputs, taxes and R&D for 85 SEC filers | ~1,000 | **Script** prefills values from XBRL companyfacts; an agent finds the verbatim line in the filing | The quote gate still applies |
| Same figures for 15 non-SEC filers | ~250 | Agent | Annual reports (PDF); FY2025 reports are out |
| Ownership (records, 2026 proxies) | ~500 | Agent | Proxy 5% tables; class and family rules unchanged |
| Owners lens (NBIM, CalPERS, holders of record) | 334 | Agent, partly script | NBIM holdings at Dec 31, 2025 are published |
| Ecosystem / sales enabled (25 platforms) | 65 | Agent | GMV, creator payouts, take rates |
| Net worth | 56 | **Script** | The Forbes 2026 list (measured Mar 2026) is live on the same API already used |
| FX | 13 currencies | **Script** | Fed G.5A 2025 annual rates are out. The current rule (year ends Jan–Jun use the prior calendar year) covers every non-USD company; no FY needs a 2026 rate |
| Footprint (state maps, countries, sites) | 1,992 | Agent, **re-check only** | Follows the publication dates of impact reports, not fiscal years. Replace only where a newer report exists; most sites won't change |
| Amazon deep dive (`amazon-*.js`) | hand-built | Agent + me | Amazon's newer state economic-impact tables |

### Outside the gated pipeline (needs fixing anyway)

- **Market cap:** all 100 values come from companiesmarketcap.com, an aggregator, which breaks the site's own sourcing rule. Proposed: shares outstanding from the latest filing cover page (XBRL `dei:EntityCommonStockSharesOutstanding`, or the annual report for non-SEC filers) × the closing price on the edition date, as a documented calculation.
- **People employed:** 88 of 100 come from stockanalysis.com. Move them to the 10-K or annual report "employees" line, with a quote.
- **Estimated pay (`wage`):** the original zip has a round number per company with no documented method, and it drives the "$985B" headline. Proposed:
  - for U.S. filers, median employee pay from the proxy's CEO pay ratio disclosure;
  - elsewhere, personnel expense ÷ average employees from the annual report.
  
  This one is optional, but it is the weakest number on the site.
- **Edition literals:** "2024–25", "$35.5 trillion", "15 million" and "$985 billion" are hand-typed in `index.html` (meta, JSON-LD, table note), `methodology.html`, `design/og-card.html`, `app.js` and `DESIGN.md`. Move them into `research/edition.json` (label, as-of date, cutoff, Forbes list) and stamp them at build time. Regenerate `og-image.png`.
- **Schema rule:** BRIEF rule 4 and SCHEMA "fiscal year: match the snapshot" become "the latest fiscal year ending on or before the edition cutoff (Sep 30, 2026)". The `fy` field in `data.js` is updated from the submissions API first, so the validators pin to the new year.

### Roster drift

Before refreshing numbers, check each of the 100 for anything since the snapshot: role changes, deaths, mergers, delistings, renames and share splits (splits change share counts and ownership math). The roster stays fixed; only ranks move. Anyone who needs to be replaced is flagged for you.

## Sequence

1. **Setup (me):**
   - git tag `edition-2024-25` so the current site is preserved;
   - add `edition.json` and update `fy` across the 100;
   - write the XBRL prefill, Forbes and FX scripts;
   - run the roster drift pass.
2. **Pilot (6 companies):** Amazon (Dec, SEC, bespoke page), Apple (two-year jump), Toyota (March year end, JPY), LVMH (non-SEC, EUR), Bank of America (bank rules) and Shopify (ecosystem). End to end through every gate and the profile page. Fix the briefs before fanning out.
3. **Fan-out:** 10 agents × about 10 companies each. Each agent refreshes every lens for its companies, not one lens across everybody, so it reads each filing once. A footprint re-check runs alongside it.
4. **Prices and literals:** market cap and net worth on the edition date, headline stamping, OG image, methodology page.
5. **Gates and review:**
   - existing gates: check-values, verify-quotes, the three validators, build and check-site;
   - a `coverage.json` diff that must not regress (for example, "held by others" shown for 83 of 100);
   - a browser pass on phone and desktop, then deploy.

The old parity check ("0 lost lines") doesn't apply, because content changes on purpose.

**Size (rough, based on the earlier fan-outs):**

- one long day of wall-clock with 10 parallel agents, or about 2 days if the footprint re-check finds many newer state reports;
- setup and pilot: about half a day;
- the fan-out is the long pole.

## Keeping it fresh afterwards

- **Prices layer** (market cap, net worth): a scripted refresh on a schedule, either monthly or quarterly. A GitHub Action commits it and Vercel deploys.
- **Filings layer:** rolls once a year, mainly in Feb–Apr when most companies file. The same per-company refresh applies, and off-calendar companies update when they file.

## Decisions needed

1. **Edition definition:** the latest reported year per company (recommended), or FY2025 for everyone (one label, but Apple, Microsoft and 28 others would show an older year than they have published).
2. **As-of date for market cap and net worth:**
   - **Recent close** (recommended for "up to date"): e.g. Nov 28, 2026. Net worth would come from the Forbes real-time list captured the same day; whether it can be cited like the annual list is checked in the pilot.
   - **Dec 31, 2025:** aligns with FY2025, with the Forbes 2026 list as of Mar 2026.
3. **Pay estimate:** replace the undocumented `wage` with sourced pay (recommended), or keep it.
