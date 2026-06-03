import ponceLogoLight from "../assets/images/Group611.png";

/** Wordmark for dark backgrounds (dashboard dark mode). Served from public/branding. */
export const PONCE_LOGO_DARK_SRC = "/branding/ponce-dark-mode.png";

export const PONCE_LOGO_LIGHT_SRC: string = ponceLogoLight;

export function ponceLogoSrc(darkMode: boolean): string {
  return darkMode ? PONCE_LOGO_DARK_SRC : PONCE_LOGO_LIGHT_SRC;
}
