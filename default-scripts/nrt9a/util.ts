import { Catalogue, EditorBase } from "~/assets/shared/battlescribe/bs_main_catalogue";
import { BSICharacteristic, BSIProfileType } from "~/assets/shared/battlescribe/bs_types";

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
    if (node) {
      await $store.remove(node);
    }
  }
}

export function charac(type: BSIProfileType, name: string, val: string) {
  let charType = type.characteristicTypes?.find((elt) => elt.name === name);
  if (!charType) charType = type.attributeTypes?.find((elt) => elt.name === name);

  let value: number | string = val;

  if (val?.match(/^[-]?[0-9]+$/)) {
    value = parseInt(val);
  } else {
    value = val;
    if (value == null) value = "";
  }

  if (charType) {
    const res: BSICharacteristic = { name: charType.name, typeId: charType.id || "", $text: value };

    return res;
  }

  return null;
}
