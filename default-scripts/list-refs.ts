import type { Base } from "~/assets/shared/battlescribe/bs_main";
import type { Catalogue, EditorBase } from "~/assets/shared/battlescribe/bs_main_catalogue";

export default {
    name: "List all used",
    description: "Find out what a catalogue uses from an imported catalogue, used to find out if an import is not necesarry",
    arguments: [
        {
            name: "catalogue (importing)",
            type: "catalogue"
        },
        {
            name: "catalogue (imported)",
            type: "catalogue"
        }
    ],
    run(from: Catalogue, to: Catalogue) {
        const result = [] as Array<[Base | EditorBase, string] | EditorBase>
        if (!from.imports.find(o => o.name === to.name)) {
            throw new Error(`${from.name} doesn't import ${to.name}`)
        }
        to.forEachObjectWhitelist((node: EditorBase) => {
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
        if (from.importsWithEntries.find(o => o.name === to.name)) {
            for (const entry of to.selectionEntries || []) {
                if (entry.import === false) continue;
                result.push([entry, "root"])
            }
            for (const entry of to.entryLinks || []) {
                if (entry.import === false) continue;
                result.push([entry, "root"])
            }
        }
        return result;
    }
}