// Cat maker: tiles use real 3D renders of the models (ears, headwear, eyewear, collar, cloak, coats)
// or crisp SVG, so nothing is pixelated. The card is fixed size (see style.css) with a hidden scrollbar.
import * as T from 'three';
import {COATS,COAT_NAMES,EARS,EAR_NAMES,EYECS,COLLARS,COLLAR_TYPES,CLOAKS,CLOAK_COLS,PATTERNS,HEADS,EYEWEAR,GEAR_COLS,EYE_STYLES,NOSES,CHEEKS,TAILS,WHISKERS} from './catAvatar.js';
import {buildEyes,buildNose,buildCheeks,buildTail} from './catFeatures.js';
import {buildEar,buildHeadwear,buildEyewear,buildCloakStatic} from './wearables.js';
import {buildCollarStatic} from './collar.js';
import {makeCoat} from './coatShader.js';
import {iconOf} from './iconRender.js';
import {mat} from './blocks.js';

const TABS=[
  ['cat','Cat',[['coat','Coat','bi-palette'],['pattern','Pattern','bi-grid-3x3-gap'],['tail','Tail','bi-bezier2'],['collarT','Collar style','bi-record-circle'],['collar','Collar color','bi-disc']]],
  ['face','Face',[['ears','Ears','bi-soundwave'],['eyeS','Eye shape','bi-eye'],['eyes','Eye color','bi-droplet-half'],['nose','Nose','bi-triangle'],['cheeks','Cheeks','bi-emoji-smile'],['whisk','Whiskers','bi-list']]],
  ['acc','Accessories',[['cloak','Cloak','bi-shield'],['cloakC','Cloak color','bi-brush'],['head','Headwear','bi-mortarboard'],['eyewear','Eyewear','bi-eyeglasses'],['gearC','Gear color','bi-palette2']]]
];
const pick=a=>a[(Math.random()*a.length)|0];
const cap=s=>s[0].toUpperCase()+s.slice(1);
// categories that are edited from BEHIND (the normal in-game camera); everything else swings round to the FRONT of the cat
const BACK_VIEW=new Set(['cloak','cloakC','tail']);

// ---- icon builders ---------------------------------------------------------
const ball=(fur,pat,pattern)=>new T.Mesh(new T.SphereGeometry(1,56,40),makeCoat({fur,pat,pattern},0));
const earPair=(type,fur,pat)=>{
  const g=new T.Group(),pink=mat('#ff9db8');
  [-1,1].forEach(s=>{const a=new T.Group();a.position.set(s*.56,0,0);a.rotation.z=-s*.5;g.add(a);
    const sw=new T.Group();a.add(sw);const info=buildEar(type,sw,mat(s<0?pat:fur),pink);sw.rotation.set(info.bx,0,-s*info.out)});
  return g};
const collarIcon=(c,t)=>buildCollarStatic(c,t||'normal');

