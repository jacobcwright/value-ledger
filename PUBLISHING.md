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

## Company value-sharing data

Per-company ownership, cash returned, stock pay and sales geography live in `research/records/<leader-id>.json` with a source URL and a verbatim quote for every figure. See [research/SCHEMA.md](research/SCHEMA.md). Validate them with:

```bash
node scripts/validate-records.mjs --xbrl   # re-checks every SEC XBRL-sourced value against data.sec.gov
```

## Share image

`dist/og-image.png` is rendered from `design/og-card.html`. Its figures are typed in, so if the data changes, update the card, screenshot it at 1200×630, and update `og:image:alt` in `dist/index.html`.
