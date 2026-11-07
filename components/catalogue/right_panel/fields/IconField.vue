<template>
  <tr v-if="target">
    <td>Icon:</td>
    <td>
      <div v-if="access === 'missing'" class="gray small">
        Icons are files beside the .gst: open this system from its folder on the Systems page to set one.
      </div>
      <div v-else-if="access === 'prompt'" class="iconfield">
        <span class="gray small">The editor needs access to {{ folder }} again to show and set icons.</span>
        <button class="bouton" @click="grant">Grant access</button>
      </div>
      <div v-else-if="state" class="iconfield">
        <img v-if="url" class="preview" :src="url" alt="" />
        <span v-else class="preview none" />
        <span class="path gray" :title="path || ''">{{ path || "None" }}</span>
        <button class="bouton" @click="picking = true">{{ path ? "Change" : "Set icon" }}</button>
        <button v-if="removable" class="bouton" :disabled="busy" @click="remove">Remove</button>
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
  gap: 6px;
  min-width: 0;
}
.preview {
  width: 24px;
  height: 24px;
  flex: none;
  object-fit: contain;
  &.none {
    border: 1px dashed var(--nr-line);
    border-radius: 3px;
  }
}
.path {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.85em;
}
.bouton {
  flex: none;
  width: auto;
  min-width: 0;
  padding: 1px 10px;
}
.error {
  color: var(--nr-danger);
}
.small {
  font-size: 0.85em;
}
</style>
