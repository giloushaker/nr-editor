import type { EntryPathEntry } from "~/assets/shared/battlescribe/bs_editor";

export const LeftPanelDefaults = {
    showImported: false,
    ignoreProfilesRules: false,
    filter: "",
    scroll: 0,
    selection: undefined as EntryPathEntry[] | undefined,
    mode: "edit",
  };