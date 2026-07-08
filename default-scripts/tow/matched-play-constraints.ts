import { generateBattlescribeId } from "~/assets/shared/battlescribe/bs_helpers";
import { Entry } from "~/assets/shared/battlescribe/bs_main";
import type { Catalogue, EditorBase } from "~/assets/shared/battlescribe/bs_main_catalogue";
import { BSICondition, BSIConditionGroup, BSIConstraint, BSIModifier } from "~/assets/shared/battlescribe/bs_types";

const BATTLE_MARCH_ID = "e40a-36c4-0c66-472a";
const OPEN_WAR_ID = "8214-cf48-b1cd-5f5e";
const COMBINED_ARMS_ID = "1ae6-ed95-069e-a390";
const GRAND_MELEE_ID = "cdbe-ecb9-27cb-fd2b";
const COMBINED_AND_GRAND_ID = "0750-5d17-d708-f990";
const ONE_PER_THOUSAND_ID = "27c9-52f0-c942-681e";

function removeConstraintsWithComment(catalogues: Catalogue[], comment: string) {
  forEachEntry(catalogues, (catalogue, rootEntry) => {
    $store.edit_node(rootEntry as EditorBase, {
      constraints: rootEntry.constraints?.filter((elt) => elt.comment != comment),
      modifiers: rootEntry.modifiers?.filter((elt) => elt.comment != comment),
      modifierGroups: rootEntry.modifierGroups?.filter((elt) => elt.comment != comment),
    });
  });
}

function removeGrandMeleeConstraints(catalogues: Catalogue[]) {
  removeConstraintsWithComment(catalogues, "Grand melee");
}

