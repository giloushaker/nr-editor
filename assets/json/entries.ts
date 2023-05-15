export const entries = {
  catalogueLinks: {
    allowedChildrens: [],
  },
  publications: {
    allowedChildrens: [],
  },
  costTypes: {
    allowedChildrens: [],
  },
  profileTypes: {
    allowedChildrens: [],
  },
  categoryEntries: {
    allowedChildrens: [
      "profiles",
      "rules",
      "infoGroups",
      "infoLinks",
      "constraints",
      "modifiers",
      "modifierGroups",
    ],
  },
  categoryLinks: {
    allowedChildrens: [
      "profiles",
      "rules",
      "infoGroups",
      "infoLinks",
      "constraints",
      "modifiers",
      "modifierGroups",
    ],
  },
  forceEntries: {
    allowedChildrens: [
      "forceEntries",
      "categoryLinks",
      "profiles",
      "rules",
      "infoGroups",
      "infoLinks",
      "constraints",
      "modifiers",
      "modifierGroups",
    ],
  },
  entryLinks: {
    allowedChildrens: "type",
  },
  selectionEntryGroup: {
    allowedChildrens: [
      "selectionEntries",
      "selectionEntryGroups",
      "entryLinks",
      "profiles",
      "rules",
      "infoGroups",
      "infoLinks",
      "constraints",
      "modifiers",
      "modifierGroups",
    ],
  },
  selectionEntryGroups: {
    allowedChildrens: [
      "selectionEntries",
      "selectionEntryGroups",
      "entryLinks",
      "profiles",
      "rules",
      "infoGroups",
      "infoLinks",
      "constraints",
      "modifiers",
      "modifierGroups",
    ],
  },
  selectionEntry: {
    allowedChildrens: [
      "selectionEntries",
      "selectionEntryGroups",
      "entryLinks",
      "profiles",
      "rules",
      "infoGroups",
      "infoLinks",
      "constraints",
      "modifiers",
      "modifierGroups",
    ],
  },
  selectionEntries: {
    allowedChildrens: [
      "selectionEntries",
      "selectionEntryGroups",
      "entryLinks",
      "profiles",
      "rules",
      "infoGroups",
      "infoLinks",
      "constraints",
      "modifiers",
      "modifierGroups",
    ],
  },
  rule: {
    allowedChildrens: ["modifiers", "modifierGroups"],
  },
  profile: {
    allowedChildrens: ["modifiers", "modifierGroups"],
  },
  rules: {
    allowedChildrens: ["modifiers", "modifierGroups"],
  },
  profiles: {
    allowedChildrens: ["modifiers", "modifierGroups"],
  },
  infoGroup: {
    allowedChildrens: [
      "profiles",
      "rules",
      "infoGroups",
      "infoLinks",
      "modifiers",
      "modifierGroups",
    ],
  },
  infoGroups: {
    allowedChildrens: [
      "profiles",
      "rules",
      "infoGroups",
      "infoLinks",
      "modifiers",
      "modifierGroups",
    ],
  },
  infoLinks: {
    allowedChildrens: "type", //get from type
  },
  modifiers: {
    allowedChildrens: ["conditions", "conditionGroups", "repeats"],
  },
  modifierGroups: {
    allowedChildrens: [
      "modifiers",
      "modifierGroups",
      "conditions",
      "conditionGroups",
      "repeats",
    ],
  },
  conditions: {
    allowedChildrens: [],
  },
  conditionGroups: {
    allowedChildrens: ["conditions", "conditionGroups"],
  },

  catalogue: {
    allowedChildrens: [
      "categoryLinks",
      "publications",
      "costTypes",
      "profileTypes",
      "categoryEntries",
      "forceEntries",
      "sharedSelectionEntries",
      "sharedSelectionEntryGroups",
      "sharedProfiles",
      "sharedRules",
      "sharedInfoGroups",
      "selectionEntries",
      "rules",
    ],
  },
  gameSystem: {
    allowedChildrens: [
      "publications",
      "costTypes",
      "profileTypes",
      "categoryEntries",
      "forceEntries",
      "sharedSelectionEntries",
      "sharedSelectionEntryGroups",
      "sharedProfiles",
      "sharedRules",
      "sharedInfoGroups",
      "selectionEntries",
      "rules",
    ],
  },
};
