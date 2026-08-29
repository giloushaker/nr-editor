import { generateBattlescribeId } from "~/assets/shared/battlescribe/bs_helpers";
import { Entry } from "~/assets/shared/battlescribe/bs_main";
import type { Catalogue, EditorBase } from "~/assets/shared/battlescribe/bs_main_catalogue";
import type { BSICondition, BSIConditionGroup, BSIConstraint, BSIModifier } from "~/assets/shared/battlescribe/bs_types";

const BATTLE_MARCH_ID = "e40a-36c4-0c66-472a";
const OPEN_WAR_ID = "8214-cf48-b1cd-5f5e";
const COMBINED_ARMS_ID = "1ae6-ed95-069e-a390";
const GRAND_MELEE_ID = "cdbe-ecb9-27cb-fd2b";
const COMBINED_AND_GRAND_ID = "0750-5d17-d708-f990";
const ONE_PER_THOUSAND_ID = "27c9-52f0-c942-681e";

// Every element this script writes is tagged with one of these, and removal matches on the tag.
// Anything written by hand is therefore never touched.
const GRAND_MELEE_COMMENT = "Grand melee";
const COMBINED_ARMS_COMMENT = "Combined arms";
const BATTLE_MARCH_POINTS_COMMENT = "Battle March points";
const BATTLE_MARCH_FLOOR_COMMENT = "Battle march";
const PER_THOUSAND_COMMENT = "Battle March Category";

function removeConstraintsWithComment(catalogues: Catalogue[], comment: string) {
  forEachEntry(catalogues, (catalogue, rootEntry) => {
    const constraints = rootEntry.constraints?.filter((elt) => elt.comment != comment);
    const modifiers = rootEntry.modifiers?.filter((elt) => elt.comment != comment);
    const modifierGroups = rootEntry.modifierGroups?.filter((elt) => elt.comment != comment);

    // Only write when something actually goes away. This visits every entry of every catalogue,
    // so an unconditional edit_node marked the whole file dirty on every run.
    const changed =
      constraints?.length !== rootEntry.constraints?.length ||
      modifiers?.length !== rootEntry.modifiers?.length ||
      modifierGroups?.length !== rootEntry.modifierGroups?.length;
    if (!changed) return;

    $store.edit_node(rootEntry as EditorBase, { constraints, modifiers, modifierGroups });
  });
}

/**
 * Id of the constraint this element already wrote on that entry, or a fresh one.
 *
 * Modifiers point at their constraint by id, so minting a new id on every run would rewrite
 * ~1800 constraint ids across the repository for no behavioural gain -- and would silently
 * orphan any hand-written modifier that targets one of them. Reusing the id keeps re-runs to
 * an actual content diff.
 */
function keepConstraintId(rootEntry: Entry, comment: string): string {
  const existing = (rootEntry.constraints || []).find((elt) => elt.comment === comment);
  return existing?.id || generateBattlescribeId();
}

/**
 * Swap this element's tagged constraints and modifiers for freshly built ones, in a single write.
 * Anything carrying another tag, or no tag at all, is left untouched.
 */
function replaceTagged(
  rootEntry: Entry,
  comment: string,
  newConstraints: BSIConstraint[],
  newModifiers: BSIModifier[],
) {
  $store.edit_node(rootEntry as EditorBase, {
    constraints: (rootEntry.constraints || []).filter((elt) => elt.comment !== comment).concat(newConstraints),
    modifiers: (rootEntry.modifiers || []).filter((elt) => elt.comment !== comment).concat(newModifiers),
  });
}

function removeGrandMeleeConstraints(catalogues: Catalogue[]) {
  removeConstraintsWithComment(catalogues, GRAND_MELEE_COMMENT);
}

