# Post-Visit Blueprint videos

Clinic-provided vertical videos for the patient-facing **Post-Visit Blueprint** page (`/post-visit-blueprint`).

- Served from the site root, e.g. `/post-visit-blueprint/videos/moxi-laser.mp4`
- **Moxi:** use **`moxi-laser.mp4`** (H.264) for Chrome/Android; `.mov` is kept as a secondary source for Safari.
- Catalog and ordering logic: `src/config/postVisitBlueprintVideos.ts`

To add or replace clips, drop files here (prefer URL-safe filenames), then update the config.

### Thumbnail / poster images (for the blueprint UI)

Static JPGs load instantly as thumbnails. Paths are set as `posterUrl` in `src/config/postVisitBlueprintVideos.ts` under `posters/`.

**Automatic (recommended):** [ffmpeg](https://ffmpeg.org/) installed, then from the repo root:

```bash
npm run extract:blueprint-posters
```

This writes `public/post-visit-blueprint/videos/posters/*.jpg` (one frame at ~1s from each MP4). Commit those files if you want them in every environment without re-running the script.

**Manual:** Export a frame in QuickTime, Premiere, etc., save as JPG in `posters/` with the same filenames as in the config, or change `posterUrl` to match your file names.

### Re-encode a `.mov` for the web (example)

```bash
ffmpeg -i moxi-laser.mov -c:v libx264 -pix_fmt yuv420p -crf 23 -c:a aac -movflags +faststart moxi-laser.mp4
```
