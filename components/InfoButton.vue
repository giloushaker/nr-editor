<template>
  <span @click.stop="show = true" class="infoButton hover-darken clickable iconWrapper" v-if="icon !== 'none'">
    <img :src="`/assets/icons/${icon}.png`" :class="{ icon: icon !== 'i' }" />
  </span>
  <PopupDialog v-if="show" v-model="show" :x="x" :noclose="x">
    <template #header v-if="title">{{ title }}</template>
    <template #header v-if="slotTitle">
      <slot name="title" />
    </template>
    <slot />
  </PopupDialog>
</template>

<script>
import PopupDialog from "~/shared_components/PopupDialog.vue";

export default {
  props: {
    title: { type: String, required: false },
    slotTitle: { type: Boolean, default: false },
    icon: { type: String, default: "i" },
  },
  data() {
    return {
      show: false,
    };
  },
  components: { PopupDialog },
  computed: {
    x() {
      return this.title != null || this.slotTitle;
    },
  },
};
</script>

<style scoped>
@media (pointer: coarse) {
  .iconWrapper {
    min-width: 30px;
  }
}
.iconWrapper {
  display: inline-flex;
  vertical-align: middle;
  align-items: center;
}
img {
  display: inline-block !important;
  cursor: pointer;
  display: block;
  padding: 0;
}
</style>