function addGrandMeleeConstraints(catalogues: Catalogue[]) {
  forEachEntry(
    catalogues,
    (catalogue, rootEntry) => {
      let newConstraint: BSIConstraint = {
        comment: GRAND_MELEE_COMMENT,
        type: "max",
        value: -1,
        field: "points",
        scope: "self",
        shared: true,
        id: keepConstraintId(rootEntry, GRAND_MELEE_COMMENT),
        includeChildSelections: true,
        includeChildForces: true,
        percentValue: false,
      };

      let newModifiers: BSIModifier[] = [
        {
          comment: GRAND_MELEE_COMMENT,
          conditionGroups: [
            {
              conditions: [
                {
                  type: "instanceOf",
                  value: 1,
                  field: "selections",
                  scope: "ancestor",
                  childId: GRAND_MELEE_ID,
                  shared: true,
                  includeChildSelections: true,
                  includeChildForces: true,
                },
                {
                  type: "instanceOf",
                  value: 1,
                  field: "selections",
                  scope: "ancestor",
                  childId: COMBINED_AND_GRAND_ID,
                  shared: true,
                  includeChildSelections: true,
                  includeChildForces: true,
                },
              ],
              type: "or",
            },
          ],
          type: "set",
          value: 0,
          field: newConstraint.id,
        },
        {
          // Modifier for Normal forces
          comment: GRAND_MELEE_COMMENT,
          conditionGroups: [
            {
              conditions: [
                {
                  type: "instanceOf",
                  value: 1,
                  field: "selections",
                  scope: "ancestor",
                  childId: GRAND_MELEE_ID,
                  shared: true,
                  includeChildSelections: true,
                  includeChildForces: true,
                },
                {
                  type: "instanceOf",
                  value: 1,
                  field: "selections",
                  scope: "ancestor",
                  childId: COMBINED_AND_GRAND_ID,
                  shared: true,
                  includeChildSelections: true,
                  includeChildForces: true,
                },
              ],
              type: "or",
            },
            {
              type: "or",
              conditionGroups: [],
              conditions: [
                {
                  type: "instanceOf",
                  value: 1,
                  field: "selections",
                  scope: "force",
                  childId: OPEN_WAR_ID,
                  shared: true,
                },
                {
                  type: "instanceOf",
                  value: 1,
                  field: "selections",
                  scope: "force",
                  childId: COMBINED_ARMS_ID,
                  shared: true,
                },
                {
                  type: "instanceOf",
                  value: 1,
                  field: "selections",
                  scope: "force",
                  childId: GRAND_MELEE_ID,
                  shared: true,
                },
                {
                  type: "instanceOf",
                  value: 1,
                  field: "selections",
                  scope: "force",
                  childId: COMBINED_AND_GRAND_ID,
                  shared: true,
                },
                {
                  type: "notInstanceOf",
                  value: 1,
                  field: "selections",
                  scope: "force",
                  childId: BATTLE_MARCH_ID,
                  shared: true,
                },
              ],
            },
          ],
          repeats: [
            {
              value: 4,
              repeats: 1,
              field: "limit::points",
              scope: "roster",
              childId: "any",
              shared: true,
              roundUp: false,
              includeChildSelections: true,
              includeChildForces: true,
            },
          ],
          type: "increment",
          value: 1,
          field: newConstraint.id,
        },
        {
          // Modifier for Allies
          comment: GRAND_MELEE_COMMENT,
          conditionGroups: [
            {
              conditions: [
                {
                  type: "instanceOf",
                  value: 1,
                  field: "selections",
                  scope: "ancestor",
                  childId: GRAND_MELEE_ID,
                  shared: true,
                  includeChildSelections: true,
                  includeChildForces: true,
                },
                {
                  type: "instanceOf",
                  value: 1,
                  field: "selections",
                  scope: "ancestor",
                  childId: COMBINED_AND_GRAND_ID,
                  shared: true,
                  includeChildSelections: true,
                  includeChildForces: true,
                },
              ],
              type: "or",
            },
            {
              type: "and",
              conditionGroups: [],
              conditions: [
                {
                  type: "notInstanceOf",
                  value: 1,
                  field: "selections",
                  scope: "force",
                  childId: OPEN_WAR_ID,
                  shared: true,
                },
                {
                  type: "notInstanceOf",
                  value: 1,
                  field: "selections",
                  scope: "force",
                  childId: COMBINED_ARMS_ID,
                  shared: true,
                },
                {
                  type: "notInstanceOf",
                  value: 1,
                  field: "selections",
                  scope: "force",
                  childId: GRAND_MELEE_ID,
                  shared: true,
                },
                {
                  type: "notInstanceOf",
                  value: 1,
                  field: "selections",
                  scope: "force",
                  childId: COMBINED_AND_GRAND_ID,
                  shared: true,
                },
                {
                  type: "notInstanceOf",
                  value: 1,
                  field: "selections",
                  scope: "force",
                  childId: BATTLE_MARCH_ID,
                  shared: true,
                },
              ],
            },
          ],
          repeats: [
            {
              value: 4,
              repeats: 1,
              field: "points",
              scope: "force",
              childId: "any",
              shared: true,
              roundUp: false,
              includeChildSelections: true,
              includeChildForces: true,
            },
          ],
          type: "increment",
          value: 1,
          field: newConstraint.id,
        },
      ];
      replaceTagged(rootEntry, GRAND_MELEE_COMMENT, [newConstraint], newModifiers);
    },
    { nested: false, categories: false },
  );
}

