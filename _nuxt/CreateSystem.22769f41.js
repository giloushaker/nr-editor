import{I as y,p as x,r as v,t as S,h as F,F as b,u as w}from"./editorStore.3020636b.js";import{a as g,o as a,b as c,F as p,m as _,L as k,Y as I,i as n,c as B,l as C,w as m,v as V,s as T,t as f,x as h,D,y as E,z as N}from"./entry.a6511128.js";const L={emits:["uploaded"],data(){return{uploading:!1}},computed:{electron(){return!!globalThis.electron}},methods:{async onFilesSelected(t){const e=[];if(t.length){t=[t[0]];for(const d of t){const i=await y(d);if(!(i!=null&&i.length))return;for(const o of i.filter(s=>x(s.name))){const s=await v(o.data,S(o.name));F(s).fullFilePath=o.path.replaceAll("\\","/"),e.push(s)}}e.length&&this.$emit("uploaded",e)}},async popFileInput(){var t;if(!globalThis.electron)throw new Error("SelectFile is for use in electron app only");try{this.uploading=!0;const e=await b({properties:["openFile"]});(t=e==null?void 0:e.filePaths)!=null&&t.length&&await this.onFilesSelected(e.filePaths)}catch(e){console.error(e)}finally{this.uploading=!1}}}};const M=["disabled"],j={key:1};function z(t,e,d,i,o,s){return s.electron?(a(),c("button",{key:0,onClick:e[0]||(e[0]=(...u)=>s.popFileInput&&s.popFileInput(...u)),class:"bouton",disabled:o.uploading},[o.uploading?(a(),c(p,{key:1},[_(" ... ")],64)):(a(),c(p,{key:0},[_(" Load System ")],64))],8,M)):(a(),c("span",j,"<SelectFile> is only available in electron app"))}const R=g(L,[["render",z],["__scopeId","data-v-1fa7b178"]]),A={emits:["created"],data(){return{open:!1,text:"",format:"gst"}},setup(){return{store:w(),settings:k()}},computed:{electron(){return!!globalThis.electron},folder(){return this.settings.systemsFolder?`${I(this.settings.systemsFolder.replaceAll("\\","/"),"/")}`:""}},methods:{click(){this.text="",this.open=!0},async create(){if(this.text){const t=await this.store.create_system(this.text,this.folder,this.format);this.$emit("created",t)}}}};const r=t=>(E("data-v-8c08c643"),t=t(),N(),t),J=r(()=>n("h2",{class:"text-center"},"Create System",-1)),O=r(()=>n("span",null,"Name ",-1)),U=r(()=>n("span",null,"Format ",-1)),X=r(()=>n("option",{value:"gstz"},".gstz (Zipped XML)",-1)),q=r(()=>n("option",{value:"gst"},".gst (XML)",-1)),P=r(()=>n("option",{value:"json"},".json (JSON)",-1)),Y=[X,q,P],Z=r(()=>n("div",null," The system will be created at: ",-1)),G={class:"gray"};function H(t,e,d,i,o,s){const u=D;return a(),c(p,null,[n("button",{class:"bouton",onClick:e[0]||(e[0]=(...l)=>s.click&&s.click(...l))}," Create System "),o.open?(a(),B(u,{key:0,modelValue:o.open,"onUpdate:modelValue":e[3]||(e[3]=l=>o.open=l),button:"Create",onButton:s.create},{default:C(()=>[J,O,m(n("input",{class:"w-full",type:"text","onUpdate:modelValue":e[1]||(e[1]=l=>o.text=l),required:""},null,512),[[V,o.text]]),U,m(n("select",{"onUpdate:modelValue":e[2]||(e[2]=l=>o.format=l)},Y,512),[[T,o.format]]),s.electron?(a(),c(p,{key:0},[Z,n("div",G,f(s.folder)+"/"+f(o.text)+"/",1)],64)):h("",!0)]),_:1},8,["modelValue","onButton"])):h("",!0)],64)}const W=g(A,[["render",H],["__scopeId","data-v-8c08c643"]]);export{R as _,W as a};
//# sourceMappingURL=CreateSystem.22769f41.js.map