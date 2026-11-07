<template>
  <PopupDialog v-model="open" x slotstyle="width: min(720px, 92vw)">
    <template #header>{{ title }}</template>
    <div class="picker">
      <p v-if="error" class="error">{{ error }}</p>
      <div class="bar">
        <input v-model="filter" type="search" placeholder="Filter images in icons/" />
        <button class="bouton" :disabled="busy" @click="($refs.file as HTMLInputElement).click()">From a file…</button>
        <input ref="file" class="hidden" type="file" :accept="accept" @change="fileChosen" />
      </div>
      <p class="gray small">
        A file is converted to webp (svg kept as is) and must be under {{ maxKb }}KB. Picking an image already in
        the folder copies it under each node's id.
      </p>
      <div v-if="!state.loaded" class="gray">Reading icons/…</div>
      <div v-else-if="!shown.length" class="gray">
        {{ state.files.length ? "No image matches the filter." : "No images in icons/ yet: add one from a file." }}
      </div>
      <div class="thumbs">
        <button v-for="path of shown" :key="path" class="thumb" :title="path" :disabled="busy" @click="choose(path)">
          <img :src="state.urls[path]" alt="" />
          <span class="label">{{ path.slice("icons/".length) }}</span>
        </button>
      </div>
    </div>
  </PopupDialog>
</template>

<script lang="ts">
import type { PropType } from "vue";
import { ASSET_MIME } from "~/assets/shared/battlescribe/icons";
import { ICON_MAX_BYTES, prepareIcon, readIcon, setIcons, type IconTarget, type SystemIcons } from "~/assets/editor/system_icons";

/** Sets one image on every target: picked from icons/, or copied in from a file. */
export default defineComponent({
  props: {
    state: { type: Object as PropType<SystemIcons>, required: true },
    targets: { type: Array as PropType<IconTarget[]>, required: true },
  },
  emits: ["close", "done"],
  data() {
    return { open: true, filter: "", busy: false, error: "", maxKb: ICON_MAX_BYTES / 1024 };
  },
  watch: {
    open(v: boolean) {
      if (!v) this.$emit("close");
    },
  },
  computed: {
    title(): string {
      return this.targets.length === 1 ? `Icon for ${this.targets[0].label}` : `Icon for ${this.targets.length} nodes`;
    },
    accept(): string {
      return Object.keys(ASSET_MIME).map((ext) => `.${ext}`).join(",");
    },
    shown(): string[] {
      const needle = this.filter.trim().toLowerCase();
      return this.state.files.filter((f) => !needle || f.toLowerCase().includes(needle));
    },
  },
  methods: {
    async apply(load: () => Promise<{ data: Uint8Array; ext: string }>) {
      this.busy = true;
      this.error = "";
      try {
        await setIcons(this.state, this.targets, await load());
        this.$emit("done");
        this.open = false;
      } catch (e) {
        this.error = (e as Error)?.message ?? String(e);
      } finally {
        this.busy = false;
      }
    },
    choose(path: string) {
      return this.apply(() => readIcon(this.state, path));
    },
    fileChosen(event: Event) {
      const input = event.target as HTMLInputElement;
      const file = input.files?.[0];
      // The same file picked twice must still fire change
      input.value = "";
      if (file) return this.apply(() => prepareIcon(file, file.name));
    },
  },
});
</script>

<style scoped lang="scss">
.hidden {
  display: none;
}
.error {
  color: var(--nr-danger);
}
.small {
  font-size: 0.85em;
}
.bouton {
  flex: none;
  width: auto;
  min-width: 0;
  padding: 2px 12px;
}
.bar {
  display: flex;
  gap: 8px;
  input {
    flex: 1;
    min-width: 0;
  }
}
.thumbs {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(96px, 1fr));
  gap: 6px;
  max-height: 50vh;
  overflow: auto;
  padding: 6px 0;
}
.thumb {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 6px 4px;
  border: 1px solid var(--nr-line);
  border-radius: 4px;
  background: transparent;
  color: inherit;
  cursor: pointer;
  &:hover,
  &:focus-visible {
    background: var(--nr-fill);
  }
  img {
    width: 40px;
    height: 40px;
    object-fit: contain;
  }
}
.label {
  max-width: 100%;
  font-size: 0.75em;
  line-height: 1.2;
  overflow-wrap: anywhere;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