function removeCombinedArmsConstraints(catalogues: Catalogue[]) {
  removeConstraintsWithComment(catalogues, COMBINED_ARMS_COMMENT);
}

function alreadyHasLimitation(rootEntry: Entry) {
  // Check if there are limitations on categories
  for (let link of rootEntry.categoryLinks || []) {
    for (let constraint of link.target.constraints || []) {
      if (constraint.scope == "roster" || constraint.scope == "force") {
        if (constraint.type === "max" && constraint.comment != COMBINED_ARMS_COMMENT) {
          console.log(
            `Entry: ${rootEntry.name}: Skipped Combined arms constraints because ${link.target.name} already has constraints`,
          );
          return true;
        }
      }
    }
  }

  for (let constraint of rootEntry.constraints || []) {
    if (constraint.scope == "roster" || constraint.scope == "force") {
      if (constraint.comment != COMBINED_ARMS_COMMENT && constraint.type === "max") {
        console.log(
          `Entry: ${rootEntry.name}: Skipped Combined arms constraints because it already has constraints`,
          constraint,
        );
        return true;
      }
    }
  }
  return false;
}

function addCombinedArmsConstraints(catalogues: Catalogue[]) {
  forEachEntry(
    catalogues,
    (catalogue, rootEntry) => {
      if (alreadyHasLimitation(rootEntry)) return;

      let val = -1;
      const primary =
        rootEntry.target?.getPrimaryCategoryLink()?.target?.name || rootEntry.getPrimaryCategoryLink()?.target.name;
      switch (primary) {
        case "Characters":
          val = 3;
          break;
        case "Core":
          val = 4;
          break;
        case "Special":
          val = 3;
          break;
        case "Rare":
          val = 2;
          break;
        case "Mercenaries":
          val = 2;
          break;
      }

      if (val != -1) {
        const newConstraint: BSIConstraint = {
          comment: COMBINED_ARMS_COMMENT,
          type: "max",
          value: -1,
          field: "selections",
          scope: "roster",
          shared: true,
          id: keepConstraintId(rootEntry, COMBINED_ARMS_COMMENT),
          includeChildSelections: true,
          includeChildForces: true,
        };

        const newModifiers: BSIModifier[] = [
          {
            comment: COMBINED_ARMS_COMMENT,
            type: "set",
            value: val - 2,
            field: newConstraint.id,
            conditions: [
              {
                type: "atLeast",
                value: 2000,
                field: "limit::points",
                scope: "roster",
                childId: "any",
                shared: true,
                includeChildSelections: true,
                includeChildForces: true,
              },
            ],
            conditionGroups: [
              {
                type: "or",
                conditions: [
                  {
                    type: "instanceOf",
                    value: 1,
                    field: "selections",
                    scope: "ancestor",
                    childId: COMBINED_AND_GRAND_ID,
                    shared: true,
                  },
                  {
                    type: "instanceOf",
                    value: 1,
                    field: "selections",
                    scope: "ancestor",
                    childId: COMBINED_ARMS_ID,
                    shared: true,
                  },
                ],
              },
            ],
          },
          {
            type: "increment",
            value: 1,
            field: newConstraint.id,
            comment: COMBINED_ARMS_COMMENT,
            conditions: [
              {
                type: "atLeast",
                value: 2000,
                field: "limit::points",
                scope: "roster",
                childId: "any",
                shared: true,
                includeChildSelections: true,
                includeChildForces: true,
              },
            ],
            conditionGroups: [
              {
                type: "or",
                conditions: [
                  {
                    type: "instanceOf",
                    value: 1,
                    field: "selections",
                    scope: "ancestor",
                    childId: COMBINED_AND_GRAND_ID,
                    shared: true,
                  },
                  {
                    type: "instanceOf",
                    value: 1,
                    field: "selections",
                    scope: "ancestor",
                    childId: COMBINED_ARMS_ID,
                    shared: true,
                  },
                ],
              },
            ],
            repeats: [
              {
                value: 1000,
                repeats: 1,
                field: "limit::points",
                scope: "roster",
                childId: "any",
                shared: true,
                roundUp: false,
                includeChildSelections: true,
                includeChildForces: true,
              },
            ],
          },
          {
            comment: COMBINED_ARMS_COMMENT,
            conditionGroups: [
              {
                conditions: [
                  {
                    type: "instanceOf",
                    value: 1,
                    field: "selections",
                    scope: "ancestor",
                    childId: COMBINED_AND_GRAND_ID,
                    shared: true,
                  },
                  {
                    type: "instanceOf",
                    value: 1,
                    field: "selections",
                    scope: "ancestor",
                    childId: COMBINED_ARMS_ID,
                    shared: true,
                  },
                ],
                type: "or",
              },
            ],
            type: "set",
            value: val,
            field: newConstraint.id,
            conditions: [
              {
                type: "lessThan",
                value: 2000,
                field: "limit::points",
                scope: "roster",
                childId: "any",
                shared: true,
                includeChildSelections: true,
                includeChildForces: true,
              },
            ],
          },
        ];

        replaceTagged(rootEntry, COMBINED_ARMS_COMMENT, [newConstraint], newModifiers);
      }
    },
    { nested: false, categories: false },
  );
}

