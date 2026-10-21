// Cat maker: tiles use real 3D renders of the models (ears, headwear, eyewear, collar, cloak, coats)
// or crisp SVG, so nothing is pixelated. The card is fixed size (see style.css) with a hidden scrollbar.
import * as T from 'three';
import {COATS,COAT_NAMES,EARS,EAR_NAMES,EYECS,COLLARS,CLOAKS,CLOAK_COLS,PATTERNS,HEADS,EYEWEAR,GEAR_COLS} from './catAvatar.js';
import {buildEar,buildHeadwear,buildEyewear,buildCloakStatic} from './wearables.js';
import {buildCollarStatic} from './collar.js';
import {makeCoat} from './coatShader.js';
import {iconOf} from './iconRender.js';
import {mat} from './blocks.js';

const TABS=[
  ['cat','Cat',[['coat','Coat','bi-palette'],['pattern','Pattern','bi-grid-3x3-gap'],['ears','Ears','bi-soundwave'],['eyes','Eyes','bi-eye'],['collar','Collar','bi-disc']]],
  ['acc','Accessories',[['cloak','Cloak','bi-shield'],['cloakC','Cloak color','bi-brush'],['head','Headwear','bi-mortarboard'],['eyewear','Eyewear','bi-eyeglasses'],['gearC','Gear color','bi-palette2']]]
];
const pick=a=>a[(Math.random()*a.length)|0];
const cap=s=>s[0].toUpperCase()+s.slice(1);

// ---- icon builders ---------------------------------------------------------
const ball=(fur,pat,pattern)=>new T.Mesh(new T.SphereGeometry(1,56,40),makeCoat({fur,pat,pattern},0));
const earPair=(type,fur,pat)=>{
  const g=new T.Group(),pink=mat('#ff9db8');
  [-1,1].forEach(s=>{const a=new T.Group();a.position.set(s*.56,0,0);a.rotation.z=-s*.5;g.add(a);
    const sw=new T.Group();a.add(sw);const info=buildEar(type,sw,mat(s<0?pat:fur),pink);sw.rotation.set(info.bx,0,-s*info.out)});
  return g};
const collarIcon=c=>buildCollarStatic(c);

const eyeSVG=c=>`<svg viewBox="0 0 48 48"><circle cx="24" cy="24" r="19" fill="#fff"/><circle cx="24" cy="24" r="14.5" fill="${c}"/><circle cx="24" cy="24" r="7" fill="#150d0a"/><circle cx="19" cy="19" r="3.4" fill="#fff"/><circle cx="28.5" cy="28.5" r="1.6" fill="#fff" opacity=".7"/></svg>`;
const swatchSVG=c=>`<svg viewBox="0 0 48 48"><defs><radialGradient id="g${c.slice(1)}" cx=".32" cy=".28" r=".8"><stop offset="0" stop-color="#fff" stop-opacity=".55"/><stop offset=".55" stop-color="#fff" stop-opacity="0"/></radialGradient></defs><circle cx="24" cy="24" r="19" fill="${c}" stroke="#00000022" stroke-width="1.5"/><circle cx="24" cy="24" r="19" fill="url(#g${c.slice(1)})"/></svg>`;
const noneIcon='<i class="bi bi-slash-circle"></i>';
const img=u=>u?`<img src="${u}" alt="" draggable="false">`:'';

