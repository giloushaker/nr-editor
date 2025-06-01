import { Catalogue, EditorBase } from "~/assets/shared/battlescribe/bs_main_catalogue";

export function toTitleCaseWords(str: string): string {
  if (str.includes("-")) {
    // kebab-case or similar
    return str
      .split("-")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  } else if (str.includes("_")) {
    // snake_case
    return str
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  } else {
    // camelCase or PascalCase
    return str.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());
  }
}

export async function cleanup(catalogue: Catalogue, gst = false) {
  const toDelete = [
    "sharedSelectionEntries",
    "selectionEntries",
    "forceEntries",
    "sharedSelectionEntryGroups",
    "selectionEntryLinks",
    "sharedSelectionEntryLinks",
    "entryLinks",
    "sharedRules",
  ];

  if (!gst) toDelete.push("categoryEntries");

  for (let elt of toDelete) {
    const node = (catalogue as any)[elt] as EditorBase[];
    await $store.remove(node);
  }
}
