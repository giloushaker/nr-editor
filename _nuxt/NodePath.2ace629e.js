import{e as c,a as y,o as s,b as t,F as l,D as d,i,t as n,l as o}from"./entry.ba5987ef.js";const h=c({props:{path:{type:Array,required:!0},maxLength:{type:Number,default:80,required:!1},endArrow:{type:Boolean,default:!1},text:{type:String}}}),_={class:"-indent-16px pl-16px"},u={class:"inline"},m={class:"whitespace-nowrap"},g=["src"],f={key:0},k={key:1},$={key:1},x={key:0,class:"gray"},b={key:0,class:"gray inline-block ml-20px text-sm"};function N(a,w,A,B,L,q){return s(),t("div",_,[(s(!0),t(l,null,d(a.path,(e,p)=>{var r;return s(),t("div",u,[i("span",m,[i("img",{class:"typeIcon",src:`/assets/bsicons/${e.type}.png`},null,8,g),p==a.path.length-1?(s(),t(l,{key:0},[(r=e.display)!=null&&r.length&&e.display.length<=a.maxLength?(s(),t("span",f,n(e.display),1)):(s(),t("span",k,n(e.label?e.label:`${e.type}[${e.index}]`),1))],64)):(s(),t("span",$,n(e.display?e.display:`${e.type}[${e.index}]`),1))]),a.endArrow||p<a.path.length-1?(s(),t("span",x," > ")):o("",!0)])}),256)),a.text?(s(),t("span",b,n(a.text),1)):o("",!0)])}const C=y(h,[["render",N]]);export{C as N};
//# sourceMappingURL=NodePath.2ace629e.js.map