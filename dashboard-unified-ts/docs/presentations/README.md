# Presentations

## Clinic Demo (`clinic-demo-deck.html`)

**Clinic-facing** slide deck for live sales demos. **9 slides**, short copy, and **live dashboard iframes** on most product slides (Sarah / Tanya Tan demo patient).

### Open (recommended)

Run **two terminals** from the repo root:

```bash
npm run dev    # dashboard → http://localhost:5173
npm run deck   # presentation → http://localhost:4177/docs/presentations/clinic-demo-deck.html
```

**Presentation URL:**

[http://localhost:4177/docs/presentations/clinic-demo-deck.html](http://localhost:4177/docs/presentations/clinic-demo-deck.html)

1. Log in as **Admin** at `http://localhost:5173` in the **same browser** (session is shared with deck iframes).
2. Hard-refresh the deck (`Cmd+Shift+R`).
3. Advance slides — each product slide loads a scaled iframe (`?embed=1` hides sidebar/header).

Override dashboard host: `?dashboard=http://localhost:5173`

### Slide map

| # | Focus | Iframe |
|---|--------|--------|
| 1 | Title | — |
| 2 | Problem + contrast | Facial analysis queue |
| 3 | Meet Sarah | Client mirror |
| 4 | In-chair analysis | Analysis overview |
| 5 | Plan builder | Treatment recommender |
| 6 | Send blueprint | Share blueprint flow |
| 7 | At home | **`/tp` Post-Visit Blueprint** (live embed) |
| 8 | Practice | Inbox |
| 9 | Live demo CTA | Launch buttons |

### Controls

| Action | Keys |
|--------|------|
| Next | `→`, `Space`, click right |
| Previous | `←`, click left |
| Open live link on slide | `L` |

### Customize before a meeting

- Slide 1: `[Date]` (clinic is preset to **Gravitas Medspa**)
- Slide 10 (final): closing line uses **Ponce AI** branding (no presenter placeholder)
- Logo: `public/demo/gravitas-medspa-logo.png`
- Demo blueprint payload: `public/demo/gravitas-tanya-blueprint.json` (embedded on slide 7 as `/tp`)

### Embed mode (dashboard)

Deck iframes append `?embed=1` (see `DashboardEmbedView` and `isDashboardEmbedMode` in `src/utils/dashboardRoutes.ts`). Public routes like `/aura` are embedded as-is.

See [DASHBOARD_ROUTES.md](../DASHBOARD_ROUTES.md) for deep-link patterns.

### PDF

Chrome → Print → Save as PDF → enable **Background graphics**. Live iframes are hidden in print layout.
