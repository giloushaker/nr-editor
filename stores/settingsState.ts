import { defineStore } from "pinia";
import { setAppearanceFont } from "~/assets/shared/appearance";
import { AppearanceTheme } from "~/assets/shared/types/appearance";
import merge from "lodash.merge";
export interface RGB {
  r: number;
  g: number;
  b: number;
}

function hexToRgb(hex: string): RGB | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16),
    }
    : null;
}

export async function updateCssVars(appearence: AppearanceTheme, algo: { unitColor?: any; armyColor?: any }) {
  if (appearence.background) {
    const bgRgb = hexToRgb(appearence.background);
    document.documentElement.style.setProperty(`--bg`, appearence.background);
    document.documentElement.style.setProperty(`--popups_background`, appearence.background);

    if (bgRgb != null) {
      for (const field in bgRgb) {
        document.documentElement.style.setProperty(`--bg-${field}`, `${bgRgb[field as keyof typeof bgRgb]}`);
      }
    }
  }

  if (appearence.title) {
    const titleRgb = hexToRgb(appearence.title);
    if (titleRgb != null) {
      for (const field in titleRgb) {
        document.documentElement.style.setProperty(`--title-${field}`, `${titleRgb[field as keyof typeof titleRgb]}`);
      }
    }
  }
  if (appearence.forcesBackground) {
    document.documentElement.style.setProperty(`--forces_background`, appearence.forcesBackground);
  } else if (appearence.title) {
    document.documentElement.style.setProperty(`--forces_background`, appearence.title);
    appearence.forcesBackground = appearence.title;
  }

  if (appearence.highlight) {
    const titleRgb = hexToRgb(appearence.highlight);
    if (titleRgb != null) {
      for (const field in titleRgb) {
        document.documentElement.style.setProperty(`--highlight-${field}`, `${titleRgb[field as keyof typeof titleRgb]}`);
      }
    }
  }

  if (appearence.borderColor) {
    document.documentElement.style.setProperty(`--box-border`, `${appearence.borderColor}`);
  }

  let filter = "";
  if (appearence.invertColors == true) {
    filter = "invert(100)";
  } else if (appearence.invertImages) {
    filter = "";
  } else {
    filter = "invert(0)";
  }

  if (appearence.hue) {
    filter += ` hue-rotate(${appearence.hue}deg)`;
  }

  if (navigator.userAgent.toLowerCase().indexOf("firefox") > -1) {
    document.documentElement.style.setProperty(`--global-filter`, "none");
  } else {
    document.documentElement.style.setProperty(`--global-filter`, filter);
  }

  if (appearence.backgroundTexture) {
    document.documentElement.style.setProperty(`--bg-texture`, appearence.backgroundTexture);
  }

  if (appearence.backgroundSize) {
    document.documentElement.style.setProperty(`--backgroundSize`, appearence.backgroundSize);
  }

  if (appearence.inputRadius) {
    document.documentElement.style.setProperty(`--input-radius`, appearence.inputRadius + "px");
  }

  if (appearence.inputBackground) {
    document.documentElement.style.setProperty(`--input-background`, appearence.inputBackground);
  }

  if (algo.unitColor) {
    document.documentElement.style.setProperty(`--color-unit`, algo.unitColor);
  }

  if (algo.armyColor) {
    document.documentElement.style.setProperty(`--color-army`, algo.armyColor);
  }

  if (appearence.fontColor) {
    document.documentElement.style.setProperty(`--font-color`, appearence.fontColor);
  }

  document.documentElement.style.setProperty(`--italic`, appearence.italic ?? "italic");

  if (appearence.colorGray) {
    document.documentElement.style.setProperty(`--color-gray`, appearence.colorGray);
  }

  if (appearence.colorRed) {
    document.documentElement.style.setProperty(`--color-red`, appearence.colorRed);
  }

  if (appearence.colorGreen) {
    document.documentElement.style.setProperty(`--color-green`, appearence.colorGreen);
  }

  if (appearence.colorBlue) {
    document.documentElement.style.setProperty(`--color-blue`, appearence.colorBlue);
  }

  if (appearence.colorLightblue) {
    document.documentElement.style.setProperty(`--color-lightblue`, appearence.colorLightblue);
  }

  if (appearence.bga) {
    let fontColor = Number(appearence.bga);
    if (fontColor > 1) {
      fontColor /= 100;
    }
    document.documentElement.style.setProperty(`--bg-a`, `${fontColor}`);
  }

  if (appearence.invertImagesBrightness) {
    const deg = 180 * (Number(appearence.invertImagesBrightness) / 100);
    document.documentElement.style.setProperty(
      `--image-filter`,
      `invert(${appearence.invertImagesBrightness}%) hue-rotate(${deg}deg)`
    );
  } else if (appearence.invertImages) {
    document.documentElement.style.setProperty(`--image-filter`, "invert(100%) hue-rotate(180deg)");
  } else {
    document.documentElement.style.setProperty(`--image-filter`, "");
  }

  if (appearence.costColor) {
    const fontColor = appearence.costColor;
    document.documentElement.style.setProperty(`--cost-color`, fontColor);
  }

  setAppearanceFont(appearence, "");
  setAppearanceFont(appearence, "Header");
  setAppearanceFont(appearence, "Button");
  document.documentElement.style.setProperty(`--fontHeaderTransform`, appearence.headerTransform);

  if (appearence.inputHighlights) {
    const fontColor = appearence.inputHighlights;
    document.documentElement.style.setProperty(`--input-highlights`, fontColor);
  }

  if (appearence.dark) {
    document.documentElement.style.setProperty(`--hover-brighten-color`, "rgba(0, 0, 0, 0.15)");
    document.documentElement.style.setProperty(`--hover-darken-color`, "rgba(255, 255, 255, 0.15)");
  } else {
    document.documentElement.style.setProperty(`--hover-darken-color`, "rgba(0, 0, 0, 0.15)");
    document.documentElement.style.setProperty(`--hover-brighten-color`, "rgba(255, 255, 255, 0.15)");
  }

  if (appearence.titleBarColor) {
    document.documentElement.style.setProperty(`--titleBarColor`, appearence.titleBarColor);
  }
}

