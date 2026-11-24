# Value for Humanity: design and editorial brief

This brief is the shared direction for every change to the site. Read it before editing.

## The pitch

**Value for Humanity** publishes **The Business 100**, a ranking of 100 business builders and the companies they helped create or lead.

The thesis is that building a great company is one of the most powerful ways a person can help other people. The site makes that case with evidence, not slogans:

1. **Value created** is the umbrella, seen through separate lenses that are not added to each other or to market value. **Market value** (market capitalization at year-end 2024) is one lens: the companies on this list are worth about $35 trillion together, and that value exists because customers chose to buy what these companies make. The other lenses (workers, ownership, cash to shareholders, platform ecosystems, taxes, R&D) sit beside it in each profile. On the site, market capitalization is labelled **"Value created"** (the owner reverted the "Market value" label on Nov 23, 2026); the methodology explains that it is measured as market capitalization and counts only what owners keep. `/methodology` defines every lens and its evidence tiers.
2. **Livelihoods.** Together they employ about 15 million people directly and pay an estimated ~$1 trillion a year in wages. The key line, meta tags and share image keep this workers figure.
   **Paid out & sales enabled** is the ranking's pay column: revenue − operating cash flow + capex (research/PAIDOUT.md), adjusted for customer lending where disclosed, plus sales enabled for the six marketplaces, in USD from `dist/paidout.json`. It is the one measure that deliberately combines figures, and only its own parts; it never adds estimated pay (already inside it), market value or another lens. Never total it across the 100: one company's payment is another's revenue. Banks and brokers show "Not comparable" and sort last.
3. **Shared ownership.** Most of the value doesn't sit with the founder. Amazon is the worked example. Jeff Bezos holds about 9% of the company. The other ~91% belongs to index funds, pension systems such as CalPERS, institutions and individuals, which in practice means the retirement savings of ordinary people. Blue on the site always marks "value held by or flowing to everyone else."
4. **Reach.** Operating footprints, sales by market and U.S. state impact show the value landing in real places.

Every headline figure above must be **computed in code from `data.js` or the Amazon data files**. Never hardcode it in copy. If you need a number that doesn't already exist in the data, don't add it.

**One figure, one display.** List-wide totals (the dark band, the "How value spreads" figures and the `<head>` description copy) use `headlineFigure()` in `app.js`: "$35.5 trillion", "15 million", "$985 billion". The four big story figures all use it, so Amazon's net sales read "$638 billion" there and "$638B" inside the case study (same rounding). Other per-company figures use `compactMoney()`: "$2.35T", "$85.6B". The exception is `og:image:alt`, which describes `og-image.png` and so repeats the figures printed in that image ($35.49T, 15M, $985.2B); regenerate the image and its alt together. Percentages for an aggregate (Bezos's 8.6%, everyone else's 91.4%) use one decimal; individual holdings in the Amazon list use two so small positions such as CalPERS's 0.15% stay visible. Amazon's $2.32T equity value (shares × year-end price) differs from its $2.35T market value (CompaniesMarketCap), and the case study says so where both appear.

## Voice

- Confident, warm and optimistic. Write like a well-edited business magazine celebrating its annual list, not like a pamphlet.
- Let the figures make the argument. Use plain verbs: built, employs, pays, owns, serves.
- Celebrate builders without diminishing anyone else. Many people helped create each company, and the methodology already says so. Keep that nuance.
- Avoid partisan language, attacks on critics of capitalism, and the words "billionaire", "greed", "trickle-down" and "job creators".
- Don't use unearned superlatives such as "greatest" or "most important". Allowed: "the 100 builders on this list", "together they employ…".
- Keep the methodology honest. Market capitalization is a snapshot of equity value, and pay is an estimate. Don't remove caveats; you can tighten their wording.

## Layout principle: list first, depth on click

