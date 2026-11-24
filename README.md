# Value for Humanity

The Business 100 is a static site about companies that business leaders helped build, the people who work there, and the value those companies create. Jeff Bezos’s profile includes Amazon’s ownership breakdown, a global sales map, a U.S. heat map covering all 50 states, and selected facility details.

## Edit locally

Use Node.js 22 or later. Run `npm ci` and `npm run dev`. The site lives in `dist/` and uses HTML, CSS, and plain JavaScript.

- `dist/index.html`, `dist/app.js`, and the area stylesheets in `dist/css/` power the ranking and profiles. See [DESIGN.md](DESIGN.md) for the editorial and visual brief.
- `dist/data.js` contains the Business 100 snapshot with source links. `dist/story.js` fills the “How value spreads” section from it.
- `dist/amazon-distribution.js` contains Amazon’s shareholder, cash, and worker-equity case study.
- `dist/amazon-footprint.js` and `dist/amazon-state-data.js` contain the Amazon geography data and source links.
- Portrait credits are in each profile. Globe geography comes from Natural Earth. State boundaries are Census Bureau data adapted from US Atlas. Its license is in `dist/amazon-state-data.js`.

## Publish

Run `npm run deploy`. It checks the site first and refuses to publish a broken build. See [PUBLISHING.md](PUBLISHING.md) for the Cloudflare setup, the www redirect, deploy-on-push and post-deploy checks.
