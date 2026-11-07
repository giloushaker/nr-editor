<template>
  <tr v-if="target && state">
    <td>Icon:</td>
    <td>
      <div class="iconfield">
        <img v-if="url" class="preview" :src="url" alt="" />
        <span v-else class="preview none" />
        <span class="path gray" :title="path || ''">{{ path || "None" }}</span>
        <button class="bouton" @click="picking = true">{{ path ? "Change" : "Set icon" }}</button>
        <button v-if="removable" class="bouton" :disabled="busy" @click="remove">Remove</button>
      </div>
      <p v-if="error" class="error">{{ error }}</p>
      <UtilIconPicker v-if="picking" :state="state" :targets="[target]" @close="picking = false" />
    </td>
  </tr>
</template>

<script lang="ts">
import { hasRemovableFile, nodeTarget, removeIcons, systemIcons, targetIconPath, writableFolder, type IconTarget, type SystemIcons } from "~/assets/editor/system_icons";
import { useEditorStore } from "~/stores/editorStore";
import { itemProp } from "./props";

/** The node's icon file in icons/, for the nodes New Recruit draws an icon for. Hidden unless the system is in a writable folder. */
export default defineComponent({
  props: { ...itemProp },
  setup() {
    return { store: useEditorStore() };
  },
  data() {
    return { state: null as SystemIcons | null, picking: false, busy: false, error: "" };
  },
  watch: {
    item: {
      immediate: true,
      async handler() {
        this.error = "";
        if (!nodeTarget(this.item)) return;
        const catalogue = (this.item as any).getCatalogue?.();
        const systemId = catalogue?.isGameSystem() ? catalogue.id : catalogue?.gameSystemId;
        const folder = await writableFolder(this.store.gameSystems[systemId]);
        this.state = folder ? systemIcons(folder) : null;
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
</style>
