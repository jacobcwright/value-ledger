# Publishing Value for Humanity

The site is static HTML, CSS and JavaScript in `dist/`, served by Cloudflare Workers Static Assets at **https://valueforhumanity.com**. There is no build step.

| Piece | Where |
| --- | --- |
| GitHub repo | `jacobcwright/value-ledger` (public), production branch `main` |
| Main Worker | `value-for-humanity` (`wrangler.jsonc`): serves `dist/`, custom domain `valueforhumanity.com` |
| www redirect | `value-for-humanity-www` (`workers/www-redirect/`): 301s `www.valueforhumanity.com` to the apex, keeping path and query |
| Headers | `dist/_headers`: CSP, HSTS (1 year), nosniff, frame and referrer policy, portrait caching |
| 404 | `dist/404.html` via `not_found_handling` |

## Deploy

```bash
npm ci
npm run check          # syntax-checks every file, verifies references, no inline scripts, 100 complete leaders
npm run deploy         # runs the check, then wrangler deploy
npm run deploy:www     # only needed if workers/www-redirect changes
```

`npm run deploy` refuses to publish if the check fails.

### Deploy on push (Workers Builds)

Connect the repo once in the Cloudflare dashboard. It needs a browser session that can authorize the Cloudflare GitHub app:

1. **Workers & Pages → value-for-humanity → Settings → Build → Connect** → GitHub → authorize `jacobcwright/value-ledger`.
2. Production branch `main`. Leave the build command blank. Deploy command: `npm run deploy`. Root directory: repository root.

After that, every push to `main` runs the check and deploys. Do new work on a branch.

## Verify after a deploy

- https://valueforhumanity.com serves **The Business 100**. https://www.valueforhumanity.com redirects to it.
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

`npm run deploy` runs `check-values` and `build-companies`, which publishes only figures whose sources pass `verified.json`, then the site check, then `wrangler deploy`. Run `verify-quotes` yourself after any research change.

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
