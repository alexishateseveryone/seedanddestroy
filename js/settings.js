// Settings: two tabs.
//   Controls : touch button size / look speed / "move buttons" layout editor (phones), or the keyboard + mouse reference (PC)
//   Graphics : presets (Low / Medium / High / Ultra) + per-option control, saved in localStorage, applied live.
// Also an optional FPS counter and an "auto lower quality when slow" safety net.
const KEY='sad.gfx';
export const PRESETS={
  low:   {scale:.75,aa:0,bloom:0,grade:0,shadows:0,clouds:0,grass:.3,detail:0,wind:0,particles:0},
  medium:{scale:1,  aa:0,bloom:0,grade:1,shadows:1,clouds:1,grass:.6,detail:1,wind:1,particles:1},
  high:  {scale:1,  aa:1,bloom:1,grade:1,shadows:2,clouds:1,grass:1, detail:1,wind:1,particles:1},
  ultra: {scale:1.25,aa:1,bloom:1,grade:1,shadows:2,clouds:1,grass:1,detail:1,wind:1,particles:1}};
const ORDER=['low','medium','high','ultra'],NAMES={low:'Low',medium:'Medium',high:'High',ultra:'Ultra'};
const ROWS=[
  ['Resolution','scale',[[.5,'50%'],[.75,'75%'],[1,'100%'],[1.25,'125%']],'Lower = much faster, slightly blurrier'],
  ['Bloom (glow)','bloom',[[0,'Off'],[1,'On']],'Soft glow on bright things. Costly'],
  ['Colour grade + vignette','grade',[[0,'Off'],[1,'On']],'Vignette, grain, colour tint'],
  ['Anti-aliasing','aa',[[0,'Off'],[1,'On']],'Smooth edges when bloom or grade is on'],
  ['Shadows','shadows',[[0,'Off'],[1,'Low'],[2,'High']],'Sun shadows from trees and characters'],
  ['Clouds','clouds',[[0,'Off'],[1,'On']],'Animated sky clouds'],
  ['Grass','grass',[[0,'Off'],[.3,'Low'],[.6,'Medium'],[1,'High']],'Amount of grass and flowers'],
  ['Ground detail','detail',[[0,'Low'],[1,'High']],'Ground shader and bump'],
  ['Wind animation','wind',[[0,'Off'],[1,'On']],'Swaying trees and grass'],
  ['Ambient particles','particles',[[0,'Off'],[1,'On']],'Fireflies and pollen']];
