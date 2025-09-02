import type { Profile, Rule } from "~/assets/shared/battlescribe/bs_main";
import type { Catalogue, EditorBase } from "~/assets/shared/battlescribe/bs_main_catalogue";
import { BSIProfile, BSIRule } from "~/assets/shared/battlescribe/bs_types";

export default {
    name: "Find Duplicate Profiles",
    description: "Returns profiles with mrore than one occurrence",
    arguments: [
        {
            name: "catalogues",
            type: "catalogue[]"
        },
        {
            name: "Match name",
            type: "boolean",
            optional: true,
            description: "duplicates must have same name",
            default: true
        },
        {
            name: "Match number",
            type: "boolean",
            optional: true,
            description: "duplicates text must have same number values",
            default: true
        }
    ],
    run(catalogues: Catalogue[], matchName: boolean, matchNumbers: boolean) {
        const map = new Map()
        for (const catalogue of catalogues) {
            catalogue.forEachObjectWhitelist((node: EditorBase & (Rule | Profile)) => {
                if (!["profile", "rule"].includes(node.editorTypeName)) return; // skip non profile/rule nodes
                const hashPieces = []

                function normalizeText(text: string | number | undefined) {
                    return (String(text) ?? "").toLowerCase()
                        // remove all whitespace and newlines to avoid differences due to spacing
                        .replace(/\s+/g, " ")
                        // replace numbers with a # to avoid differences due to values (if matchNumbers is true)
                        .replace(/\d+/g, matchNumbers ? (match) => match : "#")
                        // remove punctuation and special characters
                        .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "")
                        .trim()
                }
                if (matchName) {
                    hashPieces.push(normalizeText(node.getName()))
                }
                if (node.editorTypeName === "rule") {
                    // hashPieces.push(normalizeText('description'))
                    hashPieces.push(normalizeText((node as BSIRule).description || ""))
                } else {
                    for (const c of ((node as BSIProfile).characteristics ?? [])) {
                        const cName = normalizeText(c.name)
                        const cText = normalizeText(c.$text)
                        if (!cText) continue; // skip empty characteristics
                        // hashPieces.push(cName)
                        hashPieces.push(cText)
                    }
                }
                const id = hashPieces.filter(o => o).join("|")
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
            lines.push(`${dupe[2][0].getName()} (${dupe[1]})`)
            for (const node of dupe[2]) {
                lines.push(node)
            }
        }
        if (lines.length === 0) {
            return ["No duplicates found"]
        }
        return [`<span style="font-weight: bold">Duplicate profiles (${duplicates.length}):</span>`, ...lines]
    }
}