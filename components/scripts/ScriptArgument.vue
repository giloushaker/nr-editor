<template>
  <div>
    <span class="bold p-2px">{{ arg.name ?? arg.type }}</span
    ><span v-if="!arg.optional">*</span> <span class="gray" v-if="arg.description">{{ arg.description }}</span>
    <div v-for="(type, i) in types">
      <template v-if="type === 'catalogue[]'">
        <UtilAutocomplete
          v-model="value"
          :options="[{ label: 'All Catalogues' }, ...system.getAllCatalogueFiles()]"
          :valueField="(o: Record<string, string> & BSIData) => o.label ?? catalogueName(o)"
          :filterField="(o: Record<string, string> & BSIData) => o.label ?? catalogueName(o)"
          class="max-w-300px w-100%"
        >
          <template #option="{ option }">
            <div style="white-space: nowrap">
              <template v-if="option.label">
                <img class="mr-1 align-middle" src="/assets/bsicons/bullet.png" />{{ option.label }}
              </template>
              <template v-else>
                <img class="mr-1 align-middle" src="/assets/bsicons/catalogue.png" />
                {{ catalogueName(option) }}
              </template>
            </div>
          </template>
        </UtilAutocomplete>
      </template>
      <template v-else-if="type === 'catalogue'">
        <UtilAutocomplete
          v-model="value"
          :options="system.getAllCatalogueFiles()"
          :valueField="(o: Record<string, string> & BSIData) => o.label ?? catalogueName(o)"
          :filterField="(o: Record<string, string> & BSIData) => o.label ?? catalogueName(o)"
          class="max-w-300px w-100%"
        >
          <template #option="{ option }">
            <div style="white-space: nowrap">
              <img class="mr-1 align-middle" src="/assets/bsicons/catalogue.png" />
              {{ option.name }}
            </div>
          </template>
        </UtilAutocomplete>
      </template>
      <template v-else-if="type === 'string'">
        <EditableDiv v-model="value" spellcheck="false" style="font-family: monospace" />
      </template>
      <template v-else-if="type === 'boolean' || type === 'toggle'">
        <input type="checkbox" v-model="value" />
        <label>{{ arg.name }}</label>
      </template>
      <template v-else-if="type === 'file'">
        <input type="file" @input="onFileSelected" />
      </template>
    </div>
  </div>
</template>
<script lang="ts">
import { PropType } from "nuxt/dist/app/compat/capi";
import ScriptArgument from "./ScriptArgument.vue";
import { GameSystemFiles } from "~/assets/shared/battlescribe/local_game_system";
import { getDataObject } from "~/assets/shared/battlescribe/bs_main";
import { BSIData } from "~/assets/shared/battlescribe/bs_types";
import EditableDiv from "../util/EditableDiv.vue";

export default defineComponent({
  components: { EditableDiv },
  props: {
    arg: {
      type: Object as PropType<{
        name: string;
        type: string | string[];
        optional?: boolean;
        description?: string;
        default?: any;
      }>,
      required: true,
    },
    args: {
      type: Array,
      required: true,
    },
    system: {
      type: GameSystemFiles,
      required: true,
    },
    index: {
      type: Number,
      required: true,
    },
  },

  data() {
    return { value: this.getDefaultValue(Array.isArray(this.arg.type) ? this.arg.type[0] : this.arg.type) as any };
  },
  methods: {
    catalogueName(catalogue: BSIData) {
      return getDataObject(catalogue).name;
    },
    async getArgument() {
      const type = this.types[0];
      const val = this.value;
      switch (type) {
        case "catalogue[]":
          if (val === "All Catalogues") {
            await this.system.loadAll();
            const result = this.system.getAllLoadedCatalogues();
            result.map((o) => o.processForEditor());
            return result;
          } else {
            const catalogue = this.system
              .getAllCatalogueFiles()
              .map((o) => getDataObject(o))
              .find((o) => o.name === val)!;
            const result = await this.system.loadCatalogue({ targetId: catalogue.id });
            result.processForEditor();
            result.imports.map((o) => o.processForEditor());
            return [result];
          }
        case "catalogue":
          const catalogue = this.system
            .getAllCatalogueFiles()
            .map((o) => getDataObject(o))
            .find((o) => o.name === val)!;
          const result = await this.system.loadCatalogue({ targetId: catalogue.id });
          result.processForEditor();
          result.imports.map((o) => o.processForEditor());
          return result;
        default:
          return val;
      }
    },
    async updateArgument() {
      const val = await this.getArgument();
      this.args[this.index] = val;
      return val;
    },
    getDefaultValue(str: string) {
      if (this.arg.default !== undefined) return this.arg.default;
      if (str === "catalogue[]") return "All Catalogues";
    },
    onFileSelected(event: any) {
      const input_files = [...((event.target?.files as any | null) || [])];

      for (const file of input_files) {
        this.value = file.text();
      }
    },
  },
  computed: {
    types() {
      return Array.isArray(this.arg.type) ? this.arg.type : [this.arg.type];
    },
  },
});
</script>
<style lang="scss">
@import "@/shared_components/css/vars.scss";

.script {
  margin-top: 2px;
  border: 1px solid $box_border;
}
</style>
