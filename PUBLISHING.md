# Publishing Value for Humanity

The site is static HTML, CSS and JavaScript in `dist/`, hosted on **Vercel** at **https://valueforhumanity.com**. A small build step turns the verified research into `dist/companies/*.json`.

| Piece | Where |
| --- | --- |
| GitHub repo | `jacobcwright/value-ledger` (public). Pushing to `main` deploys production; other branches get preview URLs. |
| Vercel project | `value-for-humanity` (personal scope), configured by `vercel.json`: build command, `dist/` output, security headers (CSP, HSTS, nosniff, frame and referrer policy), clean URLs (`/methodology`) and the www → apex redirect. |
| DNS | Registered and hosted at Cloudflare (Cloudflare Registrar requires Cloudflare DNS). The apex has an `A` record to `76.76.21.21` and `www` a `CNAME` to `cname.vercel-dns.com`, both DNS-only (not proxied). |
| 404 | `dist/404.html`, served automatically by Vercel. |

## Deploy

Push to `main`. Vercel runs `npm ci` and then `npm run build`:
1. `check-values` confirms every stored number appears in its own quote.
2. `build-companies` publishes only figures whose sources pass `research/verified.json`.
3. `check-site` checks syntax, references, the absence of inline scripts, and that all 100 leaders are complete.

If any step fails, the deploy fails and the live site stays as it was.

```bash
npm ci
npm run build        # the same checks locally
npm run dev          # build, then serve dist/ at http://localhost:8790
vercel --prod        # manual deploy, if ever needed
```

## Verify after a deploy

- https://valueforhumanity.com serves **The Business 100**. https://www.valueforhumanity.com redirects to it (308).
- `#leader/jeff-bezos/distribution`: the ownership bar shows the founder in red and everyone else in green.
- `#leader/jeff-bezos/footprint`: Markets, U.S. states and Sites switch. On U.S. states, change the measure and pick a state.
- A missing path returns the 404 page.
- The browser console is clean, with no CSP violations.

## Company research and lenses

Every per-company figure lives in `research/`:

| Path | What |
| --- | --- |
| `research/records/<id>.json` | Ownership, cash returned, stock pay and sales geography ([SCHEMA.md](research/SCHEMA.md)) |
| `research/lenses/ecosystem/<id>.json` | Platform flow-through, payouts, client assets and commissioned studies ([LENSES.md](research/LENSES.md)) |
| `research/lenses/fiscal/<id>.json` | Cash income taxes paid and R&D expense |
| `research/verified.json` | Result of the quote-verification gate, committed |
| `research/manual-sources.json` | Sources that block scripts, verified from a browser copy |

Each figure carries its source URL, its host type and a verbatim quote. Four checks guard publishing:

```bash
node scripts/validate-records.mjs --xbrl   # shape and rules; re-checks SEC XBRL values against data.sec.gov
node scripts/validate-lenses.mjs --xbrl    # the same for the lens files
zsh -c 'node scripts/verify-quotes.mjs'    # re-downloads every source and confirms every quote (slow; results cached in research/.cache)
node scripts/check-values.mjs              # each stored number must appear in its own quote
```

Every Vercel build runs `check-values` and `build-companies`, which publishes only figures whose sources pass `verified.json`, then the site check. Run `verify-quotes` yourself after any research change and commit the updated `research/verified.json`.

SEC requests need a contact header. Set it once in your shell profile; the scripts read it and never print it:

```bash
echo 'export SEC_USER_AGENT="ValueForHumanity research <your email>"' >> ~/.zshenv
```

**Rules that shape the numbers:**
- Market value is one lens; lenses are never summed.
- Dividends are those paid to the company's own shareholders.
- Buybacks exclude employee-plan purchases.
- "Derived" stakes are computed from quoted class counts and labelled as derived.
- Many 5% holder figures come from 13G filings dated earlier than the proxy, and each one shows its own date.

## Share image

`dist/og-image.png` is rendered from `design/og-card.html`. Its figures are typed in, so if the data changes, update the card, screenshot it at 1200×630, and update `og:image:alt` in `dist/index.html`.