The home page follows the Forbes list model. It has a slim header, a centered title, ONE key line of computed totals, search and filters, and a plain table. Clicking a row opens an inline panel with a portrait, one computed line and "View profile". There is no marketing prose, no hero imagery and no repeated calls to action. All the depth lives in the profile dialog: stats, globe, maps, case-study tabs and sources. Before adding any sentence to the home page, ask whether the table already says it.

### Standing decisions

- **The "Value created" label.** Follow the labelling rule in point 1 of The pitch above; don't relabel anything from the markup.
- **The key line keeps the workers figure** (people employed). Don't drop or swap it to save space; the mobile layout wraps the line instead.
- **"Paid out & sales enabled"** is never totalled. Show each company's figure; never sum the column, print a column total or roll it into a list-wide figure.
- **Lenses are never added** to each other or to market value (see `/methodology`).
- **The profile headline** (owner, Nov 24, 2026): four figures side by side at the top of every profile, in this order: **Value created** · **Held by others** (value created × the ownership headline's "Everyone else", sub-label "{x}% of shares, owned by index funds, pensions, savers and others") · **Paid out & sales enabled** (per year, with the fiscal year; banks "Not comparable") · **Their stake** (own or "derived" stake × value created; "{Family} stake" only where the ownership headline leads with the family; "Under 1% (< $X)"; otherwise "—" with the reason). Four columns on desktop, 2×2 under 1000px; people employed and estimated pay sit in a row below. Under the stake, a small "Net worth: $X (Forbes estimate, Month YYYY)" line tagged "Third-party estimate" (research/lenses/networth; "Net worth (with family)" for the list's "& family" entries). All of it comes from `dist/headline.json` (billions of USD), written by `scripts/build-companies.mjs`, which runs `dist/ownership-headline.js`: the same function `company-value.js` uses for the ownership section, so the two can't disagree. The home row panel adds one line from the same file: "Value created $X · Held by others $Y · Their stake $Z".

## Visual system

An editorial publication: warm paper, ink, a figure serif for display and numbers, a clean sans for UI, a dark header and footer, dark map surfaces for the data. Mobile first: design at 320–390px, then let it open up.

### Logo: "The share"

The mark is a ring: a small warm-gray slice for the individual and the rest in blue for everyone else. It is the site's argument in one shape (the same colours as the ownership palette), so never recolour it, add red to it or animate the slice. Files: `dist/favicon.svg` (used in the header and footer as `<img class="logo" src="/favicon.svg">`), `design/brand/mark.svg` and `app-icon.svg`; `design/brand/preview.html` shows it at every size. It sits left of the wordmark "Value for Humanity", set in Source Serif 4 at weight 600, on the dark header (`--header-bg`) or on paper. Logo sizes: 28px on wide screens, 24px on phones (22px under 360px).

### Type

Self-hosted in `dist/fonts/`, SIL Open Font License 1.1 (license files beside the fonts). No external font CDNs.

| Role | Family | File | Size |
|---|---|---|---|
| Display, headings, wordmark, big figures | **Source Serif 4** (Adobe), variable: weight 400–700, optical size 8–60 | `source-serif-4-latin.woff2` (preloaded) | 86 KB |
| The same, for Latin Extended-A (Ł, ő, Š…) | Source Serif 4, weight 400–700, optical size fixed at 20 | `source-serif-4-latin-ext.woff2` (fetched only when a page renders such a glyph in the serif, via `unicode-range`) | 14 KB |
| UI, body, tables, labels | **Inter**, variable: weight 400–700, optical size fixed at 14 (text) | `inter-latin.woff2` (preloaded) | 36 KB |

