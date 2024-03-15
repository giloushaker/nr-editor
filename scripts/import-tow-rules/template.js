void async function script() {
    function addOne(obj, key) {
        const prev = obj[key] || 0;
        obj[key] = 1 + prev;
        return prev;
    }
    function printNodes(nodes, cb) {
        if (!nodes.length) return;
        const grouped = {};
        for (const nodeToPrint of nodes) {
            let node = Array.isArray(nodeToPrint) ? nodeToPrint[0] : nodeToPrint
            const path = [node.name];
            while (node.parent) {
                node = node.parent;
                path.push(node.name);
            }
            path.reverse();
            const catalogue = path.shift();
            if (!grouped[catalogue]) {
                grouped[catalogue] = {}
            }
            // let str = `/ ${path.join(" / ")}`
            let str = `${path.at(-1)}`
            if (cb) {
                str += ` (${cb(nodeToPrint)})`
            }
            if (Array.isArray(nodeToPrint)) {
                str += ` (${nodeToPrint[1]})`
            }
            addOne(grouped[catalogue], str)
        }
        const result_strings = [];
        for (const key in grouped) {
            result_strings.push(`**${key}**`);
            Object.entries(grouped[key]).forEach(([text, count]) => result_strings.push(count > 1 ? `${text} x${count}` : `${text}`));
        }
        if (result_strings.length) {
            console.log(result_strings.join("\n"));
        }
    }


    const result = []
    await $catalogue.manager.loadAll()
    const cats = $catalogue.manager.getAllLoadedCatalogues();
    cats.forEach((o) => o.processForEditor());
    for (const cat of cats) {
        cat.forEachObjectWhitelist(obj => {
            if (["profile", "rule"].includes(obj.editorTypeName)) {
                result.push(obj)
            }
        })
    }

    printNodes(result)
}();

