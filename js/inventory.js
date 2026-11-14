// Story-mode menu: a rounded 3D card that floats INSIDE the game (js/invCard.js), not a modal. Three tabs:
//   SKILL TREE : the curse objects. Collected ones are unlocked nodes (locked ones are dark "?"), you can equip 5 at a time.
//   INVENTORY  : left = the backpack (20 slots max, every non-curse item you own) + item details.
//                right = what the character wears: helmet / armor / boots, 3 artifacts, the 2 weapon slots.
//                Weapons live in the backpack: select one and press "WEAPON 1" / "WEAPON 2".
//   MAP        : the world map, drawn inside the card (bigMap.js is mounted here through hud.mapMount).
// The character itself is the real cat of the game: while this is open main.js zooms the camera in, slides the view so the cat stands on the
// LEFT and turns it to face the camera. There is no separate preview renderer any more (invPreview.js is gone).
// The card pops in, and tilts a little with the mouse or the arrow keys / W A S D. Drag on the empty area to turn the cat.
// Open it with I (story mode), a tap on the minimap, or window.dispatchEvent(new CustomEvent('sad:inv',{detail:'map'})). Q / E = previous / next tab.
// Progress is saved per world slot (localStorage "sad.inv.<slot>").
import {ITEMS,SLOTS,SLOT,GROUP_LABEL,GROUP_ORDER,GHOST,RARITY,START} from './items.js';
import {InvCard} from './invCard.js';   // the 3D card this menu is glued to

const KEYP='sad.inv.',BAG_MAX=20,CURSE_MAX=5;
const TABS=[['tree','SKILL TREE'],['inv','INVENTORY'],['map','MAP']];
const ARMOR=['head','chest','boots'],ARTIF=['a0','a1','a2'],CURSES=['c0','c1','c2','c3','c4'],WEAPS=['w0','w1'];
const CG=SLOT.c0&&SLOT.c0.grp;   // the group name of curse objects
const esc=s=>String(s).replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
// stepped (pixel-rounded) box: every button / panel uses this clip
const PXC='polygon(0 6px,3px 6px,3px 3px,6px 3px,6px 0,calc(100% - 6px) 0,calc(100% - 6px) 3px,calc(100% - 3px) 3px,calc(100% - 3px) 6px,100% 6px,100% calc(100% - 6px),calc(100% - 3px) calc(100% - 6px),calc(100% - 3px) calc(100% - 3px),calc(100% - 6px) calc(100% - 3px),calc(100% - 6px) 100%,6px 100%,6px calc(100% - 3px),3px calc(100% - 3px),3px calc(100% - 6px),0 calc(100% - 6px))';

