import type { AppearanceTheme } from "./appearance_types";

/**
 * Applies one font role (body, Header, Button) to the CSS variables.
 *
 * This is all that survived of a 293-line copy of the roster app's appearance code. The rest
 * was an `updateCssVars` plus `RGB`/`hexToRgb`/`setRGB`/`setBackground` helpers that nothing
 * imported: settingsState.ts defines and calls its own `updateCssVars`, and its own RGB and
 * hexToRgb alongside. The dead copy still spoke the roster app's colour model -- where a
 * colour is `{ colors: string[]; alpha: number }` rather than the plain string the editor
 * uses -- so it also carried twenty type errors describing a mismatch nothing could hit.
 */
export function setAppearanceFont(
  appearence: AppearanceTheme,
  key: string,
  _defaultFamily = "sans-serif",
  _defaultSize = 16,
) {
  const keyFont = `font${key}` as keyof AppearanceTheme;
  const keyFontSize = `font${key}Size` as keyof AppearanceTheme;
  const value = (appearence[keyFont] || "sans-serif") as string;

  document.documentElement.style.setProperty(`--${keyFont}`, value || _defaultFamily);
  document.documentElement.style.setProperty(`--${keyFontSize}`, (appearence[keyFontSize] || _defaultSize) + "px");
}
