<template>
  <fieldset class="section">
    <legend>Characteristic Kind</legend>
    <div class="mr-8px">
      <table class="editorTable">
        <tr>
          <td>Kind:</td>
          <td class="flex gap-2px">
            <select v-model="item.kind">
              <option :value="undefined">Not defined</option>
              <option value="longText">Long Text</option>
              <option value="annotation">Annotation</option>
            </select>
          </td>
        </tr>
      </table>
    </div>
  </fieldset>
  <fieldset class="section">
    <legend>Creation</legend>
    <div class="mr-8px">
      <table class="editorTable">
        <tr>
          <td> Default Value: </td>
          <td>
            <UtilEditableDiv v-model="item.defaultValue" />
          </td>
        </tr>
      </table>
    </div>
  </fieldset>
  <fieldset class="section">
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
      </InfoButton>
    </legend>
    <div class="mr-8px">
      <table class="format-rules-table">
        <tbody>
          <tr
            v-for="(rule, index) in item.formatRules"
            :key="index"
            class="formatRule"
            draggable="true"
            @dragstart="onDragStart($event, index)"
            @dragover.prevent="onDragOver($event, index)"
            @drop="onDrop($event, index)"
            @dragend="onDragEnd"
            :class="{ 'drag-over': dragOverIndex === index, dragging: draggingIndex === index }"
          >
            <td class="drag-handle" title="Drag to reorder">
              <span>⋮⋮</span>
            </td>
            <td class="grow-column">
              <label>Match: </label>
              <EditableDiv v-model="rule.match" />
            </td>
            <td class="grow-column">
              <label>Replace: </label>
              <EditableDiv v-model="rule.replace" />
            </td>
            <td class="remove-column">
              <button @click="removeRule(rule)" class="inputlike clickable remove-button-full">Remove</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <button @click="addFormatRule" class="bouton add-rule-button">Add Rule</button>
  </fieldset>
</template>

<script lang="ts">
import { BSIProfileType } from "~/assets/shared/battlescribe/bs_types";
import { EditorBase } from "~/assets/shared/battlescribe/bs_main_catalogue";
import EditableDiv from "~/components/util/EditableDiv.vue";
import InfoButton from "~/components/InfoButton.vue";
export default {
  components: { EditableDiv, InfoButton },
  props: {
    item: {
      type: Object as PropType<CharacteristicType & EditorBase>,
      required: true,
    },
  },
  data() {
    return {
      draggingIndex: null as number | null,
      dragOverIndex: null as number | null,
    };
  },
  methods: {
    addFormatRule() {
      if (!this.item.formatRules) this.item.formatRules = [];
      this.item.formatRules.push({});
    },
    removeRule(rule) {
      const idx = this.item.formatRules.indexOf(rule);
      if (idx !== -1) {
        this.item.formatRules.splice(idx, 1);
      }
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
        const rules = this.item.formatRules;
        const draggedRule = rules[dragIndex];

        // Remove from old position
        rules.splice(dragIndex, 1);

        // Insert at new position (adjust if we removed from before the drop position)
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
  },
};
</script>
<style lang="scss">
.format-rules-table {
  width: 100%;
  td {
    border: none;
  }

  .drag-handle {
    width: 20px;
    cursor: move;
    text-align: center;
    color: #666;
    user-select: none;
    padding: 0 4px;

    &:hover {
      color: #aaa;
    }

    span {
      font-size: 14px;
      line-height: 1;
    }
  }

  .grow-column {
    width: 50%;
  }

  .remove-column {
    width: auto;
    padding: 0;
    height: 1px;

    button {
      height: 100%;
      width: auto;
    }
  }

  tr.formatRule {
    transition: opacity 0.2s;

    &.dragging {
      opacity: 0.5;
    }

    &.drag-over {
      border-top: 2px solid #4a9eff;
    }
  }
}
.add-rule-button {
  margin-top: 10px;
}
</style>
