<template>
  <CatalogueEntry
    ref="entry"
    v-for="entry of sortedEntries"
    :item="entry"
    @selected="entrySelected"
  />
</template>

<script lang="ts">
export default {
  emits: ["selected"],
  props: {
    entries: {
      type: Array as PropType<Array<{ name?: string }>>,
      required: true,
    },
  },

  methods: {
    entrySelected(val: any) {
      if (this.$refs.entry && Array.isArray(this.$refs.entry)) {
        for (let elt of this.$refs.entry) {
          elt.unselect(val);
        }
      }
      this.$emit("selected", val);
    },
  },

  computed: {
    sortedEntries() {
      return [...this.entries].sort((e1, e2) => {
        let s1 = e1.name || "";
        let s2 = e2.name || "";

        if (s1 > s2) {
          return 1;
        }
        return -1;
      });
    },
  },
};
</script>
