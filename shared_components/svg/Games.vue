<template>
  <IconsNrIcon class="nr-games" :size="size" :stroke-boost-dark="strokeBoostDark" :detail-boost-dark="detailBoostDark" :stroke-boost-light="strokeBoostLight" :detail-boost-light="detailBoostLight">
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
      <!-- stacking-toy tower: three rounded tiers widening downward (solid fill, no stroke boost needed) -->
      <rect x="6.5" y="2.9" width="11" height="5" rx="2.2" fill="currentColor"/>
      <rect x="4" y="9.5" width="16" height="5" rx="2.2" fill="currentColor"/>
      <rect x="1.5" y="16.1" width="21" height="5" rx="2.2" fill="currentColor"/>
    </svg>
  </IconsNrIcon>
</template>

<script lang="ts">
// Games icon: a stacking-toy tower silhouette (inherits surrounding font color)
export default defineComponent({
  props: {
    size: { type: [Number, String], default: 24 },
    // Type-level boost defaults, independent per mode: tweak these to tune every icon of
    // this type at once (null = theme value from NrIcon.vue); instance props still override
    strokeBoostDark: { type: Number, default: null },
    detailBoostDark: { type: Number, default: null },
    strokeBoostLight: { type: Number, default: null },
    detailBoostLight: { type: Number, default: null },
  },
});
</script>
