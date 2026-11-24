# Edition refresh brief (2025–26 edition)

You are moving a set of companies in "Value for Humanity: The Business 100" from the 2024–25 snapshot to each company's **latest reported fiscal year**. `research/REFRESH.md` explains why. Accuracy is everything: real people and companies, every number published with its source.

## Read first
- `research/BRIEF.md`, `research/SCHEMA.md`, `research/LENSES.md`, `research/PAIDOUT.md`. All of their rules still apply: primary documents you fetched in this session, `hostType`, verbatim quotes containing the number, no mirrors or aggregators, `null` rather than a guess, and SEC requests only through `zsh -c 'curl -sL -A "$SEC_USER_AGENT" …'`. Never print the value of `SEC_USER_AGENT`.
- **One rule changed.** The fiscal year is now the one in each leader's `fy` field in `dist/data.js`, which has already been updated: `Dec 2025` means the year ended Dec 2025, and `Sep 2026` means the year ended Sep 2026. All flow figures come from that year's annual report.
- `research/refresh-prefill/<id>.json` holds the leads per company:
  - `annual`: the new 10-K or 20-F, with its URL;
  - `proxy`: the latest DEF 14A;
  - `quarterly`: the latest 10-Q;
  - `leads`: each stored XBRL figure, with its old value and the same concept at the new year end;
  - `owners`: the company's row in NBIM's holdings at 2026-06-30, and its CalPERS 13F rows at 2026-09-30.
  
  Leads are never sources. Each value still needs its verbatim line in the human-readable document, and you must check the units and that it is the right line.
  - If `annual.form` is `10-K/A`, use the original 10-K unless the amendment restates the financial statements.
  - A missing lead only means the XBRL concept changed or the filing isn't in companyfacts yet. Read the filing.

## What you update, per company `<id>` (only these files)
1. **`research/records/<id>.json`:**
   - `fiscalYear`, `fiscalYearEnd` and `currency`;
   - **ownership** from the latest proxy, or the annual report's major-shareholders section, filed after the old one. For September year-ends that is the Jan 2026 proxy, and `asOf` is whatever date it states;
   - `cash` (dividends and buybacks), `workers` (stock comp and plan) and `geography` for the new fiscal year;
   - every `source`, including `url`, `label` (e.g. "FY2025 Form 10-K, consolidated statements of cash flows"), `quote` and `xbrl` (`end` and `value` at the new year end).
2. **`research/lenses/paidout/<id>.json`:** every input for the new year, following PAIDOUT.md: revenue, OCF, capex, interest, taxes, lending adjustments and sales enabled. Banks and brokers keep `altPaidOut`.
3. **`research/lenses/fiscal/<id>.json`:** cash taxes paid and R&D for the new year.
4. **`research/lenses/ecosystem/<id>.json`** (if it exists): the new year's volume measure, platform revenue, payouts and client assets. Replace a study only if a newer one exists.
5. **`research/lenses/owners/<id>.json`:**
   - `nbim` and `calpers` from the leads (copy the quote exactly);
   - redo `calpers.derived` with the newest shares-outstanding count, the same one you use in the marketcap lens;
   - `holdersOfRecord` from the new annual report;
   - rewrite `notes` for the new dates.
   
   If a lead says "missing", search NBIM's file and the 13F by company name before concluding the holding is gone. The NBIM file is `https://www.nbim.no/api/investments/v2/2026-06-30.json` and the 13F information table is `https://www.sec.gov/Archives/edgar/data/919079/000091907926000013/form13fInfoTable.xml`.
6. **New: `research/lenses/marketcap/<id>.json`** (the inputs for "Value created" at the edition date, Nov 20, 2026):
   ```jsonc
   {
     "id": "larry-page", "company": "Alphabet",
     "classes": [   // every class of equity outstanding, listed or not; excludes treasury shares
       { "label": "Class A common stock", "shares": 5800000000, "sharesAsOf": "2026-10-20",
         "pricedAs": "GOOGL",        // Yahoo Finance symbol of the listed line that prices this class (e.g. GOOGL, BRK-A, 7203.T, MC.PA, 0700.HK, 005930.KS, 2330.TW, RELIANCE.NS, ROG.SW)
         "perListedUnit": 1,          // listed units one share of this class equals (unlisted Class B convertible 1:1 → 1; Berkshire B priced as BRK-B → 1)
         "pricedAsReason": null,      // required when the class isn't itself listed, e.g. "Class B is unlisted and converts 1:1 into Class A"
         "source": { "hostType": "sec", "url": "...", "label": "Form 10-Q for the quarter ended Sep 30, 2026, cover page", "quote": "As of October 20, 2026, there were 5,800,000,000 shares of Class A common stock outstanding" } }
     ],
     "notes": "", "researchedAt": "2026-11-24"
   }
   ```
   - Use the most recent share count available: 10-Q cover page, 20-F cover, an exchange monthly return (HKEX), or the latest annual or interim report.
   - Price every class from its own listed line, except a class with no listing of its own, which is priced through the class it converts into. Explain that in `pricedAsReason`.
   - Prefer the primary listing in local currency over ADRs.
   - Don't fetch prices yourself. Only symbols are needed.
