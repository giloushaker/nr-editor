/**
 * The fields of each node kind, as data: what a Create or Set can touch, and what each field
 * holds. Kinds are the child keys of entries.ts (what store.add takes). This is the one list; the
 * right panel and the paste-into-tree code can move onto it.
 *
 * Field types:
 *   text · number · boolean
 *   choice   one of `choices`
 *   node     the id of another node (a target, a profile type, a cost type)
 *   scope    parent · force · roster · primary-catalogue · primary-category · an ancestor's id
 *   childId  any · model · unit · upgrade · mount · crew · a node's id
 *   field    selections · forces · a cost type's id · a constraint's id
 */
export type FieldType = "text" | "number" | "boolean" | "choice" | "node" | "scope" | "childId" | "field";
export interface FieldDef {
  name: string;
  type: FieldType;
  choices?: string[];
  /** One line for the editor's tooltip. */
  doc?: string;
}

const named: FieldDef[] = [
  { name: "id", type: "text", doc: "Left out, a readable one is made from the name" },
  { name: "name", type: "text" },
];
const hidden: FieldDef = { name: "hidden", type: "boolean" };
const comment: FieldDef = { name: "comment", type: "text" };
const publication: FieldDef[] = [
  { name: "publicationId", type: "node" },
  { name: "page", type: "text" },
];
const query: FieldDef[] = [
  { name: "field", type: "field", doc: "selections, forces, a cost type, or a constraint's id" },
  { name: "scope", type: "scope" },
  { name: "childId", type: "childId", doc: "What is counted: a node's id, or any/model/unit/upgrade" },
  { name: "shared", type: "boolean", doc: "Count the target across links" },
  { name: "percentValue", type: "boolean" },
  { name: "includeChildSelections", type: "boolean" },
  { name: "includeChildForces", type: "boolean" },
];
const entry: FieldDef[] = [
  ...named,
  { name: "type", type: "choice", choices: ["upgrade", "model", "unit", "mount", "crew"] },
  hidden,
  { name: "collective", type: "boolean" },
  { name: "import", type: "boolean", doc: "Shown in the builder" },
  { name: "flatten", type: "boolean" },
  ...publication,
  comment,
];
const link: FieldDef[] = [
  ...named,
  { name: "targetId", type: "node", doc: "What it links to" },
  { name: "type", type: "choice", choices: ["selectionEntry", "selectionEntryGroup"] },
  hidden,
  { name: "import", type: "boolean" },
  comment,
];

export const FIELDS: Record<string, FieldDef[]> = {
  selectionEntries: entry,
  sharedSelectionEntries: entry,
  selectionEntryGroups: [...named, hidden, { name: "collective", type: "boolean" }, { name: "import", type: "boolean" }, { name: "defaultSelectionEntryId", type: "node" }, ...publication, comment],
  sharedSelectionEntryGroups: [...named, hidden, { name: "collective", type: "boolean" }, { name: "import", type: "boolean" }, { name: "defaultSelectionEntryId", type: "node" }, ...publication, comment],
  entryLinks: link,
  infoLinks: [...named, { name: "targetId", type: "node" }, { name: "type", type: "choice", choices: ["profile", "rule", "infoGroup"] }, hidden, comment],
  categoryLinks: [...named, { name: "targetId", type: "node" }, { name: "primary", type: "boolean" }, hidden, comment],
  categoryEntries: [...named, hidden, comment],
  forceEntries: [...named, hidden, comment],
  costs: [
    { name: "name", type: "text" },
    { name: "typeId", type: "node", doc: "The cost type" },
    { name: "value", type: "number" },
  ],
  constraints: [
    { name: "id", type: "text" },
    { name: "type", type: "choice", choices: ["min", "max", "exactly"] },
    { name: "value", type: "number" },
    ...query,
    { name: "automatic", type: "boolean", doc: "The builder fills it in" },
    { name: "negative", type: "boolean" },
    { name: "isLimit", type: "boolean" },
    { name: "message", type: "text" },
    comment,
  ],
  modifiers: [
    { name: "type", type: "choice", choices: ["set", "increment", "decrement", "multiply", "divide", "modulo", "floor", "ceil", "append", "prepend", "replace", "add", "remove", "set-primary", "unset-primary", "cumulative-add", "cumulative-multiply", "cumulative-power", "exponent", "power", "triangular"] },
    { name: "field", type: "field", doc: "hidden, name, category, a cost type, or a constraint's id" },
    { name: "value", type: "text", doc: "A number, text, or true/false, as the field wants" },
    { name: "arg", type: "text" },
    { name: "scope", type: "scope", doc: "For relative modifiers" },
    { name: "affects", type: "text", doc: "For relative modifiers: a query" },
    { name: "join", type: "text" },
    { name: "position", type: "number" },
    comment,
  ],
  modifierGroups: [comment],
  conditions: [
    { name: "type", type: "choice", choices: ["atLeast", "lessThan", "atMost", "greaterThan", "equalTo", "notEqualTo", "instanceOf", "notInstanceOf", "always", "never", "before"] },
    { name: "value", type: "number" },
    ...query,
    comment,
  ],
  conditionGroups: [{ name: "type", type: "choice", choices: ["and", "or"] }, comment],
  localConditionGroups: [{ name: "type", type: "choice", choices: ["atLeast", "lessThan", "atMost", "greaterThan", "equalTo", "notEqualTo"] }, { name: "value", type: "number" }, { name: "scope", type: "scope" }, { name: "field", type: "field" }, { name: "percentValue", type: "boolean" }, comment],
  repeats: [
    { name: "value", type: "number", doc: "Once per this many" },
    { name: "repeats", type: "number", doc: "How many times each" },
    ...query,
    { name: "roundUp", type: "boolean" },
    comment,
  ],
  profiles: [...named, { name: "typeId", type: "node", doc: "The profile type" }, hidden, ...publication, comment],
  sharedProfiles: [...named, { name: "typeId", type: "node" }, hidden, ...publication, comment],
  characteristics: [
    { name: "name", type: "text" },
    { name: "typeId", type: "node" },
    { name: "$text", type: "text", doc: "The value" },
  ],
  rules: [...named, { name: "description", type: "text" }, hidden, ...publication, comment],
  sharedRules: [...named, { name: "description", type: "text" }, hidden, ...publication, comment],
  infoGroups: [...named, hidden, ...publication, comment],
  sharedInfoGroups: [...named, hidden, ...publication, comment],
  publications: [...named, { name: "shortName", type: "text" }, { name: "publisher", type: "text" }, { name: "publicationDate", type: "text" }, { name: "publisherUrl", type: "text" }],
  costTypes: [...named, { name: "defaultCostLimit", type: "number" }, hidden],
  profileTypes: [...named],
  characteristicTypes: [...named],
  associations: [...named, { name: "min", type: "number" }, { name: "max", type: "number" }, { name: "scope", type: "scope" }, { name: "includeChildSelections", type: "boolean" }, { name: "ids", type: "text" }, { name: "of", type: "text" }, { name: "label", type: "text" }, { name: "labelMember", type: "text" }],
};

/** "selectionEntryGroups" -> "selection entry group", for sentences. */
export function kindLabel(kind: string): string {
  const words = kind.replace(/([A-Z])/g, " $1").toLowerCase().trim();
  return words.endsWith("s") ? words.slice(0, -1) : words;
}
