<template>
    <div class="scrollable max-h-60vh p-10px">
        <div v-for="item, i in sorted" class="p-4px border-solid -mt-1px border-1px hover-darken unselectable 0px"
            draggable="true" @dragstart="dragStart(item)" @dragover.prevent @drop="drop(realDropIndex)"
            @dragenter="dragEnter(i)" :class="{ 'drop-target': realDropIndex === i }">

            <template v-if="get(item) === undefined">
                <span :class="{ gray: get(item) === undefined }"
                    title="Will not be ordered specifically (but will be after anything with an index set)">
                    [?]
                </span>

            </template>
            <template v-else>
                <span>
                    [{{ get(item) }}]
                </span>

            </template>
            <slot v-bind="{ item }" name="item"></slot>
            <span v-if="get(item) !== undefined"
                class="px-4px py-1px hover-brighten cursor-pointer unselectable float-right"
                @click.stop="del(item)">x</span>
        </div>
    </div>
</template>
<script lang="ts">
import { sortByAscending } from '~/assets/shared/battlescribe/bs_helpers';

export default defineComponent({
    props: {
        items: {
            type: Array,
            required: true,
        },
        get: {
            type: Function,
            required: true,
        },
        set: {
            type: Function,
            required: true,
        },
        del: {
            type: Function,
            required: true,
        }
    },
    data() {
        return { dragging: null as null | number, dropIndex: null as null | number }
    },
    computed: {
        sorted() {
            return sortByAscending(this.items, (o) => this.get(o) ?? 10000)
        },

        realDropIndex() {
            if (this.dropIndex === null) return null;
            return Math.min(this.sorted.filter(o => this.get(o) !== undefined).length, this.dropIndex)
        },
    },
    methods: {
        dragStart(item: any) {
            this.dragging = item;
        },
        dragEnter(index: number) {
            if (this.dragging !== index) {
                this.dropIndex = index;
            }
        },
        drop(index: number | null) {
            if (index === null) return;
            const visual_index = index + 1
            this.dropIndex = null;
            if (this.dragging !== null) {
                const itemsWithIndex = []
                for (const item of this.sorted) {
                    const idx = this.get(item)
                    if (idx !== undefined) {
                        itemsWithIndex.push({ item, idx })
                    }
                }
                if (itemsWithIndex.find(o => o.idx === visual_index)) {
                    for (const { item, idx } of itemsWithIndex) {
                        if (idx >= visual_index) {
                            this.set(item, idx + 1)
                        }
                    }
                }
                this.set(this.dragging, visual_index)
                this.fixup()
                this.dragging = null;
            }
        },
        fixup() {
            let i = 1;
            for (const item of this.sorted) {
                if (this.get(item) !== undefined) {
                    this.set(item, i);
                    i++;
                }
            }
        }
    }
})
</script>
<style scoped>
.drop-target {
    border-top: 3px solid red;
}

[draggable="true"] {
    cursor: move;
    /* fallback if grab cursor is unsupported */
    cursor: grab;
    cursor: -moz-grab;
    cursor: -webkit-grab;
}
</style>
