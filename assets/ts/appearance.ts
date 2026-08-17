import { AppearanceTheme } from "./appearance_types";

export interface RGB {
  r: number;
  g: number;
  b: number;
}

function first(arr: string | string[]) {
  return Array.isArray(arr) ? arr[0] : arr;
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

function setRGB(id: string, color: string) {
  const titleRgb = hexToRgb(color);
  if (titleRgb != null) {
    for (const field in titleRgb) {
      document.documentElement.style.setProperty(`${id}-${field}`, (titleRgb as any)[field]);
    }
  }
}

function setBackground(id: string, colors: string[], backgroundAlpha: number): void {
  const convertToRgba = (color: string, alpha: number): string => {
    if (color.startsWith("#")) {
      // Convert hex to rgba
      const r = parseInt(color.slice(1, 3), 16);
      const g = parseInt(color.slice(3, 5), 16);
      const b = parseInt(color.slice(5, 7), 16);
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
    return color; // Return the original color if it's not in hex format
  };

  if (!colors) {
    return;
  }

  if (colors.length == 1) {
    // If colors is a string, set only the `--${id}` variable to that color with alpha
    const rgbaColor = convertToRgba(colors[0], backgroundAlpha / 100);
    document.documentElement.style.setProperty(`--${id}`, `linear-gradient(${rgbaColor}, ${rgbaColor})`);
  } else if (Array.isArray(colors)) {
    // If colors is an array, construct a linear gradient from the colors with alpha
    const gradient = `linear-gradient(to right, ${colors
      .map((color) => convertToRgba(color, backgroundAlpha / 100))
      .join(", ")})`;
    document.documentElement.style.setProperty(`--${id}`, gradient);
  }
}

export function updateCssVars(appearence: AppearanceTheme) {
  if (appearence.background) {
    setBackground("bg", appearence.background.colors, appearence.background.alpha);
    setBackground("popups_background", appearence.background.colors, 100);
    // plain color for the --surface token; --bg itself is a gradient, unusable in color-mix
    if (appearence.background.colors?.[0]) {
      document.documentElement.style.setProperty(`--surface-color`, appearence.background.colors[0]);
    }
  }

  if (appearence.title) {
    setBackground("title", appearence.title.colors, appearence.title.alpha);
    setBackground("popups_header", appearence.title.colors, 100);
  }

  if (appearence.forcesBackground) {
    setBackground("forces_background", appearence.forcesBackground.colors, appearence.forcesBackground.alpha);
  } else if (appearence.title) {
    setBackground("forces_background", appearence.title.colors, appearence.title.alpha);
    appearence.forcesBackground = appearence.title;
  }

  if (appearence.unitsBackground) {
    setBackground("units_background", appearence.unitsBackground.colors, appearence.unitsBackground.alpha);
  }

  if (appearence.costsBackground) {
    setBackground("costs_background", appearence.costsBackground.colors, appearence.costsBackground.alpha);
  }

  document.documentElement.style.setProperty(`--font-color-units`, appearence.fontColor);
  document.documentElement.style.setProperty(`--font-color-title`, appearence.fontColor);
  document.documentElement.style.setProperty(`--font-color-forces`, appearence.fontColor);

  /*   if (appearence.fontColorUnits) {
    document.documentElement.style.setProperty(`--font-color-units`, appearence.fontColorUnits);
  } else {
    document.documentElement.style.setProperty(`--font-color-units`, appearence.fontColor);
  }

  if (appearence.fontColorTitle) {
    document.documentElement.style.setProperty(`--font-color-title`, appearence.fontColorTitle);
  } else {
    document.documentElement.style.setProperty(`--font-color-title`, appearence.fontColor);
  }

  if (appearence.fontColorForces) {
    document.documentElement.style.setProperty(`--font-color-forces`, appearence.fontColorForces);
  } else {
    document.documentElement.style.setProperty(`--font-color-forces`, appearence.fontColor);
  } */

  if (appearence.highlight) {
    const titleRgb = hexToRgb(appearence.highlight);
    if (titleRgb != null) {
      for (const field in titleRgb) {
        document.documentElement.style.setProperty(`--highlight-${field}`, (titleRgb as any)[field]);
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
    let textureUrl = appearence.backgroundTexture;

    // Check if it's an API URL that needs the base URL prefix
    const apiBaseUrl = document.documentElement.style.getPropertyValue("--api-base-url");

    if (apiBaseUrl && apiBaseUrl.length && textureUrl.includes("url(/api/")) {
      // Replace url(/api/ with url(${apiBaseUrl}/api/
      textureUrl = textureUrl.replace(/url\(\/api\//g, `url(${apiBaseUrl}/api/`);
    }

    document.documentElement.style.setProperty(`--bg-texture`, textureUrl);
  }

  if (appearence.fitBackground) {
    document.documentElement.style.setProperty(`--backgroundRepeat`, "no-repeat");
    document.documentElement.style.setProperty(`--backgroundSize`, "cover");
    document.documentElement.style.setProperty(`--backgroundPosition`, "center");
  } else {
    document.documentElement.style.setProperty(`--backgroundRepeat`, "repeat");
    document.documentElement.style.setProperty(`--backgroundSize`, "");
    document.documentElement.style.setProperty(`--backgroundPosition`, "");
  }

  if (appearence.inputRadius) {
    document.documentElement.style.setProperty(`--input-radius`, appearence.inputRadius + "px");
  }

  if (appearence.inputBackground) {
    document.documentElement.style.setProperty(`--input-background`, appearence.inputBackground);
  }

  if (appearence.hoverColor) {
    setBackground("hover-color", appearence.hoverColor.colors, appearence.hoverColor.alpha);
    setBackground("popups-hover", appearence.hoverColor.colors, 100);
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

  if (appearence.invertImagesBrightness) {
    const invertImagesBrightness = parseInt(`${appearence.invertImagesBrightness}`);
    const deg = 180 * (invertImagesBrightness / 100);
    document.documentElement.style.setProperty(
      `--image-filter`,
      `invert(${appearence.invertImagesBrightness}%) hue-rotate(${deg}deg)`,
    );
    if (invertImagesBrightness > 50) {
      document.firstElementChild?.classList.add("dark");
      appearence.dark = true;
    } else {
      document.firstElementChild?.classList.remove("dark");
      appearence.dark = false;
    }
  } else if (appearence.invertImages) {
    document.documentElement.style.setProperty(`--image-filter`, "invert(100%) hue-rotate(180deg)");
  } else {
    document.documentElement.style.setProperty(`--image-filter`, "");
  }

  if (appearence.dark) {
    document.documentElement.style.setProperty(`--checkbox-background`, "white");
  } else {
    document.documentElement.style.setProperty(`--checkbox-background`, appearence.inputHighlights);
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

  // optional Material accents; removed when unset so the token defaults derived from the primary accent apply
  if (appearence.materialSecondary) {
    document.documentElement.style.setProperty(`--color-secondary`, appearence.materialSecondary);
  } else {
    document.documentElement.style.removeProperty(`--color-secondary`);
  }
  if (appearence.materialTertiary) {
    document.documentElement.style.setProperty(`--color-tertiary-accent`, appearence.materialTertiary);
  } else {
    document.documentElement.style.removeProperty(`--color-tertiary-accent`);
  }

  if (appearence.dark) {
    document.documentElement.style.setProperty(`--hover-brighten-color`, "rgba(0, 0, 0, 0.15)");
    document.documentElement.style.setProperty(`--hover-darken-color`, "rgba(255, 255, 255, 0.15)");
    document.documentElement.style.setProperty(`--hover-slightly-darken-color`, "rgba(255, 255, 255, 0.05)");
    document.documentElement.style.setProperty(`--hover-brighten-pct`, "85%");
    document.documentElement.style.setProperty(`--hover-darken-pct`, "110%");
  } else {
    document.documentElement.style.setProperty(`--hover-darken-color`, "rgba(0, 0, 0, 0.15)");
    document.documentElement.style.setProperty(`--hover-slightly-darken-color`, "rgba(0, 0, 0, 0.05)");
    document.documentElement.style.setProperty(`--hover-brighten-color`, "rgba(255, 255, 255, 0.15)");
    document.documentElement.style.setProperty(`--hover-darken-pct`, "85%");
    document.documentElement.style.setProperty(`--hover-brighten-pct`, "110%");
  }

  if (appearence.titleBarColor) {
    document.documentElement.style.setProperty(`--titleBarColor`, appearence.titleBarColor);
  }
}

export function setAppearanceFont(
  appearence: AppearanceTheme,
  key: string,
  _defaultFamily = "sans-serif",
  _defaultSize = 16,
) {
  const keyFont = `font${key}` as keyof AppearanceTheme;
  const keyFontSize = `font${key}Size` as keyof AppearanceTheme;
  let value = (appearence[keyFont] || "sans-serif") as string;

  document.documentElement.style.setProperty(`--${keyFont}`, value || _defaultFamily);
  document.documentElement.style.setProperty(`--${keyFontSize}`, (appearence[keyFontSize] || _defaultSize) + "px");
}
