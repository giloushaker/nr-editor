<template>
  <nr-icon class="nr-icon" :style="iconStyle"><slot /></nr-icon>
</template>

<script lang="ts">
// Base wrapper for all SVG icons: sizes the artwork provided by the per-icon component's slot.
// <nr-icon> is a custom element (declared in nuxt.config) so generic selectors like
// "a > span" or ".x img" never catch icons — same immunity the old <img> tags had.
// IMPORTANT: the template must stay single-root WITHOUT comments, otherwise Vue treats it
// as a fragment and attribute/class fallthrough from the per-icon components breaks.
export default defineComponent({
  props: {
    // Rendered width/height in px, matches the old PNG intrinsic sizes by default
    size: { type: [Number, String], default: 16 },
    // Width/height ratio for non-square icons: height = size / ratio (1 = square)
    ratio: { type: Number, default: 1 },
    // Per-mode boost overrides: dark and light are fully independent; the global CSS below
    // picks the right carrier var per mode, so switching theme reacts without any JS
    strokeBoostDark: { type: Number, default: null },
    detailBoostDark: { type: Number, default: null },
    strokeBoostLight: { type: Number, default: null },
    detailBoostLight: { type: Number, default: null },
    // Per-context multiplier on top of the theme/mode boost (boost props replace, this scales):
    // use it where an icon needs to sit lighter/heavier among its neighbors in one spot
    strokeMult: { type: Number, default: 1 },
  },
  computed: {
    px(): string {
      return typeof this.size === "number" ? `${this.size}px` : this.size;
    },
    pxH(): string {
      if (this.ratio === 1) return this.px;
      const w = typeof this.size === "number" ? this.size : parseFloat(this.size);
      return `${Math.round((w / this.ratio) * 10) / 10}px`;
    },
    iconStyle(): Record<string, string> {
      const style: Record<string, string> = { width: this.px, height: this.pxH };
      if (this.strokeBoostDark != null) style["--icon-stroke-boost-dark"] = `${this.strokeBoostDark}`;
      if (this.detailBoostDark != null) style["--icon-detail-boost-dark"] = `${this.detailBoostDark}`;
      if (this.strokeBoostLight != null) style["--icon-stroke-boost-light"] = `${this.strokeBoostLight}`;
      if (this.detailBoostLight != null) style["--icon-detail-boost-light"] = `${this.detailBoostLight}`;
      if (this.strokeMult !== 1) style["--icon-stroke-mult"] = `${this.strokeMult}`;
      return style;
    },
  },
});
</script>

<style scoped lang="scss">
.nr-icon {
  display: inline-block;
  vertical-align: middle;
  line-height: 0;

  :deep(svg) {
    width: 100%;
    height: 100%;
  }
}
</style>

<!-- Global icon-system rules (deliberately unscoped: they target the theme root and
     interactive ancestors, which scoped CSS cannot reach). -->
<style lang="scss">
// Icons rest on --nr-icon-color when a theme defines it; the low specificity (0,1,0)
// lets per-icon scoped colors (Support red, Question blue) win without exceptions.
.nr-icon {
  color: var(--nr-icon-color, inherit);
  opacity: var(--nr-icon-opacity, 1);
  transition:
    color 0.15s,
    opacity 0.15s;
}

// Dark themes: icons rest at 70% opacity of the font color. Element opacity (not an
// alpha color) flattens each icon before fading, so overlapping shapes inside an icon
// can never stack into brighter patches.
html.dark {
  --nr-icon-opacity: 0.7;
}

// Only the icon's own interactive element lights it up — row-level containers also
// carry these classes and would whiten every icon in the row on hover
html.dark .imgBt:hover > .nr-icon,
html.dark a:hover > .nr-icon,
html.dark button:hover > .nr-icon,
html.dark .clickable:hover > .nr-icon,
html.dark .hover-darken:hover > .nr-icon,
html.dark .nr-icon.imgBt:hover,
html.dark .nr-icon.clickable:hover {
  --nr-icon-opacity: 1;
}

// Thin-stroke icons drown against dark backgrounds: converted svgs express stroke widths
// and detail opacities as calc(base * boost). The mode picks its own carrier var, so
// dark and light are tunable independently at theme, type or instance level.
.nr-icon {
  --icon-stroke-boost: calc(var(--icon-stroke-boost-light, 0.7) * var(--icon-stroke-mult, 1));
  --icon-detail-boost: var(--icon-detail-boost-light, 1);
}

html.dark .nr-icon {
  --icon-stroke-boost: calc(var(--icon-stroke-boost-dark, 1) * var(--icon-stroke-mult, 1));
  --icon-detail-boost: var(--icon-detail-boost-dark, 1);
}
</style>
