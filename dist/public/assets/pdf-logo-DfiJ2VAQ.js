const s="width: 130px; height: auto; object-fit: contain;";async function i(t){try{const e=await fetch(t);if(!e.ok)return null;const o=await e.blob();return new Promise(a=>{const n=new FileReader;n.onloadend=()=>a(n.result),n.onerror=()=>a(null),n.readAsDataURL(o)})}catch{return null}}async function c(t,e){let o="";t&&(o=`<img src="${await i(t)||t}" style="${s}" />`);const a=e?`<h1 style="color: #1a365d; margin: 0; font-size: 24px;">${e}</h1>`:'<h1 style="color: #1a365d; margin: 0; font-size: 24px;">AuditWise</h1>';return`
    <div style="display: flex; align-items: center; gap: 16px; margin-bottom: 8px;">
      ${o}
      <div>
        ${a}
        <p style="color: #666; margin: 2px 0 0 0; font-size: 12px;">Statutory Audit Management</p>
      </div>
    </div>
  `.trim()}export{c as g,i as l};
