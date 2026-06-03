import { resolve } from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const repoRoot = resolve(__dirname, "..");
const dashboardOrigin = (
  process.env.DASHBOARD_ORIGIN || "https://adalo-dashboard-2.vercel.app"
).replace(/\/$/, "");

export default defineConfig({
  plugins: [react()],
  root: repoRoot,
  /** Deck assets are copied in `scripts/build.mjs` (not the full repo `public/`). */
  publicDir: false,
  build: {
    outDir: resolve(__dirname, "public"),
    emptyOutDir: true,
    rollupOptions: {
      input: resolve(repoRoot, "docs/presentations/clinic-demo-deck.html"),
    },
  },
  define: {
    "import.meta.env.VITE_DASHBOARD_ORIGIN": JSON.stringify(dashboardOrigin),
  },
});