const eyeSVG=c=>`<svg viewBox="0 0 48 48"><circle cx="24" cy="24" r="19" fill="#fff"/><circle cx="24" cy="24" r="14.5" fill="${c}"/><circle cx="24" cy="24" r="7" fill="#150d0a"/><circle cx="19" cy="19" r="3.4" fill="#fff"/><circle cx="28.5" cy="28.5" r="1.6" fill="#fff" opacity=".7"/></svg>`;
const swatchSVG=c=>`<svg viewBox="0 0 48 48"><defs><radialGradient id="g${c.slice(1)}" cx=".32" cy=".28" r=".8"><stop offset="0" stop-color="#fff" stop-opacity=".55"/><stop offset=".55" stop-color="#fff" stop-opacity="0"/></radialGradient></defs><circle cx="24" cy="24" r="19" fill="${c}" stroke="#00000022" stroke-width="1.5"/><circle cx="24" cy="24" r="19" fill="url(#g${c.slice(1)})"/></svg>`;
// ---- new face / tail icons: crisp SVG for eyes + noses, 3D renders for cheeks + tails ----
const D='#150d0a';
const hl=(x,y,r,o=1)=>`<circle cx="${x}" cy="${y}" r="${r}" fill="#fff" opacity="${o}"/>`;
const eyeStyleSVG=(s,c)=>`<svg viewBox="0 0 48 48">${({
  classic:`<ellipse cx="24" cy="24" rx="11" ry="14" fill="${D}"/><circle cx="19" cy="25" r="2.2" fill="${c}"/>`+hl(27,17,3.4),
  big:`<ellipse cx="24" cy="24" rx="15" ry="18" fill="${D}"/><ellipse cx="24" cy="25" rx="11.5" ry="14" fill="${c}"/><ellipse cx="24" cy="25.5" rx="7" ry="9.5" fill="${D}"/>`+hl(18,16,5)+hl(30,32,2.4,.85),
  beady:`<circle cx="24" cy="24" r="9" fill="${D}"/>`+hl(21,21,3),
  slit:`<ellipse cx="24" cy="24" rx="15" ry="17" fill="${c}" stroke="${D}" stroke-width="2.5"/><ellipse cx="24" cy="24" rx="3" ry="14" fill="${D}"/>`+hl(30,15,3),
  sleepy:`<path d="M9 25 A15 15 0 0 0 39 25 Z" fill="${D}"/><path d="M14 25 A10 10 0 0 0 34 25 Z" fill="${c}" opacity=".9"/><path d="M8 25 H40" stroke="${D}" stroke-width="3.5" stroke-linecap="round"/>`+hl(29,28,3),
  happy:`<path d="M10 31 Q24 9 38 31" fill="none" stroke="${D}" stroke-width="5.5" stroke-linecap="round"/>`,
  sharp:`<ellipse cx="24" cy="27" rx="13" ry="14" fill="${D}"/><ellipse cx="24" cy="28" rx="9" ry="10" fill="${c}"/><ellipse cx="24" cy="28.5" rx="5" ry="6.5" fill="${D}"/>`+hl(19,23,3.4)+`<path d="M7 13 L41 22" stroke="${D}" stroke-width="5" stroke-linecap="round"/>`,
  lashes:`<ellipse cx="24" cy="26" rx="12" ry="14" fill="${D}"/><ellipse cx="24" cy="27" rx="8.5" ry="10" fill="${c}"/><ellipse cx="24" cy="27.5" rx="5" ry="6.5" fill="${D}"/>`+hl(20,21,3.4)+`<path d="M34 16 L40 10 M37 21 L44 17 M38 27 L45 26" stroke="${D}" stroke-width="2.4" stroke-linecap="round"/>`
})[s]}</svg>`;
const noseSVG=s=>`<svg viewBox="0 0 48 48">${({
  button:`<ellipse cx="24" cy="25" rx="7.5" ry="5.5" fill="#3a2308"/>`,
  pink:`<ellipse cx="24" cy="25" rx="6.5" ry="5" fill="#ff8fa8"/>`,
  triangle:`<path d="M16 20 H32 L24 30 Z" fill="#e0728c" stroke="#e0728c" stroke-width="3" stroke-linejoin="round"/>`,
  heart:`<path d="M24 31 C16 25 15 19 19.5 18 C22 17.5 24 20 24 21 C24 20 26 17.5 28.5 18 C33 19 32 25 24 31 Z" fill="#ff5f8a"/>`,
  big:`<ellipse cx="24" cy="24" rx="10.5" ry="7.5" fill="#2a1a14"/>`,
  dot:`<circle cx="24" cy="25" r="3.2" fill="${D}"/>`,
  dog:`<path d="M24 17 C31 17 38 19 38 25 C38 31 30 37 24 37 C18 37 10 31 10 25 C10 19 17 17 24 17 Z" fill="#1c1514"/><ellipse cx="19.5" cy="25" rx="2" ry="3.4" fill="#000" transform="rotate(-28 19.5 25)"/><ellipse cx="28.5" cy="25" rx="2" ry="3.4" fill="#000" transform="rotate(28 28.5 25)"/><path d="M24 28 V33" stroke="#000" stroke-width="1.4" stroke-linecap="round"/><ellipse cx="19" cy="20.5" rx="3" ry="1.4" fill="#6f6a78" transform="rotate(-15 19 20.5)"/>`,
  wide:`<ellipse cx="24" cy="25" rx="10.5" ry="6.5" fill="#d9798f"/><ellipse cx="20.5" cy="25" rx="2" ry="2.8" fill="#4a1a24"/><ellipse cx="27.5" cy="25" rx="2" ry="2.8" fill="#4a1a24"/>`
})[s]}<path d="M24 32 V37 M24 37 Q18 43 12 38 M24 37 Q30 43 36 38" fill="none" stroke="#3a2a22" stroke-width="2.2" stroke-linecap="round"/></svg>`;
const WS={classic:{},short:{len:9,dr:.5},long:{len:21,dr:3},thick:{w:3.4},many:{n:4},droopy:{len:17,dr:7},white:{c:'#c9bfb2'}};
const whiskSVG=t=>{const o=Object.assign({n:3,len:15,dr:1,w:1.7,c:'#2a1a14'},WS[t]);let d='';
  [-1,1].forEach(sd=>{for(let i=0;i<o.n;i++){const k=i-(o.n-1)/2,y=26+k*5.5,x0=24+sd*6,x1=24+sd*(6+o.len),y1=y+k*3+o.dr;d+=`M${x0} ${y} Q${(x0+x1)/2} ${y+k*1.5-1} ${x1} ${y1} `}});
  return `<svg viewBox="0 0 48 48"><path d="${d}" fill="none" stroke="${o.c}" stroke-width="${o.w}" stroke-linecap="round"/><ellipse cx="24" cy="26" rx="4.2" ry="3.2" fill="#d98a9a"/></svg>`};
