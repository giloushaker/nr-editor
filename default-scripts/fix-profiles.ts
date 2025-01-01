import type { Modifier, Profile, ProfileType } from "~/assets/shared/battlescribe/bs_main";
import type { Catalogue, EditorBase } from "~/assets/shared/battlescribe/bs_main_catalogue";
export function findParentWhere<T extends { parent?: T }>(self: T, fn: (node: T) => any): T | undefined {
    let current = self.parent;
    while (current && !Object.is(current, current.parent)) {
        if (fn(current)) return current;
        current = current.parent;
    }
    return undefined;
}
export default {
    name: "Fix profiles & characteristics",
    arguments: [{
        name: "catalogues",
        type: "catalogue[]"
    }],
    run: (catalogues: Catalogue[]) => {
        const result = [] as [EditorBase, string][];
        const output = []
        catalogues.map(o => o.processForEditor())
        for (const catalogue of catalogues) {
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
                    for (const c of obj.characteristics) {
                        const ct = type.characteristicTypes.find(ct => ct.name === c.name)!
                        if (ct && c.typeId !== ct.id) {
                            result.push([obj, `fixed typeId: ${c.name}`])
                            $store.edit_node(c, { typeId: ct.id })
                        }
                    }

                    // Fix characteristic with wrong name
                    for (const c of obj.characteristics) {
                        const ct = type.characteristicTypes.find(ct => ct.id === c.typeId)!
                        if (ct && c.name !== ct.name) {
                            result.push([obj, `fixed characteristic name: ${c.name} -> ${ct.name}`])
                            $store.edit_node(c, { name: ct.name })
                        }
                    }
                    // Fix characteristic order & remove extra characteristics
                    const missing = type.characteristicTypes?.filter(ct => !obj.characteristics.find(c => c.typeId === ct.id))
                    const badIndex = obj.characteristics.find((c, i) => i !== type.characteristicTypes.findIndex(ct => ct.id === c.typeId))
                    if (missing.length || badIndex) {
                        const out_characteristics = []
                        const in_characteristics = [...obj.characteristics]
                        for (const ct of missing) {
                            in_characteristics.push({
                                name: ct.name,
                                typeId: ct.id,
                                $text: "",
                            })
                            result.push([obj, `added missing characteristic: ${ct.name}`])
                        }
                        if (badIndex) {
                            result.push([obj, `fixed characteristics order`])
                        }
                        for (const c of in_characteristics) {
                            const idx = type.characteristicTypes.findIndex(ct => ct.id === c.typeId)
                            if (idx >= 0) {
                                out_characteristics[idx] = c
                            } else {
                                output.push([[obj, `removed extra characteristic: ${c.name}`]])
                                output.push(`<pre style="background-color: rgba(0,0,0,0.1); border: 1px solid rgba(0.5,0.5,0.5,0.15)">${c.$text}</pre><hr class="gray" style="border-bottom: none;"/>`)
                            }
                        }
                        $store.edit_node(obj, { characteristics: out_characteristics })
                    }


                }
                else if (obj.editorTypeName === "modifier") {
                    const modifier = (obj as Modifier & EditorBase)
                    if (modifier.scope || modifier.affects) return
                    const parent = findParentWhere(obj, o => !o.editorTypeName.includes('modifier'))
                    const target = (parent?.target ?? parent) as Profile & EditorBase
                    const field = modifier.field
                    const staticFields = ["name", "hidden", "annotation", "page", "defaultAmount", "defaultSelectionEntryId", "description"]
                    if (staticFields.includes(field)) return;
                    const found = catalogue.findOptionById(field) as EditorBase
                    if (!found) {
                        output.push([[obj, `invalid field type: ${modifier.field}`]])
                        return;
                    }
                    if (found.editorTypeName === 'characteristicType') {
                        const targetTypeId = target.getTypeId()
                        if ((found.parent as ProfileType & EditorBase).id !== targetTypeId) {
                            output.push([[obj, `invalid modifiere field type: characteristic on ${target.editorTypeName}`]])
                        }
                    }
                }
            })
        }
        if (output.length === 0 && result.length === 0) {
            return ["No Issues found"]
        }
        return [...output, result]
    }
}