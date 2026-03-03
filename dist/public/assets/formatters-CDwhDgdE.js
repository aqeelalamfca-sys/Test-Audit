function o(t){if(t==null||t===0)return"-";const i=Math.abs(t),n=new Intl.NumberFormat("en-US",{minimumFractionDigits:0,maximumFractionDigits:0}).format(i);return t<0?`(${n})`:n}export{o as f};