function editModifierConditions(catalogues: Catalogue[]) {
  forEachEntry(
    catalogues,
    (catalogue, rootEntry) => {
      for (let modifier of rootEntry.modifiers || []) {
        if (modifier.conditions) {
          let foundCondition: BSICondition | null = null;

          for (let firstCondition of modifier.conditions || []) {
            if (
              firstCondition.childId === OPEN_WAR_ID &&
              firstCondition.field === "selections" &&
              (firstCondition.type === "instanceOf" || firstCondition.type === "notInstanceOf")
            ) {
              foundCondition = firstCondition;
            }
          }
          if (foundCondition) {
            const type = foundCondition.type;
            const newConditionGroup: BSIConditionGroup = {
              conditions: [
                {
                  type: type,
                  value: 1,
                  field: "selections",
                  scope: "force",
                  childId: OPEN_WAR_ID,
                  shared: true,
                  includeChildSelections: true,
                },
                {
                  type: type,
                  value: 1,
                  field: "selections",
                  scope: "force",
                  childId: COMBINED_ARMS_ID,
                  shared: true,
                  includeChildSelections: true,
                },
                {
                  type: type,
                  value: 1,
                  field: "selections",
                  scope: "force",
                  childId: GRAND_MELEE_ID,
                  shared: true,
                  includeChildSelections: true,
                },
                {
                  type: type,
                  value: 1,
                  field: "selections",
                  scope: "force",
                  childId: COMBINED_AND_GRAND_ID,
                  shared: true,
                  includeChildSelections: true,
                },
                {
                  type: type,
                  value: 1,
                  field: "selections",
                  scope: "force",
                  childId: BATTLE_MARCH_ID,
                  shared: true,
                  includeChildSelections: true,
                },
              ],
              type: type === "instanceOf" ? "or" : "and",
            };

            $store.edit_node(modifier as any, {
              conditions: modifier.conditions!.filter((elt) => elt != foundCondition),
              conditionGroups: (modifier.conditionGroups || []).concat(newConditionGroup),
            });
          }
        }
      }
    },
    { nested: true, categories: false, root: false },
  );
}

