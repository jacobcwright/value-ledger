# Value for Humanity: design and editorial brief

This brief is the shared direction for every change to the site. Read it before editing.

## The pitch

**Value for Humanity** publishes **The Business 100**, a ranking of 100 business builders and the companies they helped create or lead.

The thesis is that building a great company is one of the most powerful ways a person can help other people. The site makes that case with evidence, not slogans:

1. **Value created** is the umbrella, seen through separate lenses that are not added to each other or to market value. **Market value** (market capitalization at year-end 2024) is one lens: the companies on this list are worth about $35 trillion together, and that value exists because customers chose to buy what these companies make. The other lenses (workers, ownership, cash to shareholders, platform ecosystems, taxes, R&D) sit beside it in each profile. Label market capitalization "Market value", never "Value created". `/methodology` defines every lens and its evidence tiers.
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

## Visual direction

The site is an editorial publication: warm paper, ink, serif display type, red as the brand mark, and dark map surfaces for the data. Polish it; don't redesign it.

- **Tokens.** Use the custom properties in `dist/css/base.css` (`--space-*`, `--radius*`, `--shadow-*`, `--green`, `--gold`, `--map*` and others). Don't add new one-off hex colors when a token fits. If you need a token that doesn't exist, define it locally in your own file and say so in your report.
- **Color meaning.** Red is brand chrome only: the mark, eyebrows and links. Ownership and value-sharing visuals never use red or green. The individual is a recessive warm gray (`--share-self`); named holders (index funds, asset managers and other large holders) alternate violet and amber (`--share-1`, `--share-2`); the pensions & sovereign funds group (NBIM, CalPERS) is pink (`--share-3`); "everyone else" is blue (`--share-rest`), the visual hero. The pension group is drawn only when every listed segment fits within 100%. Gold is the highlight on dark map surfaces. This palette passes the CVD validator; keep a visible label on every segment because amber and pink are low-contrast.
- **Type.** Use Georgia for display and numbers, and the system sans for UI and body. Use tabular numerals for figures in tables and lists.
- **Radii.** Standardize on `--radius-sm` for controls and `--radius` for cards and panels. Keep `--radius-lg` for the dialog only.
- **Motion.** Keep it subtle (150–250ms, `--ease`) and respect `prefers-reduced-motion`.
- **Responsiveness.** Every change must hold at 390px, 768px and 1440px wide.
- **Accessibility.** Keep visible focus, at least AA contrast, keyboard paths for maps and globes, and the existing ARIA.

## File ownership

Styles are split by area in `dist/css/`, loaded in this order: `base`, `home-hero`, `home-ranking`, `home-method`, `profile`, `amazon-distribution`, `amazon-map`, `amazon-states`, `company-value`, `company-footprint` (which reuses the Amazon map classes, so it loads after them). `methodology.css` styles `methodology.html` only, on top of `base`, `home-hero` (header) and `home-method` (footer). Edit only the files that belong to your area.

## Hard rules

- Don't change any figure, source URL, portrait credit or license in `data.js` or the Amazon data files.
- Keep every source link, photo credit and license line visible.
- Hash routes must keep working: `#leader/<id>`, `#leader/jeff-bezos/distribution`, `#leader/jeff-bezos/footprint`, `#leader/jeff-bezos/states` and `#leader/<id>/footprint`, `#leader/<id>/states` (every leader: the footprint panel, or the simple globe when there is no footprint data), `#leader/<id>/value` (the lenses module; for Amazon, its standalone lens section).
- Keep the stack: no build step, no frameworks, no external CDNs or trackers. The site must work from static files in `dist/`.
