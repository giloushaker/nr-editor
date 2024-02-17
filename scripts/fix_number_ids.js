check = (cats) => {

    const result = [];
    function keyCmp([a], [b]) {
        return a.localeCompare(b, undefined, { numeric: true });
    }
    function sortByAscending(array, getKey) {
        return array
            .map((o) => [(getKey(o) ?? "").toString(), o])
            .sort(keyCmp)
            .map(([, v]) => v);
    }

    for (const cat of Array.isArray(cats) ? cats : [cats]) {
        for (const entry of Object.values(cat.index)) {
            if (typeof entry.id === typeof 1) {
                result.push(entry)
            }
        }
    }
    const grouped = {};
    for (const item of result) {
        if (!grouped[item.catalogue.name]) grouped[item.catalogue.name] = []
        grouped[item.catalogue.name].push(item)
    }
    for (const cat in grouped) {
        console.log(`***${cat}***`)
        const sorted = sortByAscending(grouped[cat], o => o.name)
        console.log(sorted)
        console.log(sorted.map(o => `- ${o.getName()}`).join("\n"));
    }
    for (const item of result) {
        item.id = item.catalogue.generateNonConflictingId()
        for (const ref of item.links) {
            ref.targetId = item.id
        }
        $store.set_catalogue_changed(item.catalogue)
    }
};

$catalogue.manager.loadAll().then(() => {
    const cats = $catalogue.manager.getAllLoadedCatalogues();
    check(cats);
});
