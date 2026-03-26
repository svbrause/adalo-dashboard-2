# Dr. Reddy video thumbnails

Place the generated thumbnail images here so the app can use them for the 16 video cases. Name them exactly: `video-reddy-1.png` … `video-reddy-16.png`.

---

## Option 1: Canva (recommended – faster, higher fidelity)

- **`CANVA-AI-PROMPTS.md`** – Ready-to-paste prompts for **Canva’s AI thumbnail generator**. One prompt per video; upload Dr. Reddy’s photo as a reference so the AI uses his face. Easiest if you want AI to do the layout.
- **`CANVA-BRIEF.md`** – Manual template approach: dimensions (1280×720), styles (black panel + key-word banner, stacked banners, etc.), and copy for all 16. Duplicate one design 16 times and swap text.
- **`thumbnail-copy.csv`** – Same copy in CSV form for quick paste or bulk use.

Export each thumbnail as PNG, 1280×720, with the exact names above, and drop the files here.

---

## Option 2: In-app thumbnail editor (edit + export)

Open **http://localhost:5173/wellnest/thumbnail-editor.html** (with the dev server running). You get:

- **16 slides**, one per video, with Wellnest colors and layouts (black panel + mint banner, stacked banners, or colored panel).
- **Zoomed Dr. Reddy photo**, wider text panel, and larger type (no vial images).
- **Editable text** – click any text on a slide to edit it.
- **Banner color** – use the color picker under each slide to change the mint accent.
- **Export** – click “Export video-reddy-N.png” to download that slide as a 1280×720 PNG. Save the file into this folder so the app uses it.

No Canva or external tool required; edit and export in the browser.

---

## Option 3: HTML generator (quick preview / fallback)

1. Run the dev server and open: **http://localhost:5173/wellnest/thumbnail-generator.html**
2. Click **Download** on each of the 16 thumbnails.
3. Save each file into this folder with the exact name shown.

Once the PNGs are in place, the Wellnest case cards and detail view will use them automatically.
