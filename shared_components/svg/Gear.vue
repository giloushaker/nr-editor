<template>
  <IconsNrIcon class="nr-gear" :size="size" :stroke-boost-dark="strokeBoostDark" :detail-boost-dark="detailBoostDark" :stroke-boost-light="strokeBoostLight" :detail-boost-light="detailBoostLight">
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
      <!-- cog with a punched center hole (evenodd) so it stays transparent on any background;
           scaled into the standard live area with a larger hole to shed visual weight -->
      <g transform="translate(12 12) scale(0.88) translate(-12.5 -12.5)">
        <path fill="currentColor" fill-rule="evenodd" d="M 10.503,1.175 L 14.497,1.175 L 16.059,3.908 L 19.096,3.080 L 21.920,5.904 L 21.092,8.941 L 23.825,10.503 L 23.825,14.497 L 21.092,16.059 L 21.920,19.096 L 19.096,21.920 L 16.059,21.092 L 14.497,23.825 L 10.503,23.825 L 8.941,21.092 L 5.904,21.920 L 3.080,19.096 L 3.908,16.059 L 1.175,14.497 L 1.175,10.503 L 3.908,8.941 L 3.080,5.904 L 5.904,3.080 L 8.941,3.908 Z M 18.000,12.500 A 5.5,5.5 0 1 0 7.000,12.500 A 5.5,5.5 0 1 0 18.000,12.500 Z"/>
      </g>
    </svg>
  </IconsNrIcon>
</template>

<script lang="ts">
// Settings/configuration icon: a cog with a punched center hole (inherits surrounding font color)
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
