<template>
  <div class="h-full">
    <div class="flex items-center justify-center h-full">
      <!--
        Every row is always rendered, and the block has a fixed width. The counter and the
        message used to be v-if'd, so a load went 1 line -> 3 lines and the whole block moved
        as it grew; the message also re-centred on every catalogue name.
      -->
      <div class="loading m-auto">
        <div class="head">
          <img class="w-20px h-20px icon" src="/assets/icons/spin.gif" />
          <span class="ml-5px">Loading...</span>
          <span class="count">{{ progress_max ? `${progress} / ${progress_max}` : "" }}</span>
        </div>
        <div class="bar" :class="{ idle: !progress_max }">
          <div class="fill" :style="{ width: `${pct}%` }" />
        </div>
        <div class="msg">{{ progress_msg }}</div>
      </div>
    </div>
  </div>
</template>
<script lang="ts">
export default defineComponent({
  props: {
    progress: { type: Number, default: 0 },
    progress_max: { type: Number, default: 0 },
    progress_msg: { type: String, default: "" },
  },
  computed: {
    pct(): number {
      if (!this.progress_max) return 0;
      return Math.max(0, Math.min(100, (this.progress / this.progress_max) * 100));
    },
  },
});
</script>
<style scoped lang="scss">
.loading {
  width: 320px;
  max-width: 80vw;
}

.head {
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 20px;
}

.count {
  margin-left: 10px;
  opacity: 0.7;
  font-size: 13px;
  /* so the digits do not shift the row as the count grows */
  font-variant-numeric: tabular-nums;
}

.bar {
  height: 6px;
  margin: 8px 0 6px;
  border-radius: 3px;
  overflow: hidden;
  background-color: rgba(128, 128, 128, 0.25);
  transition: opacity 150ms linear;
}

/* Hidden, not removed: the space stays reserved so the block does not resize when a count
   arrives, but a track that will never fill reads as broken. Nothing reports a count during
   /system's initial load, or while the catalogue page is still parsing the game system. */
.bar.idle {
  opacity: 0;
}

.fill {
  height: 100%;
  border-radius: inherit;
  /* the theme vars carry no fallback of their own, and an unset var would kill the gradient */
  background: linear-gradient(90deg, var(--color-lightblue, #4a9eff), var(--color-blue, #0063fb));
  /* spans the gap between paints, which the loader throttles to ~100ms */
  transition: width 150ms linear;
}

.msg {
  font-size: 13px;
  opacity: 0.75;
  line-height: 18px;
  text-align: center;
  /* reserved whether or not there is a message, and truncated rather than wrapped: a long
     catalogue name would otherwise take a second line and resize the block again */
  min-height: 18px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
