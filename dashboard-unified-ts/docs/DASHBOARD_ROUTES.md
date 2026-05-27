# Dashboard deep links

The provider dashboard syncs main navigation and open patients with the browser URL (HTML5 `history.pushState`). Existing public routes (`/aura`, `/tp`, `/debug/*`, etc.) are unchanged.

## Views

| URL | View |
|-----|------|
| `/` or `/patients` | Clients list |
| `/leads` | Leads list |
| `/kanban` | Kanban |
| `/facial-analysis` | Facial analysis cards |
| `/inbox` | Inbox |
| `/archived` | Archived |
| `/settings` | Settings |
| `/offers` | Offers |
| `/sms-history` | SMS history |
| `/admin/users` | User admin (embedded) |

## Client detail

```
/client-details/:patientId
/client-details/:patientId?view=facial-analysis
/client-details/:patientId?view=facial-analysis&section=mirror
```

| `section` | Opens |
|-----------|--------|
| `mirror` | Face mirror (default split layout) |
| `analysis` | Analysis overview modal |
| `recommender` | Treatment recommender |
| `quiz` | Skin type quiz |
| `blueprint` | Share Post-Visit Blueprint link |

`view` is optional (defaults to list). Use `facial-analysis` for Aura / 3D demo patients.

## Admin demo (local)

Log in as **Admin**, then open:

- [Tanya Tan — facial analysis + mirror](http://localhost:5173/client-details/admin-demo-tanya?view=facial-analysis&section=mirror)
- [Tanya Tan — analysis overview](http://localhost:5173/client-details/admin-demo-tanya?view=facial-analysis&section=analysis)
- [Tanya Tan — blueprint send](http://localhost:5173/client-details/admin-demo-tanya?section=blueprint)

## API (React)

```ts
const { navigateDashboard, openClient, closeClient, routeClientId, routeSection } = useDashboard();

navigateDashboard({ view: "kanban" });
openClient("recXXX", { view: "facial-analysis", section: "mirror" });
closeClient();
```

## Deploy

`public/_redirects` sends all paths to `index.html` (Netlify-style). Configure equivalent SPA fallback on other hosts.
