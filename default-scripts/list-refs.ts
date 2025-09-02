import type { Base } from "~/assets/shared/battlescribe/bs_main";
import type { Catalogue, EditorBase } from "~/assets/shared/battlescribe/bs_main_catalogue";

export default {
    name: "List used imports",
    description: "Lists what a catalogue uses from an imported catalogue, can used to find out if an import is not necesarry",
    arguments: [
        {
            name: "catalogue",
            type: "catalogue"
        },
        {
            name: "catalogue (imported)",
            type: "catalogue[]"
        }
    ],
    run(from: Catalogue, to: Catalogue[]) {
        const result = [] as Array<[Base | EditorBase, string] | EditorBase>
        for (const to_catalogue of to) {
            if (!from.imports.find(o => o.name === to_catalogue.name) && to.length === 1) {
                throw new Error(`${from.name} doesn't import ${to_catalogue.name}`)
            }
            to_catalogue.forEachObjectWhitelist((node: EditorBase) => {
                for (const link of node.refs || []) {
                    if (link.catalogue.name === from.name) {
                        result.push(node)
                        break;
                    }
                }

                for (const cond of node.other_refs || []) {
                    if (cond.catalogue.name === from.name) {
                        result.push(node)
                        break;
                    }
                }
            });
            if (from.importsWithEntries.find(o => o.name === to_catalogue.name)) {
                for (const entry of to_catalogue.selectionEntries || []) {
                    if (entry.import === false) continue;
                    result.push([entry, "root"])
                }
                for (const entry of to_catalogue.entryLinks || []) {
                    if (entry.import === false) continue;
                    result.push([entry, "root"])
                }
            }
        }
        return result;
    }
}