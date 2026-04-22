# Dashboard style guide — mint, gray, white, black

This document captures the **Pastel Teal & Gray** palette used when `pastel-teal-theme` is on the document body (see `src/App.tsx` and `src/styles/pastel-teal-theme.css`). Use it to match another app to the same look.

---

## Source of truth in this repo

| File | Role |
|------|------|
| `src/styles/pastel-teal-theme.css` | Active theme overrides (mint/teal + cool grays) |
| `src/styles/index.css` (`:root`) | Shared layout tokens: radii, spacing, font scale, plan-pricing colors |

Base `:root` in `index.css` defines a **Lakeshore** warm theme; it is **overridden** by `.pastel-teal-theme` for the live dashboard.

---

## Core palette

### Mint / teal (primary brand)

| Token / name | Hex | Usage |
|--------------|-----|--------|
| **Teal primary** | `#367588` | Primary buttons, accent, logo fallback, key CTAs |
| **Teal hover / pressed** | `#2c5f6b` | Hover states for primary actions |
| **Pastel teal surface** | `#e6f3f7` | Active nav item background |
| **Teal border (nav active)** | `#367588` | Active nav left border |
| **Teal tints** | `rgba(54, 117, 136, 0.1)` … `0.3` | Overlays, subtle fills |
| **Nav hover wash** | `rgba(54, 117, 136, 0.08)` | Sidebar row hover |

### Grays (text, borders, sections)

| Token / name | Hex | Usage |
|--------------|-----|--------|
| **Text primary** | `#111827` | Headings, main body |
| **Text secondary / muted** | `#6B7280` | Secondary labels, meta |
| **Border default** | `#E5E7EB` | Cards, dividers, inputs |
| **Border hover** | `#D1D5DB` | Stronger border on hover (optional) |
| **Page background (top)** | `#f8f9fa` | Gradient start |
| **Section wash** | `#F3F4F6` | Gradient middle |

### White

| Hex | Usage |
|-----|--------|
| `#ffffff` | Card/sidebar/header surfaces, gradient end |

### Black / near-black

| Hex | Usage |
|-----|--------|
| `#111827` | Primary text (near-black, not pure `#000`) |
| `rgba(0, 0, 0, 0.05)` … `0.15` | Shadows, dropdown depth (see components) |
| `#000000` | **Not** the default primary button in this theme — primary actions use **teal** (`#367588`). Pure black still appears in some full-bleed areas (e.g. login banner) and generic shadows. |

---

## Page background

Default body background is a **vertical gradient** (cool gray → white):

```text
linear-gradient(180deg, #f8f9fa 0%, #f3f4f6 50%, #ffffff 100%)
```

`background-attachment: fixed` is used in `index.css` for a stable scroll feel.

---

## CSS variables (drop-in)

These are the variables set under `.pastel-teal-theme` plus the extra aliases at the bottom of `pastel-teal-theme.css`:

```css
.pastel-teal-theme {
  --theme-accent: #367588;
  --theme-accent-hover: #2c5f6b;
  --theme-primary-btn: #367588;
  --theme-primary-btn-hover: #2c5f6b;

  --theme-bg-gradient: linear-gradient(180deg, #f8f9fa 0%, #f3f4f6 50%, #ffffff 100%);
  --theme-bg-card: #ffffff;

  --theme-border: #E5E7EB;
  --theme-text-primary: #111827;
  --theme-text-secondary: #6B7280;
  --theme-text-muted: #6B7280;

  --theme-shadow: rgba(54, 117, 136, 0.06);
  --theme-shadow-hover: rgba(54, 117, 136, 0.12);

  --theme-nav-active-bg: #e6f3f7;
  --theme-nav-active-border: #367588;
  --theme-nav-hover-bg: rgba(54, 117, 136, 0.08);

  --teal-primary: #367588;
  --teal-secondary: #2c5f6b;
  --teal-pastel-bg: #e6f3f7;
  --teal-tint-10: rgba(54, 117, 136, 0.1);
  --teal-tint-20: rgba(54, 117, 136, 0.2);
  --teal-tint-30: rgba(54, 117, 136, 0.3);
  --gray-page-bg: #f8f9fa;
  --gray-section-bg: #F3F4F6;
  --gray-border: #E5E7EB;
  --gray-border-hover: #D1D5DB;
}
```

Shared **radius / spacing / type scale** (from `:root` in `index.css`) — reuse for consistency:

```css
:root {
  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 16px;
  --radius-pill: 999px;

  --space-xs: 4px;
  --space-sm: 8px;
  --space-md: 12px;
  --space-lg: 16px;
  --space-xl: 24px;
  --space-2xl: 32px;

  --font-xs: 0.72rem;
  --font-sm: 0.82rem;
  --font-base: 0.9rem;
  --font-md: 1rem;
  --font-lg: 1.05rem;

  --theme-heading-font: "Montserrat", sans-serif;
}
```

**Typography:** UI font stack is Montserrat first, then system UI sans-serifs (`index.css` `body` rule).

---

## Related “success mint” accents (forms & pricing)

Some modals and the treatment recommender use **Tailwind-style teals** as fallbacks when variables are missing (e.g. `#0d9488` / `#0f766e` for accent and success). If you need one extra accent for “success / fix” rows, align with:

- Accent: `#0d9488`  
- Accent hover: `#0f766e`  
- Success-tint background: `#ecfdf5`  

(Defined in `:root` as plan-pricing tokens in `index.css`.)

---

## Porting checklist

1. Set **primary** to `#367588` and **hover** to `#2c5f6b` (not black) for main buttons.  
2. Use **near-black** `#111827` for primary text and **#6B7280** for secondary.  
3. Use **#E5E7EB** borders and **#ffffff** surfaces.  
4. Apply the **gray → white** page gradient or at least `#f8f9fa` / `#F3F4F6` section backgrounds.  
5. For navigation, mirror **pastel active** `#e6f3f7` + **teal** `#367588` border.  
6. Prefer **Montserrat** for headings if you want a literal match.

---

## Optional: Tailwind 3+ theme snippet

```js
// tailwind.config.js — extend.colors excerpt
colors: {
  brand: {
    DEFAULT: '#367588',
    dark: '#2c5f6b',
    pastel: '#e6f3f7',
  },
  ink: {
    DEFAULT: '#111827',
    muted: '#6B7280',
  },
  surface: {
    page: '#f8f9fa',
    section: '#F3F4F6',
    card: '#ffffff',
  },
  line: {
    DEFAULT: '#E5E7EB',
    strong: '#D1D5DB',
  },
},
```

This guide is derived from the dashboard as of the `pastel-teal-theme` implementation; individual screens may still contain legacy hex values—prefer the variables above for new work.