const KEYS=[['W A S D','Move'],['Mouse / Arrows','Look'],['LMB / E','Shoot / slash'],['RMB','Scope'],['Space','Tumble'],['R','Reload'],['1-8 / Wheel','Weapons'],['F (hold)','Plant / defuse'],['Esc / P','Pause'],['G','Settings']];
const ICO={
  pad:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8h12a4 4 0 0 1 4 4.5l-.7 4a2.3 2.3 0 0 1-4 1.2L15.5 16h-7l-1.8 1.7a2.3 2.3 0 0 1-4-1.2l-.7-4A4 4 0 0 1 6 8z"/><path d="M7.5 10.5v3M6 12h3"/><circle cx="16" cy="11.2" r=".8" fill="currentColor"/><circle cx="18" cy="13" r=".8" fill="currentColor"/></svg>',
  gfx:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="4" width="19" height="13" rx="2.5"/><path d="M8 21h8M12 17v4"/></svg>',
  move:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v18M3 12h18M12 3l-3 3M12 3l3 3M12 21l-3-3M12 21l3-3M3 12l3-3M3 12l3 3M21 12l-3-3M21 12l-3 3"/></svg>',
  reset:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12a8 8 0 1 0 2.6-5.9"/><path d="M3.5 3.5v5h5"/></svg>'};
const same=(a,b)=>ROWS.every(([,k])=>Math.abs(a[k]-b[k])<1e-6);

export function createSettings({atm,map,onResolution,getMobile=()=>null,root=document.body}){
  let st={preset:'medium',q:{...PRESETS.medium},fps:false,auto:true,blur:1,fov:70},tab='gfx';   // blur 0..3 (Off/Low/Medium/High) and fov are personal options: presets never change them
  try{const j=JSON.parse(localStorage.getItem(KEY)||'null');if(j&&j.q)st={...st,...j,q:{...PRESETS.medium,...j.q}}}catch(e){}
  const save=()=>{try{localStorage.setItem(KEY,JSON.stringify({preset:st.preset,q:st.q,fps:st.fps,auto:st.auto,blur:st.blur,fov:st.fov}))}catch(e){}};
  const presetOf=q=>ORDER.find(n=>same(PRESETS[n],q))||'custom';
  // only treat the touch controls as usable when they really expose the settings API (get/set/edit/reset)
  const mob=()=>{try{const m=getMobile();return m&&m.active&&typeof m.get==='function'&&typeof m.set==='function'&&typeof m.edit==='function'&&typeof m.reset==='function'?m:null}catch(e){return null}};
  // ---- apply
  const pr=()=>Math.max(.4,Math.min(2,Math.min(devicePixelRatio||1,1.5)*st.q.scale));
  const apply=()=>{const q=st.q;atm.setQuality({bloom:!!q.bloom,grade:!!q.grade,aa:!!q.aa,shadows:q.shadows,clouds:!!q.clouds,blur:st.blur});
    map.setQuality({grass:q.grass,detail:!!q.detail,wind:!!q.wind,particles:!!q.particles});onResolution&&onResolution();fpsEl.style.display=st.fps?'block':'none';settle=4};
  // ---- ui
  const css=document.createElement('style');css.textContent=`
  #gfx .gtabs{display:flex;gap:8px;margin:2px 0 12px}
  #gfx .gtabs button{flex:1;display:flex;align-items:center;justify-content:center;gap:8px;padding:8px 10px;border-radius:14px;border:3px solid #00000022;background:#0000000d;color:inherit;font:800 15px 'Baloo 2',sans-serif;cursor:pointer}
  #gfx .gtabs button.on{background:var(--lemon,#ffd54a);border-color:#2b2150}
  #gfx .gtabs svg,#gfx .seg svg{width:20px;height:20px;flex:none}
  #gfx .seg button.ic{display:inline-flex;align-items:center;gap:6px;white-space:nowrap;margin:0;flex:none}
  #gfx .seg.lay{display:flex;flex-wrap:wrap;gap:8px;padding:0;background:none;border:0;box-shadow:none}
  #gfx .seg.lay button.ic{border-radius:12px;border:3px solid #00000022;background:#0000000d;padding:6px 12px}
  #gfx .gkeys{display:grid;grid-template-columns:1fr 1fr;gap:8px 14px;text-align:left;font:700 14px 'Baloo 2',sans-serif}
  #gfx .gkeys div{display:flex;align-items:center;gap:8px;justify-content:space-between;background:#0000000a;border-radius:10px;padding:4px 10px}
  #gfx .gkeys kbd{white-space:nowrap}
  #gfx .fovr{display:flex;align-items:center;gap:10px;min-width:210px}
  #gfx .fovr input{flex:1;min-width:120px;accent-color:#2b2150;cursor:pointer}
  #gfx .fovr b{min-width:42px;text-align:right;font:800 15px 'Baloo 2',sans-serif}
  #gfx [hidden]{display:none!important}
  /* phones: the panel must sit above the touch buttons (z-index 960) and the pause overlay, and scroll */
  body.mobile #gfx{position:fixed;inset:0;z-index:3000;overflow-y:auto;-webkit-overflow-scrolling:touch;touch-action:pan-y;pointer-events:auto;overscroll-behavior:contain}
  body.mobile #gfx .gfxcard{max-height:92vh;max-height:92dvh;overflow-y:auto;touch-action:pan-y}
  body.mobile #gfx .grow{flex-wrap:wrap;gap:6px}
  body.mobile #gfx .gkeys{grid-template-columns:1fr}`;
  document.head.appendChild(css);
  const el=document.createElement('div');el.id='gfx';el.hidden=true;
  const seg=(attr,opts)=>`<div class="seg" ${attr}>${opts.map(([v,t])=>`<button data-v="${v}">${t}</button>`).join('')}</div>`;
  el.innerHTML=`<div class="card gfxcard"><h2>Settings</h2>
    <div class="gtabs"><button data-tab="ctl">${ICO.pad}<span>Controls</span></button><button data-tab="gfx">${ICO.gfx}<span>Graphics</span></button></div>
    <div id="pCtl" hidden>
      <div class="grows" id="ctlM">
        <div class="grow"><span>Button size<small>Bigger buttons are easier to hit</small></span>${seg('data-c="scale"',[[.8,'S'],[1,'M'],[1.2,'L'],[1.4,'XL']])}</div>
        <div class="grow"><span>Look speed<small>How fast dragging turns the camera</small></span>${seg('data-c="sens"',[[.6,'Slow'],[1,'Normal'],[1.5,'Fast'],[2,'Max']])}</div>
        <div class="grow"><span>Button layout<small>Drag every button where your thumbs like it</small></span>
          <div class="seg lay"><button class="ic" data-act="edit" title="Edit layout">${ICO.move}<span>Edit layout</span></button></div></div>
      </div>
      <div class="gkeys" id="ctlK">${KEYS.map(([k,t])=>`<div><span>${t}</span><kbd>${k}</kbd></div>`).join('')}</div>
    </div>
    <div id="pGfx">
      <div class="gpre" id="gPre">${ORDER.map(n=>`<button data-p="${n}">${NAMES[n]}</button>`).join('')}<button data-p="custom" disabled>Custom</button></div>
      <div class="grows">${ROWS.map(([name,k,opts,hint])=>`<div class="grow" title="${hint}"><span>${name}<small>${hint}</small></span>${seg(`data-k="${k}"`,opts)}</div>`).join('')}
        <div class="grow"><span>Motion blur<small>Smears the picture when you turn the camera</small></span>${seg('data-x="blur"',[[0,'Off'],[1,'Low'],[2,'Medium'],[3,'High']])}</div>
        <div class="grow"><span>Field of view<small>Wider sees more around you (default 70)</small></span><div class="fovr"><input type="range" id="fovR" min="50" max="120" step="1"><b id="fovV">70°</b></div></div>
        <div class="grow"><span>Show FPS<small>Frame rate counter</small></span>${seg('data-x="fps"',[[0,'Off'],[1,'On']])}</div>
        <div class="grow"><span>Auto-lower when slow<small>Steps the preset down if the game lags</small></span>${seg('data-x="auto"',[[0,'Off'],[1,'On']])}</div></div>
    </div>
    <div class="row"><button id="gDone" class="btn green">Done</button></div></div>`;
  root.appendChild(el);
  // keep touches inside the panel from reaching game-level touch/pointer handlers
  ['touchstart','touchmove','touchend'].forEach(t=>el.addEventListener(t,e=>e.stopPropagation(),{passive:true}));
  const fpsEl=document.createElement('div');fpsEl.id='fpsc';fpsEl.textContent='-- FPS';root.appendChild(fpsEl);
  const showTab=t=>{tab=t;el.querySelector('#pCtl').hidden=t!=='ctl';el.querySelector('#pGfx').hidden=t!=='gfx';
    el.querySelectorAll('.gtabs button').forEach(b=>b.classList.toggle('on',b.dataset.tab===t));
    const m=mob();el.querySelector('#ctlM').hidden=!m;el.querySelector('#ctlK').hidden=!!m};
  const sync=()=>{const p=presetOf(st.q);st.preset=p;showTab(tab);const m=mob(),mc=m&&m.get();
    el.querySelectorAll('#gPre button').forEach(b=>b.classList.toggle('on',b.dataset.p===p));
    el.querySelectorAll('.seg').forEach(g=>{const k=g.dataset.k,x=g.dataset.x,c=g.dataset.c;if(!k&&!x&&!c)return;
      const cur=k?st.q[k]:c?(mc?mc[c]:0):x==='fps'?+st.fps:x==='blur'?st.blur:+st.auto;g.querySelectorAll('button').forEach(b=>b.classList.toggle('on',Math.abs(+b.dataset.v-cur)<1e-6))});
    el.querySelector('#fovR').value=st.fov;el.querySelector('#fovV').textContent=st.fov+'°'};
  el.addEventListener('input',e=>{if(e.target.id!=='fovR')return;st.fov=+e.target.value;el.querySelector('#fovV').textContent=st.fov+'°';save()});   // read live every frame by main.js
  el.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;
    if(b.id==='gDone'){api.close();return}
    if(b.dataset.tab){showTab(b.dataset.tab);return}
    if(b.dataset.act){const m=mob();if(!m)return;
      if(b.dataset.act==='reset'){m.reset();return}
      const cb=onClose;onClose=null;el.hidden=true;m.edit(()=>api.open(cb,'ctl'));return}   // hide the panel, show the draggable buttons, come back afterwards
    if(b.dataset.p&&b.dataset.p!=='custom'){st.q={...PRESETS[b.dataset.p]}}
    else if(b.parentNode.dataset.c){const m=mob();m&&m.set(b.parentNode.dataset.c,+b.dataset.v);sync();return}
    else if(b.parentNode.dataset.k)st.q[b.parentNode.dataset.k]=+b.dataset.v;
    else if(b.parentNode.dataset.x==='fps')st.fps=!!+b.dataset.v;
    else if(b.parentNode.dataset.x==='auto')st.auto=!!+b.dataset.v;
    else if(b.parentNode.dataset.x==='blur')st.blur=+b.dataset.v;
    sync();save();apply()});
  addEventListener('keydown',e=>{if(!el.hidden&&(e.code==='Escape'||e.code==='KeyG')){e.stopImmediatePropagation();api.close()}},true);
  // ---- fps meter + auto-lower
  let acc=0,frames=0,slow=0,settle=4,onClose=null;
  const api={
    pr,get:()=>st,apply,
    open(cb,t){onClose=cb||null;if(t)tab=t;try{sync()}catch(err){console.warn('settings sync failed',err)}el.hidden=false},close(){el.hidden=true;const f=onClose;onClose=null;f&&f()},isOpen:()=>!el.hidden,
    /** call once per rendered frame with the real frame time (seconds) while the game is running */
    frame(dt,note){acc+=dt;frames++;settle=Math.max(0,settle-dt);
      if(acc>=.5){const f=frames/acc;if(st.fps)fpsEl.textContent=Math.round(f)+' FPS';
        if(st.auto&&settle<=0){slow=f<28?slow+acc:0;if(slow>=3){slow=0;const i=ORDER.indexOf(presetOf(st.q)==='custom'?'high':presetOf(st.q));
          if(i>0){st.q={...PRESETS[ORDER[i-1]]};save();apply();note&&note(NAMES[ORDER[i-1]])}}}else slow=0;
        acc=0;frames=0}}
  };
  sync();apply();return api}
