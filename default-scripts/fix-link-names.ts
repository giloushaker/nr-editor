import type { Catalogue, EditorBase } from "~/assets/shared/battlescribe/bs_main_catalogue";
export default {
    name: "Fix link names",
    arguments: [{
        name: "catalogues",
        type: "catalogue[]"
    }],
    run: (catalogues: Catalogue[]) => {
        const result = [] as [EditorBase, string][]
        for (const catalogue of catalogues) {
            catalogue.forEachObjectWhitelist((obj: EditorBase) => {
                if (obj.target && obj.name !== obj.target.name) {
                    result.push([obj, `${obj.name} -> ${obj.target.name}`])
                    $store.edit_node(obj, { name: obj.target.name })
                }
            })
        }
        return result;
    }
}