# Research brief for company records

You are researching sourced records for "Value for Humanity: The Business 100". For each company the site shows:
- who owns it;
- the cash it returns to shareholders;
- the stock it pays workers;
- where its sales come from.

The site's goal is to show honestly how widely the value a company creates is shared. Accuracy is everything: these are real people and companies, and every number is published with its source.

## Read first
- `research/SCHEMA.md` is the binding spec. Read all of it, including "Clarifications from the pilot" and the fiscal-year rule.
- `dist/data.js` gives each leader's `id`, `company` and `fy`.
- `research/records/sam-walton.json` and `research/records/ma-huateng.json` are reasonable pilot examples. Note that they predate the `hostType` field.

## Hard rules
1. **Every figure comes from a document you fetched in this session.** That means a company annual report, 20-F, 10-K, proxy, an exchange filing (HKEX, SGX, NSE/BSE, ASX, Euronext, SIX, JPX/EDINET, DART, Companies House) or the SEC XBRL API. A search snippet, news story, aggregator, wiki or your own memory is never a source. If you can't reach the document, use `null` or `not-sourced` and explain in `notes`.
2. **`source.url` is the document you actually read**, and `hostType` says where it is hosted (`company`, `exchange`, `regulator` or `sec`). Mirrors are forbidden.
3. **The quote is verbatim** from that document and contains the number.
4. **Figures match the site's snapshot year:** the leader's `fy` field in data.js, not later years.
5. **Never sum or derive holders yourself**, except through the documented `leader.derived` object.

## How to fetch
- Use `curl -L` from Bash with a generic browser-like user agent for company and exchange sites, e.g. `-A "Mozilla/5.0 (compatible; ValueForHumanity research)"`.
- **SEC (www.sec.gov and data.sec.gov):** always send the contact header from the environment, exactly like this: `zsh -c 'curl -sL -A "$SEC_USER_AGENT" "<url>"'`. Never type, print or echo the value of `SEC_USER_AGENT`, and never put it in a file or a record. Several agents share the SEC's 10-requests-per-second limit, so pause at least 1 second between your SEC requests (`sleep 1`). If `$SEC_USER_AGENT` is empty, stop and report it.
- SEC filings worth knowing: DEF 14A proxy ("Security Ownership of Certain Beneficial Owners and Management"), 10-K (cash-flow statement, share-based compensation note, segment or geographic revenue note), 20-F (Item 6.E share ownership, Item 7.A major shareholders), and Schedule 13D/G. Use the EDGAR filing index at `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=<cik>&type=DEF+14A` or `https://data.sec.gov/submissions/CIK##########.json` to find documents. The XBRL companyfacts API is the best source for cash-flow and stock-comp values, so include the `xbrl` object for those.
- Keep request rates polite: no more than about 2 per second to any one host.
- For PDFs, download to your scratch folder and run `pdftotext -layout file.pdf out.txt`, then grep.
- Annual reports usually carry:
  - major shareholders and directors' interests in the governance or shareholder-information section;
  - dividends paid and share buybacks in the cash-flow statement;
  - share-based payment expense in the notes;
  - revenue by geography in the segment note.
- Work only in your own scratch folder, which is given in your task. The only place you write in the repo is `research/records/<id>.json`.

## Validate
Run `node /Users/jacobwright/dev/work/value-ledger/scripts/validate-records.mjs --xbrl <ids...>` on your records and fix every error.

## Report
For each company:
- a one-line summary of what you recorded;
- every field left null or `not-sourced`, with the reason;
- any judgment call (overlaps, bases, currencies).

Keep the report compact.
