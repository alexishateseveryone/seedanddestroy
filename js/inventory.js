// Story-mode inventory screen (Inventory / Collectibles tabs). The 3D cat in the main scene is the character preview:
// main.js moves the camera to a slightly angled front view and shifts the cat to the left while this screen is open.
//   INVENTORY    : 2 weapon slots, 3 armor slots (headgear, chestplate, boots), 3 artifact slots, 5 curse-object slots.
//                  Click a slot to see the item, then click an item in the list to equip it.
//   COLLECTIBLES : every item collected so far.
// Progress is saved per world slot (localStorage "sad.inv.<slot>").
import {ITEMS,SLOTS,SLOT,SECTIONS,GROUP_LABEL,GROUP_ORDER,GROUP_TITLE,GHOST,RARITY,START} from './items.js';

const KEYP='sad.inv.';
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

const css=document.createElement('style');css.textContent=`
body.inv-open #hud,body.inv-open #fps-crosshair,body.inv-open #ebars,body.inv-open #banner,body.inv-open #mob{display:none!important}
#inv{position:fixed;inset:0;z-index:1200;color:var(--cream);font-family:var(--font);touch-action:none;-webkit-user-select:none;user-select:none;
  background:linear-gradient(90deg,rgba(14,8,8,0) 27%,rgba(14,8,8,.74) 46%,rgba(14,8,8,.92) 100%)}
#inv[hidden]{display:none}
#inv .iv-left{position:absolute;left:0;top:0;bottom:0;width:29%;cursor:grab}
#inv .iv-lv{position:absolute;left:max(4vw,env(safe-area-inset-left));top:78px;pointer-events:none;display:flex;flex-direction:column;line-height:1;text-shadow:var(--ol)}
#inv .iv-lv small{font:800 14px var(--font);letter-spacing:.3em}
#inv .iv-lv b{font:400 clamp(40px,7vmin,64px)/1 var(--disp);color:var(--cream)}
#inv .iv-top{position:absolute;left:30%;right:3vw;top:max(16px,env(safe-area-inset-top));display:flex;align-items:center;justify-content:space-between;gap:14px}
#inv .iv-tabs{display:flex;gap:6px;align-items:center}
#inv .iv-tabs button,#inv .iv-x{appearance:none;border:0;cursor:pointer;background:none;color:var(--cream);font:400 clamp(15px,2.4vmin,22px) var(--disp);letter-spacing:.08em;padding:8px 16px;border-radius:3px;text-shadow:var(--ol);opacity:.7;transition:background .12s,opacity .12s}
#inv .iv-tabs button:hover,#inv .iv-x:hover{opacity:1;background:rgba(241,232,210,.12)}
#inv .iv-tabs button.on{opacity:1;background:var(--blood)}
#inv kbd{font:700 11px/1 var(--mono);background:rgba(23,16,14,.7);border:1px solid rgba(241,232,210,.4);border-radius:3px;padding:3px 5px;margin-left:8px;vertical-align:middle;color:var(--cream)}
#inv .iv-body{position:absolute;left:30%;right:3vw;top:calc(max(16px,env(safe-area-inset-top)) + 58px);bottom:max(22px,env(safe-area-inset-bottom));display:grid;grid-template-columns:minmax(0,1.12fr) minmax(0,1fr);gap:26px}
#inv .iv-main{min-height:0;overflow-y:auto;scrollbar-width:none;padding:4px 6px 20px}
#inv .iv-main::-webkit-scrollbar,#inv .iv-det::-webkit-scrollbar{display:none}
#inv .iv-gp{display:flex;align-items:center;gap:16px;margin:0 0 14px;text-shadow:var(--ol)}
#inv .iv-gp small{font:800 13px var(--font);letter-spacing:.22em;display:block;opacity:.85}
#inv .iv-gp b{font:400 clamp(34px,6vmin,52px)/1 var(--disp)}
#inv .iv-chips{display:flex;gap:8px;flex-wrap:wrap}
#inv .iv-chip{display:flex;flex-direction:column;align-items:center;min-width:48px;padding:4px 8px;background:rgba(241,232,210,.12);border-radius:3px;font:400 18px/1.1 var(--disp)}
#inv .iv-chip span{font:800 10px var(--font);letter-spacing:.16em;opacity:.75}
#inv .iv-sec{margin:0 0 16px}
#inv .iv-sec h4{margin:0 0 8px;font:800 13px var(--font);letter-spacing:.24em;opacity:.85;text-shadow:var(--ol)}
#inv .iv-row,#inv .iv-grid{display:flex;flex-wrap:wrap;gap:12px}
#inv .iv-s,#inv .iv-t{--sheet:var(--paper);position:relative;isolation:isolate;appearance:none;border:0;background:none;cursor:pointer;padding:0;display:grid;place-items:center;color:var(--k);
  width:var(--ts,64px);height:var(--ts,64px);transition:transform .1s,color .1s;filter:drop-shadow(0 3px 0 rgba(0,0,0,.55))}
#inv .iv-s::before,#inv .iv-t::before,#inv .iv-r::before{content:'';position:absolute;inset:0;z-index:-1;background:var(--grain) var(--sheet);clip-path:var(--s3);transition:background-color .12s}
#inv .iv-s:nth-child(2n)::before,#inv .iv-t:nth-child(2n)::before{clip-path:var(--s6)}
#inv .iv-s:nth-child(3n)::before,#inv .iv-t:nth-child(3n)::before{clip-path:var(--s5)}
#inv .iv-s:nth-child(2n),#inv .iv-t:nth-child(2n){transform:rotate(.6deg)}
#inv .iv-s:nth-child(2n+1),#inv .iv-t:nth-child(2n+1){transform:rotate(-.5deg)}
#inv .iv-s:hover,#inv .iv-t:hover{transform:translateY(-2px) rotate(0)}
#inv .iv-s:hover::before,#inv .iv-t:hover::before,#inv .iv-r:hover::before{background-color:#fffaf0}
#inv .iv-s.sel,#inv .iv-t.sel{color:var(--cream)}
#inv .iv-s.sel::before,#inv .iv-t.sel::before{background-color:var(--blood)}
#inv .iv-s.empty{opacity:.55}
#inv .iv-s .wi,#inv .iv-t .wi{width:60%;height:60%}
#inv .iv-s.empty .wi{opacity:.35}
#inv .iv-s em,#inv .iv-t em{position:absolute;right:3px;bottom:3px;font:800 11px/1 var(--font);font-style:normal;padding:2px 4px;border-radius:2px;color:var(--cream);background:#6b6253}
#inv .iv-s em.r-rare,#inv .iv-t em.r-rare{background:#2b6cb0}
#inv .iv-s em.r-unique,#inv .iv-t em.r-unique{background:#c2640a}
#inv .iv-t{--ts:70px}
#inv .iv-t b{position:absolute;left:0;right:0;bottom:-18px;text-align:center;font:800 11px var(--font);letter-spacing:.04em;color:var(--cream);text-shadow:var(--ol);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#inv .iv-grid{row-gap:30px}
#inv .iv-cnt{font:800 13px var(--font);letter-spacing:.2em;margin:0 0 14px;text-shadow:var(--ol)}
#inv .iv-none{opacity:.7;font:800 14px var(--font);margin:4px 0 16px}
#inv .iv-detw{position:relative;isolation:isolate;min-height:0;filter:drop-shadow(0 6px 0 rgba(0,0,0,.5)) drop-shadow(0 12px 18px rgba(0,0,0,.4))}
#inv .iv-detw::before{content:'';position:absolute;inset:0;z-index:-1;background:var(--grain) var(--paper);clip-path:var(--L1)}
#inv .iv-det{height:100%;box-sizing:border-box;overflow-y:auto;scrollbar-width:none;padding:22px 24px;color:var(--k)}
#inv .iv-eqd{display:inline-block;font:800 11px var(--font);letter-spacing:.22em;background:var(--k);color:var(--cream);padding:3px 10px;border-radius:2px;margin:0 0 10px}
#inv .iv-nh{display:flex;gap:14px;align-items:center;margin:0 0 10px}
#inv .iv-ic{flex:none;display:grid;place-items:center;width:62px;height:62px;color:var(--k)}
#inv .iv-ic .wi{width:100%;height:100%}
#inv .iv-pw{font:400 30px/1 var(--disp);display:flex;align-items:center;gap:10px}
#inv .iv-pw small{font:800 11px var(--font);letter-spacing:.16em;color:var(--cream);background:#6b6253;padding:3px 8px;border-radius:2px}
#inv .iv-pw small.r-rare{background:#2b6cb0}#inv .iv-pw small.r-unique{background:#c2640a}
#inv .iv-det h3{margin:2px 0 0;font:400 clamp(20px,3.4vmin,28px)/1.05 var(--disp);color:var(--blood)}
#inv .iv-gr{font:800 12px var(--font);letter-spacing:.16em;text-transform:uppercase;opacity:.6}
#inv .iv-ds{margin:8px 0 12px;font:800 16px/1.3 var(--font);opacity:.85}
#inv .iv-ln{display:flex;justify-content:space-between;font:800 15px var(--font);padding:5px 0;border-top:2px solid rgba(23,16,14,.15)}
#inv .iv-ln span:first-child{opacity:.65}
#inv .iv-sw{margin:16px 0 6px;font:800 12px var(--font);letter-spacing:.22em;opacity:.7}
#inv .iv-r{--sheet:var(--paper2);position:relative;isolation:isolate;appearance:none;border:0;background:none;cursor:pointer;width:100%;display:flex;align-items:center;gap:12px;padding:8px 12px;margin:0 0 8px;text-align:left;color:var(--k);font:800 16px var(--font)}
#inv .iv-r::before{clip-path:var(--s2)}
#inv .iv-r .ic{flex:none;width:30px;height:30px;display:grid;place-items:center}
#inv .iv-r .wi{width:100%;height:100%}
#inv .iv-r b{flex:1;font-weight:800;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#inv .iv-r em{font:400 16px var(--disp);font-style:normal}
#inv .iv-r small{font:800 10px var(--font);letter-spacing:.14em;opacity:.55}
#inv .iv-un{appearance:none;border:0;cursor:pointer;margin:4px 0 4px;padding:8px 16px;background:var(--k);color:var(--cream);font:800 14px var(--font);letter-spacing:.14em;border-radius:3px}
#inv .iv-un:hover{background:var(--blood)}
#inv .iv-empty{opacity:.7;font:800 16px var(--font)}
@media (max-width:900px),(max-height:520px){
  #inv{background:linear-gradient(90deg,rgba(14,8,8,.35),rgba(14,8,8,.9) 40%)}
  #inv .iv-left,#inv .iv-lv{display:none}
  #inv .iv-top,#inv .iv-body{left:2vw}
  #inv .iv-body{gap:12px;top:calc(max(8px,env(safe-area-inset-top)) + 46px)}
  #inv .iv-top{top:max(8px,env(safe-area-inset-top))}
  #inv .iv-s{--ts:50px}#inv .iv-t{--ts:56px}
  #inv .iv-row{gap:8px}
  #inv .iv-det{padding:14px 16px}#inv .iv-ic{width:44px;height:44px}
  #inv .iv-tabs button,#inv .iv-x{padding:5px 10px;font-size:14px}
  #inv kbd{display:none}
}`;document.head.appendChild(css);

