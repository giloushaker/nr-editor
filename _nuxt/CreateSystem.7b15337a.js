import{D as y,l as x,n as v,o as S,p as b,A as F,u as k,E as w}from"./editorStore.d81766c6.js";import{a as g,o as a,f as c,F as p,l as _,B,i as n,c as C,k as I,w as m,v as V,m as T,t as f,q as h,H as D,s as E,x as N}from"./entry.6ab2fb7a.js";const A={emits:["uploaded"],data(){return{uploading:!1}},computed:{electron(){return!!globalThis.electron}},methods:{async onFilesSelected(t){const e=[];if(t.length){t=[t[0]];for(const d of t){const i=await y(d);if(!(i!=null&&i.length))return;for(const o of i.filter(s=>x(s.name))){const s=await v(o.data,S(o.name));b(s).fullFilePath=o.path.replaceAll("\\","/"),e.push(s)}}e.length&&this.$emit("uploaded",e)}},async popFileInput(){var t;if(!globalThis.electron)throw new Error("SelectFile is for use in electron app only");try{this.uploading=!0;const e=await F({properties:["openFile"]});(t=e==null?void 0:e.filePaths)!=null&&t.length&&await this.onFilesSelected(e.filePaths)}catch(e){console.error(e)}finally{this.uploading=!1}}}};const j=["disabled"],J={key:1};function O(t,e,d,i,o,s){return s.electron?(a(),c("button",{key:0,onClick:e[0]||(e[0]=(...u)=>s.popFileInput&&s.popFileInput(...u)),class:"bouton",disabled:o.uploading},[o.uploading?(a(),c(p,{key:1},[_(" ... ")],64)):(a(),c(p,{key:0},[_(" Load System ")],64))],8,j)):(a(),c("span",J,"<SelectFile> is only available in electron app"))}const W=g(A,[["render",O],["__scopeId","data-v-1fa7b178"]]),U={emits:["created"],data(){return{open:!1,text:"",format:"gst"}},setup(){return{store:k(),settings:B()}},computed:{electron(){return!!globalThis.electron},folder(){return this.settings.systemsFolder?`${w(this.settings.systemsFolder.replaceAll("\\","/"),"/")}`:""}},methods:{click(){this.text="",this.open=!0},async create(){if(this.text){const t=await this.store.create_system(this.text,this.folder,this.format);this.$emit("created",t)}}}};const r=t=>(E("data-v-79601ba6"),t=t(),N(),t),q=r(()=>n("h2",{class:"text-center"},"Create System",-1)),z=r(()=>n("span",null,"Name ",-1)),M=r(()=>n("span",null,"Format ",-1)),X=r(()=>n("option",{value:"gstz"},".gstz (Zipped Xml)",-1)),H=r(()=>n("option",{value:"gst"},".gst (Xml)",-1)),L=r(()=>n("option",{value:"json"},".json (JSON)",-1)),P=[X,H,L],Z=r(()=>n("div",null," The system will be created at: ",-1)),G={class:"gray"};function K(t,e,d,i,o,s){const u=D;return a(),c(p,null,[n("button",{class:"bouton",onClick:e[0]||(e[0]=(...l)=>s.click&&s.click(...l))}," Create System "),o.open?(a(),C(u,{key:0,modelValue:o.open,"onUpdate:modelValue":e[3]||(e[3]=l=>o.open=l),button:"Create",onButton:s.create},{default:I(()=>[q,z,m(n("input",{class:"w-full",type:"text","onUpdate:modelValue":e[1]||(e[1]=l=>o.text=l),required:""},null,512),[[V,o.text]]),M,m(n("select",{"onUpdate:modelValue":e[2]||(e[2]=l=>o.format=l)},P,512),[[T,o.format]]),s.electron?(a(),c(p,{key:0},[Z,n("div",G,f(s.folder)+"/"+f(o.text)+"/",1)],64)):h("",!0)]),_:1},8,["modelValue","onButton"])):h("",!0)],64)}const Y=g(U,[["render",K],["__scopeId","data-v-79601ba6"]]);export{W as _,Y as a};