function addGrandMeleeConstraints(catalogues: Catalogue[]) {
  forEachEntry(
    catalogues,
    (catalogue, rootEntry) => {
      let newConstraint: BSIConstraint = {
        comment: "Grand melee",
        type: "max",
        value: -1,
        field: "points",
        scope: "self",
        shared: true,
        id: generateBattlescribeId(),
        includeChildSelections: true,
        includeChildForces: true,
        percentValue: false,
      };

      let newModifiers: BSIModifier[] = [
        {
          comment: "Grand melee",
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
          comment: "Grand melee",
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
          comment: "Grand melee",
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
      $store.edit_node(rootEntry as EditorBase, {
        constraints: (rootEntry.constraints || []).concat([newConstraint]),
        modifiers: (rootEntry.modifiers || []).concat(newModifiers),
      });
    },
    { nested: false, categories: false },
  );
}

function removeCombinedArmsConstraints(catalogues: Catalogue[]) {
  removeConstraintsWithComment(catalogues, "Combined arms");
}

function alreadyHasLimitation(rootEntry: Entry) {
  // Check if there are limitations on categories
  for (let link of rootEntry.categoryLinks || []) {
    for (let constraint of link.target.constraints || []) {
      if (constraint.scope == "roster" || constraint.scope == "force") {
        if (constraint.type === "max" && constraint.comment != "Combined arms") {
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
      if (constraint.comment != "Combined arms" && constraint.type === "max") {
        console.log(
          `Entry: ${rootEntry.name}: Skipped Combined arms constraints because it already has constraints`,
          constraint,
        );
        return true;
      }
    }
  }
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
          comment: "Combined arms",
          type: "max",
          value: -1,
          field: "selections",
          scope: "roster",
          shared: true,
          id: generateBattlescribeId(),
          includeChildSelections: true,
          includeChildForces: true,
        };

        const newModifiers: BSIModifier[] = [
          {
            comment: "Combined arms",
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
            comment: "Combined arms",
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
            comment: "Combined arms",
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

        $store.edit_node(rootEntry as EditorBase, {
          constraints: (rootEntry.constraints || []).concat([newConstraint]),
          modifiers: (rootEntry.modifiers || []).concat(newModifiers),
        });
      }
    },
    { nested: false, categories: false },
  );
}

function editModifierConditions(catalogues: Catalogue[]) {
  forEachEntry(
    catalogues,
    (catalogue, rootEntry) => {
      console.log(rootEntry);
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
                  childId: "8214-cf48-b1cd-5f5e",
                  shared: true,
                  includeChildSelections: true,
                },
                {
                  type: type,
                  value: 1,
                  field: "selections",
                  scope: "force",
                  childId: "1ae6-ed95-069e-a390",
                  shared: true,
                  includeChildSelections: true,
                },
                {
                  type: type,
                  value: 1,
                  field: "selections",
                  scope: "force",
                  childId: "cdbe-ecb9-27cb-fd2b",
                  shared: true,
                  includeChildSelections: true,
                },
                {
                  type: type,
                  value: 1,
                  field: "selections",
                  scope: "force",
                  childId: "0750-5d17-d708-f990",
                  shared: true,
                  includeChildSelections: true,
                },
                {
                  type: type,
                  value: 1,
                  field: "selections",
                  scope: "force",
                  childId: "e40a-36c4-0c66-472a",
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
  options: ForEachEntryOptions = { nested: true, categories: true, root: true },
) {
  const processed = new Set<Entry>();
  for (const catalogue of catalogues) {
    const allEntries: Entry[] = (catalogue.selectionEntries || []).concat(catalogue.entryLinks || []);

    const entries: Entry[] = [];
    if (options.root) entries.push(...allEntries);

    if (options.nested !== false) {
      entries.push(...getNestedEntries(allEntries));
    }
    if (options.categories !== false) {
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
        if (modifier.comment === "Battle march" && (modifier.conditions || []).length == 0) {
          $store.del_node(modifier as any);
        }
      }
    },
    { nested: false, categories: true },
  );
}

function addBattleMarchFloor(catalogues: Catalogue[]) {
  forEachEntry(catalogues, (catalogue, rootEntry) => {
    for (let modifier of rootEntry.modifiers || []) {
      if (modifier.type === "increment" && modifier.comment != "Combined arms") {
        const repeats = modifier.repeats || [];
        if (repeats.length) {
          if (repeats[0].value === 1000 && repeats[0].field === "limit::points") {
            const newModifie: BSIModifier = {
              repeats: [],
              conditionGroups: [],
              type: "floor",
              value: 1,
              field: modifier.field,
              comment: "Battle march",
              conditions: [
                {
                  type: "instanceOf",
                  value: 1,
                  field: "selections",
                  scope: "ancestor",
                  childId: "e40a-36c4-0c66-472a",
                  shared: true,
                },
              ],
            };
            $store.edit_node(rootEntry as EditorBase, {
              modifiers: rootEntry.modifiers?.concat([newModifie]),
            });
            console.log("Modifier detected on entry: [" + catalogue.name + "] " + rootEntry.name, rootEntry.modifiers);
          }
        }
      }
    }
  });
}

function hasPerThousandModifier(rootEntry: EditorBase) {
  for (let modifier of rootEntry.modifiers || []) {
    if (modifier.type === "increment" && modifier.comment != "Combined arms") {
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

      if (found) {
        console.log(rootEntry);
        $store.edit_node(rootEntry as EditorBase, {
          categoryLinks: (rootEntry.categoryLinks || []).concat([
            {
              comment: "Battle March Category",
              name: "OnePerThousandConstraint",
              hidden: true,
              targetId: ONE_PER_THOUSAND_ID,
              primary: false,
            } as any,
          ]),
        });
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
  removeConstraintsWithComment(catalogues, "Battle March points");
}

function addBattleMarchPoints(catalogues: Catalogue[]) {
  forEachEntry(
    catalogues,
    (catalogue, rootEntry) => {
      let newConstraint: BSIConstraint = {
        comment: "Battle March points",
        type: "max",
        value: -1,
        field: "points",
        scope: "self",
        shared: true,
        id: generateBattlescribeId(),
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
          comment: "Battle March points",
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
          comment: "Battle March points",
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
          comment: "Battle March points",
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
      $store.edit_node(rootEntry as EditorBase, {
        constraints: (rootEntry.constraints || []).concat([newConstraint]),
        modifiers: (rootEntry.modifiers || []).concat(newModifiers),
      });
    },
    { nested: false, categories: false, root: true },
  );
}

export default {
  name: "[TOW 4] Matched Play Constraints",
  description: "Adds Matched Play Constraints",
  arguments: [
    {
      name: "catalogues",
      type: "catalogue[]",
    },
  ],
  run(catalogues: Catalogue[]) {
    // removeCombinedArmsConstraints(catalogues);
    //addCombinedArmsConstraints(catalogues);

    // addGrandMeleeConstraints(catalogues);
    //editModifierConditions(catalogues);
    //addBattleMarchFloor(catalogues);
    // removeBattleMarchPoints(catalogues);
    //addBattleMarchPoints(catalogues);
    //editModifierConditions(catalogues);
    //removeConstraintsWithComment(catalogues, "Battle march");
    //addBattleMarchFloor(catalogues);
    //removeBattleMarchFloorNoCondition(catalogues);
    //  removeConstraintsWithComment(catalogues, "Battle march");
    //  addBattleMarchFloor(catalogues);
    //editModifierConditions(catalogues);
    removeConstraintsWithComment(catalogues, "Battle march");
    //addPerThousandCategory(catalogues);
    addBattleMarchFloor(catalogues);
    return [];
  },
};
