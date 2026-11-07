<template>
  <tr v-if="target">
    <td>Icon:</td>
    <td>
      <div v-if="access === 'missing'" class="gray small">
        Icons are files beside the .gst: open this system from its folder on the Systems page to set one.
      </div>
      <div v-else-if="access === 'prompt'" class="iconfield">
        <span class="gray small">The editor needs access to {{ folder }} again to show and set icons.</span>
        <button class="link" @click="grant">Grant access</button>
      </div>
      <div v-else-if="state" class="iconfield">
        <!-- The tile is the control: click to pick, like an avatar. The path is in the tooltip. -->
        <button class="tile" :class="{ empty: !url }" :title="path ? `${path}
Click to change` : 'Set icon'" @click="picking = true">
          <img v-if="url" :src="url" alt="" />
          <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <path d="M12 6 V18 M6 12 H18" />
          </svg>
        </button>
        <button v-if="!path" class="link" @click="picking = true">Set icon</button>
        <template v-else>
          <span class="name">{{ fileName }}</span>
          <button class="link" @click="picking = true">Change</button>
          <button v-if="removable" class="link" :disabled="busy" @click="remove">Remove</button>
        </template>
      </div>
      <p v-if="error" class="error">{{ error }}</p>
      <UtilIconPicker v-if="picking && state" :state="state" :targets="[target]" @close="picking = false" />
    </td>
  </tr>
</template>

<script lang="ts">
import { hasRemovableFile, nodeTarget, removeIcons, systemIcons, targetIconPath, iconFolder, grantFolder, type IconTarget, type SystemIcons } from "~/assets/editor/system_icons";
import { useEditorStore } from "~/stores/editorStore";
import { itemProp } from "./props";

/** The node's icon file in icons/, for the nodes New Recruit draws an icon for. Says why when the folder cannot be written. */
export default defineComponent({
  props: { ...itemProp },
  setup() {
    return { store: useEditorStore() };
  },
  data() {
    return { state: null as SystemIcons | null, folder: "", access: "" as "" | "granted" | "prompt" | "missing", picking: false, busy: false, error: "" };
  },
  watch: {
    item: {
      immediate: true,
      async handler() {
        this.error = "";
        if (!nodeTarget(this.item)) return;
        const catalogue = (this.item as any).getCatalogue?.();
        const systemId = catalogue?.isGameSystem() ? catalogue.id : catalogue?.gameSystemId;
        const { folder, access } = await iconFolder(this.store.gameSystems[systemId]);
        this.folder = folder ?? "";
        this.access = access;
        this.state = folder && access === "granted" ? systemIcons(folder) : null;
      },
    },
  },
  computed: {
    target(): IconTarget | null {
      return nodeTarget(this.item);
    },
    path(): string | null {
      return this.target && this.state ? targetIconPath(this.state, this.target) : null;
    },
    url(): string | null {
      return (this.path && this.state?.urls[this.path.replace(/^\.?\//, "")]) || null;
    },
    fileName(): string {
      return this.path?.split("/").pop() ?? "";
    },
    removable(): boolean {
      return !!this.target && !!this.state && hasRemovableFile(this.state, this.target);
    },
  },
  methods: {
    async grant() {
      if (!(await grantFolder(this.folder))) return;
      this.access = "granted";
      this.state = systemIcons(this.folder);
    },
    async remove() {
      this.busy = true;
      this.error = "";
      try {
        await removeIcons(this.state!, [this.target!]);
      } catch (e) {
        this.error = `Could not delete: ${(e as Error)?.message ?? e}`;
      } finally {
        this.busy = false;
      }
    },
  },
});
</script>

<style scoped lang="scss">
.iconfield {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.tile {
  width: 32px;
  height: 32px;
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2px;
  border: 1px solid var(--nr-line);
  border-radius: 4px;
  background: var(--nr-input, transparent);
  color: var(--nr-muted);
  cursor: pointer;
  &.empty {
    border-style: dashed;
  }
  &:hover,
  &:focus-visible {
    border-color: currentColor;
    color: inherit;
  }
  img {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }
  svg {
    width: 16px;
    height: 16px;
  }
}
.name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.85em;
  color: var(--nr-muted);
}
// Text actions, so the row reads as one control and not a toolbar
.link {
  flex: none;
  padding: 0;
  border: none;
  background: none;
  color: inherit;
  font-size: 0.9em;
  font-weight: normal;
  text-decoration: underline;
  text-decoration-color: var(--nr-line);
  text-underline-offset: 2px;
  cursor: pointer;
  &:hover,
  &:focus-visible {
    text-decoration-color: currentColor;
  }
  &:disabled {
    opacity: 0.5;
  }
}
.error {
  color: var(--nr-danger);
}
.small {
  font-size: 0.85em;
}
</style>
