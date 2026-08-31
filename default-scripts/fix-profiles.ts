import type { ProfileType } from "~/assets/shared/battlescribe/bs_main";
import type { Catalogue, EditorBase } from "~/assets/shared/battlescribe/bs_main_catalogue";
import type { ScriptRunContext } from "~/stores/scriptsStore";
export function findParentWhere<T extends { parent?: T }>(self: T, fn: (node: T) => any): T | undefined {
    let current = self.parent;
    while (current && !Object.is(current, current.parent)) {
        if (fn(current)) return current;
        current = current.parent;
    }
    return undefined;
}
/**
 * Coalesces runs per game system.
 *
 * Editing a profile type touches every profile in every catalogue, and the right panel emits a
 * `change` per blur, so a burst of edits has to produce one pass rather than one each.
 */
const timers: Record<string, ReturnType<typeof setTimeout>> = {};
const DEBOUNCE_MS = 800;

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

function queue(systemId: string) {
    if (timers[systemId]) clearTimeout(timers[systemId]);
    timers[systemId] = setTimeout(async () => {
        delete timers[systemId];
        const system = $store.get_system(systemId);
        if (system) {
            await system.loadAll();
            const catalogues = system.getAllLoadedCatalogues();
            catalogues.map((o) => o.processForEditor());
            // run_background so the whole repair pass is one undo entry, a throw is reported the
            // same way any other script failure is, and the titlebar says it is happening.
            const output = await $store.scripts.run_background("Fix profiles", (ctx) => run(catalogues, ctx));

            // run() returns [...notes, fixes], or ["No Issues found"] -- whose last element is a
            // string, and reading .length off that reports 15 repairs for a run that did nothing.
            const last = Array.isArray(output) ? output[output.length - 1] : undefined;
            const fixes = (Array.isArray(last) ? last : []) as Array<[EditorBase, string]>;

            if (fixes.length) {
                // A profile usually collects several fixes at once -- a wrong typeName and three
                // renamed characteristics is four entries on one profile -- so counting entries
                // and calling them "things" overstates it and says nothing about what changed.
                const profiles = new Set(fixes.map(([node]) => node)).size;
                // Collapsed, with every node passed through as a second argument so it can be
                // expanded and clicked in devtools. `output` rides along on the header line, which
                // is where the removals -- the destructive half -- are.
                console.groupCollapsed(
                    `Fix profiles: ${plural(fixes.length, "change")} on ${plural(profiles, "profile")}, ` +
                    `across ${plural(catalogues.length, "catalogue")}`,
                    output,
                );
                for (const [node, message] of fixes) {
                    console.log(`${node.getCatalogue()?.name} › ${node.getName()}: ${message}`, node);
                }
                console.groupEnd();
                // Toast only when it changed something: this fires on every edit to a profile
                // type, and "nothing to do" after each one is noise rather than feedback.
                notify(`Fix profiles: updated ${plural(profiles, "profile")}`);
            } else {
                console.log(`Fix profiles: nothing to repair in ${plural(catalogues.length, "catalogue")}`);
            }
        } else {
            throw new Error("Couldn't queue fix-profiles: Failed to get system with id " + systemId);
        }
    }, DEBOUNCE_MS);
}

/**
 * `ctx` is the editor's run context, handed in after the declared arguments. Optional, because
 * the change hook below calls this directly with nothing to report progress to.
 */
