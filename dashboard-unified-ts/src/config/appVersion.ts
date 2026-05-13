/** Shown in the UI; value comes from `package.json` at build (see vite.config.ts). */
export const APP_VERSION_LABEL = (() => {
  const v = import.meta.env.VITE_APP_VERSION?.trim();
  return v ? `v${v}` : "v2.5.2";
})();
