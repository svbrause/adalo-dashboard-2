# Staging Deployment (analysis.ponce.ai unchanged)

Use the **staging-dashboard** branch to share a test version without affecting production at **analysis.ponce.ai**.

## Branch

- **Branch name:** `staging-dashboard`
- **Production (unchanged):** `main` → analysis.ponce.ai

## 1. Push the staging branch (if not already)

```bash
# From repo root (parent of dashboard-unified-ts)
git checkout staging-dashboard
git push -u origin staging-dashboard
```

## 2. Get a staging URL in Vercel

### Option A: Use automatic Preview Deployment (simplest)

1. In **Vercel Dashboard** → your project (the one that deploys analysis.ponce.ai).
2. After you push `staging-dashboard`, Vercel creates a **Preview Deployment** for that branch.
3. Open **Deployments** → click the deployment for branch `staging-dashboard`.
4. Copy the **Preview URL** (e.g. `dashboard-unified-ts-git-staging-dashboard-xxx.vercel.app`).
5. Share that URL for testing. Each new push to `staging-dashboard` updates this preview.

Production (main → analysis.ponce.ai) is unchanged; only the branch you push gets the new build.

### Option B: Stable staging URL (e.g. staging-analysis.ponce.ai)

1. In **Vercel** → Project **Settings** → **Git**.
2. Confirm **Production Branch** is `main` (so analysis.ponce.ai stays on main).
3. Go to **Settings** → **Domains**.
4. Click **Add** and enter a domain (e.g. `staging-analysis.ponce.ai`).
5. When asked which branch to assign, choose **staging-dashboard**.
6. Finish DNS (add the CNAME record Vercel shows).  
   After DNS propagates, that domain always serves the latest `staging-dashboard` build.

## 3. Deploying updates to staging only

```bash
git checkout staging-dashboard
# make changes, then:
git add .
git commit -m "Staging: your change description"
git push origin staging-dashboard
```

Vercel will redeploy only the preview for `staging-dashboard`; **main** and analysis.ponce.ai stay the same.

## 4. Promoting staging to production (when ready)

```bash
git checkout main
git pull origin main
git merge staging-dashboard
git push origin main
```

Then in Vercel, the next production deployment will be from `main` (analysis.ponce.ai).

---

**Summary:** Push `staging-dashboard`, use the preview URL from Vercel (or a custom staging domain). Keep using `main` for analysis.ponce.ai so production is never broken by staging work.