const run = async (catalogues: Catalogue[], ctx?: ScriptRunContext) => {
        const result = [] as [EditorBase, string][];
        const output = [] as Array<Array<string | object> | string>
        catalogues.map(o => o.processForEditor())
        for (const [index, catalogue] of catalogues.entries()) {
            // Awaited once per catalogue rather than per node: it yields to let the bar paint, and
            // a yield per profile would cost more than the repair does.
            await ctx?.progress(index, catalogues.length, catalogue.name)
            catalogue.forEachObjectWhitelist((obj: EditorBase) => {
                if (obj.isProfile() && !obj.isLink() && obj.typeId) {
                    const type = obj.catalogue.findOptionById(obj.typeId) as ProfileType;
                    if (!type) return;

                    // Fix typeName
                    if (type.name !== obj.typeName) {
                        result.push([obj, `fixed typeName: ${obj.typeName} -> ${type.name}`])
                        $store.edit_node(obj, { typeName: type.name })
                    }
                    // Fix characteristic with wrong typeId
                    for (const c of obj.characteristics || []) {
                        const ct = type.characteristicTypes?.find(ct => ct.name === c.name)
                        if (ct && c.typeId !== ct.id) {
                            result.push([obj, `fixed typeId: ${c.name}`])
                            $store.edit_node(c as unknown as EditorBase, { typeId: ct.id })
                        }
                    }
                    // Fix attribute with wrong typeId
                    for (const c of obj.attributes || []) {
                        const ct = type.attributeTypes?.find(ct => ct.name === c.name)
                        if (ct && c.typeId !== ct.id) {
                            result.push([obj, `fixed typeId: ${c.name}`])
                            $store.edit_node(c as unknown as EditorBase, { typeId: ct.id })
                        }
                    }

                    // Fix characteristic with wrong name
                    for (const c of obj.characteristics || []) {
                        const ct = type.characteristicTypes?.find(ct => ct.id === c.typeId)
                        if (ct && c.name !== ct.name) {
                            result.push([obj, `fixed characteristic name: ${c.name} -> ${ct.name}`])
                            $store.edit_node(c as unknown as EditorBase, { name: ct.name })
                        }
                    }

                    // Fix attribute with wrong name
                    for (const c of obj.attributes || []) {
                        const ct = type.attributeTypes?.find(ct => ct.id === c.typeId)
                        if (ct && c.name !== ct.name) {
                            result.push([obj, `fixed attribute name: ${c.name} -> ${ct.name}`])
                            $store.edit_node(c as unknown as EditorBase, { name: ct.name })
                        }
                    }
                    // Fix characteristic order & remove extra characteristics
                    const missingCharacteristics = type.characteristicTypes?.filter(ct => !obj.characteristics?.find(c => c.typeId === ct.id)) || []
                    const characteristicBadIndex = obj.characteristics?.find((c, i) => i !== type.characteristicTypes?.findIndex(ct => ct.id === c.typeId))
                    if (missingCharacteristics.length || characteristicBadIndex) {
                        const out_characteristics = []
                        const in_characteristics = [...(obj.characteristics || [])]
                        for (const ct of missingCharacteristics) {
                            in_characteristics.push({
                                name: ct.name,
                                typeId: ct.id,
                                $text: "",
                            })
                            result.push([obj, `added missing characteristic: ${ct.name}`])
                        }
                        if (characteristicBadIndex) {
                            result.push([obj, `fixed characteristics order`])
                        }
                        for (const c of in_characteristics) {
                            const idx = type.characteristicTypes?.findIndex(ct => ct.id === c.typeId)
                            if (idx >= 0) {
                                out_characteristics[idx] = c
                            } else {
                                output.push([[obj, `removed extra characteristic: ${c.name}`]])
                                output.push(`<pre style="background-color: rgba(0,0,0,0.1); border: 1px solid rgba(0.5,0.5,0.5,0.15)">${c.$text}</pre><hr class="gray" style="border-bottom: none;"/>`)
                            }
                        }
                        $store.edit_node(obj, { characteristics: out_characteristics })
                    }
                    // Fix attribute order & remove extra attributes
                    const missingAttributes = type.attributeTypes?.filter(ct => !obj.attributes?.find(c => c.typeId === ct.id)) || []
                    const attributeBadIndex = obj.attributes?.find((c, i) => i !== type.attributeTypes?.findIndex(ct => ct.id === c.typeId))
                    if (missingAttributes.length || attributeBadIndex) {
                        const out_attributes = []
                        const in_attributes = [...(obj.attributes || [])]
                        for (const ct of missingAttributes) {
                            in_attributes.push({
                                name: ct.name,
                                typeId: ct.id,
                                $text: "",
                            })
                            result.push([obj, `added missing attribute: ${ct.name}`])
                        }
                        if (attributeBadIndex) {
                            result.push([obj, `fixed attributes order`])
                        }
                        for (const c of in_attributes) {
                            const idx = type.attributeTypes?.findIndex(ct => ct.id === c.typeId)
                            if (idx >= 0) {
                                out_attributes[idx] = c
                            } else {
                                output.push([[obj, `removed extra attribute: ${c.name}`]])
                                output.push(`<pre style="background-color: rgba(0,0,0,0.1); border: 1px solid rgba(0.5,0.5,0.5,0.15)">${c.$text}</pre><hr class="gray" style="border-bottom: none;"/>`)
                            }
                        }
                        $store.edit_node(obj, { attributes: out_attributes })
                    }


                }

            })
        }
        if (output.length === 0 && result.length === 0) {
            return ["No Issues found"]
        }
        return [...output, result]
}

export default {
    name: "Fix profiles",
    description:
        "Repairs profiles against their profile type: wrong typeName, wrong characteristic and attribute typeIds\n" +
        "or names, missing characteristics, wrong order, and extra characteristics the type does not define.\n" +
        "Writes to the data, and reports the text of anything it drops.\n" +
        "Also runs itself whenever a profile type is edited.",
    arguments: [{
        name: "catalogues",
        type: "catalogue[]"
    }],
    run,
    hooks: {
        /**
         * The editor used to call this script by name from its own `changed()` handler, which
         * meant the store knew about one particular script and no other script could ask for the
         * same notice. It subscribes like any plugin would now.
         */
        change(_event: unknown, { node }: { node: EditorBase }) {
            if (node.editorTypeName !== "profileType" && !findParentWhere(node, (o) => o.editorTypeName === "profileType")) {
                return;
            }
            queue(node.getCatalogue().getSystemId())
        },
    },
}
