<template>
  <div class="settings">
    <fieldset>
      <legend>Editing</legend>
      <div class="row">
        <input type="checkbox" id="global-duplicate-id-error" v-model="settings.globalDuplicateIdError" />
        <label for="global-duplicate-id-error">
          Check for duplicate ids across all catalogues
          <span class="hint">Takes effect after a reload.</span>
        </label>
      </div>
      <div class="row">
        <input type="checkbox" id="sticky-scroll" v-model="settings.stickyScroll" />
        <label for="sticky-scroll">
          Sticky scroll
          <span class="hint">Keep parent entries pinned when they scroll out of view.</span>
        </label>
      </div>
      <!--
        Hidden on purpose since f24b7bf, not by accident: both features still work (Characteristics
        beforePaste, LinkPanel's rename), but the rows only appear for someone who already has the
        setting on. Guarding a row on its own value reads like a bug -- it means you can switch it
        off and never back on -- so leave this comment in place of fixing it.
      -->
      <div class="row" v-if="settings.autoFormatCharacteristics">
        <input type="checkbox" id="auto-format" v-model="settings.autoFormatCharacteristics" />
        <label for="auto-format">Format characteristics automatically on paste</label>
      </div>
      <div class="row" v-if="settings.autoRenameInfoLinkParent">
        <input type="checkbox" id="auto-rename" v-model="settings.autoRenameInfoLinkParent" />
        <label for="auto-rename">Rename the parent entry when assigning an info link</label>
      </div>
    </fieldset>

    <fieldset>
      <legend>Saving</legend>
      <div class="row">
        <input type="checkbox" id="github-auto-increment" v-model="settings.githubAutoIncrement" />
        <label for="github-auto-increment">
          Increment the revision automatically when saving
          <span class="hint">Needs GitHub integration and an internet connection.</span>
        </label>
      </div>
      <div class="row">
        <input type="checkbox" id="revision-popup" v-model="noRevisionPopup" />
        <label for="revision-popup">Don't ask about incrementing the revision</label>
      </div>
    </fieldset>

    <fieldset>
      <legend>Show in the tree</legend>
      <div class="displayRow">
        <div class="row">
          <input type="checkbox" id="display-sort-index" v-model="settings.display.sortIndex" />
          <label for="display-sort-index">Sort index</label>
        </div>
        <div class="row">
          <input type="checkbox" id="display-references" v-model="settings.display.references" />
          <label for="display-references">References</label>
        </div>
        <div class="row">
          <input type="checkbox" id="display-costs" v-model="settings.display.costs" />
          <label for="display-costs">Costs</label>
        </div>
        <div class="row">
          <input type="checkbox" id="display-primary-category" v-model="settings.display.primaryCategory" />
          <label for="display-primary-category">Primary category</label>
        </div>
      </div>
    </fieldset>

    <fieldset>
      <legend>AI assistant access</legend>
      <div class="row">
        <input type="checkbox" id="mcp-enabled" v-model="settings.mcpEnabled" />
        <label for="mcp-enabled">
          Enable MCP
          <span class="hint">Lets AI tools use the editor.</span>
        </label>
      </div>

      <!-- Nothing about connecting is shown until it is on: until then it is not a decision anyone
           has to make. -->
      <div class="mcpDetail" v-if="settings.mcpEnabled">
        <div class="status">
          <span class="dot" :class="mcp.connected ? 'connected' : 'waiting'"></span>
          <span v-if="mcp.connected">Connected on {{ mcp.address }}</span>
          <span v-else-if="mcp.rejected">{{ mcp.rejected }}</span>
          <span v-else>No assistant connected yet</span>
        </div>

        <template v-if="!mcp.connected">
          <div>
            For Claude Code, register the relay once:
            <code>claude mcp add --scope user webmcp -- npx @mcp-b/webmcp-local-relay</code>
            <span class="hint">Claude Code starts the relay itself. Start a session, then reload this page.</span>
          </div>
          <span class="hint">
            Other setups: run <code class="inline">npx @mcp-b/webmcp-local-relay</code> in a terminal, or install the
            WebMCP bridge extension (Chromium browsers only) &mdash; then reload. If the port is taken, open the editor
            with <code class="inline">?webmcpPort=9876</code>.
          </span>
        </template>
        <div class="hint" v-else>Untick to cut it off. The relay keeps running until you stop it in its terminal.</div>
      </div>
    </fieldset>
  </div>
</template>

<script lang="ts">
import { useSettingsStore } from "~/stores/settingsState";
import { usePromptStore } from "~/stores/promptStore";
import { mcpStatus } from "~/plugins/webmcp.client";

export default {
  setup() {
    // mcpStatus is the plugin's own reactive state rather than a store: it is runtime-only, dies
    // with the page, and nothing but this panel reads it.
    return { settings: useSettingsStore(), prompt: usePromptStore(), mcp: mcpStatus };
  },
  computed: {
    noRevisionPopup: {
      get() {
        return this.prompt.get("revision");
      },
      set(val: boolean) {
        this.prompt.set("revision", val);
      },
    },
  },
};
</script>

<style scoped lang="scss">
@use "@/shared_components/css/vars.scss" as *;

.settings {
  min-width: 460px;
  max-width: 560px;
}



fieldset {
  border: 1px solid $box_border;
  border-radius: 4px;
  padding: 4px 10px 8px;
  margin: 0 0 8px 0;
}

legend {
  padding: 0 4px;
  font-size: 12px;
  color: $gray;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.row {
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  gap: 8px;
  padding: 4px 0;

  input {
    margin: 4px 0 0 0;
    flex: none;
  }
}

/* The qualifier that used to sit in parentheses inside the label. */
.hint {
  display: block;
  font-size: 13px;
  color: $gray;
  line-height: 1.4;
}

.displayRow {
  display: flex;
  flex-wrap: wrap;

  .row {
    width: 200px;
    align-items: center;

    input {
      margin: 0;
    }
  }
}

.mcpDetail {
  margin: 8px 0 2px 24px;
  padding-left: 12px;
  border-left: 2px solid $box_border;
  display: flex;
  flex-direction: column;
  gap: 10px;
  font-size: 14px;
}

.status {
  display: flex;
  align-items: center;
  gap: 8px;
}

.dot {
  flex: none;
  width: 8px;
  height: 8px;
  border-radius: 50%;

  &.connected {
    background-color: $green;
  }

  &.waiting {
    background-color: $orange;
  }
}

code {
  display: block;
  width: fit-content;
  margin-top: 4px;
  border: 1px solid $box_border;
  border-radius: 4px;
  background-color: $input_background;
  padding: 6px 8px;
  font-size: 13px;

  &.inline {
    display: inline;
    border: none;
    background: none;
    padding: 0;
    margin: 0;
    font-size: 12.5px;
  }
}
</style>