7. **New: `research/lenses/pay/<id>.json`** (people employed and what they are paid; this replaces the aggregator head counts and the undocumented wage):
   ```jsonc
   {
     "id": "...", "company": "...", "fiscalYear": "FY2025", "fiscalYearEnd": "2025-12-31", "currency": "USD",
     "employees": { "value": 183323, "asOf": "2025-12-31", "basis": "<the company's wording, e.g. full-time employees>", "source": {...} },
     "payroll": {                              // prefer method 1
       "method": "personnel-expense",          // 1. total staff costs as reported (wages, salaries, benefits, social charges). value in BILLIONS of currency
       // or "median-pay": 2. the proxy's CEO pay ratio disclosure, median employee annual total compensation, value in UNITS of currency
       "label": "<the line's own name>", "value": 0, "source": {...}
     },
     "notes": "", "researchedAt": "2026-11-24"
   }
   ```
   - Most IFRS and annual-report filers disclose personnel expense in the notes. Some U.S. filers do too, under names like "salaries and benefits", "compensation and benefits" (banks) or a total "employee costs".
   - Use median-pay only when no total is disclosed.
   - Never compute a payroll yourself. If neither exists, set `payroll: null` and explain in notes.
   - The employee count is the year-end head count in the annual report. Note it if the company reports FTEs or an average.

## Learned in the pilot (apply these)
- **Taxes paid moved:** under the new income-tax disclosure rule (ASU 2023-09), many FY2025 10-Ks no longer print "cash paid for income taxes" in the supplemental cash-flow lines. It sits in a by-jurisdiction table in the income-tax note. Look there before setting null.
- **Share count:** use the most recent of the 10-K cover page and the latest 10-Q cover page. For September year-ends, the 10-K cover is newer than the prefill's `quarterly`.
- **Market cap:**
  - Common equity only. Leave out preferred stock and nominal or special voting shares (e.g. Shopify's single Founder Share), and say so in `notes`.
  - For a dual listing that isn't an ADR (e.g. `SHOP` vs `SHOP.TO`), pick one line and say which in `notes`.
  - Fill `pricedAsReason` whenever a class is priced through another class's symbol, even if `perListedUnit` is 1.
- **Pay:**
  - Add `"period": "FY2025"` inside `payroll` when the payroll's year differs from the head count's. For example, a January proxy's median for a September year-end is a year behind.
  - Foreign private issuers have no CEO pay ratio, so `payroll: null` with a note is expected when they publish no staff-cost total.
- **NBIM:** some companies also have a bond row under the same name. Use the equity row (it has an `eq` object). CalPERS issuer names can change (e.g. "BANK OF AMER CORP").
- **Quote self-check:** `node scripts/tools/qcheck.mjs <urlmap.json> <your json files…>` runs verify-quotes' matching against your local copies (urlmap: `{"<url>": "/abs/path/to/local/file"}`) without touching shared files.
- **grep:** the local `grep` is ugrep and fails on long context patterns. Use `grep -F` with short strings, or node/python.
- **Pace:** the pilot took about 3 minutes per SEC company once its tools were in place.

Rewrite every `notes` field so it describes the new year. Remove statements that were true only of the old year, and set `researchedAt` to today. Keep each file's shape. Don't add keys the schemas don't list.

## Don't touch
`dist/` (including data.js), `research/lenses/footprint/`, `research/lenses/networth/`, `_fx.json`, `_managers.json`, `manual-sources.json`, `scripts/`, other companies' files and git (no commits, checkout, stash or reset). Other agents are working in the same folder at the same time. If a shared file needs a change (a new currency, a new manager name), put it in your report.

## Check your work
- `node scripts/validate-records.mjs --xbrl <ids…>`
- `node scripts/validate-lenses.mjs --xbrl <ids…>`
- `node scripts/check-values.mjs 2>&1 | grep -E "<id1>|<id2>|…"`

Fix every error for your ids. Old-year warnings in files you didn't need to touch don't apply.

Don't run `verify-quotes.mjs` (it rewrites a shared file); it runs centrally afterwards. Instead, confirm each quote yourself: extract the document's text (HTML to text, or `pdftotext -layout`), squash whitespace, and check the quote is a substring. If a host blocks scripts entirely, say so in your report with the URL.

Pause at least 1.5 seconds between SEC requests (10 agents share the limit) and keep to about 2 requests per second for other hosts.

## Report (compact)
For each company:
- the old year and the new year;
- headline changes (buybacks, paid out, employees, the leader's ownership %);
- anything left null, with the reason;
- judgment calls;
- **roster facts**: whether the leader's role, status or the company's identity changed (rename, merger, delisting, split), as stated in the filings.
