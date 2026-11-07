<template>
  <PopupDialog v-model="open" x slotstyle="width: min(720px, 92vw)">
    <template #header>{{ title }}</template>
    <div class="picker" :class="{ dragging }" @dragover.prevent="dragging = true" @dragleave.self="dragging = false" @drop.prevent="dropped">
      <p v-if="error" class="error">{{ error }}</p>
      <input ref="file" class="hidden" type="file" :accept="accept" @change="fileChosen" />
      <button class="dropzone" :disabled="busy" @click="browse">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3.5" y="4.5" width="17" height="15" rx="2" />
          <circle cx="9" cy="10" r="1.8" />
          <path d="M20.5 15.5 L15.5 10.5 L6 19.5" />
        </svg>
        <span class="strong">Choose an image</span>
        <span class="gray">or drop one here</span>
      </button>
      <div v-if="!state.loaded" class="gray">Loading…</div>
      <template v-else-if="state.files.length">
        <div class="existing">
          <span class="heading">In this folder</span>
          <input v-if="state.files.length > 12" v-model="filter" class="filter" type="search" placeholder="Filter" />
        </div>
        <div class="thumbs">
          <button v-for="path of shown" :key="path" class="thumb" :title="path" :disabled="busy" @click="choose(path)">
            <img :src="state.urls[path]" alt="" />
            <span class="label">{{ path.split("/").pop() }}</span>
          </button>
        </div>
        <p v-if="!shown.length" class="gray">No icon matches the filter.</p>
      </template>
    </div>
  </PopupDialog>
</template>

<script lang="ts">
import type { PropType } from "vue";
import { ASSET_MIME } from "~/assets/shared/battlescribe/icons";
import { prepareIcon, readIcon, setIcons, type IconTarget, type SystemIcons } from "~/assets/editor/system_icons";

/** Sets one image on every target: picked from icons/, or copied in from a file. */
export default defineComponent({
  props: {
    state: { type: Object as PropType<SystemIcons>, required: true },
    targets: { type: Array as PropType<IconTarget[]>, required: true },
  },
  emits: ["close", "done"],
  data() {
    return { open: true, filter: "", busy: false, error: "", dragging: false };
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
    browse() {
      (this.$refs.file as HTMLInputElement).click();
    },
    dropped(event: DragEvent) {
      this.dragging = false;
      const file = event.dataTransfer?.files?.[0];
      if (file && !this.busy) return this.apply(() => prepareIcon(file, file.name));
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
.picker {
  border-radius: 6px;
  &.dragging {
    outline: 2px dashed currentColor;
    outline-offset: 2px;
  }
}
.existing {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 12px;
  .heading {
    font-weight: bold;
    white-space: nowrap;
  }
  .filter {
    flex: 1;
    min-width: 0;
  }
}
.dropzone {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  width: 100%;
  padding: 28px 12px;
  border: 1px dashed var(--nr-muted);
  border-radius: 6px;
  background: transparent;
  color: inherit;
  font-weight: normal;
  cursor: pointer;
  &:hover,
  &:focus-visible {
    border-color: currentColor;
    background: var(--nr-fill);
  }
  svg {
    width: 32px;
    height: 32px;
    opacity: 0.7;
  }
  .strong {
    font-weight: bold;
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
  font-weight: normal;
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
