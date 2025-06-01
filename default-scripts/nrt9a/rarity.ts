import { generateBattlescribeId } from "~/assets/shared/battlescribe/bs_helpers";
import { Catalogue, EditorBase } from "~/assets/shared/battlescribe/bs_main_catalogue";
import { BSIConstraint, BSIModifier, BSIRepeat } from "~/assets/shared/battlescribe/bs_types";

export async function insertUnitRarity(catalogue: Catalogue) {
  const entries = (catalogue.sharedSelectionEntries || []).concat(catalogue.sharedSelectionEntryGroups || []);

  const rarityTotals: any = {
    Regular: { total: 0, limit: 1, perpoints: 500 },
    Common: { total: 0, limit: 1, perpoints: 1000 },
    Uncommon: { total: 0, limit: 1, perpoints: 1500 },
    Rare: { total: 0, limit: 1, perpoints: 2500 },
    Extraordinary: { total: 0, limit: 1, perpoints: 4000 },
    Legendary: { total: 0, limit: 1, perpoints: null },
  };

  for (let elt of entries) {
    elt.forEach((child) => {
      if (child.comment?.startsWith("Rarity")) {
        const rarity = child.comment.split(":")[1].trim();
        const total = rarityTotals[rarity];

        const constraint: BSIConstraint = {
          id: generateBattlescribeId(),
          type: "max",
          scope: "roster",
          field: "selections",
          value: 0,
        };
        const repeat: BSIRepeat = {
          value: total.perpoints,
          repeats: 1,
          field: "limit::24fd-8af8-0c78-001c",
          scope: "roster",
          childId: "any",
          shared: true,
          roundUp: false,
          includeChildSelections: true,
          includeChildForces: true,
        };
        const modifier: BSIModifier = {
          type: "increment",
          field: constraint.id,
          value: 1,
          repeats: [repeat],
        };

        if (!child.modifiers) child.modifiers = [];
        $store.add(constraint, "constraints", child as EditorBase);
        $store.add(modifier, "modifiers", child as EditorBase);
      }
    });
  }
}
