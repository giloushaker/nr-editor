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
    allowedChildrens: ["characteristicTypes"],
  },
  categoryEntries: {
    allowedChildrens: ["profiles", "rules", "infoGroups", "infoLinks", "constraints", "modifiers", "modifierGroups"],
  },
  categoryLinks: {
    allowedChildrens: ["profiles", "rules", "infoGroups", "infoLinks", "constraints", "modifiers", "modifierGroups"],
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
      "categoryLinks",
    ],
  },
  sharedSelectionEntryGroups: {
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
      "categoryLinks",
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
      "associations",
      "constraints",
      "modifiers",
      "modifierGroups",
      "categoryLinks",
    ],
  },
  sharedSelectionEntries: {
    allowedChildrens: [
      "selectionEntries",
      "selectionEntryGroups",
      "entryLinks",
      "profiles",
      "rules",
      "infoGroups",
      "infoLinks",
      "associations",
      "constraints",
      "modifiers",
      "modifierGroups",
      "categoryLinks",
    ],
  },
  associations: {
    allowedChildrens: ["constraints", "modifiers", "modifierGroups"],
  },
  sharedRules: {
    allowedChildrens: ["modifiers", "modifierGroups"],
  },
  rule: {
    allowedChildrens: ["modifiers", "modifierGroups"],
  },
  rules: {
    allowedChildrens: ["modifiers", "modifierGroups"],
  },
  profile: {
    allowedChildrens: ["modifiers", "modifierGroups", "characteristics"],
  },
  profiles: {
    allowedChildrens: ["modifiers", "modifierGroups", "characteristics"],
  },
  sharedProfiles: {
    allowedChildrens: ["modifiers", "modifierGroups", "characteristics"],
  },
  infoGroup: {
    allowedChildrens: ["profiles", "rules", "infoGroups", "infoLinks", "modifiers", "modifierGroups"],
  },
  infoGroups: {
    allowedChildrens: ["profiles", "rules", "infoGroups", "infoLinks", "modifiers", "modifierGroups"],
  },
  infoLinks: {
    allowedChildrens: "type", //get from type
  },
  modifiers: {
    allowedChildrens: ["conditions", "conditionGroups", "repeats"],
  },
  modifierGroups: {
    allowedChildrens: ["modifiers", "modifierGroups", "conditions", "conditionGroups", "repeats"],
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
      "entryLinks",
      "infoLinks",
      "infoGroups",
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
      "entryLinks",
      "infoLinks",
      "infoGroups",
      "rules",
    ],
  },
};
