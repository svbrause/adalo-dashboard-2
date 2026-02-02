# PostHog analytics and session recording

The dashboard sends **analytics events** and **session recordings** to PostHog when `VITE_POSTHOG_KEY` is set in the environment.

## 1. Environment variable

- **Vercel:** Project → Settings → Environment Variables → add `VITE_POSTHOG_KEY` with your PostHog project API key.
- Get the key: [PostHog Project Settings](https://us.posthog.com/settings/project) → Project API Key.

Redeploy after adding the variable so the build picks it up.

## 2. Allow session recordings for your domain

If session recordings don't appear for **analysis.ponce.ai** (or your deployed URL), allow the domain in PostHog:

1. In PostHog: **Project settings** → **Replay** (or open [Environment & Replay](https://us.posthog.com/settings/environment-replay)).
2. Find **"Authorized domains for recordings"** (or **"Replay"** / **"Session recording"**).
3. Add your dashboard URL(s), for example:
   - `https://analysis.ponce.ai`
   - `https://dashboard-unified-ts.vercel.app`
   - (Optional) `http://localhost:5173` for local testing.

If the list is **empty**, PostHog records on all domains. If any domains are listed, only those are recorded—so **analysis.ponce.ai** must be in the list if you use a restricted list.

**Newer projects:** You may see **"Enable recordings when URL matches"** (URL trigger) instead.

### URL Trigger Regex Pattern

To record sessions from **patients.ponce.ai**, **analysis.ponce.ai**, and **cases.ponce.ai**:

**Recommended regex pattern:**

```
https://(patients|analysis|cases)\.ponce\.ai.*
```

This matches:

- `https://patients.ponce.ai` (and all paths like `/dashboard`, `/clients`, etc.)
- `https://analysis.ponce.ai` (and all paths)
- `https://cases.ponce.ai` (and all paths)

**How it works:**

- `(patients|analysis|cases)` - matches any of the three subdomains
- `\.ponce\.ai` - matches the domain (dots are escaped)
- `.*` - matches any path after the domain (e.g., `/dashboard`, `/clients/123`, etc.)

PostHog automatically wraps your regex with `^` and `$` anchors, so you don't need to include them.

**Alternative: Record everything**
If you want to record sessions from **all domains** (not just these three), you can either:

- Leave the URL trigger empty/unset (if your PostHog plan allows)
- Use a broader pattern like `https://.*\.ponce\.ai.*` to match all ponce.ai subdomains

## 3. What's sent

- **Session recording:** Enabled by default (no `disable_session_recording` in code).
- **Page views / page leave:** Captured automatically.
- **Events:** `dashboard_viewed`, `user_logged_out`, plus `identify` on provider login.

No code changes are required for session recording beyond deploying with `VITE_POSTHOG_KEY` set and adding **analysis.ponce.ai** (and any other domains) in PostHog's replay/authorized-domains settings as above.