const faceIcon=(cfg,type)=>{const g=new T.Group(),h=new T.Mesh(new T.SphereGeometry(1,48,32),makeCoat({fur:cfg.fur,pat:cfg.pat,pattern:cfg.pattern||'classic'},0));
  h.scale.set(1,.78,.85);g.add(h);buildEyes(cfg.eyeStyle||'classic',cfg.eyeColor||EYECS[0],cfg.fur,g);buildNose(cfg.nose||'button',g);const c=buildCheeks(type,{fur:cfg.fur,pat:cfg.pat,pattern:cfg.pattern||'classic'},g);
  if(c&&c.meshes[0])c.meshes[0].material.userData.u.uRel.value.makeScale(1,1/.78,1/.85);   // icon head is a unit sphere scaled like the real head
  return g};
const tailIcon=(cfg,type)=>{const g=new T.Group();buildTail(type,g,{fur:cfg.fur,pat:cfg.pat,pattern:cfg.pattern||'classic'});return g};
const noneIcon='<i class="bi bi-slash-circle"></i>';
const img=u=>u?`<img src="${u}" alt="" draggable="false">`:'';

export function openMaker(cfg,h){
  const el=document.getElementById('maker');el.hidden=false;let tab='cat',cat='coat';
  const pat=()=>cfg.pattern||'classic',gear=()=>cfg.gearC||GEAR_COLS[0];
  // lazy: only the visible category is rendered
  const items=()=>({
    coat:()=>COATS.map((c,i)=>({html:img(iconOf(`coat|${c}|${pat()}`,()=>ball(c[0],c[1],pat()),[0,.12,1])),sel:cfg.fur===c[0]&&cfg.pat===c[1],set:()=>{cfg.fur=c[0];cfg.pat=c[1]},t:COAT_NAMES[i],lab:COAT_NAMES[i]})),
    pattern:()=>PATTERNS.map(p=>({html:img(iconOf(`pat|${p[0]}|${cfg.fur}|${cfg.pat}`,()=>ball(cfg.fur,cfg.pat,p[0]),[0,.12,1])),sel:pat()===p[0],set:()=>cfg.pattern=p[0],t:p[1],lab:p[1]})),
    ears:()=>EARS.map(e=>({html:img(iconOf(`ear|${e}|${cfg.fur}|${cfg.pat}`,()=>earPair(e,cfg.fur,cfg.pat),[0,.25,1])),sel:cfg.ears===e,set:()=>cfg.ears=e,t:EAR_NAMES[e],lab:EAR_NAMES[e]})),
    eyeS:()=>EYE_STYLES.map(x=>({html:eyeStyleSVG(x[0],cfg.eyeColor||EYECS[0]),sel:(cfg.eyeStyle||'classic')===x[0],set:()=>cfg.eyeStyle=x[0],t:x[1],lab:x[1]})),
    nose:()=>NOSES.map(x=>({html:noseSVG(x[0]),sel:(cfg.nose||'button')===x[0],set:()=>cfg.nose=x[0],t:x[1],lab:x[1]})),
    cheeks:()=>CHEEKS.map(x=>({html:x[0]==='none'?noneIcon:img(iconOf(`cheek|${x[0]}|${cfg.fur}|${cfg.pat}|${pat()}|${cfg.nose}|${cfg.eyeStyle}|${cfg.eyeColor}`,()=>faceIcon(cfg,x[0]),[0,.05,1])),sel:(cfg.cheeks||'none')===x[0],set:()=>cfg.cheeks=x[0],t:x[1],lab:x[1]})),
    tail:()=>TAILS.map(x=>({html:img(iconOf(`tail|${x[0]}|${cfg.fur}|${cfg.pat}|${pat()}`,()=>tailIcon(cfg,x[0]),[1,.35,.25])),sel:(cfg.tail||'classic')===x[0],set:()=>cfg.tail=x[0],t:x[1],lab:x[1]})),
    whisk:()=>WHISKERS.map(x=>({html:x[0]==='none'?noneIcon:whiskSVG(x[0]),sel:(cfg.whiskers||'classic')===x[0],set:()=>cfg.whiskers=x[0],t:x[1],lab:x[1]})),
    eyes:()=>EYECS.map(c=>({html:eyeSVG(c),sel:cfg.eyeColor===c,set:()=>cfg.eyeColor=c,t:'Eyes'})),
    collarT:()=>COLLAR_TYPES.map(x=>({html:img(iconOf(`ctype|${x[0]}|${cfg.collar||COLLARS[0]}`,()=>collarIcon(cfg.collar||COLLARS[0],x[0]),[0,.55,1])),sel:(cfg.collarType||'normal')===x[0],set:()=>cfg.collarType=x[0],t:x[1],lab:x[1]})),
    collar:()=>COLLARS.map(c=>({html:img(iconOf(`collar|${cfg.collarType||'normal'}|${c}`,()=>collarIcon(c,cfg.collarType),[0,.55,1])),sel:(cfg.collar||COLLARS[0])===c,set:()=>cfg.collar=c,t:'Collar'})),
    cloak:()=>CLOAKS.map(c=>({html:c[0]==='none'?noneIcon:img(iconOf(`cloak|${c[0]}|${cfg.cloakC}`,()=>buildCloakStatic(c[0],cfg.cloakC||CLOAK_COLS[0]),[.25,.25,-1])),sel:cfg.cloak===c[0],set:()=>cfg.cloak=c[0],t:c[1],lab:c[1]})),
    cloakC:()=>CLOAK_COLS.map(c=>({html:swatchSVG(c),sel:cfg.cloakC===c,set:()=>cfg.cloakC=c,t:'Cloak color'})),
    head:()=>HEADS.map(x=>({html:x[0]==='none'?noneIcon:img(iconOf(`head|${x[0]}|${gear()}`,()=>buildHeadwear(x[0],gear()),[.45,.35,1])),sel:(cfg.head||'none')===x[0],set:()=>cfg.head=x[0],t:x[1],lab:x[1]})),
    eyewear:()=>EYEWEAR.map(x=>({html:x[0]==='none'?noneIcon:img(iconOf(`eye|${x[0]}|${gear()}`,()=>buildEyewear(x[0],gear()),[.35,.2,1])),sel:(cfg.eyewear||'none')===x[0],set:()=>cfg.eyewear=x[0],t:x[1],lab:x[1]})),
    gearC:()=>GEAR_COLS.map(c=>({html:swatchSVG(c),sel:gear()===c,set:()=>cfg.gearC=c,t:'Gear color'}))
  })[cat]();
  const cats=()=>TABS.find(t=>t[0]===tab)[2];
  const render=(keepScroll)=>{
    if(h.view)h.view(BACK_VIEW.has(cat)?0:Math.PI);   // 0 = behind the cat (game camera), PI = in front of it
    const old=el.querySelector('.gridw'),st=old&&keepScroll?old.scrollTop:0;
    const list=items(),title=cats().find(c=>c[0]===cat)[1];
    el.innerHTML=`<div class="nmpill"><span>NAME</span><input id="nm" maxlength="8" value="${(cfg.name||'Ming').replace(/"/g,'&quot;')}" spellcheck="false"></div>
    <div class="tools"><span class="hint"><i class="bi bi-arrow-left-right"></i> Drag to rotate</span></div>
    <aside class="side">
      <div class="tabs" role="tablist">${TABS.map(t=>`<button role="tab" data-a="tab" data-v="${t[0]}" aria-selected="${t[0]===tab}" class="${t[0]===tab?'on':''}">${t[1]}</button>`).join('')}</div>
      <div class="mkbody">
        <nav class="cats">${cats().map(c=>`<button class="cbtn" data-a="cat" data-v="${c[0]}" aria-pressed="${c[0]===cat}" title="${c[1]}"><i class="bi ${c[2]}"></i></button>`).join('')}</nav>
        <section class="pnl"><header class="ptitle"><h3>${title}</h3><span>${list.length} options</span></header>
          <div class="gridw">${list.map((it,i)=>`<button class="tile${it.sel?' on':''}${it.lab?' lab':''}" data-a="pick" data-v="${i}" title="${it.t}">${it.html}${it.lab?`<em>${it.lab}</em>`:''}</button>`).join('')}</div></section>
      </div>
      <div class="pfoot"><button class="btn red" data-a="cancel"><i class="bi bi-x-lg"></i>Cancel</button><button class="btn gold" data-a="rand"><i class="bi bi-shuffle"></i>Random</button><button class="btn green" data-a="done"><i class="bi bi-check-lg"></i>Done</button></div>
    </aside>`;
    const gw=el.querySelector('.gridw');if(gw)gw.scrollTop=st;
  };
  el.onclick=e=>{const b=e.target.closest('button');if(!b||b.disabled)return;const{a,v}=b.dataset;let keep=false;
    if(a==='tab'){tab=v;cat=cats()[0][0]}else if(a==='cat')cat=v;
    else if(a==='rand'){const c=pick(COATS);Object.assign(cfg,{fur:c[0],pat:c[1],pattern:pick(PATTERNS)[0],ears:pick(EARS),eyeColor:pick(EYECS),collar:pick(COLLARS),collarType:pick(COLLAR_TYPES)[0],cloak:pick(CLOAKS)[0],cloakC:pick(CLOAK_COLS),head:pick(HEADS)[0],eyewear:pick(EYEWEAR)[0],gearC:pick(GEAR_COLS),eyeStyle:pick(EYE_STYLES)[0],nose:pick(NOSES)[0],cheeks:pick(CHEEKS)[0],tail:pick(TAILS)[0],whiskers:pick(WHISKERS)[0]});h.change(cfg);keep=true}
    else if(a==='done'||a==='cancel'){el.hidden=true;h[a](cfg);return}
    else if(a==='pick'){items()[+v].set();h.change(cfg);keep=true}
    render(keep)};
  el.oninput=e=>{if(e.target.id==='nm'){cfg.name=e.target.value||'Ming';h.change(cfg)}};render();
}