- **Why Source Serif 4.** True lining figures by default with tabular (`tnum`) and proportional (`pnum`) variants, so columns of dollars line up; Georgia's old-style numerals bob above and below the baseline. Its optical-size axis is automatic (`font-optical-sizing:auto`): the 84px title gets the high-contrast display cut while 15px figures get the sturdier text cut, from one file.
- **Why Inter.** Built for screens at small sizes, with tabular figures, a large x-height that reads well in dense tables at 13–14px, and a neutral voice that leaves the serif to carry the brand.
- Subsets were built from the variable TTFs in the `google/fonts` repository with fontTools (`varLib.instancer` to limit the axes, then `pyftsubset --flavor=woff2 --no-hinting --desubroutinize` keeping `kern liga calt ccmp locl mark mkmk tnum lnum pnum case`). Rebuild them the same way if a glyph is missing; keep the font weight under about 150 KB (now 137 KB on disk, 122 KB on a first load). The serif has no U+2011 non-breaking hyphen; it falls back to Georgia.
- `font-display:swap` with metric-matched fallbacks (`"Source Serif 4 Fallback"` on Georgia, `"Inter Fallback"` on Arial) so the swap barely moves the layout. Use the `--serif` and `--sans` tokens, never a family name.
- **Figures.** Every figure uses `font-variant-numeric:tabular-nums lining-nums` (the `--figures` token). `td`, `th`, `data`, `output` and the `.num` / `.figures` utilities get it from `base.css`. The `font:` shorthand resets it, so a number-heavy rule that uses `font:` must restate `font-variant-numeric:var(--figures)` after the shorthand. Leave the title's "100" proportional.
- **Scale** (fluid, linear from 320px to 1440px, then fixed): `--text-xs` 11→12 (labels, eyebrows), `--text-sm` 13→14 (UI, captions), `--text-base` 16→17 (body), `--text-md` 17→20 (lead, dek), `--text-lg` 21→26 (card and small headings), `--text-xl` 28→40 (section headings), `--text-2xl` 36→60 (page headings), `--text-display` 44→84 (the home title, capped at 12vw so it stays on one line at 320px). Line heights `--leading-tight` 1.04, `--leading-snug` 1.25, `--leading-body` 1.55. Tracking: display `-.022em`, headings `-.015em`, uppercase labels `.1–.14em`. Body copy never drops below 13px; never set body text in the serif except deks and quotes.
- Headings use `text-wrap:balance`, paragraphs `text-wrap:pretty`. There is no italic face: don't use `font-style:italic` (it would be synthesized).

### Tokens (`dist/css/base.css`)

Use the custom properties; don't add one-off hex colours, sizes or shadows when a token fits. If you need a token that doesn't exist, define it locally in your own file and say so in your report. Existing names are an API that ten stylesheets consume: add beside them, never rename.

