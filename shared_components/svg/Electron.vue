<template>
  <IconsNrIcon class="nr-electron" :size="size" :stroke-boost-dark="strokeBoostDark" :detail-boost-dark="detailBoostDark" :stroke-boost-light="strokeBoostLight" :detail-boost-light="detailBoostLight">
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
      <!-- Electron's atom: three thin orbits 60° apart, an electron on each, and a small
           nucleus, tilted like the logo. currentColor throughout, so it follows the titlebar's
           white font color in both light and dark mode. Hairline stroke to match the 32px png
           it replaced - the shape reads as line art, not as a solid glyph. -->
      <g transform="rotate(-22 12 12)">
        <g fill="none" stroke="currentColor" stroke-width="calc(0.72px * var(--icon-stroke-boost, 1))">
          <ellipse cx="12" cy="12" rx="10.3" ry="3.95" />
          <ellipse cx="12" cy="12" rx="10.3" ry="3.95" transform="rotate(60 12 12)" />
          <ellipse cx="12" cy="12" rx="10.3" ry="3.95" transform="rotate(120 12 12)" />
        </g>
        <g fill="currentColor">
          <circle cx="12" cy="12" r="1.15" />
          <circle cx="1.7" cy="12" r="1.05" />
          <circle cx="17.15" cy="20.92" r="1.05" />
          <circle cx="17.15" cy="3.08" r="1.05" />
        </g>
      </g>
    </svg>
  </IconsNrIcon>
</template>

<script lang="ts">
// Electron/desktop-app indicator: the atom silhouette (inherits surrounding font color)
export default defineComponent({
  props: {
    size: { type: [Number, String], default: 24 },
    // Type-level boost defaults, independent per mode: tweak these to tune every icon of
    // this type at once (null = theme value from NrIcon.vue); instance props still override.
    // Light keeps the full stroke: this icon sits on the colored titlebar, not on a light page.
    strokeBoostDark: { type: Number, default: null },
    detailBoostDark: { type: Number, default: null },
    strokeBoostLight: { type: Number, default: 1 },
    detailBoostLight: { type: Number, default: null },
  },
});
</script>