function* iterateEntriesRec(entry: Entry): Generator<Entry> {
  const resolved = (entry as any).target || entry;
  yield resolved;
  for (const sub of resolved.iterateSelectionEntries()) {
    yield* iterateEntriesRec(sub);
  }
}

function getNestedEntries(entries: Entry[]): Entry[] {
  const roots = new Set(entries.map((e) => (e as any).target || e));
  const seen = new Set<Entry>();
  const result: Entry[] = [];
  for (const entry of entries) {
    for (const sub of iterateEntriesRec(entry)) {
      if (!roots.has(sub) && !seen.has(sub)) {
        seen.add(sub);
        result.push(sub);
      }
    }
  }
  return result;
}

interface ForEachEntryOptions {
  root?: boolean;
  nested?: boolean;
  categories?: boolean;
}

function forEachEntry(
  catalogues: Catalogue[],
  callback: (catalogue: Catalogue, entry: Entry) => void,
  options: ForEachEntryOptions = {},
) {
  // A default parameter replaces the WHOLE object, so passing { nested: false } used to silently
  // drop root: true and iterate nothing at all. Merge per key, and treat the three flags alike.
  const root = options.root !== false;
  const nested = options.nested !== false;
  const categories = options.categories !== false;

  const processed = new Set<Entry>();
  for (const catalogue of catalogues) {
    const allEntries: Entry[] = (catalogue.selectionEntries || []).concat(catalogue.entryLinks || []);

    const entries: Entry[] = [];
    if (root) entries.push(...allEntries);

    if (nested) {
      entries.push(...getNestedEntries(allEntries));
    }
    if (categories) {
      entries.push(...(catalogue.categoryEntries || []));
    }
    for (const entry of entries) {
      const resolved = entry;
      if (processed.has(resolved)) continue;
      processed.add(resolved);
      callback(catalogue, entry);
    }
  }
}

function removeBattleMarchFloorNoCondition(catalogues: Catalogue[]) {
  forEachEntry(
    catalogues,
    (catalogue, rootEntry) => {
      for (let modifier of rootEntry.modifiers || []) {
        if (modifier.comment === BATTLE_MARCH_FLOOR_COMMENT && (modifier.conditions || []).length == 0) {
          $store.del_node(modifier as any);
        }
      }
    },
    { nested: false, categories: true },
  );
}

function addBattleMarchFloor(catalogues: Catalogue[]) {
  forEachEntry(catalogues, (catalogue, rootEntry) => {
    const modifiers = rootEntry.modifiers || [];

    // One floor per constraint, not one per matching increment: two "0-X per 1000 points"
    // increments on the same constraint used to yield two identical floors.
    const needFloor = new Set<string>();
    for (const modifier of modifiers) {
      if (modifier.comment === BATTLE_MARCH_FLOOR_COMMENT) continue;
      if (modifier.type !== "increment" || modifier.comment === COMBINED_ARMS_COMMENT) continue;
      const repeats = modifier.repeats || [];
      if (!repeats.length) continue;
      if (repeats[0].value === 1000 && repeats[0].field === "limit::points") {
        needFloor.add(modifier.field as string);
      }
    }

    // Rebuild rather than top up, so a floor written in an older shape is replaced instead of kept.
    const kept = modifiers.filter((elt) => elt.comment !== BATTLE_MARCH_FLOOR_COMMENT);
    const toAdd: BSIModifier[] = [];
    for (const field of needFloor) {
      toAdd.push({
        repeats: [],
        conditionGroups: [],
        type: "floor",
        value: 1,
        field,
        comment: BATTLE_MARCH_FLOOR_COMMENT,
        conditions: [
          {
            type: "instanceOf",
            value: 1,
            field: "selections",
            scope: "ancestor",
            childId: BATTLE_MARCH_ID,
            shared: true,
          },
        ],
      });
    }

    // Single write at the end: the previous version edited rootEntry.modifiers while iterating it.
    if (toAdd.length || kept.length !== modifiers.length) {
      $store.edit_node(rootEntry as EditorBase, { modifiers: kept.concat(toAdd) });
    }
  });
}

