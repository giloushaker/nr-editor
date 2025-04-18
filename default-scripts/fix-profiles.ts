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
    name: "Fix profiles",
    arguments: [{
        name: "catalogues",
        type: "catalogue[]"
    }],
    run: (catalogues: Catalogue[]) => {
        const result = [] as [EditorBase, string][];
        const output = [] as Array<Array<string | object> | string>
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
                    for (const c of obj.characteristics || []) {
                        const ct = type.characteristicTypes?.find(ct => ct.name === c.name)!
                        if (ct && c.typeId !== ct.id) {
                            result.push([obj, `fixed typeId: ${c.name}`])
                            $store.edit_node(c, { typeId: ct.id })
                        }
                    }
                    // Fix attribute with wrong typeId
                    for (const c of obj.attributes || []) {
                        const ct = type.attributeTypes?.find(ct => ct.name === c.name)!
                        if (ct && c.typeId !== ct.id) {
                            result.push([obj, `fixed typeId: ${c.name}`])
                            $store.edit_node(c, { typeId: ct.id })
                        }
                    }

                    // Fix characteristic with wrong name
                    for (const c of obj.characteristics || []) {
                        const ct = type.characteristicTypes?.find(ct => ct.id === c.typeId)!
                        if (ct && c.name !== ct.name) {
                            result.push([obj, `fixed characteristic name: ${c.name} -> ${ct.name}`])
                            $store.edit_node(c, { name: ct.name })
                        }
                    }

                    // Fix attribute with wrong name
                    for (const c of obj.attributes || []) {
                        const ct = type.attributeTypes?.find(ct => ct.id === c.typeId)!
                        if (ct && c.name !== ct.name) {
                            result.push([obj, `fixed attribute name: ${c.name} -> ${ct.name}`])
                            $store.edit_node(c, { name: ct.name })
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
}