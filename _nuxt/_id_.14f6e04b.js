import{u as e}from"./editorStore.f6f8e70a.js";import{e as t,a as s,b as o,o as r,i as n}from"./entry.fd0de611.js";const a=t({setup(){return{store:e()}},data(){return{}},computed:{async system(){return await this.store.get_or_load_system(this.$route.params.id)}},methods:{}}),i={class:"ml-20px mt-10px h-full overflow-y-auto"},c=n("pre",null,`This tab is used to run scripts:
Scripts will be able to export certain methods:

// Returns the entries that the script should select, allowing the user to preview what would be changed by modify()
select()

// Modifies the entries provided, wich is what is returned by select, or user-provided entries.
// returns: a list of changes to apply (so that they may be viewed by the user)
// Possible changes:
// - overwrite (path, Record<string, value>)
// - set (path, field, value)
// - add (path, nodes)
// - remove (path)
modify(catalogues, entries)

// Returns a list of errors to display to the user
check(catalogues, entries)

// Documenting your script:
// export \`readme\` to display documentation for your script
// export an object as \`docs\` with the key:value pairs corresponding to a function (such as \`select\`, \`modify\`,
\`check\`)
        `,-1),d=[c];function u(p,h,l,m,f,_){return r(),o("div",i,d)}const b=s(a,[["render",u]]);export{b as default};
//# sourceMappingURL=_id_.14f6e04b.js.map