- **Neutrals.** `--paper` #fbf8f2 (page), `--paper-2` #f4ede2 (tinted bands, table heads), `--card` #fffdf9 (raised surfaces). Text: `--ink` #221d1b (15.7:1 on paper), `--ink-2` #463e3a (secondary copy, 9.9:1), `--muted` #5c534d (meta and labels, 7.1:1 on paper, 6.4:1 on `--paper-2`: AA at any size). Rules: `--line` #e0d7cb for hairlines (decorative), `--line-strong` #8f8276 for control borders (3.5:1, meets the 3:1 non-text minimum).
- **Brand red.** `--red` #9d271f and `--red-dark` #84231b: eyebrows, links, the title's "100" and the 404 button. Red is brand chrome only.
- **Dark surfaces.** `--header-bg` (= `--night` #201c1b, matching `<meta name="theme-color">`: change both together), `--header-text` #fff8ed, `--header-muted` #d9cdc4 (10.8:1), `--header-line` (a faint white hairline). Maps: `--map`, `--map-2`, `--map-line`, with `--gold` as the highlight.
- **Space.** Fixed steps `--space-1..9`: 4, 8, 12, 16, 24, 32, 48, 64, 96px. Fluid: `--space-section` (32→56px, between page sections), `--gutter` (16→48px side margin), `--gutter-l` / `--gutter-r` (the gutter or the safe-area inset, whichever is larger). `.wrap` is `min(--max, 100% − gutters)` with `--max` 1200px.
- **Shape.** `--radius-sm` 4px for controls, `--radius` 8px for cards and panels, `--radius-lg` 12px for dialogs and sheets only, `--radius-pill` for chips and the phone nav link.
- **Depth.** `--shadow-1` (resting card), `--shadow-2` (popover), `--shadow-3` (sheet or dialog). Prefer hairlines to shadows on paper.
- **Motion.** `--dur-1` 120ms (press), `--dur-2` 180ms (hover, colour), `--dur-3` 260ms (enter, underline). Easing `--ease` (out) and `--ease-in-out`. Animate opacity and transform only. `base.css` collapses all animation and transition under `prefers-reduced-motion:reduce`; still add a local `transition:none` for anything you animate.
- **Focus.** `:focus-visible` draws a `--focus-width` (3px) outline in `--focus` (#b0563d, 4.7:1 on paper) at `--focus-offset`. On dark surfaces set `outline-color:var(--focus-on-dark)` (gold). Never remove an outline without replacing it.
- **Touch.** `--tap` is 44px. Under `@media (pointer:coarse)` text inputs and selects get `min-height:var(--tap)`, and `.tap` opts any element in. For a compact control, keep the visual size and extend the hit area with an absolutely positioned `::after` (see the phone nav pill and the methodology chips). Inline links inside running text are exempt.
- **Safe areas.** `--safe-top` and `--safe-bottom` wrap `env(safe-area-inset-*)`. The header pads by `--safe-top`, the footer and the 404 by `--safe-bottom`, and `.wrap` uses the left and right insets. The viewport meta on index, methodology and 404 has `viewport-fit=cover`, so they are live: anything new that touches a screen edge must pad by them.

### Colour meaning

Red is brand chrome only: eyebrows, links and the title's numeral. Ownership and value-sharing visuals never use red or green. The individual is a recessive warm gray (`--share-self`); named holders are violet, amber and pink (`--share-1..3`, in that fixed order); "everyone else" is blue (`--share-rest`), the visual hero, as in the logo. Gold is the highlight on dark map surfaces. This palette passes the CVD validator; keep a visible label on every segment because amber and pink are low-contrast. `--green` stays for its existing non-ownership uses; never bring it into an ownership visual.

### Header and footer

- The header is a dark bar, `--header-h` tall (56px; 50px under 760px) plus the top safe area. **Under 760px it is sticky.** `--sticky-top` says where other page-level sticky elements must stick (0 on wide screens, below the header on phones), and `html` has `scroll-padding-top` set from it so anchors land below the bar. Anything that sticks to the top of the page (a table head, a section bar) uses `top:var(--sticky-top)`, never `top:0`.
- Wide screens: the logo and wordmark are centred, text links on the right with a sliding underline; the current page's link is white with its underline showing.
- Phones (under 760px): logo and wordmark on the left, ONE link on the right, set as an outlined pill with a 44px hit area. On the home page that link is "Methodology" ("The ranking" hides because the list starts on the first screen); on a page that is itself in the nav, its own link (`aria-current="page"`) hides; any other optional link takes `class="nav-optional"`. There is no menu button: the CSP forbids inline script and two destinations don't need one.
- The footer repeats the brand on the dark surface, then the edition and the links. On phones the links sit in their own row under a hairline, each 44px tall on touch screens, and the footer pads by the bottom safe area.

### Mobile patterns

- **Check every change at 320, 390, 768 and 1440px**, with no horizontal page scroll, and once with a coarse pointer (touch emulation), which plain narrow screenshots don't exercise.
- **Title block.** The title stays on one line from 320px up. The key line is one row with red middots on wide screens, two even rows split at a centre seam under 880px (separators only before the right-hand items, so none dangles whatever the item count), and one figure per line under 560px.
- **Section chips.** Where a page has sections, phones get ONE horizontally scrolling row of pill chips (no wrapping, no visible scrollbar, full-bleed to the screen edges, 44px hit areas), sticky under the header. The methodology contents uses it; the profile will too.
- **The profile (built).** At every width the profile is one column of stacked sections (no tabs) under a sticky bar and ONE sticky chip row; sections declare themselves with `data-chip` and the row tracks them with an IntersectionObserver. Chips are buttons, never hash links (a hash change re-routes the profile). `company-value.js` and `amazon-distribution.js` load on the first profile open (`loadProfileScripts()` in `app.js`), not with the page. Under 760px the profile dialog becomes a **full-screen sheet**: `inset:0`, no margin or radius, `100dvh` tall, padded by all four safe-area insets, and its own scroll container. A **sticky top bar** holds the leader's name (Source Serif 4, one line, ellipsis) and the close button (44×44, right, `aria-label` kept), on `--paper` with a hairline below. Directly under it, **ONE horizontally scrollable section-chip row** replaces the stacked tab rows: one chip per section (overview, value lenses, footprint, states, distribution where they exist), the active chip filled in ink with paper text, `aria-current` or `aria-selected` on it, scrolled into view when it changes, and every hash route (`#leader/<id>/value`, `/footprint`, `/states`, `/distribution`) selecting the matching chip. Sheet entrance: a 260ms rise with `--ease`, none under reduced motion. At 760px and wider the profile stays the centred dialog.
- Tables on phones show rank, name and the active measure; other columns appear as width allows. Never let a table widen the page: truncate names with an ellipsis or scroll the table inside its own container.

### Accessibility

Keep visible focus, at least AA contrast for all text (the neutrals above are chosen for it), keyboard paths for maps and globes, the existing ARIA and 44px touch targets.

## File ownership

Styles are split by area in `dist/css/`, loaded in this order: `base`, `home-hero`, `home-ranking`, `home-method`, `profile`, `amazon-distribution`, `amazon-map`, `amazon-states`, `company-value`, `company-footprint` (which reuses the Amazon map classes, so it loads after them). Edit only the files that belong to your area.

- `base.css`: fonts (`@font-face`), tokens, global element rules, utilities.
- `home-hero.css`: the site header (every page) and the home title block and key line.
- `home-method.css`: About the data and the site footer (every page).
- `methodology.css`: `methodology.html` only, on top of `base`, `home-hero` and `home-method`.
- `404.html` links `/css/base.css` and `/css/home-hero.css` and keeps its few page rules in a `<style>` block (the CSP allows inline styles, never inline scripts).
- `dist/fonts/`: the three WOFF2 files and their licenses. Every page preloads `source-serif-4-latin.woff2` and `inter-latin.woff2` in its `<head>` with `as="font" type="font/woff2" crossorigin`, using the same absolute `/fonts/…` URLs as the `@font-face` rules. Don't preload the Latin Extended file.

## Sourcing rules

- Every figure on the site has a source a reader can open: each profile shows each figure's source, and figures from company filings quote the line they came from verbatim.
- Prefer the company's own filings (10-K, 20-F, annual report, proxy) and official statistics. A study the company paid for is allowed only with the sponsor named and tagged "Company-commissioned".
- Estimates (pay) are labelled as estimates wherever they appear, with the assumption shown on the profile.
- When a company doesn't report a figure, say so; don't estimate it.

## Hard rules

- Don't change any figure, source URL, portrait credit or license in `data.js` or the Amazon data files.
- Keep every source link, photo credit and license line visible.
- Hash routes must keep working: `#leader/<id>`, `#leader/jeff-bezos/distribution`, `#leader/jeff-bezos/footprint`, `#leader/jeff-bezos/states` and `#leader/<id>/footprint`, `#leader/<id>/states` (every leader: the footprint panel, or the simple globe when there is no footprint data), `#leader/<id>/value` (the lenses module; for Amazon, its standalone lens section).
- Keep the stack: no build step beyond the JSON data build, no frameworks, no external CDNs, fonts or trackers. The site must work from static files in `dist/`. `vercel.json` sets a strict CSP (`'self'` for scripts, styles, fonts and fetch; inline style attributes allowed; no inline `<script>`), and `npm run check` fails the build on an inline script.
