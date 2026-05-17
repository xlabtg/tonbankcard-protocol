# Tonbankcard Protocol — Documentation Site

This directory hosts the public documentation site for the Tonbankcard
protocol, built with [Docusaurus 3](https://docusaurus.io). It consumes
the existing markdown sources in `../docs/` directly, so a single
source of truth is preserved.

## Layout

- `docusaurus.config.ts` — site configuration (navbar, footer, theming, plugins).
- `sidebars.ts` — curated sidebar mirroring `docs/INDEX.md`.
- `sidebars.sdk-api.ts` — sidebar for the auto-generated SDK API reference.
- `typedoc.json` — TypeDoc configuration that generates Markdown from `sdk/src/types.ts`.
- `src/pages/index.tsx` — landing page.
- `sdk-api/` — auto-generated TypeDoc output (regenerated on every build).

## Prerequisites

- Node.js ≥ 18 (CI uses 20).

## Local development

```bash
cd docs-site
npm install
npm run start      # http://localhost:3000
```

## Production build

```bash
npm run build      # also regenerates sdk-api/ via `prebuild`
npm run serve
```

## Deployment

The build output in `build/` can be served by any static host
(GitHub Pages, Vercel, Netlify, Cloudflare Pages, S3). The recommended
public URL is `https://docs.tonbankcard.com`.

A GitHub Actions workflow (`.github/workflows/docs.yml`) verifies that
the site builds on every pull request that touches `docs/`, `sdk/src/`
or the site itself, and publishes the resulting artifact for review.

## Adding new pages

1. Add the markdown file to `../docs/` (preserve existing structure).
2. Register the doc ID in `sidebars.ts` under the appropriate category.
3. Run `npm run build` locally to confirm the link graph is intact.