export function openMaker(cfg,h){
  const el=document.getElementById('maker');el.hidden=false;let tab='cat',cat='coat',run=false;
  const pat=()=>cfg.pattern||'classic',gear=()=>cfg.gearC||GEAR_COLS[0];
  // lazy: only the visible category is rendered
  const items=()=>({
    coat:()=>COATS.map((c,i)=>({html:img(iconOf(`coat|${c}|${pat()}`,()=>ball(c[0],c[1],pat()),[0,.12,1])),sel:cfg.fur===c[0]&&cfg.pat===c[1],set:()=>{cfg.fur=c[0];cfg.pat=c[1]},t:COAT_NAMES[i],lab:COAT_NAMES[i]})),
    pattern:()=>PATTERNS.map(p=>({html:img(iconOf(`pat|${p[0]}|${cfg.fur}|${cfg.pat}`,()=>ball(cfg.fur,cfg.pat,p[0]),[0,.12,1])),sel:pat()===p[0],set:()=>cfg.pattern=p[0],t:p[1],lab:p[1]})),
    ears:()=>EARS.map(e=>({html:img(iconOf(`ear|${e}|${cfg.fur}|${cfg.pat}`,()=>earPair(e,cfg.fur,cfg.pat),[0,.25,1])),sel:cfg.ears===e,set:()=>cfg.ears=e,t:EAR_NAMES[e],lab:EAR_NAMES[e]})),
    eyes:()=>EYECS.map(c=>({html:eyeSVG(c),sel:cfg.eyeColor===c,set:()=>cfg.eyeColor=c,t:'Eyes'})),
    collar:()=>COLLARS.map(c=>({html:img(iconOf(`collar|${c}`,()=>collarIcon(c),[0,.55,1])),sel:(cfg.collar||COLLARS[0])===c,set:()=>cfg.collar=c,t:'Collar'})),
    cloak:()=>CLOAKS.map(c=>({html:c[0]==='none'?noneIcon:img(iconOf(`cloak|${c[0]}|${cfg.cloakC}`,()=>buildCloakStatic(c[0],cfg.cloakC||CLOAK_COLS[0]),[.25,.25,-1])),sel:cfg.cloak===c[0],set:()=>cfg.cloak=c[0],t:c[1],lab:c[1]})),
    cloakC:()=>CLOAK_COLS.map(c=>({html:swatchSVG(c),sel:cfg.cloakC===c,set:()=>cfg.cloakC=c,t:'Cloak color'})),
    head:()=>HEADS.map(x=>({html:x[0]==='none'?noneIcon:img(iconOf(`head|${x[0]}|${gear()}`,()=>buildHeadwear(x[0],gear()),[.45,.35,1])),sel:(cfg.head||'none')===x[0],set:()=>cfg.head=x[0],t:x[1],lab:x[1]})),
    eyewear:()=>EYEWEAR.map(x=>({html:x[0]==='none'?noneIcon:img(iconOf(`eye|${x[0]}|${gear()}`,()=>buildEyewear(x[0],gear()),[.35,.2,1])),sel:(cfg.eyewear||'none')===x[0],set:()=>cfg.eyewear=x[0],t:x[1],lab:x[1]})),
    gearC:()=>GEAR_COLS.map(c=>({html:swatchSVG(c),sel:gear()===c,set:()=>cfg.gearC=c,t:'Gear color'}))
  })[cat]();
  const cats=()=>TABS.find(t=>t[0]===tab)[2];
  const render=(keepScroll)=>{
    const old=el.querySelector('.gridw'),st=old&&keepScroll?old.scrollTop:0;
    const list=items(),title=cats().find(c=>c[0]===cat)[1];
    el.innerHTML=`<div class="nmpill"><span>NAME</span><input id="nm" maxlength="8" value="${(cfg.name||'Ming').replace(/"/g,'&quot;')}"></div>
    <div class="tools"><button class="rbtn blue" data-a="run" title="Run"><i class="bi ${run?'bi-stop-fill':'bi-play-fill'}"></i></button><button class="rbtn gold" data-a="shoot" title="Shoot"><i class="bi bi-bullseye"></i></button><span>Drag to spin</span></div>
    <aside class="side">
      <div class="tabs" role="tablist">${TABS.map(t=>`<button role="tab" data-a="tab" data-v="${t[0]}" aria-selected="${t[0]===tab}" class="${t[0]===tab?'on':''}">${t[1]}</button>`).join('')}</div>
      <div class="cats">${cats().map(c=>`<button class="cbtn" data-a="cat" data-v="${c[0]}" aria-pressed="${c[0]===cat}" title="${c[1]}"><i class="bi ${c[2]}"></i></button>`).join('')}</div>
      <section class="pnl"><h3 class="ptitle">${title}</h3>
        <div class="gridw">${list.map((it,i)=>`<button class="tile${it.sel?' on':''}${it.lab?' lab':''}" data-a="pick" data-v="${i}" title="${it.t}">${it.html}${it.lab?`<em>${it.lab}</em>`:''}</button>`).join('')}</div></section>
      <div class="pfoot"><button class="pill red" data-a="cancel">Cancel<i><b class="bi bi-x-lg"></b></i></button><button class="pill purple" data-a="rand">Random<i><b class="bi bi-shuffle"></b></i></button><button class="pill green" data-a="done">Done<i><b class="bi bi-check-lg"></b></i></button></div>
    </aside>`;
    const gw=el.querySelector('.gridw');if(gw)gw.scrollTop=st;
  };
  el.onclick=e=>{const b=e.target.closest('button');if(!b||b.disabled)return;const{a,v}=b.dataset;let keep=false;
    if(a==='tab'){tab=v;cat=cats()[0][0]}else if(a==='cat')cat=v;else if(a==='run'){run=!run;h.run(run);keep=true}else if(a==='shoot'){h.shoot();return}
    else if(a==='rand'){const c=pick(COATS);Object.assign(cfg,{fur:c[0],pat:c[1],pattern:pick(PATTERNS)[0],ears:pick(EARS),eyeColor:pick(EYECS),collar:pick(COLLARS),cloak:pick(CLOAKS)[0],cloakC:pick(CLOAK_COLS),head:pick(HEADS)[0],eyewear:pick(EYEWEAR)[0],gearC:pick(GEAR_COLS)});h.change(cfg);keep=true}
    else if(a==='done'||a==='cancel'){el.hidden=true;h.run(false);h[a](cfg);return}
    else if(a==='pick'){items()[+v].set();h.change(cfg);keep=true}
    render(keep)};
  el.oninput=e=>{if(e.target.id==='nm'){cfg.name=e.target.value||'Ming';h.change(cfg)}};render();
}