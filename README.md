# UI Prompt Package

A minimal Astro starter for the UI Prompt Package website. The current page is a coming-soon placeholder; the full product and checkout are not implemented.

## Development

Use Node.js 24.

```sh
npm ci
npm run dev
```

## Build

```sh
npm run build
npm run preview
```

## GitHub → Vercel

Connect `lanqston/UIPromptPackage` to the Vercel project `digitalpromptpackage`.

| Setting | Value |
| --- | --- |
| Production branch | `main` |
| Root directory | `./` |
| Framework | Astro |
| Node.js | 24.x |
| Install command | `npm ci` |
| Build command | `npm run build` |
| Output directory | `dist` |
| Environment variables | None required |

Build settings are recorded in `vercel.json`. With the Vercel GitHub integration connected, pushes to `main` create production deployments and pull requests create preview deployments. No GitHub Actions deployment token is needed.

This repository is public. Keep secrets and private paid content out of commits. The Focus City project is separate.