export function createInventory(o){
  const {hud,keys,mouse,P,getCat,view,lockPtr,touch,canOpen,onGear}=o;
  let world=-1,st=fresh(),isOpen=false,tab='inv',sel='w0',selItem=null,spin=0;
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
  function stats(){const eq=SLOTS.map(s=>it(s.id)).filter(Boolean),sum=(ids,k)=>ids.reduce((a,s)=>a+((it(s)&&it(s)[k])||0),0);
    const def=['head','chest','boots'].reduce((a,s)=>a+((it(s)&&(it(s).lines.find(l=>l[0]==='Defense')||[0,0])[1])||0),0);
    return{gp:eq.length?Math.round(eq.reduce((a,b)=>a+b.power,0)/eq.length):0,atk:Math.round(sum(['w0','w1'],'power')/2),def,art:sum(['a0','a1','a2'],'power'),crs:['c0','c1','c2','c3','c4'].filter(s=>it(s)).length}}

  // ---- rendering
  const slotBtn=sid=>{const s=SLOT[sid],x=it(sid);
    return`<button class="iv-s${selItem===null&&sel===sid&&tab==='inv'?' sel':''}${x?'':' empty'}" data-s="${sid}" title="${GROUP_LABEL[s.grp]}">${x?x.icon+`<em class="r-${x.rarity}">${x.power}</em>`:GHOST[s.grp]}</button>`};
  const card=(x,equipped)=>`${equipped?'<div class="iv-eqd">EQUIPPED</div>':''}
    <div class="iv-nh"><span class="iv-ic">${x.icon}</span><div><div class="iv-pw">${x.power}<small class="r-${x.rarity}">${RARITY[x.rarity]}</small></div><h3>${esc(x.name)}</h3><span class="iv-gr">${GROUP_LABEL[x.grp]}</span></div></div>
    <p class="iv-ds">${esc(x.desc)}</p>${x.lines.map(l=>`<div class="iv-ln"><span>${esc(l[0])}</span><span>${esc(l[1])}</span></div>`).join('')}`;
  function detail(){
    if(tab==='col'){const x=selItem&&ITEMS[selItem];return x?card(x,Object.values(st.eq).includes(x.id)):'<div class="iv-empty">Pick an item to read about it.</div>'}
    const s=SLOT[sel],cur=it(sel);
    const pool=[...st.owned].map(id=>ITEMS[id]).filter(x=>x.grp===s.grp&&x.id!==st.eq[sel]).sort((a,b)=>b.power-a.power);
    const used=id=>SLOTS.some(q=>q.grp===s.grp&&q.id!==sel&&st.eq[q.id]===id);
    return(cur?card(cur,true)+(s.grp==='weapon'?'':'<button class="iv-un" data-un="1">UNEQUIP</button>'):`<div class="iv-empty">Empty ${GROUP_LABEL[s.grp].toLowerCase()} slot.</div>`)
      +`<div class="iv-sw">${cur?'SWAP WITH':'EQUIP'}</div>`
      +(pool.length?pool.map(x=>`<button class="iv-r" data-i="${x.id}"><span class="ic">${x.icon}</span><b>${esc(x.name)}</b>${used(x.id)?'<small>IN USE</small>':''}<em>${x.power}</em></button>`).join(''):'<div class="iv-empty">Nothing else collected for this slot yet.</div>')}
  function main(){
    if(tab==='inv'){const S=stats();
      return`<div class="iv-gp"><div><small>GEAR POWER</small><b>${S.gp}</b></div><div class="iv-chips"><div class="iv-chip">${S.atk}<span>ATK</span></div><div class="iv-chip">${S.def}<span>DEF</span></div><div class="iv-chip">${S.art}<span>ART</span></div><div class="iv-chip">${S.crs}/5<span>CURSE</span></div></div></div>`
        +SECTIONS.map(sc=>`<div class="iv-sec"><h4>${sc.name}</h4><div class="iv-row">${sc.slots.map(slotBtn).join('')}</div></div>`).join('')}
    const total=Object.keys(ITEMS).length;
    return`<div class="iv-cnt">COLLECTED ${st.owned.size} / ${total}</div>`+GROUP_ORDER.map(g=>{
      const list=[...st.owned].map(id=>ITEMS[id]).filter(x=>x.grp===g);if(!list.length)return'';
      return`<div class="iv-sec"><h4>${GROUP_TITLE[g].toUpperCase()}</h4><div class="iv-grid">${list.map(x=>`<button class="iv-t${selItem===x.id?' sel':''}" data-c="${x.id}" title="${esc(x.name)}">${x.icon}<em class="r-${x.rarity}">${x.power}</em><b>${esc(x.name)}</b></button>`).join('')}</div></div>`}).join('')}
  function render(){
    const sc=[root.querySelector('.iv-main'),root.querySelector('.iv-det')].map(e=>e?e.scrollTop:0);
    root.innerHTML=`<div class="iv-left"></div><div class="iv-lv"><small>LEVEL</small><b>${st.level}</b></div>
      <div class="iv-top"><div class="iv-tabs"><button data-t="inv" class="${tab==='inv'?'on':''}">INVENTORY${touch?'':'<kbd>Q</kbd>'}</button><button data-t="col" class="${tab==='col'?'on':''}">COLLECTIBLES${touch?'':'<kbd>E</kbd>'}</button></div><button class="iv-x" data-x="1">CLOSE${touch?'':'<kbd>ESC</kbd>'}</button></div>
      <div class="iv-body"><div class="iv-main">${main()}</div><div class="iv-detw"><div class="iv-det">${detail()}</div></div></div>`;
    const m=root.querySelector('.iv-main'),d=root.querySelector('.iv-det');if(m)m.scrollTop=sc[0];if(d)d.scrollTop=sc[1]}

  // ---- actions
  function equip(sid,id){const s=SLOT[sid],other=SLOTS.find(q=>q.grp===s.grp&&q.id!==sid&&st.eq[q.id]===id);
    if(other)st.eq[other.id]=st.eq[sid]||null;     // already worn in another slot of this kind: swap them
    st.eq[sid]=id;fixWeapons();save();render();onGear&&onGear()}
  function unequip(sid){if(SLOT[sid].grp==='weapon'||!st.eq[sid])return;st.eq[sid]=null;save();render();onGear&&onGear()}
  function collect(id){if(!ITEMS[id]||st.owned.has(id))return false;st.owned.add(id);save();if(isOpen)render();hud.banner('Collected',ITEMS[id].name);return true}
  function setTab(t){if(t===tab)return;tab=t;selItem=null;render()}
  root.addEventListener('click',e=>{const t=e.target.closest('[data-s],[data-i],[data-c],[data-t],[data-un],[data-x]');if(!t)return;const d=t.dataset;
    if(d.x)close();else if(d.t)setTab(d.t);else if(d.s){sel=d.s;selItem=null;render()}else if(d.i)equip(sel,d.i);else if(d.c){selItem=d.c;render()}else if(d.un)unequip(sel)});
  // drag on the left side turns the character preview
  let drag=null;
  root.addEventListener('pointerdown',e=>{if(e.target.closest('.iv-left')){drag={id:e.pointerId,x:e.clientX};try{e.target.setPointerCapture(e.pointerId)}catch(_){}}});
  root.addEventListener('pointermove',e=>{if(drag&&e.pointerId===drag.id){spin+=(e.clientX-drag.x)*.011;drag.x=e.clientX}});
  for(const t of['pointerup','pointercancel'])root.addEventListener(t,e=>{if(drag&&e.pointerId===drag.id)drag=null});

  function open(){if(isOpen||!canOpen())return;isOpen=true;hud.bigmap&&hud.bigmap(false);spin=0;tab='inv';sel='w0';selItem=null;
    for(const k in keys)keys[k]=false;mouse.l=false;P.scope=false;P.mv=false;P.dash=0;
    const c=getCat();if(c&&c.userData.move){c.userData.move.f=0;c.userData.move.s=0}
    document.body.classList.add('inv-open');try{document.exitPointerLock&&document.exitPointerLock()}catch(e){}
    render();root.hidden=false;view(innerWidth>900&&innerHeight>520?.335:.2)}   // slide the scene left so the cat stands in the empty left third, clear of the item grid
  function close(silent){if(!isOpen)return;isOpen=false;root.hidden=true;document.body.classList.remove('inv-open');view(0);if(!silent&&!touch)lockPtr()}

  return{load,wipe,open,close,collect,
    toggle(){isOpen?close():open()},
    isOpen:()=>isOpen,tab:setTab,spin:()=>spin,
    weaponIdx:()=>[ITEMS[st.eq.w0].wi,ITEMS[st.eq.w1].wi],
    artifactIcons:()=>['a0','a1','a2'].map(s=>it(s)?{icon:it(s).icon,name:it(s).name}:null)}}