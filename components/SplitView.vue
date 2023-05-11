<template>
  <div
    class="mainView splitMainView"
    :class="{
      splitMainView: split,
      doubleSplitView: double,
      tripleSplitView: triple,
    }"
    :style="viewStyle"
  >
    <div class="leftMost scrollable" v-if="triple">
      <slot name="left"></slot>
    </div>

    <div
      class="leftSide"
      :style="{ width: `${leftWidth}px` }"
      :class="{ hidden: !split && showRight, hideOnSmallScreen: showRight }"
    >
      <slot name="middle"></slot>
    </div>
    <div
      class="between"
      @drag.capture="ondragstart"
      @dragend="ondragend"
      :style="{ left: `${leftWidth - 8}px` }"
    ></div>
    <div
      class="rightSide"
      :class="{
        hidden: !split && showRight == false,
        hideOnSmallScreen: showRight == false,
      }"
      v-if="showRight"
    >
      <slot name="right"></slot>
    </div>
  </div>
</template>

<script lang="ts">
export default {
  props: ["split", "double", "triple", "showRight", "viewStyle"],
  data() {
    return { leftWidth: 400 };
  },
  methods: {
    ondragstart(e: MouseEvent) {
      console.log("dragstarts");
      this.leftWidth = e.clientX;
    },
    ondragend(e: MouseEvent) {
      console.log(e);
      this.leftWidth = e.clientX;
      console.log("dragdrop");
    },
  },
};
</script>

<style scoped lang="scss">
@import "@/shared_components/css/vars.scss";

.mainView {
  display: grid;
  grid-gap: 5px;
  grid-auto-flow: column;
  grid-auto-columns: 1fr;
  width: 100%;

  &.tripleSplitView {
    grid-template-columns: fit-content(20%) 1fr 1fr;
  }

  &.doubleSplitView {
    grid-template-columns: auto fit-content(50%);
  }
}

@media screen and (max-width: $very_large_mode) {
  .mainView {
    grid-template-columns: 1fr !important;
  }
}

.splitMainView {
  flex: 1;
  overflow: auto;
  position: relative;

  .leftMost {
    & > .EditorCollapsibleBox {
      border-top: none;

      & > .arrowTitle {
        position: sticky !important;
        top: 0;
        z-index: 20;
        border-top: 1px solid $box_border;
      }
    }
  }

  .leftSide {
    overflow-y: auto;

    & > .EditorCollapsibleBox {
      border-top: none;

      & > .arrowTitle {
        position: sticky !important;

        top: 0;
        z-index: 20;
        border-top: 1px solid $box_border;
      }

      & > .boxContent {
        padding: 0;

        & > div:first-child {
          position: sticky !important;
          top: 31px;
          background-color: rgba(var(--bg-r), var(--bg-g), var(--bg-b), 1);
          z-index: 10;
          padding: 5px;
          border-bottom: 1px solid $box_border;
        }
      }

      div.liste {
        padding: 5px;
      }
    }
  }

  .rightSide {
    overflow-y: auto;

    .inbox {
      border-top: none;
    }

    .unitNameTitle {
      position: sticky !important;
      top: 0;
      z-index: 10;
      border-top: 1px solid $box_border;
    }
  }

  .leftMost {
    overflow-y: auto;
  }
}
.between {
  background-color: rgba(255, 0, 0, 54);
  height: 100%;
  position: absolute;
  cursor: ew-resize;
  width: 10px;
}
</style>
