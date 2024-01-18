<template>
    <span>
        <span class="typeIcon-wrapper">
            <img class="typeIcon" :src="`assets/bsicons/${item.editorTypeName}.png`" />
        </span>
        <ErrorIcon :errors="item.errors" />
        <span v-if="item.sortIndex && settings.display.sortIndex && !noSortIndex" class="gray">
            [{{ item.sortIndex }}]
        </span>
        <span :class="{ imported: imported, filtered: item.highlight }">{{ getName(item) }}</span>
        <span v-if="getNameExtra(item, settings.display.references)" class="gray">&nbsp;
            {{ getNameExtra(item, settings.display.references) }}
        </span>
        <span class="ml-10px" v-if="costs && settings.display.costs" v-html="costs" />
    </span>
</template>
<script lang="ts">
import { getName, getNameExtra } from '~/assets/shared/battlescribe/bs_editor';
import { sortByDescending } from '~/assets/shared/battlescribe/bs_helpers';
import { EditorBase } from '~/assets/shared/battlescribe/bs_main_catalogue';
import { useSettingsStore } from '~/stores/settingsState';
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
    props: {
        item: { type: Object as PropType<EditorBase>, required: true },
        noSortIndex: Boolean,
        imported: Boolean,
    },
    setup() {
        return { settings: useSettingsStore() }
    },
    methods: {
        getNameExtra, getName
    },
    computed: {
        costs() {
            const result = [] as ICost[];
            const catalogue = this.item.getCatalogue();
            const costs = this.item.getCosts();
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
    }
})
</script>
<style scoped>
.typeIcon {
    max-width: 18px;
    vertical-align: middle;
}

.typeIcon-wrapper {
    display: inline-block;
    min-width: 20px;
    min-height: 1px;
}

.imported {
    color: rgb(128, 145, 183);
}
</style>