function hasPerThousandModifier(rootEntry: EditorBase) {
  for (let modifier of rootEntry.modifiers || []) {
    if (modifier.type === "increment" && modifier.comment != COMBINED_ARMS_COMMENT) {
      const repeats = modifier.repeats || [];
      if (repeats.length) {
        if (repeats[0].value === 1000 && repeats[0].field === "limit::points") {
          return true;
        }
      }
    }
  }
  return false;
}

function addPerThousandCategory(catalogues: Catalogue[]) {
  forEachEntry(
    catalogues,
    (catalogue, rootEntry) => {
      let found = hasPerThousandModifier(rootEntry as EditorBase);

      for (let categoryLink of rootEntry.categoryLinks || []) {
        if (hasPerThousandModifier(categoryLink.target as unknown as EditorBase)) {
          found = true;
        }
      }

      // Rebuild our own link rather than topping up, and never touch a link added by hand:
      // matching is on our tag, not on the target id.
      const links = rootEntry.categoryLinks || [];
      const kept = links.filter((link) => (link as any).comment !== PER_THOUSAND_COMMENT);
      const byHand = kept.some((link) => (link as any).targetId === ONE_PER_THOUSAND_ID);

      const next = found && !byHand
        ? kept.concat([
            {
              comment: PER_THOUSAND_COMMENT,
              name: "OnePerThousandConstraint",
              hidden: true,
              targetId: ONE_PER_THOUSAND_ID,
              primary: false,
            } as any,
          ])
        : kept;

      if (next.length !== links.length) {
        $store.edit_node(rootEntry as EditorBase, { categoryLinks: next });
      }
    },
    {
      categories: false,
      root: true,
      nested: true,
    },
  );
}

function removePerThousandCategory(catalogues: Catalogue[]) {
  forEachEntry(
    catalogues,
    (catalogue, rootEntry) => {
      const links = rootEntry.categoryLinks || [];
      // Only the links this script wrote: matched on our comment, never on the target id alone,
      // so a link added by hand to the same category is left alone.
      const kept = links.filter((link) => (link as any).comment !== PER_THOUSAND_COMMENT);
      if (kept.length !== links.length) {
        $store.edit_node(rootEntry as EditorBase, { categoryLinks: kept });
      }
    },
    {
      categories: false,
      root: true,
      nested: true,
    },
  );
}

function removeBattleMarchPoints(catalogues: Catalogue[]) {
  removeConstraintsWithComment(catalogues, BATTLE_MARCH_POINTS_COMMENT);
}

