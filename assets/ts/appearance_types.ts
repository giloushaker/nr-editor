/**
 * The editor's theme shape.
 *
 * Was a byte-for-byte copy of assets/shared/types/appearance.ts, which is the roster app's
 * model: there a colour is an `AppearanceColor` ({ colors: string[]; alpha: number }) because
 * it renders multi-stop gradients behind a list. The editor only ever writes plain CSS colour
 * strings, so every theme it defines failed to match its own declared type, and settingsState
 * carried seven errors saying so.
 *
 * Nothing shares this. assets/shared keeps its own copy for nuxt-nr, which still uses it.
 *
 * Fields are optional where the dark theme omits them or updateCssVars guards the read.
 */
export interface AppearanceTheme {
  /** Page background colour. */
  background: string;
  /** Background image, as a full CSS `url(...)` value. */
  backgroundTexture: string;
  backgroundSize: string;
  /** Background alpha, 0-100. Written as a number by the default theme and a string by dark. */
  bga: number | string;
  hue: number;

  title: string;
  forcesBackground: string;
  unitsBackground: string;
  highlight: string;
  hoverColor: string;

  dropdownStyle: number;
  inputRadius: number;
  inputBackground: string;
  inputHighlights: string;

  categoryIcons: boolean;
  costsLeft: boolean;
  invertColors: boolean;
  invertImages: boolean;
  /** Brightness percentage applied to inverted images; same number/string split as bga. */
  invertImagesBrightness: number | string;
  fitBackground: boolean;

  font: string;
  fontSize: number;
  fontHeader: string;
  fontHeaderSize: number;
  headerTransform: string;
  fontButton: string;
  fontButtonSize: number;
  italic?: "italic" | "normal";

  fontColor: string;
  borderColor: string;
  colorGray: string;
  colorBlue: string;
  colorRed: string;
  colorGreen: string;
  colorLightblue: string;
  costColor: string;
  titleBarColor: string;

  /** Set only by the dark theme; updateCssVars branches on it. */
  dark?: boolean;

  fontColorUnits?: string;
  fontColorTitle?: string;
  fontColorForces?: string;

  /** Optional Material accent roles; vars.scss derives them from inputHighlights when unset. */
  materialSecondary?: string;
  materialTertiary?: string;
}
