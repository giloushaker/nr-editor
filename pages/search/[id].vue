<template>
  <div class="ml-20px mt-10px h-full overflow-y-auto">
    <!-- Params:
    {{ $route.params }} -->
    <div>
      <input type="search" v-model="filter" @keydown.enter="search" />
      <button class="inputstyle" @click="search"> Search </button>
      <span v-if="searching"> Searching...</span>
      <template v-else-if="count !== null">
        <span>Found {{ count }}<template v-if="more">+</template> results</span>
        <span>, Displaying {{ displayed_count }} results</span>
      </template>
    </div>
    <button class="inputstyle w-28px" @click="page = Math.max(0, page - 1)"> &lt; </button>
    <button class="inputstyle w-28px" @click="page = Math.min(last_page, page + 1)"> &gt; </button>
    Page {{ page + 1 }} / {{ last_page + 1 }} <input type="checkbox" id="show-fullpath" v-model="showFullPath" /><label
      for="show-fullpath"
      >Show Full Path</label
    >
    <div></div>
    <!-- Results -->
    <div v-if="results" class="pb-50px">
      <div v-for="(items, catalogue) in displayed_results">
        <span class="bold">{{ catalogue }}</span>
        <div class="ml-8px">
          <div class="hover-darken cursor-pointer" v-for="item in items" @click="store.goto(item)">
            <template v-if="showFullPath">
              <NodePath
                :path="path(item)"
                @click="store.goto(item)"
                class="inline hover-darken cursor-pointer p-1px"
                end-arrow
              />
            </template>

            <span>
              <span class="typeIcon-wrapper">
                <img class="typeIcon mr-4px" :src="`/assets/bsicons/${item.editorTypeName}.png`" />
              </span>
              <!-- <span v-if="primary" class="text-orange">{{ primary }}</span> -->
              <span>
                {{ getName(item) }}
              </span>
              <span v-if="getNameExtra(item)" class="gray">&nbsp;{{ getNameExtra(item) }} </span>
              <span class="ml-10px" v-if="costs(item)" v-html="costs(item)" />
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { getEntryPathInfo, getName, getNameExtra } from "~/assets/shared/battlescribe/bs_editor";
import { sortByDescending } from "~/assets/shared/battlescribe/bs_helpers";
import { EditorBase } from "~/assets/shared/battlescribe/bs_main_catalogue";
import NodePath from "~/components/util/NodePath.vue";
import { useEditorStore } from "~/stores/editorStore";

export interface ICost {
  name: string;
  value: number;
  typeId: string;
}
function round(num: number): number {
  return Math.round(num * 100) / 100;
}
export function formatCosts(costs: ICost[]): string {
  let res = "";
  costs = sortByDescending(costs, (c) => c.name);
  for (const cost of costs) {
    if (cost.value != 0) {
      let name = "";
      if (cost.name.length != 0) {
        name = " " + cost.name;
      }
      res = `${res}<span class='cost'>${round(cost.value)}${name}</span>`;
    }
  }
  if (res.length == 0) {
    return res;
  }
  return `<span class="costList">${res}</span>`;
}
export default defineComponent({
  setup() {
    return { store: useEditorStore() };
  },
  data() {
    return {
      filter: "",
      results: null as Record<string, EditorBase[]> | null,
      count: null as number | null,
      searching: false,
      more: false,
      page: 0,
      max_display: 30,
      max_results: 1000,
      showFullPath: false,
    };
  },
  computed: {
    async system() {
      return await this.store.get_or_load_system(
        (
          this.$route.params as {
            id: string;
          }
        ).id
      );
    },
    data() {
      return { filter: this.filter };
    },
    from() {
      if (this.count === null) return 0;
      return Math.min(this.page * this.max_display, this.count);
    },
    to() {
      if (this.count === null) return 0;
      return Math.min(this.page * this.max_display + this.max_display, this.count);
    },
    last_page() {
      if (this.count === null) return 0;
      return Math.ceil(this.count / this.max_display) - 1;
    },
    displayed_results() {
      let n = 0;
      const from = this.from;
      const to = this.to;
      const result = {} as Record<string, EditorBase[]>;
      for (const key in this.results) {
        const items = this.results[key];
        const count = items.length;
        let end = count;
        if (n + count > to) {
          const total = n + count;
          const extra = Math.max(total - to, 0);
          end = count - extra;
        }
        if (n + count >= from) {
          const diff = Math.max(from - n, 0);
          if (count && end > diff) result[key] = items.slice(diff, end);
        }
        n += count;
        if (n > to) {
          break;
        }
      }
      return result;
    },
    displayed_count() {
      let n = 0;
      for (const key in this.displayed_results) {
        n += this.displayed_results[key].length;
      }
      return n;
    },
  },
  methods: {
    getName,
    getNameExtra,
    path(link: EditorBase) {
      const path = getEntryPathInfo(link);
      path.pop();

      return path;
    },
    async search() {
      try {
        this.searching = true;
        await this.$nextTick(() => this.$forceUpdate());
        await new Promise((resolve) => setTimeout(resolve, 5));
        const found = await this.store.system_search(await this.system, this.data, this.max_results);
        if (!found) {
          this.results = null;
          this.count = null;
          this.more = false;
          return;
        }
        this.more = found.more;
        this.results = found.grouped;
        this.count = found.all.length;
      } catch (e) {
        console.error(e);
      } finally {
        this.page = 0;
        this.searching = false;
      }
    },
    costs(item: EditorBase) {
      const result = [] as ICost[];
      const catalogue = item.getCatalogue();
      const costs = item.getCosts();
      for (const cost of costs) {
        const name = catalogue.findOptionById(cost.typeId)?.name || cost.name || cost.typeId;
        if (name) {
          result.push({
            name: name,
            value: cost.value,
            typeId: cost.typeId,
          });
        }
      }
      return formatCosts(result);
    },
  },
  components: { NodePath },
});
</script>