function addBattleMarchPoints(catalogues: Catalogue[]) {
  forEachEntry(
    catalogues,
    (catalogue, rootEntry) => {
      let newConstraint: BSIConstraint = {
        comment: BATTLE_MARCH_POINTS_COMMENT,
        type: "max",
        value: -1,
        field: "points",
        scope: "self",
        shared: true,
        id: keepConstraintId(rootEntry, BATTLE_MARCH_POINTS_COMMENT),
        includeChildSelections: true,
        includeChildForces: true,
        percentValue: false,
      };

      let percent = 0.25;
      const primary =
        rootEntry.target?.getPrimaryCategoryLink()?.target?.name || rootEntry.getPrimaryCategoryLink()?.target.name;
      switch (primary) {
        case "Characters":
          percent = 0.25;
          break;
        case "Core":
          percent = 0.35;
          break;
        case "Special":
          percent = 0.3;
          break;
        case "Rare":
          percent = 0.25;
          break;
        case "Mercenaries":
          percent = 0.25;
          break;
      }

      let newModifiers: BSIModifier[] = [
        {
          comment: BATTLE_MARCH_POINTS_COMMENT,
          conditionGroups: [
            {
              conditions: [
                {
                  type: "instanceOf",
                  value: 1,
                  field: "selections",
                  scope: "ancestor",
                  childId: BATTLE_MARCH_ID,
                  shared: true,
                },
              ],
              type: "and",
            },
          ],
          type: "set",
          value: 0,
          field: newConstraint.id,
        },
        {
          // Modifier for Normal forces
          comment: BATTLE_MARCH_POINTS_COMMENT,
          conditionGroups: [
            {
              conditions: [
                {
                  type: "instanceOf",
                  value: 1,
                  field: "selections",
                  scope: "ancestor",
                  childId: BATTLE_MARCH_ID,
                  shared: true,
                },
              ],
              type: "and",
            },
            {
              type: "or",
              conditionGroups: [],
              conditions: [
                {
                  type: "instanceOf",
                  value: 1,
                  field: "selections",
                  scope: "force",
                  childId: BATTLE_MARCH_ID,
                  shared: true,
                },
                {
                  type: "instanceOf",
                  value: 1,
                  field: "selections",
                  scope: "force",
                  childId: COMBINED_ARMS_ID,
                  shared: true,
                },
                {
                  type: "instanceOf",
                  value: 1,
                  field: "selections",
                  scope: "force",
                  childId: GRAND_MELEE_ID,
                  shared: true,
                },
                {
                  type: "instanceOf",
                  value: 1,
                  field: "selections",
                  scope: "force",
                  childId: COMBINED_AND_GRAND_ID,
                  shared: true,
                },
                {
                  type: "instanceOf",
                  value: 1,
                  field: "selections",
                  scope: "force",
                  childId: BATTLE_MARCH_ID,
                  shared: true,
                },
              ],
            },
          ],
          repeats: [
            {
              value: 1 / percent,
              repeats: 1,
              field: "limit::points",
              scope: "roster",
              childId: "any",
              shared: true,
              roundUp: false,
              includeChildSelections: true,
              includeChildForces: true,
            },
          ],
          type: "increment",
          value: 1,
          field: newConstraint.id,
        },
        {
          // Modifier for Allies
          comment: BATTLE_MARCH_POINTS_COMMENT,
          conditionGroups: [
            {
              conditions: [
                {
                  type: "instanceOf",
                  value: 1,
                  field: "selections",
                  scope: "ancestor",
                  childId: BATTLE_MARCH_ID,
                  shared: true,
                },
              ],
              type: "and",
            },
            {
              type: "and",
              conditionGroups: [],
              conditions: [
                {
                  type: "notInstanceOf",
                  value: 1,
                  field: "selections",
                  scope: "force",
                  childId: OPEN_WAR_ID,
                  shared: true,
                },
                {
                  type: "notInstanceOf",
                  value: 1,
                  field: "selections",
                  scope: "force",
                  childId: COMBINED_ARMS_ID,
                  shared: true,
                },
                {
                  type: "notInstanceOf",
                  value: 1,
                  field: "selections",
                  scope: "force",
                  childId: GRAND_MELEE_ID,
                  shared: true,
                },
                {
                  type: "notInstanceOf",
                  value: 1,
                  field: "selections",
                  scope: "force",
                  childId: COMBINED_AND_GRAND_ID,
                  shared: true,
                },
                {
                  type: "notInstanceOf",
                  value: 1,
                  field: "selections",
                  scope: "force",
                  childId: BATTLE_MARCH_ID,
                  shared: true,
                },
              ],
            },
          ],
          repeats: [
            {
              value: 1 / percent,
              repeats: 1,
              field: "points",
              scope: "force",
              childId: "any",
              shared: true,
              roundUp: false,
              includeChildSelections: true,
              includeChildForces: true,
            },
          ],
          type: "increment",
          value: 1,
          field: newConstraint.id,
        },
      ];
      replaceTagged(rootEntry, BATTLE_MARCH_POINTS_COMMENT, [newConstraint], newModifiers);
    },
    { nested: false, categories: false, root: true },
  );
}