// The HTML is laid out on a fixed "design" canvas (--W x --H, sizes set by invCard.js through onLayout) and invCard.js maps that canvas onto the 3D card,
// so nothing here depends on the viewport size.
const css=document.createElement('style');css.textContent=`
body.inv-open #hud,body.inv-open #fps-crosshair,body.inv-open #ebars,body.inv-open #banner,body.inv-open #mob{display:none!important}
#inv{--ink:#2a1d18;--cr:#fbf3dc;--tan:#ecdcb2;--tan2:#dcc994;--edge:#cdb98a;--red:#b3392b;--pxc:${PXC};
  position:fixed;inset:0;z-index:1200;color:var(--ink);font-family:var(--font);touch-action:none;-webkit-user-select:none;user-select:none}   /* no dim layer: the game stays visible, the cat stands on the left */
#inv[hidden]{display:none}
#inv button{font-family:inherit}
#inv .px{appearance:none;border:0;color:var(--ink);background:var(--tan);position:relative;clip-path:var(--pxc)}
#inv button.px{cursor:pointer}
#inv button.px:hover{background:#fff8e2}
#inv button.px:active{transform:translateY(1px)}
#inv .px.sel,#inv .px.on{background:#fffdf4}
/* the card: its transform / size / opacity are set every frame by invCard.js (CSS matrix3d that follows the 3D card) */
#inv .iv-card{position:absolute;left:0;top:0;transform-origin:0 0;visibility:hidden;--ts:56px;--ss:62px;--H:640px}
#inv .iv-face{position:absolute;inset:3px;border-radius:34px;background:var(--cr);box-shadow:inset 0 0 0 4px var(--edge)}   /* sits 3px inside the 3D card, so its rim shows around it */
#inv .iv-in{position:absolute;inset:0;display:flex;flex-direction:column;gap:14px;padding:24px 30px 28px}
#inv .iv-top{display:flex;gap:10px;align-items:center;justify-content:center;flex:none}
#inv .iv-top .px{padding:9px 22px 10px;font:400 18px/1 var(--disp);letter-spacing:.08em;white-space:nowrap}
#inv .iv-top .px.on{background:var(--ink);color:var(--cr)}
#inv .iv-top .iv-x{position:absolute;right:30px;top:22px;padding:9px 14px 10px}
#inv kbd{font:700 11px/1 var(--mono);background:var(--ink);color:var(--cr);padding:5px 7px;margin:0 6px;clip-path:polygon(0 2px,2px 2px,2px 0,calc(100% - 2px) 0,calc(100% - 2px) 2px,100% 2px,100% 100%,0 100%)}
#inv .iv-body{flex:1;min-height:0;display:flex}
#inv .iv-hint{position:fixed;left:max(20px,env(safe-area-inset-left));bottom:max(16px,env(safe-area-inset-bottom));pointer-events:none;font:800 13px/1.5 var(--font);letter-spacing:.12em;text-transform:uppercase;color:#f1e8d2;text-shadow:0 2px 0 rgba(23,16,14,.85),0 3px 7px rgba(0,0,0,.55)}
/* slots */
#inv .iv-s{width:var(--ts);height:var(--ts);padding:0;display:grid;place-items:center;flex:none}
#inv .iv-s.big{width:var(--ss);height:var(--ss)}
#inv .iv-s.empty .wi{opacity:.3}
#inv .iv-s .wi{width:62%;height:62%}
#inv .iv-s em{position:absolute;right:4px;bottom:4px;font:800 10px/1 var(--font);font-style:normal;padding:2px 4px;color:var(--cr);background:#6b6253}
#inv .iv-s em.r-rare{background:#2b6cb0}#inv .iv-s em.r-unique{background:#c2640a}
#inv .iv-s i{position:absolute;left:4px;top:4px;font:400 11px/1 var(--disp);font-style:normal;background:var(--red);color:var(--cr);padding:2px 4px}   /* "equipped" tag: weapon number or a dot */
#inv .iv-cnt{font:800 12px var(--font);letter-spacing:.2em;opacity:.7;margin:0 0 8px;text-align:right}
/* inventory tab */
#inv .iv-invb{flex:1;min-height:0;display:grid;grid-template-columns:1fr 1fr;gap:26px}
#inv .iv-left{display:flex;flex-direction:column;min-height:0}
#inv .iv-grid{display:grid;grid-template-columns:repeat(5,var(--ts));gap:8px;justify-content:center;flex:none}
#inv .iv-right{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:20px;min-height:0;padding:14px;background:var(--tan2);clip-path:var(--pxc)}   /* what the character wears */
#inv .iv-eqg{display:flex;gap:34px}
#inv .iv-grp{display:flex;flex-direction:column;align-items:center}
#inv .iv-cap{font:800 11px var(--font);letter-spacing:.2em;opacity:.65;margin:0 0 8px;text-align:center}
#inv .iv-col{display:flex;flex-direction:column;gap:12px}
#inv .iv-row{display:flex;gap:12px}
/* details */
#inv .iv-det{flex:1;min-height:0;margin-top:12px;padding:12px 16px;overflow-y:auto;scrollbar-width:none;background:var(--tan);clip-path:var(--pxc)}
#inv .iv-det::-webkit-scrollbar{display:none}
#inv .iv-nh{display:flex;gap:12px;align-items:center}
#inv .iv-ic{flex:none;width:46px;height:46px;display:grid;place-items:center}#inv .iv-ic .wi{width:100%;height:100%}
#inv .iv-det h3{margin:0;font:400 22px/1.05 var(--disp);color:var(--red)}
#inv .iv-gr{font:800 11px var(--font);letter-spacing:.16em;text-transform:uppercase;opacity:.6}
#inv .iv-gr b{font:800 10px var(--font);color:var(--cr);background:#6b6253;padding:2px 6px;margin-left:6px;letter-spacing:.12em}
#inv .iv-gr b.r-rare{background:#2b6cb0}#inv .iv-gr b.r-unique{background:#c2640a}
#inv .iv-ds{margin:8px 0 6px;font:800 14px/1.3 var(--font);opacity:.85}
#inv .iv-ln{display:flex;justify-content:space-between;font:800 13px var(--font);padding:4px 0;border-top:2px dotted var(--tan2)}
#inv .iv-ln span:first-child{opacity:.6}
#inv .iv-acts{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}
#inv .iv-acts .px{background:var(--cr);padding:8px 14px;font:400 14px/1 var(--disp);letter-spacing:.06em}
#inv .iv-acts .px:hover{background:#fff}
#inv .iv-acts .px.dis{opacity:.45;pointer-events:none}
#inv .iv-acts .px.on{background:var(--ink);color:var(--cr)}
#inv .iv-empty{opacity:.65;font:800 14px var(--font)}
/* skill tree tab */
#inv .iv-treeb{flex:1;min-height:0;display:flex;flex-direction:column;gap:12px}
#inv .iv-tree{position:relative;flex:1;min-height:0;background:var(--tan);clip-path:var(--pxc)}
#inv .iv-tree svg{position:absolute;inset:0;width:100%;height:100%;shape-rendering:crispEdges}
#inv .iv-tree line{stroke:var(--tan2);stroke-width:4;vector-effect:non-scaling-stroke}
#inv .iv-tree line.on{stroke:var(--ink)}
#inv .iv-node{position:absolute;transform:translate(-50%,-50%);--ts:var(--ss);background:var(--cr)}
#inv .iv-node:hover{transform:translate(-50%,-50%)}
#inv .iv-node.lock{background:var(--tan2)}
#inv .iv-node.lock .wi{filter:brightness(0);opacity:.28}
#inv .iv-node.eq::after{content:'';position:absolute;inset:0;box-shadow:inset 0 0 0 4px var(--red)}
#inv .iv-node b{position:absolute;font:400 20px var(--disp);opacity:.45}
#inv .iv-treebot{flex:none;height:max(116px,calc(var(--H)*.26));display:grid;grid-template-columns:auto 1fr;gap:20px}
#inv .iv-eqc{display:flex;flex-direction:column;justify-content:center}
#inv .iv-eqc .row{display:flex;gap:8px}
#inv .iv-treebot .iv-det{margin:0}
/* map tab */
#inv .iv-mapw{flex:1;min-height:0;position:relative;background:#2a2118;clip-path:var(--pxc)}
/* phones upright: the card is a bottom sheet, equipment on top, backpack below */
#inv.pt .iv-hint{display:none}
#inv .iv-card.pt .iv-in{padding:18px 16px 20px;gap:10px}
#inv .iv-card.pt .iv-top .px{padding:7px 8px 8px;font-size:12px;letter-spacing:.02em}
#inv .iv-card.pt .iv-top .iv-x{position:static}
#inv .iv-card.pt kbd{display:none}
#inv .iv-card.pt .iv-invb{grid-template-columns:1fr;grid-template-rows:auto minmax(0,1fr);gap:10px}
#inv .iv-card.pt .iv-right{order:-1;flex-direction:row;flex-wrap:wrap;justify-content:center;gap:6px 16px;padding:8px}
#inv .iv-card.pt .iv-eqg{gap:14px}
#inv .iv-card.pt .iv-col,#inv .iv-card.pt .iv-row{flex-direction:row;gap:6px}
#inv .iv-card.pt .iv-s.big{width:calc(var(--ts)*.8);height:calc(var(--ts)*.8)}
#inv .iv-card.pt .iv-left{overflow-y:auto;scrollbar-width:none}
#inv .iv-card.pt .iv-det{flex:none;min-height:110px}
#inv .iv-card.pt .iv-treebot{grid-template-columns:1fr;height:auto}
#inv .iv-card.pt .iv-eqc{align-items:center}
#inv .iv-card.pt{--ss:var(--ts)}`;document.head.appendChild(css);

