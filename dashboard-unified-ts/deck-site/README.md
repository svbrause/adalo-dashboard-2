# Clinic deck (standalone Vercel site)

Static deployment of `docs/presentations/clinic-demo-deck.html` — **separate** from the main dashboard Vercel project.

## URLs compared

| Site | Example URL |
|------|-------------|
| **This deck** | `https://your-deck-project.vercel.app/` |
| **Dashboard** | `https://your-dashboard-project.vercel.app/patients` |

Live demo links and “Open product demo” buttons point at the dashboard origin (see below).

## Deploy on Vercel (new project — separate from dashboard)

Use a **second** Vercel project in the same GitHub repo (do not reuse the dashboard project).

1. [Vercel](https://vercel.com) → **Add New → Project** → import this repository.
2. **Root Directory:** `deck-site` (required).
3. Framework: **Other** — `deck-site/vercel.json` sets build/output (no `npm install` needed).
4. **Environment variable** (recommended):

   | Name | Value |
   |------|--------|
   | `DASHBOARD_ORIGIN` | `https://your-dashboard.vercel.app` |

   Default if unset: `https://adalo-dashboard-2.vercel.app`.

5. Deploy. Live URL is the project root, e.g. `https://your-deck-project.vercel.app/`.

Git push rebuilds automatically. The build reads `../docs/presentations/clinic-demo-deck.html` and assets from the monorepo (full repo is checked out even when root is `deck-site`).

### CLI deploy (optional)

From repo root, sync then deploy so assets are included:

```bash
npm run deck:sync
cd deck-site && vercel deploy --prod
```

Or connect Git and deploy from the dashboard (preferred).

## Local preview

From repo root:

```bash
cd deck-site
npm run build
npm run dev
```

Open [http://localhost:4177](http://localhost:4177).

Override dashboard for live links:

```bash
DASHBOARD_ORIGIN=http://localhost:5173 npm run build
```

## Rebuild after deck edits

Edit `docs/presentations/clinic-demo-deck.html`, then:

```bash
cd deck-site && npm run build
```

Or push to Git — Vercel rebuilds on deploy.

## What the build copies

- Deck HTML → `public/index.html` (paths rewritten for site root)
- Gravitas logo + blueprint JSON, Ponce logo, Tanya/Aura images, turntable video

Add paths to `scripts/build.mjs` → `ASSET_MANIFEST` if the deck references new files.
