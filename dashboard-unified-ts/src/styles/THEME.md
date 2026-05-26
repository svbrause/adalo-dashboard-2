# Dashboard theme tokens

All UI colors should come from **`src/styles/theme-tokens.css`**, not hardcoded hex values. Light and dark schemes are defined once; toggling dark mode only remaps CSS variables on `body.dark-mode`.

## How dark mode works

1. `DashboardContext` adds `dark-mode` to `<document.body>` when the user enables dark mode.
2. `theme-tokens.css` redefines every `--theme-*` variable under `body.dark-mode`.
3. Components that use `var(--theme-…)` update automatically.

## Rules for new CSS

| Do | Don't |
|----|--------|
| `color: var(--theme-text-primary)` | `color: #212121` |
| `background: var(--theme-bg-card)` | `background: white` |
| `border: 1px solid var(--theme-border)` | `border: 1px solid #e8e8e8` |
| Semantic aliases: `var(--color-text-heading)` | Copy-paste light/dark hex in two places |

If something still looks wrong in dark mode, **add or fix a token** in `theme-tokens.css` rather than adding `body.dark-mode .my-screen { … }` overrides (unless patching legacy hardcoded CSS).

## Token reference

### Text

| Token | Use for |
|-------|---------|
| `--color-text-heading` / `--theme-text-primary` | Titles, names, primary content |
| `--color-text-body` | Body copy, field values |
| `--theme-text-secondary` | Secondary emphasis |
| `--color-text-label` / `--theme-text-muted` | Labels, captions, hints |
| `--theme-text-link` | Links |

### Backgrounds

| Token | Use for |
|-------|---------|
| `--theme-bg-page` | App shell / page |
| `--theme-bg-card` | Cards, modals, header bars |
| `--theme-bg-subtle` | Table headers, footer bars, toolbars |
| `--theme-bg-hover` | Hover states |
| `--theme-bg-inset` | Nested boxes (e.g. pre-filled info, inset panels) |
| `--theme-bg-overlay` | Modal scrim |

### Borders & shadows

| Token | Use for |
|-------|---------|
| `--theme-border` | Default borders |
| `--theme-border-subtle` | Dividers, light separation |
| `--theme-shadow` / `--theme-shadow-hover` | Elevation |

### Status pills & chips

| Token | Use for |
|-------|---------|
| `--theme-status-success-*` | Built, complete, on |
| `--theme-status-warning-*` | Pending |
| `--theme-status-info-*` | Ready for review (blue) or use success for green |
| `--theme-status-danger-*` | Off, error |
| `--theme-status-muted-*` | Not started, inactive |
| `--theme-chip-*` | Interest tags, purple chips |

Each status has `-bg`, `-fg`, and `-border`.

### Tables

| Token | Use for |
|-------|---------|
| `--theme-table-header-bg` | `<thead>` |
| `--theme-table-header-text` | Header cell text |
| `--theme-table-row-hover` | Row hover |
| `--theme-table-border` | Cell borders |

### Forms

| Token | Use for |
|-------|---------|
| `--theme-input-bg` | Inputs, selects, textareas |
| `--theme-input-border` | Input borders |
| `--theme-btn-secondary-*` | Secondary buttons |

### Accent indigo (3D scan, face mirror)

| Token | Use for |
|-------|---------|
| `--theme-accent-indigo-fg` | Text on tinted indigo buttons (Generate 3D Scan) |
| `--theme-accent-indigo-bg` / `-bg-hover` | Soft indigo button backgrounds |
| `--theme-accent-indigo-border` | Outlined indigo controls |
| `--theme-accent-indigo-solid` | Filled primary actions (Start 3D Scan) |

## Files

| File | Role |
|------|------|
| `theme-tokens.css` | **Source of truth** — light `:root` + base element hooks |
| `pastel-teal-theme.css` | Light-only brand overrides (`:not(.dark-mode)`) |
| `theme-dark-vars.css` | Dark token remaps (imported after pastel-teal) |
| `dark-theme.css` | Legacy per-component patches (shrink over time) |
| `index.css` | Imports tokens first; layout scale tokens (`--radius-*`, `--space-*`) |

## Migrating legacy screens

1. Replace hardcoded colors with the closest token.
2. Remove redundant `body.dark-mode .component` rules if tokens handle it.
3. If no token fits, add one pair (light in `:root`, dark in `body.dark-mode`) in `theme-tokens.css`.