export function createInventory(o){
  const {hud,keys,mouse,P,getCat,lockPtr,touch,canOpen,onGear}=o;   // (the camera zoom / shift that puts the cat on the left is done in main.js)
  let world=-1,st=fresh(),isOpen=false,tab='inv',sel=null,selSlot=null,selC=null,spin=0,bound=null;
  const root=document.createElement('div');root.id='inv';root.hidden=true;document.body.appendChild(root);

  function fresh(){return{owned:new Set(START.owned),eq:{...START.eq},level:1}}
  function fixWeapons(){const own=[...st.owned].filter(id=>ITEMS[id]&&ITEMS[id].grp==='weapon');
    if(!st.eq.w0||!st.owned.has(st.eq.w0))st.eq.w0=own[0];
    if(!st.eq.w1||!st.owned.has(st.eq.w1)||st.eq.w1===st.eq.w0)st.eq.w1=own.find(id=>id!==st.eq.w0)||st.eq.w0}
  function load(i){world=i;st=fresh();
    try{const j=JSON.parse(localStorage.getItem(KEYP+i)||'null');
      if(j){(j.owned||[]).forEach(id=>{if(ITEMS[id])st.owned.add(id)});
        for(const s of SLOTS){if(!j.eq||!(s.id in j.eq))continue;const id=j.eq[s.id];if(id===null&&s.grp!=='weapon')st.eq[s.id]=null;else if(id&&ITEMS[id]&&ITEMS[id].grp===s.grp&&st.owned.has(id))st.eq[s.id]=id}
        if(+j.level>0)st.level=+j.level}}catch(e){}
    fixWeapons()}
  function save(){if(world<0)return;try{localStorage.setItem(KEYP+world,JSON.stringify({owned:[...st.owned],eq:st.eq,level:st.level}))}catch(e){}}
  function wipe(i){try{localStorage.removeItem(KEYP+i)}catch(e){}}
  fixWeapons();

  const it=sid=>st.eq[sid]?ITEMS[st.eq[sid]]:null;
  const eqSlot=id=>SLOTS.find(s=>st.eq[s.id]===id);
  const gorder=g=>{const k=GROUP_ORDER.indexOf(g);return k<0?99:k};
  const bag=()=>[...st.owned].map(id=>ITEMS[id]).filter(x=>x&&x.grp!==CG).sort((a,b)=>gorder(a.grp)-gorder(b.grp)||b.power-a.power);   // the backpack: everything but curse objects
  const curses=()=>Object.values(ITEMS).filter(x=>x.grp===CG);
  const nCurse=()=>CURSES.filter(s=>st.eq[s]).length;

  // ---- pieces
  const slotBtn=(sid,big)=>{const s=SLOT[sid],x=it(sid),tag=s.grp==='weapon'?`<i>${sid==='w0'?1:2}</i>`:'';
    return`<button class="px iv-s${big?' big':''}${x?'':' empty'}${selSlot===sid?' sel':''}" data-slot="${sid}" title="${esc(x?x.name:GROUP_LABEL[s.grp])}">${x?x.icon+`<em class="r-${x.rarity}">${x.power}</em>`+tag:(GHOST[s.grp]||'')}</button>`};
  const info=x=>`<div class="iv-nh"><span class="iv-ic">${x.icon}</span><div><h3>${esc(x.name)}</h3><span class="iv-gr">${GROUP_LABEL[x.grp]}<b class="r-${x.rarity}">${RARITY[x.rarity]}</b><b>PWR ${x.power}</b></span></div></div>
    <p class="iv-ds">${esc(x.desc)}</p>${x.lines.map(l=>`<div class="iv-ln"><span>${esc(l[0])}</span><span>${esc(l[1])}</span></div>`).join('')}`;
  function acts(x){const at=eqSlot(x.id);
    if(x.grp==='weapon')return`<div class="iv-acts"><button class="px${st.eq.w0===x.id?' on':''}" data-w="w0" data-i="${x.id}">WEAPON 1</button><button class="px${st.eq.w1===x.id?' on':''}" data-w="w1" data-i="${x.id}">WEAPON 2</button></div>`;
    if(at)return`<div class="iv-acts"><button class="px" data-un="${at.id}">UNEQUIP</button></div>`;
    const full=x.grp===CG&&nCurse()>=CURSE_MAX;
    return`<div class="iv-acts"><button class="px${full?' dis':''}" data-eq="${x.id}">${full?'CURSES FULL '+CURSE_MAX+'/'+CURSE_MAX:'EQUIP'}</button></div>`}
  const detail=x=>x?info(x)+acts(x):'';

  // ---- tabs
  function invTab(){
    const list=bag().slice(0,BAG_MAX),cells=[];
    for(let i=0;i<BAG_MAX;i++){const x=list[i];
      if(!x){cells.push('<div class="px iv-s empty" style="opacity:.55;cursor:default"></div>');continue}
      const at=eqSlot(x.id),tag=at?(x.grp==='weapon'?(at.id==='w0'?'1':'2'):'&#9679;'):'';
      cells.push(`<button class="px iv-s${sel&&sel.k==='item'&&sel.v===x.id?' sel':''}" data-item="${x.id}" title="${esc(x.name)}">${x.icon}<em class="r-${x.rarity}">${x.power}</em>${tag?`<i>${tag}</i>`:''}</button>`)}
    let d;
    if(sel&&sel.k==='item'&&ITEMS[sel.v]&&st.owned.has(sel.v))d=detail(ITEMS[sel.v]);
    else if(sel&&sel.k==='slot')d=`<div class="iv-empty">Empty ${GROUP_LABEL[SLOT[sel.v].grp].toLowerCase()} slot. Pick an item from the backpack to put in it.</div>`;
    else d='<div class="iv-empty">Pick an item to read about it.</div>';
    return`<div class="iv-invb"><div class="iv-left"><div class="iv-cnt">ITEMS ${list.length} / ${BAG_MAX}</div><div class="iv-grid">${cells.join('')}</div><div class="iv-det">${d}</div></div>
      <div class="iv-right"><div class="iv-eqg"><div class="iv-grp"><div class="iv-cap">ARMOR</div><div class="iv-col">${ARMOR.map(s=>slotBtn(s,1)).join('')}</div></div>
        <div class="iv-grp"><div class="iv-cap">ARTIFACTS</div><div class="iv-col">${ARTIF.map(s=>slotBtn(s,1)).join('')}</div></div></div>
        <div class="iv-grp"><div class="iv-cap">WEAPONS</div><div class="iv-row">${WEAPS.map(s=>slotBtn(s,1)).join('')}</div></div></div></div>`}

  function treeTab(){
    const all=curses(),n=all.length,lv=[];let k=0;
    for(let l=0;k<n;l++){const c=Math.min(1<<l,n-k);lv.push([k,c]);k+=c}
    const pos=all.map((_,i)=>{let l=0;while(l+1<lv.length&&i>=lv[l+1][0])l++;const[s,c]=lv[l];return{x:(i-s+.5)/c*100,y:lv.length<2?50:14+l*(72/(lv.length-1))}});
    const lines=all.map((x,i)=>{if(!i)return'';const p=(i-1)>>1;return`<line x1="${pos[p].x}%" y1="${pos[p].y}%" x2="${pos[i].x}%" y2="${pos[i].y}%" class="${st.owned.has(x.id)&&st.owned.has(all[p].id)?'on':''}"/>`}).join('');
    const nodes=all.map((x,i)=>{const own=st.owned.has(x.id),eq=!!eqSlot(x.id);
      return`<button class="px iv-s iv-node${own?'':' lock'}${eq?' eq':''}${selC===x.id?' sel':''}" style="left:${pos[i].x}%;top:${pos[i].y}%" data-cn="${x.id}" title="${own?esc(x.name):'Locked'}">${x.icon}${own?'':'<b>?</b>'}</button>`}).join('');
    const x=selC&&ITEMS[selC],own=x&&st.owned.has(x.id);
    const d=!x?'<div class="iv-empty">Pick a curse to read about it. Collect curse objects in the world to unlock more.</div>'
      :own?detail(x):`<div class="iv-nh"><span class="iv-ic">${x.icon.replace('<svg','<svg style="filter:brightness(0);opacity:.3"')}</span><div><h3>???</h3><span class="iv-gr">Locked ${GROUP_LABEL[CG].toLowerCase()}</span></div></div><p class="iv-ds">Find this curse object in the world to unlock it.</p>`;
    return`<div class="iv-treeb"><div class="iv-tree"><svg>${lines}</svg>${nodes||'<div class="iv-empty" style="padding:20px">No curse objects exist yet.</div>'}</div>
      <div class="iv-treebot"><div class="iv-eqc"><div class="iv-cnt" style="text-align:left">CURSES ${nCurse()} / ${CURSE_MAX}</div><div class="row">${CURSES.map(s=>slotBtn(s,0)).join('')}</div></div><div class="iv-det">${d}</div></div></div>`}

  // the design canvas size / slot size come from invCard.js (it knows the screen); the card element is created once
  function onLayout(L){const c=bound;if(!c)return;
    const ts=clamp(Math.round(L.H*.088),38,62);
    c.style.width=L.W+'px';c.style.height=L.H+'px';
    c.style.setProperty('--H',L.H+'px');c.style.setProperty('--ts',ts+'px');c.style.setProperty('--ss',Math.round(ts*1.12)+'px');
    c.classList.toggle('pt',L.portrait);root.classList.toggle('pt',L.portrait)}

  function render(){
    if(!root.firstChild){
      root.innerHTML=`<div class="iv-card"><div class="iv-face"></div><div class="iv-in"><div class="iv-top"></div><div class="iv-body"></div></div></div>
        <div class="iv-hint">${touch?'Drag to turn your cat':'Drag to turn your cat<br>Mouse or arrow keys tilt the card'}</div>`;
      bound=root.querySelector('.iv-card');InvCard.bind(bound,onLayout)}
    const $=q=>root.querySelector(q),body=$('.iv-body'),ds=body.querySelector('.iv-det'),sc=ds?ds.scrollTop:0;
    hud.mapMount&&hud.mapMount(null);                                   // take the map out before the body is rebuilt
    $('.iv-top').innerHTML=(touch?'':'<kbd>Q</kbd>')+TABS.map(([t,n])=>`<button class="px${tab===t?' on':''}" data-t="${t}">${n}</button>`).join('')+(touch?'':'<kbd>E</kbd>')+`<button class="px iv-x" data-x="1">&times;</button>`;
    body.innerHTML=tab==='tree'?treeTab():tab==='map'?'<div class="iv-mapw"></div>':invTab();
    if(tab==='map'&&hud.mapMount)hud.mapMount(body.querySelector('.iv-mapw'));
    InvCard.tiltScale(tab==='map'?0:1);                                 // the map is panned with the mouse: keep the card flat there
    const nd=body.querySelector('.iv-det');if(nd)nd.scrollTop=sc}

  // ---- actions
  function equip(sid,id){const s=SLOT[sid],other=SLOTS.find(q=>q.grp===s.grp&&q.id!==sid&&st.eq[q.id]===id);
    if(other)st.eq[other.id]=st.eq[sid]||null;     // already worn in another slot of this kind: swap them
    st.eq[sid]=id;fixWeapons();save();render();onGear&&onGear()}
  function unequip(sid){if(SLOT[sid].grp==='weapon'||!st.eq[sid])return;st.eq[sid]=null;save();render();onGear&&onGear()}
  function equipItem(id){const x=ITEMS[id];if(!x||!st.owned.has(id))return;
    const same=SLOTS.filter(s=>s.grp===x.grp);if(!same.length)return;
    if(x.grp===CG){const f=same.find(s=>!st.eq[s.id]);if(f)equip(f.id,id);return}      // max 5 curses
    const t=selSlot&&SLOT[selSlot]&&SLOT[selSlot].grp===x.grp?selSlot:(same.find(s=>!st.eq[s.id])||same[0]).id;equip(t,id)}
  function collect(id){if(!ITEMS[id]||st.owned.has(id))return false;
    if(ITEMS[id].grp!==CG&&bag().length>=BAG_MAX){hud.banner('Inventory full','Max '+BAG_MAX+' items');return false}
    st.owned.add(id);save();if(isOpen)render();hud.banner('Collected',ITEMS[id].name);return true}
  function setTab(t){if(t==='col')t='tree';if(!TABS.some(a=>a[0]===t)||t===tab)return;tab=t;sel=null;selSlot=null;selC=null;render();InvCard.nudge()}
  root.addEventListener('click',e=>{const t=e.target.closest('[data-slot],[data-item],[data-t],[data-x],[data-eq],[data-un],[data-w],[data-cn]');if(!t)return;const d=t.dataset;
    if(d.x!==undefined)close();else if(d.t)setTab(d.t);
    else if(d.slot){const x=it(d.slot);selSlot=d.slot;if(tab==='tree'){selC=x?x.id:null}else sel=x?{k:'item',v:x.id}:{k:'slot',v:d.slot};render()}
    else if(d.item){sel={k:'item',v:d.item};if(selSlot&&SLOT[selSlot].grp!==ITEMS[d.item].grp)selSlot=null;render()}
    else if(d.cn){selC=d.cn;render()}
    else if(d.eq)equipItem(d.eq);else if(d.un)unequip(d.un);else if(d.w)equip(d.w,d.i)});
  // drag on the empty area (next to the card, where the cat stands) to turn the cat
  let drag=null;
  root.addEventListener('pointerdown',e=>{if(e.target===root){drag={id:e.pointerId,x:e.clientX};try{e.target.setPointerCapture(e.pointerId)}catch(_){}}});
  root.addEventListener('pointermove',e=>{if(drag&&e.pointerId===drag.id){spin+=(e.clientX-drag.x)*.011;drag.x=e.clientX;InvCard.spinY=spin}});
  for(const t of['pointerup','pointercancel'])root.addEventListener(t,e=>{if(drag&&e.pointerId===drag.id)drag=null});
  // Q / E = previous / next tab (captured so older single-key tab shortcuts do not fire). The card tilt keys (arrows, W A S D) are read by invCard.js.
  addEventListener('keydown',e=>{if(!isOpen||e.repeat||e.ctrlKey||e.altKey||e.metaKey)return;
    const k=e.code==='KeyQ'?-1:e.code==='KeyE'?1:0;if(!k)return;const i=TABS.findIndex(a=>a[0]===tab);setTab(TABS[(i+k+TABS.length)%TABS.length][0]);e.preventDefault();e.stopImmediatePropagation()},true);
  addEventListener('sad:inv',e=>{const t=e.detail||'inv';if(isOpen)setTab(t);else open(t)});   // e.g. the minimap: dispatchEvent(new CustomEvent('sad:inv',{detail:'map'}))

  function open(t){if(isOpen||!canOpen())return;isOpen=true;spin=0;InvCard.spinY=0;tab=TABS.some(a=>a[0]===t)?t:'inv';sel=null;selSlot=null;selC=null;
    for(const k in keys)keys[k]=false;mouse.l=false;P.scope=false;P.mv=false;P.dash=0;
    const c=getCat();if(c&&c.userData.move){c.userData.move.f=0;c.userData.move.s=0}
    document.body.classList.add('inv-open');try{document.exitPointerLock&&document.exitPointerLock()}catch(e){}
    root.hidden=false;render();
    InvCard.show()}                                                     // the card pops in
  function close(silent){if(!isOpen)return;isOpen=false;document.body.classList.remove('inv-open');if(!silent&&!touch)lockPtr();
    hud.mapMount&&hud.mapMount(null);
    InvCard.hide(()=>{if(!isOpen)root.hidden=true})}                    // pops out, then the layer is hidden

  return{load,wipe,open,close,collect,
    toggle(){isOpen?close():open('inv')},
    isOpen:()=>isOpen,tab:setTab,spin:()=>spin,
    weaponIdx:()=>[ITEMS[st.eq.w0].wi,ITEMS[st.eq.w1].wi],
    artifactIcons:()=>['a0','a1','a2'].map(s=>it(s)?{icon:it(s).icon,name:it(s).name}:null)}}