export const defaultAppearence: AppearanceTheme = {
  background: "#f0f5ff",
  backgroundTexture: "url(assets/images/no.jpg)",
  backgroundSize: "auto",
  bga: 70,
  hue: 0,

  title: "#8ecff0",
  forcesBackground: "#dcd189",
  highlight: "#fffef1",

  dropdownStyle: 2,
  inputRadius: 0,
  inputBackground: "#ffffff",
  inputHighlights: "#add8e6",

  categoryIcons: true,
  costsLeft: false,
  invertColors: false,
  invertImages: false,
  invertImagesBrightness: 0,

  font: "sans-serif",
  fontSize: 16,
  fontHeader: "sans-serif",
  fontHeaderSize: 16,
  headerTransform: "none",
  fontButton: "sans-serif",
  fontButtonSize: 16,

  fontColor: "black",
  borderColor: "#aaaaaa",
  colorGray: "gray",
  colorBlue: "#0f59ba",
  colorRed: "#e64e4e",
  colorGreen: "#439943",
  colorLightblue: "#009cbd",
  costColor: "#284781",
  titleBarColor: "#708090",
  unitsBackground: "",
  fitBackground: false,
  hoverColor: ""
};
const defaultSortConfiguration = `type:model
type:mount
type:crew
type:upgrade
type:entry
type:group & name:/mount/i
type:group & name:/weapons/i
type:group & name:/armour/i
type:group & name:/equipment/i
type:group & name:/items/i
type:group & name:/options/i
type:group
cost:pts
cost:points
name`;

const defaultState = {
  systemsFolder: "" as string | undefined,
  showOnlyEnabledCategories: false,
  globalDuplicateIdError: false,
  useNewCategoriesUI: false,
  sort: "asc" as string,
  theme: "" as "" | "dark" | "light",
  githubAutoIncrement: true,
  autosort: {
    config: defaultSortConfiguration,
  },
  display: {
    sortIndex: true,
    references: true,
    costs: true,
  },
  autoFormatCharacteristics: false,
  autoRenameInfoLinkParent: false,
};
export const useSettingsStore = defineStore("settings", {
  state: () => ({ ...defaultState }),

  persist: {
    storage: globalThis.localStorage,
    deserialize(text: string) {
      const parsed = JSON.parse(text);
      return merge(parsed, defaultState);
    },
    serialize: JSON.stringify,
  } as any, // It makes an error without any but it works fine so idc.
  getters: {
    isDarkTheme(): boolean {
      return this.theme === "dark";
    },
  },
  actions: {
    getDefaultAppareance(): AppearanceTheme {
      if (this.theme === "dark") {
        return {
          ...defaultAppearence,
          background: "#2b2b2b",
          bga: "100",
          borderColor: "#5e5e5e",
          colorGray: "#737283" || "#76909f",
          colorBlue: "#2d9ce1",
          colorRed: "#c74343",
          costColor: "#5dabdf",
          dropdownStyle: 2,
          fontColor: "#ababab",
          inputBackground: "#333333",
          inputHighlights: "#add8e6",
          invertImagesBrightness: "85",
          titleBarColor: "#525252",
          title: "#333333",
          dark: true,
          // font: "Bahnschrift",
          // fontButton: "Bahnschrift",
          // fontHeader: "Bahnschrift",
        };
      } else {
        return defaultAppearence;
      }
    },
    setTheme(theme: "" | "dark" | "light") {
      this.theme = theme;
      this.refreshAppearance();
    },
    refreshAppearance() {
      updateCssVars(this.getDefaultAppareance(), {});
    },
    init() {
      if (!this.display) {
        this.display = {
          sortIndex: true,
          references: true,
          costs: true,
        };
      }
    },
  },
});