/**
 * One switchable element of the matched play ruleset.
 *
 * `clear` must undo exactly what `write` produces, so that running the same element twice
 * leaves the data identical to running it once. Every element is therefore rewritten from
 * scratch rather than patched: clear, then write.
 */
interface Element {
  key: string;
  label: string;
  clear: (catalogues: Catalogue[]) => void;
  write?: (catalogues: Catalogue[]) => void;
}

const ELEMENTS: Element[] = [
  {
    key: "grandMelee",
    label: "Grand Melee point caps",
    clear: removeGrandMeleeConstraints,
    write: addGrandMeleeConstraints,
  },
  {
    key: "combinedArms",
    label: "Combined Arms duplicate caps",
    clear: removeCombinedArmsConstraints,
    write: addCombinedArmsConstraints,
  },
  {
    key: "battleMarchPoints",
    label: "Battle March point caps",
    clear: removeBattleMarchPoints,
    write: addBattleMarchPoints,
  },
  {
    key: "battleMarchFloor",
    label: "Battle March floor on 0-X per 1000 points limits",
    clear: (catalogues) => removeConstraintsWithComment(catalogues, BATTLE_MARCH_FLOOR_COMMENT),
    write: addBattleMarchFloor,
  },
  {
    key: "perThousandCategory",
    label: "Single 0-X per 1000 points slot category",
    clear: removePerThousandCategory,
    write: addPerThousandCategory,
  },
  {
    // One-shot migration, not a generated element: it rewrites hand-written Open War conditions
    // into a condition group covering all five game modes. Nothing to clear -- the old shape is
    // gone once rewritten, so this one is deliberately not reversible.
    key: "migrateGameModeConditions",
    label: "Migrate lone Open War conditions into a five-mode group (one-way)",
    clear: () => {},
    write: editModifierConditions,
  },
  {
    // Legacy cleanup: floors written before the condition was added, which fire in every mode.
    key: "dropUnconditionalFloors",
    label: "Drop Battle March floors that have no condition (legacy cleanup)",
    clear: removeBattleMarchFloorNoCondition,
  },
];

export default {
  name: "[TOW 4] Matched Play Constraints",
  description:
    "Warhammer: The Old World only. Writes the matched play composition limits onto every root entry. " +
    "Tick only the elements you want -- nothing runs unless it is ticked. Each element is tagged with its own " +
    "comment and is cleared before being rewritten, so re-running is idempotent. Tick 'Remove only' to strip an " +
    "element instead of writing it.",
  arguments: [
    { name: "catalogues", type: "catalogue[]" },
    ...ELEMENTS.map((element) => ({
      name: element.label,
      type: "boolean",
      optional: true,
      default: false,
    })),
    {
      name: "Remove only (undo: clear the ticked elements without rewriting them)",
      type: "boolean",
      optional: true,
      default: false,
    },
  ],
  run(catalogues: Catalogue[], ...rest: boolean[]) {
    const removeOnly = rest[ELEMENTS.length] === true;
    const picked = ELEMENTS.filter((_, i) => rest[i] === true);

    if (!catalogues?.length) return ["No catalogue selected."];
    if (!picked.length) {
      return ["Nothing ticked. Tick at least one element above, otherwise this script does nothing."];
    }

    const log: string[] = [];
    for (const element of picked) {
      // Deliberately NOT clear-then-write: every writer replaces its own tagged elements in place
      // and reuses the existing constraint id. Clearing first would delete the id it needs to reuse
      // and mint a new one for every entry, which is exactly what we are avoiding.
      if (removeOnly || !element.write) {
        element.clear(catalogues);
        log.push(`${element.label}: removed`);
        continue;
      }
      element.write(catalogues);
      log.push(`${element.label}: rewritten (constraint ids preserved)`);
    }
    log.push(`Done on ${catalogues.length} catalogue(s). Remember to bump each catalogue's revision.`);
    return log;
  },
};
