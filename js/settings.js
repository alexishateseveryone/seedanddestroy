// Settings: two tabs.
//   Controls : touch button size / look speed / "move buttons" layout editor (phones), or the keyboard + mouse reference (PC)
//   Graphics : presets (Low / Medium / High / Ultra) + per-option control, saved in localStorage, applied live.
// Also an optional FPS counter and an "auto lower quality when slow" safety net.
import {ACTIONS} from './keybinds.js';
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
const FIXED=[['Mouse','Look'],['LMB','Shoot / slash'],['RMB','Scope'],['1-8 / Wheel','Weapons'],['Esc','Pause / close']];
const ICO={
  pad:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8h12a4 4 0 0 1 4 4.5l-.7 4a2.3 2.3 0 0 1-4 1.2L15.5 16h-7l-1.8 1.7a2.3 2.3 0 0 1-4-1.2l-.7-4A4 4 0 0 1 6 8z"/><path d="M7.5 10.5v3M6 12h3"/><circle cx="16" cy="11.2" r=".8" fill="currentColor"/><circle cx="18" cy="13" r=".8" fill="currentColor"/></svg>',
  gfx:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="4" width="19" height="13" rx="2.5"/><path d="M8 21h8M12 17v4"/></svg>',
  aud:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9.5v5h4l5 4v-13l-5 4z"/><path d="M16.5 9a4 4 0 0 1 0 6M19 6.5a8 8 0 0 1 0 11"/></svg>',
  move:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v18M3 12h18M12 3l-3 3M12 3l3 3M12 21l-3-3M12 21l3-3M3 12l3-3M3 12l3 3M21 12l-3-3M21 12l-3 3"/></svg>',
  reset:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12a8 8 0 1 0 2.6-5.9"/><path d="M3.5 3.5v5h5"/></svg>'};
const same=(a,b)=>ROWS.every(([,k])=>Math.abs(a[k]-b[k])<1e-6);

export function createSettings({atm,map,audio,kb,onResolution,getMobile=()=>null,root=document.body}){
  let st={preset:'medium',q:{...PRESETS.medium},fps:false,auto:true,blur:1,fov:70,cap:0},tab='gfx';   // blur 0..3 (Off/Low/Medium/High) and fov are personal options: presets never change them
  try{const j=JSON.parse(localStorage.getItem(KEY)||'null');if(j&&j.q)st={...st,...j,q:{...PRESETS.medium,...j.q}}}catch(e){}
  const save=()=>{try{localStorage.setItem(KEY,JSON.stringify({preset:st.preset,q:st.q,fps:st.fps,auto:st.auto,blur:st.blur,fov:st.fov,cap:st.cap}))}catch(e){}};
  const presetOf=q=>ORDER.find(n=>same(PRESETS[n],q))||'custom';
  // only treat the touch controls as usable when they really expose the settings API (get/set/edit/reset)
  const mob=()=>{try{const m=getMobile();return m&&m.active&&typeof m.get==='function'&&typeof m.set==='function'&&typeof m.edit==='function'&&typeof m.reset==='function'?m:null}catch(e){return null}};
  // ---- apply
  const pr=()=>Math.max(.4,Math.min(2,Math.min(devicePixelRatio||1,1.5)*st.q.scale));
  const apply=()=>{const q=st.q;atm.setQuality({bloom:!!q.bloom,grade:!!q.grade,aa:!!q.aa,shadows:q.shadows,clouds:!!q.clouds,blur:st.blur});
    map.setQuality({grass:q.grass,detail:!!q.detail,wind:!!q.wind,particles:!!q.particles});onResolution&&onResolution();fpsShow();settle=4};
  // ---- ui
  const css=document.createElement('style');css.textContent=`
  /* fixed-size card: the tab content scrolls inside it, so switching tabs never resizes the card */
  #gfx .gfxcard{width:min(820px,94vw);height:min(640px,92vh);height:min(640px,92dvh);max-height:none;box-sizing:border-box;display:flex;flex-direction:column;overflow:hidden}
  #gfx .gfxcard h2{flex:none}
  #gfx .gfxcard>.row{position:static;flex:none;padding:12px 0 0;background:none}
  #gfx .gbody{display:flex;gap:18px;align-items:stretch;margin:0;flex:1;min-height:0}
  #gfx .gtabs{display:flex;flex-direction:column;gap:8px;padding:8px;border-radius:24px;background:#e9dff7;flex:none;width:158px;align-self:flex-start}
  #gfx .gtabs button{display:flex;align-items:center;gap:10px;padding:11px 14px;border-radius:16px;border:0;background:transparent;color:var(--ink,#2b2150);font:800 17px 'Baloo 2',sans-serif;cursor:pointer;opacity:.7;text-align:left;transition:background .12s,opacity .12s,transform .08s}
  #gfx .gtabs button:hover{opacity:1;background:#ffffff80}
  #gfx .gtabs button.on{background:var(--lemon,#ffd54a);box-shadow:0 4px 0 var(--lemon-d,#c98a14);opacity:1}
  #gfx .gtabs button:active{transform:translateY(2px)}
  #gfx .gmain{flex:1;min-width:0;min-height:0;overflow-y:auto;overflow-x:hidden;padding:0 6px 6px 0;scrollbar-width:thin}
  #gfx .gmain>div>.grows:last-child{margin-bottom:0}
  @media (max-height:520px){#gfx .gfxcard{padding:12px 20px 14px}#gfx .gfxcard h2{font-size:30px;margin-bottom:6px}}
  #gfx .grows{grid-template-columns:1fr}
  #gfx .grows.k2{grid-template-columns:1fr 1fr}
  @media (max-width:700px){#gfx .gbody{flex-direction:column;gap:12px}#gfx .gtabs{flex-direction:row;width:auto;align-self:stretch}#gfx .gtabs button{flex:1;justify-content:center;padding:8px 6px;font-size:15px}#gfx .grows.k2{grid-template-columns:1fr}}
  /* small chunky 3D buttons (same look as the title menu) */
  #gfx .btn.sm,#gReset .btn.sm{min-width:0;min-height:44px;padding:0 20px;font-size:18px;border-radius:16px;gap:8px;white-space:nowrap;box-shadow:0 5px 0 var(--c2),0 10px 16px #0003}
  #gfx .btn.sm:active,#gReset .btn.sm:active{transform:translateY(4px);box-shadow:0 1px 0 var(--c2)}
  #gfx .btn.sm svg,#gReset .btn.sm svg{width:20px;height:20px;flex:none}
  #gReset{position:fixed;left:50%;top:14px;transform:translateX(-50%);z-index:3200}
  /* key remap rows */
  #gfx .kbtn{border:0;border-radius:12px;min-width:84px;padding:6px 14px;background:#fff6e6;color:var(--ink,#2b2150);font:800 15px 'Baloo 2',sans-serif;cursor:pointer;box-shadow:0 4px 0 #dcc9a6;transition:transform .08s,box-shadow .08s,background .12s}
  #gfx .kbtn:hover{background:#fff}
  #gfx .kbtn:active{transform:translateY(3px);box-shadow:0 1px 0 #dcc9a6}
  #gfx .kbtn.wait{background:var(--lemon,#ffd54a);box-shadow:0 4px 0 var(--lemon-d,#c98a14);animation:kwait 1s ease-in-out infinite}
  @keyframes kwait{50%{filter:brightness(1.12)}}
  #gfx .kfix{margin:2px 0 14px}#gfx .krst{display:flex;justify-content:center}
  #gfx .khint{font:700 12px 'Baloo 2',sans-serif;opacity:.55;margin:0 0 8px}
  #gfx .gtabs svg,#gfx .seg svg{width:20px;height:20px;flex:none}
  #gfx .seg button.ic{display:inline-flex;align-items:center;gap:6px;white-space:nowrap;margin:0;flex:none}
  #gfx .seg.lay{display:flex;flex-wrap:wrap;gap:8px;padding:0;background:none;border:0;box-shadow:none}
  #gfx .seg.lay button.ic{border-radius:12px;border:3px solid #00000022;background:#0000000d;padding:6px 12px}
  #gfx .gkeys{display:grid;grid-template-columns:1fr 1fr;gap:8px 14px;text-align:left;font:700 14px 'Baloo 2',sans-serif}
  #gfx .gkeys div{display:flex;align-items:center;gap:8px;justify-content:space-between;background:#0000000a;border-radius:10px;padding:4px 10px}
  #gfx .gkeys kbd{white-space:nowrap}
  #gfx .fovr{display:flex;align-items:center;gap:10px;min-width:210px}
  /* yellow 3D sliders: pill track filled with lemon up to the thumb (--p, set from JS), chunky round thumb with a hard bottom edge */
  #gfx input[type=range]{-webkit-appearance:none;appearance:none;flex:1;min-width:120px;height:28px;margin:0;background:transparent;cursor:pointer;--p:50%}
  #gfx input[type=range]:focus{outline:none}
  #gfx input[type=range]::-webkit-slider-runnable-track{height:16px;border-radius:99px;background:linear-gradient(90deg,var(--lemon,#ffd54a) var(--p),#e9dff7 var(--p));box-shadow:inset 0 -4px 0 #0000001a,0 3px 0 #cbbfe4}
  #gfx input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;box-sizing:border-box;width:30px;height:30px;margin-top:-7px;border-radius:50%;background:var(--lemon,#ffd54a);border:4px solid #fff;box-shadow:0 4px 0 var(--lemon-d,#c98a14),0 7px 10px #0003;transition:transform .08s,box-shadow .08s}
  #gfx input[type=range]:hover::-webkit-slider-thumb{filter:brightness(1.06)}
  #gfx input[type=range]:active::-webkit-slider-thumb{transform:translateY(3px);box-shadow:0 1px 0 var(--lemon-d,#c98a14)}
  #gfx input[type=range]::-moz-range-track{height:16px;border-radius:99px;background:#e9dff7;box-shadow:inset 0 -4px 0 #0000001a,0 3px 0 #cbbfe4}
  #gfx input[type=range]::-moz-range-progress{height:16px;border-radius:99px;background:var(--lemon,#ffd54a);box-shadow:inset 0 -4px 0 #0000001a}
  #gfx input[type=range]::-moz-range-thumb{box-sizing:border-box;width:30px;height:30px;border-radius:50%;background:var(--lemon,#ffd54a);border:4px solid #fff;box-shadow:0 4px 0 var(--lemon-d,#c98a14),0 7px 10px #0003}
  #gfx .fovr b{min-width:42px;text-align:right;font:800 15px 'Baloo 2',sans-serif}
  #gfx [hidden]{display:none!important}
  /* phones: the panel must sit above the touch buttons (z-index 960) and the pause overlay, and scroll */
  body.mobile #gfx{position:fixed;inset:0;z-index:3000;overflow-y:auto;-webkit-overflow-scrolling:touch;touch-action:pan-y;pointer-events:auto;overscroll-behavior:contain}
  body.mobile #gfx .gfxcard{max-height:92vh;max-height:92dvh;overflow:hidden}
  body.mobile #gfx .gmain{touch-action:pan-y;-webkit-overflow-scrolling:touch;overscroll-behavior:contain}
  body.mobile #gfx .grow{flex-wrap:wrap;gap:6px}
  body.mobile #gfx .gkeys{grid-template-columns:1fr}`;
  document.head.appendChild(css);
  const el=document.createElement('div');el.id='gfx';el.hidden=true;
  const seg=(attr,opts)=>`<div class="seg" ${attr}>${opts.map(([v,t])=>`<button data-v="${v}">${t}</button>`).join('')}</div>`;
  el.innerHTML=`<div class="card gfxcard"><h2>Settings</h2>
    <div class="gbody"><div class="gtabs"><button data-tab="ctl">${ICO.pad}<span>Controls</span></button><button data-tab="gfx">${ICO.gfx}<span>Graphics</span></button><button data-tab="aud">${ICO.aud}<span>Audio</span></button></div><div class="gmain">
    <div id="pCtl" hidden>
      <div class="grows" id="ctlM">
        <div class="grow"><span>Button size<small>Bigger buttons are easier to hit</small></span>${seg('data-c="scale"',[[.8,'S'],[1,'M'],[1.2,'L'],[1.4,'XL']])}</div>
        <div class="grow"><span>Look speed<small>How fast dragging turns the camera</small></span>${seg('data-c="sens"',[[.6,'Slow'],[1,'Normal'],[1.5,'Fast'],[2,'Max']])}</div>
        <div class="grow"><span>Button layout<small>Drag every button where your thumbs like it (Reset is on the edit screen)</small></span>
          <button class="btn green sm" data-act="edit">${ICO.move}Edit layout</button></div>
      </div>
      <div id="ctlK"></div>
    </div>
    <div id="pGfx">
      <div class="gpre" id="gPre">${ORDER.map(n=>`<button data-p="${n}">${NAMES[n]}</button>`).join('')}<button data-p="custom" disabled>Custom</button></div>
      <div class="grows">${ROWS.map(([name,k,opts,hint])=>`<div class="grow" title="${hint}"><span>${name}<small>${hint}</small></span>${seg(`data-k="${k}"`,opts)}</div>`).join('')}
        <div class="grow"><span>Motion blur<small>Smears the picture when you turn the camera</small></span>${seg('data-x="blur"',[[0,'Off'],[1,'Low'],[2,'Medium'],[3,'High']])}</div>
        <div class="grow"><span>Field of view<small>Wider sees more around you (default 70)</small></span><div class="fovr"><input type="range" id="fovR" min="50" max="120" step="1"><b id="fovV">70°</b></div></div>
        <div class="grow"><span>FPS limit<small>Caps the frame rate. Lower = cooler and saves battery</small></span>${seg('data-x="cap"',[[30,'30'],[60,'60'],[120,'120'],[0,'Unlimited']])}</div>
        <div class="grow"><span>Show FPS<small>Frame rate counter (in game only)</small></span>${seg('data-x="fps"',[[0,'Off'],[1,'On']])}</div>
        <div class="grow"><span>Auto-lower when slow<small>Steps the preset down if the game lags</small></span>${seg('data-x="auto"',[[0,'Off'],[1,'On']])}</div></div>
    </div>
    <div id="pAud" hidden><div class="grows">${[['master','Master volume','Everything at once'],['sfx','Sound effects','Shots, hits, buttons'],['music','Music','Background music']].map(([k,n,h])=>`<div class="grow"><span>${n}<small>${h}</small></span><div class="fovr"><input type="range" data-a="${k}" min="0" max="100" step="5"><b></b></div></div>`).join('')}</div></div>
    </div></div>
    <div class="row"><button id="gDone" class="btn green">Done</button></div></div>`;
  root.appendChild(el);
  // keep touches inside the panel from reaching game-level touch/pointer handlers
  ['touchstart','touchmove','touchend'].forEach(t=>el.addEventListener(t,e=>e.stopPropagation(),{passive:true}));
  const fpsEl=document.createElement('div');fpsEl.id='fpsc';fpsEl.textContent='-- FPS';root.appendChild(fpsEl);
  let inGame=false;const fpsShow=()=>{fpsEl.style.display=st.fps&&inGame?'block':'none'};   // the counter only shows while actually playing
  let listening=null;
  const paint=i=>i.style.setProperty('--p',((i.value-i.min)/(i.max-i.min)*100)+'%');
  const renderKeys=()=>{const box=el.querySelector('#ctlK');if(!box||!kb)return;
    box.innerHTML=`<p class="khint">Click a key, then press the new one (Esc cancels). If it is already used, the two swap.</p>
      <div class="grows k2">${ACTIONS.map(a=>`<div class="grow"><span>${a.name}</span><button class="kbtn${listening===a.id?' wait':''}" data-bind="${a.id}">${listening===a.id?'Press a key…':kb.label(a.id)}</button></div>`).join('')}</div>
      <div class="gkeys kfix">${FIXED.map(([k,t])=>`<div><span>${t}</span><kbd>${k}</kbd></div>`).join('')}</div>
      <div class="krst"><button class="btn red sm" data-act="kreset">${ICO.reset}Reset controls</button></div>`};
  const showTab=t=>{tab=t;el.querySelector('#pCtl').hidden=t!=='ctl';el.querySelector('#pGfx').hidden=t!=='gfx';el.querySelector('#pAud').hidden=t!=='aud';
    el.querySelectorAll('.gtabs button').forEach(b=>b.classList.toggle('on',b.dataset.tab===t));
    const m=mob();el.querySelector('#ctlM').hidden=!m;el.querySelector('#ctlK').hidden=!!m;if(!m)renderKeys()};
  const sync=()=>{const p=presetOf(st.q);st.preset=p;showTab(tab);const m=mob(),mc=m&&m.get();
    el.querySelectorAll('#gPre button').forEach(b=>b.classList.toggle('on',b.dataset.p===p));
    el.querySelectorAll('.seg').forEach(g=>{const k=g.dataset.k,x=g.dataset.x,c=g.dataset.c;if(!k&&!x&&!c)return;
      const cur=k?st.q[k]:c?(mc?mc[c]:0):x==='fps'?+st.fps:x==='blur'?st.blur:x==='cap'?st.cap:+st.auto;g.querySelectorAll('button').forEach(b=>b.classList.toggle('on',Math.abs(+b.dataset.v-cur)<1e-6))});
    el.querySelectorAll('[data-a]').forEach(i=>{const v=Math.round((audio?audio.get()[i.dataset.a]:0)*100);i.value=v;i.nextElementSibling.textContent=v+'%';paint(i)});
    el.querySelector('#fovR').value=st.fov;paint(el.querySelector('#fovR'));el.querySelector('#fovV').textContent=st.fov+'°'};
  el.addEventListener('input',e=>{if(e.target.type==='range')paint(e.target);const a=e.target.dataset&&e.target.dataset.a;if(a&&audio){audio.set(a,+e.target.value/100);e.target.nextElementSibling.textContent=e.target.value+'%';return}
    if(e.target.id!=='fovR')return;st.fov=+e.target.value;el.querySelector('#fovV').textContent=st.fov+'°';save()});   // read live every frame by main.js
  el.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;
    if(b.id==='gDone'){api.close();return}
    if(b.dataset.bind){listening=listening===b.dataset.bind?null:b.dataset.bind;renderKeys();return}
    if(b.dataset.tab){listening=null;showTab(b.dataset.tab);return}
    if(b.dataset.act==='kreset'){kb&&kb.reset();listening=null;renderKeys();return}
    if(b.dataset.act){const m=mob();if(!m)return;
      // hide the panel, show the draggable buttons (plus a "Reset layout" button on that screen), come back afterwards
      const cb=onClose;onClose=null;el.hidden=true;
      const bar=document.createElement('div');bar.id='gReset';bar.innerHTML=`<button class="btn red sm">${ICO.reset}Reset layout</button>`;
      ['pointerdown','mousedown','touchstart'].forEach(t=>bar.addEventListener(t,ev=>ev.stopPropagation()));
      bar.querySelector('button').addEventListener('click',()=>m.reset());document.body.appendChild(bar);
      m.edit(()=>{bar.remove();api.open(cb,'ctl')});return}
    if(b.dataset.p&&b.dataset.p!=='custom'){st.q={...PRESETS[b.dataset.p]}}
    else if(b.parentNode.dataset.c){const m=mob();m&&m.set(b.parentNode.dataset.c,+b.dataset.v);sync();return}
    else if(b.parentNode.dataset.k)st.q[b.parentNode.dataset.k]=+b.dataset.v;
    else if(b.parentNode.dataset.x==='fps')st.fps=!!+b.dataset.v;
    else if(b.parentNode.dataset.x==='auto')st.auto=!!+b.dataset.v;
    else if(b.parentNode.dataset.x==='blur')st.blur=+b.dataset.v;
    else if(b.parentNode.dataset.x==='cap')st.cap=+b.dataset.v;
    sync();save();apply()});
  el.addEventListener('change',e=>{if(audio&&e.target.dataset&&e.target.dataset.a==='sfx')audio.play('hit')});   // let go of the sfx slider = hear the new level
  addEventListener('keydown',e=>{
    if(listening){e.preventDefault();e.stopImmediatePropagation();   // waiting for the new key of a binding
      if(e.code==='Escape'){listening=null;renderKeys();return}
      if(e.code==='MetaLeft'||e.code==='MetaRight'||e.code==='ContextMenu'||/^Digit[1-8]$/.test(e.code))return;   // reserved (weapon slots / OS keys)
      const id=listening;listening=null;kb.set(id,e.code);renderKeys();return}
    if(!el.hidden&&(e.code==='Escape'||(kb?kb.canon(e.code):e.code)==='KeyG')){e.stopImmediatePropagation();api.close()}},true);
  // ---- fps meter + auto-lower
  let acc=0,frames=0,slow=0,settle=4,onClose=null;
  const api={
    pr,get:()=>st,apply,
    /** ms between frames for the FPS limit (0 = unlimited) */
    fpsInterval:()=>st.cap?1000/st.cap:0,
    /** main.js tells us whether the player is in a match; the FPS counter is hidden everywhere else */
    ingame(v){v=!!v;if(v!==inGame){inGame=v;fpsShow()}},
    open(cb,t){onClose=cb||null;if(t)tab=t;try{sync()}catch(err){console.warn('settings sync failed',err)}el.hidden=false},close(){listening=null;el.hidden=true;const f=onClose;onClose=null;f&&f()},isOpen:()=>!el.hidden,
    /** call once per rendered frame with the real frame time (seconds) while the game is running */
    frame(dt,note){acc+=dt;frames++;settle=Math.max(0,settle-dt);
      if(acc>=.5){const f=frames/acc;if(st.fps)fpsEl.textContent=Math.round(f)+' FPS';
        if(st.auto&&settle<=0){slow=f<(st.cap?Math.min(28,st.cap*.85):28)?slow+acc:0;if(slow>=3){slow=0;const i=ORDER.indexOf(presetOf(st.q)==='custom'?'high':presetOf(st.q));
          if(i>0){st.q={...PRESETS[ORDER[i-1]]};save();apply();note&&note(NAMES[ORDER[i-1]])}}}else slow=0;
        acc=0;frames=0}}
  };
  sync();apply();return api}