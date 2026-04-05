<template>
  <fieldset>
    <legend>
      Formatting Rules
      <InfoButton>
        Formatting Rules use a match and replace regex, with modifications to the replace syntax in order to sign &
        sum(eval)
        <br />
        Example Rules:
        <br />
        <br />
        Replace (empty) with - <br />
        Match: <span class="cost">^$</span>, Replace: <span class="cost">-</span>
        <br />
        <br />
        Replace 0 with - <br />
        Match: <span class="cost">^0$</span>, Replace: <span class="cost">-</span>
        <br />
        <br />
        Prefix Positive Numbers with + <br />
        Match: <span class="cost">([+-]?\d+)</span>, Replace: <span class="cost">$1|sign</span>
        <br />
        <br />
        Combine/Evaluate Numbers (eg +2+4 -> +6)<br />
        Match: <span class="cost">(([+-]\d+){2,})</span>, Replace: <span class="cost">$1|sum|sign</span>
        <br /><br />
        Useful tools:<br />
        <a href="https://regexr.com" target="_blank">regexr.com</a> — build & test regex visually<br />
        <a href="https://regex101.com" target="_blank">regex101.com</a> — detailed regex debugger
      </InfoButton>
    </legend>
    <div class="mr-8px">
      <div class="format-rules-table" style="display: flex; flex-direction: column; gap: 10px">
        <div v-for="(rule, index) in item.formatRules" :key="index" class="formatRule border px-4px py-8px"
          @dragover.prevent="onDragOver($event, index)"
          @drop="onDrop($event, index)" @dragend="onDragEnd"
          :class="{ 'drag-over': dragOverIndex === index, dragging: draggingIndex === index }"
          style="display: flex; flex-direction: row; align-items: center; border-width: 1px; border-radius: 5px;"
          >
          <div class="drag-handle" draggable="true" @dragstart="onDragStart($event, index)" title="Drag to reorder">
            <span class="m-auto">⋮⋮</span>
          </div>
          <div style="width: 100%">

            <!-- COMMENT COMMENT COMMENT
                   MATCH  REPLACE REMOVE
              -->

            <div style="display: flex; gap: 4px; flex-direction: column;">
              <div>
                <label>Description: </label>
                <EditableDiv v-model="rule.comment" />
              </div>
              <div style="display: flex; gap: 4px; flex-direction: row;">
                <div style="flex-grow: 5;">
                  <label>Match: </label>
                  <EditableDiv v-model="rule.match" />
                </div>
                <div style="flex-grow:3;">
                  <label>Replace: </label>
                  <EditableDiv v-model="rule.replace" />
                </div>

                <button @click="removeRule(rule)" class="inputlike clickable remove-button-full">Remove</button>

              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div class="add-rule-row">
      <button @click="addFormatRule" class="bouton">Add Rule</button>
      <select @change="addPreset($event)" class="preset-select">
        <option value="">Add Preset...</option>
        <option value="empty-dash">Empty → -</option>
        <option value="zero-dash">0 → -</option>
        <option value="plus-zero-empty">+0 → (empty)</option>
        <option value="bold">Bold (**value**)</option>
        <option value="prepend">Prepend (prefix)...</option>
        <option value="append">Append (suffix)...</option>
        <option value="sign">Prefix sign (+/-)</option>
        <option value="sum-sign">Combine & sign (+2+4 → +6)</option>
      </select>
    </div>
  </fieldset>
</template>

<script lang="ts">
import { PropType } from "vue";
import { BSICharacteristicType, } from "~/assets/shared/battlescribe/bs_types";
import { EditorBase } from "~/assets/shared/battlescribe/bs_main_catalogue";
import EditableDiv from "~/components/util/EditableDiv.vue";
import InfoButton from "~/components/InfoButton.vue";
import { FormatRule } from "~/assets/shared/battlescribe/bs_main";
import { useEditorStore } from "~/stores/editorStore";

export default {
  components: { EditableDiv, InfoButton },
  props: {
    item: {
      type: Object as PropType<BSICharacteristicType & EditorBase>,
      required: true,
    },
  },
  data() {
    return {
      draggingIndex: null as number | null,
      dragOverIndex: null as number | null,
    };
  },

  setup() {
    return { store: useEditorStore() };
  },
  methods: {
    addFormatRule() {
      if (!this.item.formatRules) this.item.formatRules = [];
      this.store.add_node("formatRules", this.item, {
        type: "regex",
      })
    },
    removeRule(rule: FormatRule) {
      this.store.del_node(rule);
    },
    onDragStart(event: DragEvent, index: number) {
      this.draggingIndex = index;
      event.dataTransfer!.effectAllowed = "move";
      event.dataTransfer!.setData("text/plain", index.toString());
    },
    onDragOver(event: DragEvent, index: number) {
      event.preventDefault();
      this.dragOverIndex = index;
    },
    onDrop(event: DragEvent, dropIndex: number) {
      event.preventDefault();
      const dragIndex = this.draggingIndex;
      if (dragIndex !== null && dragIndex !== dropIndex) {
        const rules = this.item.formatRules!;
        const draggedRule = rules[dragIndex];
        rules.splice(dragIndex, 1);
        const newIndex = dragIndex < dropIndex ? dropIndex - 1 : dropIndex;
        rules.splice(newIndex, 0, draggedRule);
      }
      this.dragOverIndex = null;
      this.draggingIndex = null;
    },
    onDragEnd() {
      this.draggingIndex = null;
      this.dragOverIndex = null;
    },
    addPreset(event: Event) {
      const select = event.target as HTMLSelectElement;
      const presets: Record<string, { match: string; replace: string; comment: string }> = {
        "empty-dash":     { match: "^$",                replace: "-",         comment: "Empty → -" },
        "zero-dash":      { match: "^0$",               replace: "-",         comment: "0 → -" },
        "plus-zero-empty":{ match: "^\\+0$",            replace: "",          comment: "+0 → (empty)" },
        "bold":           { match: "([\\s\\S]*)",       replace: "**$1**",    comment: "Bold" },
        "prepend":        { match: "([\\s\\S]*)",       replace: "PREFIX$1",  comment: "Prepend PREFIX" },
        "append":         { match: "([\\s\\S]*)",       replace: "$1SUFFIX",  comment: "Append SUFFIX" },
        "sign":           { match: "([+-]?\\d+)",       replace: "$1|sign",   comment: "Prefix sign (+/-)" },
        "sum-sign":       { match: "(([+-]\\d+){2,})",  replace: "$1|sum|sign", comment: "Combine & sign" },
      };
      const preset = presets[select.value];
      if (preset) {
        if (!this.item.formatRules) this.item.formatRules = [];
        this.store.add_node("formatRules", this.item, { type: "regex", ...preset });
      }
      select.value = "";
    },
  },
};
</script>

<style lang="scss">
.format-rules-table {
  width: 100%;

  .drag-handle {
    width: 20px;
    cursor: move;
    text-align: center;
    color: #666;
    user-select: none;
    padding: 0 4px;
    align-self: stretch;
    display: flex;
    align-items: center;

    &:hover {
      color: #aaa;
    }

    span {
      font-size: 14px;
      line-height: 1;
    }
  }

  .formatRule {
    transition: opacity 0.2s;

    &.dragging {
      opacity: 0.5;
    }

    &.drag-over {
      border-top: 2px solid #4a9eff !important;
    }
  }
}

.add-rule-row {
  display: flex;
  gap: 6px;
  margin-top: 10px;
  align-items: center;
}

.preset-select {
  flex: 1;
}
</style>
