<template>
  <div class="h-full">
    <div class="flex items-center h-full">
      <div class="m-auto items-center flex flex-col">
        <div class="items-center flex">
          <img class="w-20px h-20px" src="/assets/icons/spin.gif" />
          <span class="ml-5px"> Loading... </span>
        </div>
        <div>
          <div class="text-center" v-if="progress_max">{{ progress }}/{{ progress_max }}</div>
          <div v-if="progress_msg">{{ progress_msg }}</div>
        </div>
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
  watch: {
    async progress_msg() {
      return await new Promise((resolve) => setTimeout(resolve, 10));
    },
  },
});
</script>
