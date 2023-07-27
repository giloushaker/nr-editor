import { defineStore } from "pinia";
import { updateCssVars } from "~/assets/shared/js/util";
import { AppearanceTheme } from "~/assets/shared/types/appearance";
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
  invertImagesBrightness: "0",

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
};
export const useSettingsStore = defineStore("settings", {
  state: () => ({
    systemsFolder: "" as string | undefined,
    showOnlyEnabledCategories: false,
    globalDuplicateIdError: false,
    sort: "asc" as string,
    theme: "" as "" | "dark" | "light",
    githubAutoIncrement: true,
  }),

  persist: {
    storage: globalThis.localStorage,
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
          lightblue: "#009cbd",
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
  },
});
