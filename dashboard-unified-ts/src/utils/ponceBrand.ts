import ponceLogoLight from "../assets/images/Group611.png";

/** Wordmark for dark backgrounds (dashboard dark mode). */
export const PONCE_LOGO_DARK_SRC = "/demo-3d/dark_mode_logo.png";

export const PONCE_LOGO_LIGHT_SRC: string = ponceLogoLight;

export function ponceLogoSrc(darkMode: boolean): string {
  return darkMode ? PONCE_LOGO_DARK_SRC : PONCE_LOGO_LIGHT_SRC;
}
