# Merge: jan30 + adalo (Option B)

This folder is the result of a git-based merge of:

- **Base (main):** `jan30-draft-1/dashboard-unified-ts`
- **Branch (adalo):** `adalo-dashboard-2/dashboard-unified-ts`

Merge was done with `git merge adalo --no-ff`. The working tree is currently the merged result: adalo’s features (treatment recommender, DiscussedTreatmentsModal, AnalysisOverviewModal, etc.) are in place; jan30-only pieces were removed by the merge.

## Git history

```bash
git log --oneline
# You should see:
#   <merge commit> Merge adalo into main
#   <adalo commit> Adalo branch
#   <base commit> Base: jan30
```

- **main** = merged state (current files).
- **adalo** = full adalo tree (same as current state; no jan30-only files).
- To see jan30 again: `git show f070439:src/App.tsx` or check out that commit in a temp branch.

## What’s in this merge

- All of **adalo-dashboard-2** features (treatment recommender, DiscussedTreatmentsModal, config, debug pages, pastel-teal theme, etc.).
- All of **jan30-draft-1**-only pieces have been added and wired up:
  - `src/utils/scrollLock.ts` — body scroll lock for modals
  - `src/components/modals/OfferRequestModal.tsx` + `.css` — add/edit offer requests (used by Offers view)
  - `src/components/debug/DebugClientDetailPage.tsx` — debug route `/debug/client-detail` or `?debug=client-detail`
- **Offers view** uses jan30’s full implementation: lists offers, Add/Edit via `OfferRequestModal`, and `fetchOffers` in `api.ts`. The **Offer** type is in `src/types/index.ts`.
- No conflict markers: Git auto-resolved by taking adalo’s version where both sides differed; jan30-only files were then added manually.

## Run the app

```bash
cd dashboard-unified-ts-merged
npm install
npm run dev
```

Build:

```bash
npm run build
```

## Original folders (unchanged)

- `../jan30-draft-1/dashboard-unified-ts` — jan30 snapshot
- `../adalo-dashboard-2/dashboard-unified-ts` — adalo snapshot

Use these to compare or copy files if you want to reintroduce jan30-only pieces into this merged project.
