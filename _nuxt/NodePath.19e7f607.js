import{e as l,a as c,o as s,b as t,F as o,B as d,i,t as n,x as h}from"./entry.a6511128.js";const y=l({props:{path:{type:Array,required:!0},maxLength:{type:Number,default:80,required:!1},endArrow:{type:Boolean,default:!1}}}),_={class:"-indent-16px pl-16px"},u={class:"inline"},m={class:"whitespace-nowrap"},g=["src"],f={key:0},$={key:1},k={key:1},x={key:0,class:"gray"};function b(a,B,N,w,A,L){return s(),t("div",_,[(s(!0),t(o,null,d(a.path,(e,p)=>{var r;return s(),t("div",u,[i("span",m,[i("img",{class:"typeIcon",src:`/assets/bsicons/${e.type}.png`},null,8,g),p==a.path.length-1?(s(),t(o,{key:0},[(r=e.display)!=null&&r.length&&e.display.length<=a.maxLength?(s(),t("span",f,n(e.display),1)):(s(),t("span",$,n(e.label?e.label:`${e.type}[${e.index}]`),1))],64)):(s(),t("span",k,n(e.display?e.display:`${e.type}[${e.index}]`),1))]),a.endArrow||p<a.path.length-1?(s(),t("span",x," > ")):h("",!0)])}),256))])}const v=c(y,[["render",b]]);export{v as N};
//# sourceMappingURL=NodePath.19e7f607.js.map