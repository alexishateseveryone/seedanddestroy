// Graphics settings: presets (Low / Medium / High / Ultra) + per-option control, saved in localStorage, applied live.
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
const same=(a,b)=>ROWS.every(([,k])=>Math.abs(a[k]-b[k])<1e-6);

export function createSettings({atm,map,onResolution,root=document.body}){
  let st={preset:'medium',q:{...PRESETS.medium},fps:false,auto:true};
  try{const j=JSON.parse(localStorage.getItem(KEY)||'null');if(j&&j.q)st={...st,...j,q:{...PRESETS.medium,...j.q}}}catch(e){}
  const save=()=>{try{localStorage.setItem(KEY,JSON.stringify(st))}catch(e){}};
  const presetOf=q=>ORDER.find(n=>same(PRESETS[n],q))||'custom';
  // ---- apply
  const pr=()=>Math.max(.4,Math.min(2,Math.min(devicePixelRatio||1,1.5)*st.q.scale));
  const apply=()=>{const q=st.q;atm.setQuality({bloom:!!q.bloom,grade:!!q.grade,aa:!!q.aa,shadows:q.shadows,clouds:!!q.clouds});
    map.setQuality({grass:q.grass,detail:!!q.detail,wind:!!q.wind,particles:!!q.particles});onResolution&&onResolution();fpsEl.style.display=st.fps?'block':'none';settle=4};
  // ---- ui
  const el=document.createElement('div');el.id='gfx';el.hidden=true;
  el.innerHTML=`<div class="card gfxcard"><h2>Graphics</h2>
    <div class="gpre" id="gPre">${ORDER.map(n=>`<button data-p="${n}">${NAMES[n]}</button>`).join('')}<button data-p="custom" disabled>Custom</button></div>
    <div class="grows">${ROWS.map(([name,k,opts,hint])=>`<div class="grow" title="${hint}"><span>${name}<small>${hint}</small></span><div class="seg" data-k="${k}">${opts.map(([v,t])=>`<button data-v="${v}">${t}</button>`).join('')}</div></div>`).join('')}
      <div class="grow"><span>Show FPS<small>Frame rate counter</small></span><div class="seg" data-x="fps">${[[0,'Off'],[1,'On']].map(([v,t])=>`<button data-v="${v}">${t}</button>`).join('')}</div></div>
      <div class="grow"><span>Auto-lower when slow<small>Steps the preset down if the game lags</small></span><div class="seg" data-x="auto">${[[0,'Off'],[1,'On']].map(([v,t])=>`<button data-v="${v}">${t}</button>`).join('')}</div></div></div>
    <div class="row"><button id="gDone" class="btn green">Done</button></div></div>`;
  root.appendChild(el);
  const fpsEl=document.createElement('div');fpsEl.id='fpsc';fpsEl.textContent='-- FPS';root.appendChild(fpsEl);
  const sync=()=>{const p=presetOf(st.q);st.preset=p;
    el.querySelectorAll('#gPre button').forEach(b=>b.classList.toggle('on',b.dataset.p===p));
    el.querySelectorAll('.seg').forEach(g=>{const k=g.dataset.k,x=g.dataset.x,cur=k?st.q[k]:x==='fps'?+st.fps:+st.auto;g.querySelectorAll('button').forEach(b=>b.classList.toggle('on',Math.abs(+b.dataset.v-cur)<1e-6))})};
  el.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;
    if(b.id==='gDone'){api.close();return}
    if(b.dataset.p&&b.dataset.p!=='custom'){st.q={...PRESETS[b.dataset.p]}}
    else if(b.parentNode.dataset.k)st.q[b.parentNode.dataset.k]=+b.dataset.v;
    else if(b.parentNode.dataset.x==='fps')st.fps=!!+b.dataset.v;
    else if(b.parentNode.dataset.x==='auto')st.auto=!!+b.dataset.v;
    sync();save();apply()});
  addEventListener('keydown',e=>{if(!el.hidden&&(e.code==='Escape'||e.code==='KeyG')){e.stopImmediatePropagation();api.close()}},true);
  // ---- fps meter + auto-lower
  let acc=0,frames=0,slow=0,settle=4,onClose=null;
  const api={
    pr,get:()=>st,apply,
    open(cb){onClose=cb||null;sync();el.hidden=false},close(){el.hidden=true;const f=onClose;onClose=null;f&&f()},isOpen:()=>!el.hidden,
    /** call once per rendered frame with the real frame time (seconds) while the game is running */
    frame(dt,note){acc+=dt;frames++;settle=Math.max(0,settle-dt);
      if(acc>=.5){const f=frames/acc;if(st.fps)fpsEl.textContent=Math.round(f)+' FPS';
        if(st.auto&&settle<=0){slow=f<28?slow+acc:0;if(slow>=3){slow=0;const i=ORDER.indexOf(presetOf(st.q)==='custom'?'high':presetOf(st.q));
          if(i>0){st.q={...PRESETS[ORDER[i-1]]};save();apply();note&&note(NAMES[ORDER[i-1]])}}}else slow=0;
        acc=0;frames=0}}
  };
  sync();apply();return api}
