import type { EntryPathEntry } from "~/assets/editor/bs_editor";

export const LeftPanelDefaults = {
    showImported: false,
    ignoreProfilesRules: false,
    filter: "",
    scroll: 0,
    selection: undefined as EntryPathEntry[] | undefined,
    mode: "edit" as "edit" | "references",
  };