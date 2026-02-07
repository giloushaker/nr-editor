import type { Catalogue } from "~/assets/shared/battlescribe/bs_main_catalogue"

export default {
    name: "Find Duplicates Ids",
    description: "Returns ids with mrore than one occurrence",
    arguments: [
        {
            name: "catalogues",
            type: "catalogue[]"
        },
    ],
    run(catalogues: Catalogue[]) {
        const map = new Map()
        for (const catalogue of catalogues) {
            catalogue.forEachObjectWhitelist((node) => {
                const id = node.id
                if (!id) return
                if (map.has(id)) {
                    map.get(id).push(node)
                } else {
                    map.set(id, [node])
                }
            })
        }
        const duplicates = []
        for (const [id, nodes] of map) {
            if (nodes.length > 1) {
                duplicates.push([id, nodes.length, nodes])
            }
        }
        duplicates.sort((a, b) => b[1] - a[1])
        const lines = []
        for (const dupe of duplicates) {
            lines.push(`${dupe[0]} (${dupe[1]})`)
            for (const node of dupe[2]) {
                lines.push(node)
            }
        }
        if (lines.length === 0) {
            return ["No duplicates found"]
        }
        return [`<span style="font-weight: bold">Duplicate IDs (count):</span>`, ...lines]
    }
}