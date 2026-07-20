import{i as e,n as t,o as n,t as r}from"./jsx-runtime-v183glR-.js";import{t as i}from"./CAlert-DaW5_UPj.js";import{t as a}from"./CButton-BlalLS9r.js";import{t as o}from"./CBadge-DT-p-3ML.js";import{n as s,t as c}from"./CCardBody-CrIHuWtc.js";import{t as l}from"./CCardHeader-D90gj24U.js";import{t as u}from"./CFormCheck-DscLxj5V.js";import{t as d}from"./CFormSelect-BtMGZk8z.js";import{n as f,t as p}from"./CRow-D2k1OpuZ.js";import{t as m}from"./cil-print-CpcdISMS.js";import{t as h}from"./cil-reload-BGCC4Fh2.js";import{b as g,p as _}from"./index-BuaH2Kcn.js";import{c as v}from"./assetService-4dUQXc1Q.js";import{t as y}from"./qrCodeService-BWOacq0k.js";var b=[`512 512`,`<path fill='var(--ci-primary-color, currentcolor)' d='M238.627 496H192V253.828l-168-200V16h456v37.612l-160 200v161.015ZM224 464h1.373L288 401.373V242.388L443.51 48H60.9L224 242.172Z' class='ci-primary'/>`],x=n(e()),S=r(),C=()=>{let{t:e}=t(),[n,r]=(0,x.useState)([]),[C,w]=(0,x.useState)([]),[T,E]=(0,x.useState)(new Set),[D,O]=(0,x.useState)(!0),[k,A]=(0,x.useState)(!1),[j,M]=(0,x.useState)(``),[N,P]=(0,x.useState)(``),[F,I]=(0,x.useState)(``),[L,R]=(0,x.useState)(``);(0,x.useEffect)(()=>{z()},[]),(0,x.useEffect)(()=>{let e=[...n];N&&(e=e.filter(e=>e.location?.toLowerCase().includes(N.toLowerCase()))),F&&(e=e.filter(e=>e.department?.toLowerCase().includes(F.toLowerCase()))),L&&(e=e.filter(e=>e.type===L)),w(e),E(new Set)},[N,F,L,n]);let z=async()=>{O(!0),M(``);try{let e=await v();r(e),w(e),E(new Set)}catch{M(e(`print_qr.load_error`))}finally{O(!1)}},B=e=>[...new Set(n.map(t=>t[e]).filter(Boolean))].sort(),V=()=>{P(``),I(``),R(``)},H=C.length>0&&C.every(e=>T.has(e.id)),U=C.some(e=>T.has(e.id))&&!H,W=()=>{E(H?e=>{let t=new Set(e);return C.forEach(e=>t.delete(e.id)),t}:e=>{let t=new Set(e);return C.forEach(e=>t.add(e.id)),t})},G=e=>{E(t=>{let n=new Set(t);return n.has(e)?n.delete(e):n.add(e),n})},K=C.filter(e=>T.has(e.id)),q=async()=>{let t=K.length>0?K:C;if(t.length!==0){A(!0),M(``);try{let n=(await Promise.all(t.map(async e=>{try{let t=await y(e.id);return{...e,qrSvg:t.qrSvg,qrUrl:t.url}}catch{return null}}))).filter(Boolean);if(n.length===0){M(e(`print_qr.no_qr_generated`));return}J(n)}catch{M(`Erreur lors de la génération des QR Codes.`)}finally{A(!1)}}},J=t=>{let n=window.open(``,`_blank`,`width=900,height=700`);if(!n){M(e(`print_qr.browser_blocked`));return}let r=t.map(e=>`
      <div class="label">
        <div class="qr">${e.qrSvg}</div>
        <div class="tag">${e.assetTag}</div>
        <div class="loc">${e.location||`—`}</div>
        ${e.department?`<div class="dept">${e.department}</div>`:``}
      </div>
    `).join(``);n.document.write(`<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>${e(`print_qr.print_title`)} — DRESI ITSM</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, sans-serif; background: #fff; }
    .actions {
      position: fixed; top: 0; left: 0; right: 0;
      background: #1e293b; color: #fff;
      padding: 12px 20px;
      display: flex; align-items: center; gap: 12px;
      z-index: 100;
    }
    .actions h2 { font-size: 15px; font-weight: 600; flex: 1; }
    .actions button {
      padding: 7px 18px; border: none; border-radius: 6px;
      font-size: 13px; cursor: pointer; font-weight: 500;
    }
    .btn-print  { background: #2563eb; color: #fff; }
    .btn-close  { background: #475569; color: #fff; }
    .btn-print:hover { background: #1d4ed8; }
    .btn-close:hover { background: #334155; }
    .page {
      padding: 20mm 15mm;
      padding-top: 60px;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 8mm;
    }
    .label {
      border: 1.5px solid #000;
      border-radius: 6px;
      padding: 10px 8px 8px;
      text-align: center;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .qr { width: 120px; height: 120px; margin: 0 auto 6px; }
    .qr svg { width: 100%; height: 100%; }
    .tag  { font-weight: 700; font-size: 13px; margin-bottom: 3px; }
    .loc  { font-size: 11px; color: #555; }
    .dept { font-size: 10px; color: #888; margin-top: 2px; }
    @media print {
      .actions { display: none !important; }
      .page { padding: 10mm; padding-top: 10mm; }
      body { background: #fff; }
    }
  </style>
</head>
<body>
  <div class="actions">
    <h2>${e(`print_qr.print_title`)} — ${t.length} ${e(`print_qr.print_equipments`)} — DRESI ITSM</h2>
    <button class="btn-print" onclick="window.print()">${e(`print_qr.print_button`)}</button>
    <button class="btn-close" onclick="window.close()">${e(`print_qr.close_button`)}</button>
  </div>
  <div class="page">
    <div class="grid">${r}</div>
  </div>
</body>
</html>`),n.document.close()};return D?(0,S.jsxs)(`div`,{className:`text-center p-5`,children:[(0,S.jsx)(g,{size:`lg`}),(0,S.jsx)(`p`,{className:`mt-3 text-muted`,children:e(`print_qr.loading`)})]}):(0,S.jsx)(p,{children:(0,S.jsx)(f,{lg:12,children:(0,S.jsxs)(s,{children:[(0,S.jsx)(l,{children:(0,S.jsx)(`strong`,{children:e(`print_qr.title`)})}),(0,S.jsxs)(c,{children:[j&&(0,S.jsx)(i,{color:`danger`,className:`mb-3`,dismissible:!0,onClose:()=>M(``),children:j}),(0,S.jsx)(s,{className:`mb-4`,style:{background:`var(--cui-tertiary-bg)`},children:(0,S.jsxs)(c,{children:[(0,S.jsxs)(`div`,{className:`d-flex align-items-center gap-2 mb-3`,children:[(0,S.jsx)(_,{icon:b,size:`sm`}),(0,S.jsx)(`strong`,{className:`small`,children:e(`print_qr.filters`)})]}),(0,S.jsxs)(p,{className:`g-3`,children:[(0,S.jsx)(f,{md:4,children:(0,S.jsxs)(d,{size:`sm`,value:N,onChange:e=>P(e.target.value),children:[(0,S.jsx)(`option`,{value:``,children:e(`print_qr.all_locations`)}),B(`location`).map(e=>(0,S.jsx)(`option`,{value:e,children:e},e))]})}),(0,S.jsx)(f,{md:4,children:(0,S.jsxs)(d,{size:`sm`,value:F,onChange:e=>I(e.target.value),children:[(0,S.jsx)(`option`,{value:``,children:e(`print_qr.all_departments`)}),B(`department`).map(e=>(0,S.jsx)(`option`,{value:e,children:e},e))]})}),(0,S.jsx)(f,{md:4,children:(0,S.jsxs)(d,{size:`sm`,value:L,onChange:e=>R(e.target.value),children:[(0,S.jsx)(`option`,{value:``,children:e(`print_qr.all_types`)}),B(`type`).map(e=>(0,S.jsx)(`option`,{value:e,children:e},e))]})})]}),(0,S.jsxs)(`div`,{className:`mt-3 d-flex align-items-center gap-2 flex-wrap`,children:[(0,S.jsxs)(o,{color:`info`,children:[C.length,` `,e(`print_qr.selected_count`)]}),T.size>0&&(0,S.jsxs)(o,{color:`primary`,children:[T.size,` `,e(`print_qr.selected_count`)]}),(N||F||L)&&(0,S.jsx)(a,{size:`sm`,color:`secondary`,onClick:V,children:e(`print_qr.reset_filters`)}),T.size>0&&(0,S.jsx)(a,{size:`sm`,color:`outline-danger`,onClick:()=>E(new Set),children:e(`print_qr.deselect_all`)})]})]})}),(0,S.jsxs)(`div`,{className:`d-flex gap-2 mb-4 align-items-center flex-wrap`,children:[(0,S.jsx)(a,{color:`primary`,onClick:q,disabled:k||C.length===0,children:k?(0,S.jsxs)(S.Fragment,{children:[(0,S.jsx)(g,{size:`sm`,className:`me-2`}),e(`print_qr.generating`)]}):(0,S.jsxs)(S.Fragment,{children:[(0,S.jsx)(_,{icon:m,className:`me-2`}),T.size>0?e(`print_qr.print_selected`,{count:T.size}):e(`print_qr.print_all`,{count:C.length})]})}),(0,S.jsxs)(a,{color:`secondary`,onClick:z,disabled:D,children:[(0,S.jsx)(_,{icon:h,className:`me-1`}),e(`print_qr.refresh`)]}),(0,S.jsx)(`span`,{className:`text-muted small`,children:T.size===0?e(`print_qr.select_hint`):e(`print_qr.selected_hint`,{count:T.size})})]}),C.length>0?(0,S.jsxs)(s,{children:[(0,S.jsx)(l,{children:(0,S.jsx)(`strong`,{children:T.size>0?`${T.size} / ${C.length} ${e(`print_qr.selected_count`)}`:`${C.length} ${e(`print_qr.selected_count`)}`})}),(0,S.jsx)(c,{className:`p-0`,children:(0,S.jsx)(`div`,{className:`table-responsive`,children:(0,S.jsxs)(`table`,{className:`table table-hover mb-0`,children:[(0,S.jsx)(`thead`,{children:(0,S.jsxs)(`tr`,{children:[(0,S.jsx)(`th`,{style:{width:40},children:(0,S.jsx)(u,{checked:H,ref:e=>{e&&(e.indeterminate=U)},onChange:W,title:e(`print_qr.select_all_title`)})}),(0,S.jsx)(`th`,{children:e(`print_qr.table_headers.tag`)}),(0,S.jsx)(`th`,{children:e(`print_qr.table_headers.type`)}),(0,S.jsx)(`th`,{children:e(`print_qr.table_headers.brand_model`)}),(0,S.jsx)(`th`,{children:e(`print_qr.table_headers.location`)}),(0,S.jsx)(`th`,{children:e(`print_qr.table_headers.department`)}),(0,S.jsx)(`th`,{children:e(`print_qr.table_headers.status`)})]})}),(0,S.jsx)(`tbody`,{children:C.map(e=>(0,S.jsxs)(`tr`,{style:{cursor:`pointer`},className:T.has(e.id)?`table-active`:``,onClick:()=>G(e.id),children:[(0,S.jsx)(`td`,{onClick:e=>e.stopPropagation(),children:(0,S.jsx)(u,{checked:T.has(e.id),onChange:()=>G(e.id)})}),(0,S.jsx)(`td`,{children:(0,S.jsx)(`strong`,{children:e.assetTag})}),(0,S.jsx)(`td`,{className:`text-muted`,children:e.type}),(0,S.jsxs)(`td`,{children:[e.brand,` `,e.model]}),(0,S.jsx)(`td`,{children:e.location||`—`}),(0,S.jsx)(`td`,{children:e.department||`—`}),(0,S.jsx)(`td`,{children:(0,S.jsx)(o,{color:e.status===`En service`?`success`:e.status===`En panne`?`danger`:e.status===`En maintenance`?`warning`:`secondary`,children:e.status})})]},e.id))})]})})})]}):(0,S.jsx)(i,{color:`warning`,children:e(`print_qr.no_assets`)})]})]})})})};export{C as default};