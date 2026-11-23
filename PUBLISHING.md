# Publish The Value Ledger

## Task to give the publishing agent

> Use this repository to publish The Value Ledger to a **public** GitHub repository at **jacobcwright/value-ledger**, then connect it to **Cloudflare Workers** and deploy it at **https://valueforhumanity.com**. Use the `main` branch for production and enable deployment on push. Preserve the existing site behavior, including Amazon’s ownership and map views. Verify that GitHub reports the repo as public, that the custom domain serves the site, and that the Amazon map and state drill-down work. Return the GitHub URL and the live URL. If account permissions block an action, report the specific account, action, and permission error.

## What’s in the archive

This is a ready-to-push Git working tree with one initial commit on `main`. It has no remote configured. The entire site is in `dist/`, including the JavaScript data, styles, portraits, and screenshots. There is no build step. Cloudflare serves the directory as Workers Static Assets.

## 1. Check the package

From the extracted `value-ledger` folder, run:

```bash
npm ci
npm run check:deploy
```

For a local preview, run `npm run dev` and open the URL printed by Wrangler. Test `/#leader/jeff-bezos/footprint` and `/#leader/jeff-bezos/states`.

## 2. Push to GitHub

Authenticate GitHub CLI as `jacobcwright` with permission to create and push to a public personal repository. Verify the account:

```bash
gh auth status
gh api user --jq .login
```

Create the repository from the extracted folder:

```bash
gh repo create jacobcwright/value-ledger --public --source=. --remote=origin --push
```

If `jacobcwright/value-ledger` already exists and is empty, use that repository:

```bash
git remote add origin https://github.com/jacobcwright/value-ledger.git
git push -u origin main
```

If the repo already contains commits, inspect its history and integrate the site with a normal commit or pull request. The GitHub connection used for the original handoff returned HTTP 403 on repository creation. If the same restriction applies, use an authorized GitHub session or have the owner create the empty public repo and grant write access.

Verify the repository visibility and production branch:

```bash
gh repo view jacobcwright/value-ledger --json url,visibility,defaultBranchRef
```

## 3. Deploy on Cloudflare

Sign in to the Cloudflare account that controls the active `valueforhumanity.com` zone and has permission to manage Workers and custom domains.

Use **Workers & Pages → Create application → Import a repository** and authorize access to `jacobcwright/value-ledger`. Select these settings:

| Setting | Value |
| --- | --- |
| Worker name | `value-for-humanity` |
| Production branch | `main` |
| Root directory | Repository root |
| Build command | Leave blank |
| Deploy command | `npm run deploy` |

The checked-in `wrangler.jsonc` serves `dist/` and binds `valueforhumanity.com` as a Workers Custom Domain. Keep the dashboard Worker name and the Wrangler name in sync. In the Worker’s settings, confirm that the custom domain is active and that the GitHub repository is connected for subsequent pushes.

To deploy from a terminal with authorized Cloudflare access, run:

```bash
npx wrangler login
npx wrangler whoami
npm run deploy
```

If you use the CLI first, connect the existing Worker to the GitHub repository afterward to enable deploys on push.

[Cloudflare Workers Static Assets](https://developers.cloudflare.com/workers/static-assets/get-started/) · [Workers Builds configuration](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/)

## 4. Verify and report

- Confirm GitHub shows the repo as **PUBLIC** and contains the `main` branch.
- Open [valueforhumanity.com](https://valueforhumanity.com/) and confirm it serves **The Business 100** over HTTPS.
- Open the [Amazon global map](https://valueforhumanity.com/#leader/jeff-bezos/footprint). Switch to **U.S. states**, select a state, and switch the measure from estimated GDP contribution to investment.
- Open the [Amazon ownership view](https://valueforhumanity.com/#leader/jeff-bezos/distribution) and confirm that **All remaining shares** appears green.
- Return the GitHub URL, live domain, and whether pushes to `main` trigger Cloudflare deployments.
