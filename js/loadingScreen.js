// REUSABLE LOADING SCREEN. Used by the game boot (index.html markup + window.__load) and by anything slow, e.g. world generation.
//   import {loading} from './js/loadingScreen.js';
//   loading.show('Generating world…');            // fades in, bar reset to 0
//   loading.set(.4,'Carving rivers…');            // 0..1 + step text (the bar never goes backwards until the next show())
//   await loading.done();                         // fills the bar, says Ready!, fades out (resolves when it is gone)
//   loading.fail('Something broke');              // red bar + message
//   loading.tips([...]);                          // replace the rotating tips
// It reuses the #loading element from index.html when it exists, otherwise it builds its own (same look), so it also works on a page without the boot markup.
const DEFAULT_TIPS=['Roll (Space) to dodge bullets - you are invulnerable while tumbling.','Right click scopes with guns. The Sniper pierces through enemies.','Mouse wheel or 1-8 swaps weapons.','5v5: hold F on a site to plant the spike.','Your rank decides how good the AI cats are. Climb to face tougher ones.','Customize your cat - hood, cloak, collar, ears and coat patterns.'];
const CSS=`
#loading{position:fixed;inset:0;z-index:5000;display:flex;align-items:center;justify-content:center;background:radial-gradient(ellipse 80% 80% at 50% 40%,#3b3e45 0,#202226 55%,#121316 100%);transition:opacity .6s ease,visibility .6s;color:#e9eaee;font-family:'Baloo 2',system-ui,sans-serif}
#loading.out{opacity:0;visibility:hidden;pointer-events:none}
#loading .lc{width:min(440px,86vw);text-align:center}
#loading .llogo{display:block;width:min(440px,86vw);max-height:46vh;object-fit:contain;margin:0 auto;filter:drop-shadow(0 12px 22px rgba(0,0,0,.55));image-rendering:pixelated;-webkit-user-drag:none}
#loading .lname{font:400 40px/1 'Bungee','Baloo 2',Impact,sans-serif;color:#ffd54a;-webkit-text-stroke:8px #3a2308;paint-order:stroke fill;text-shadow:0 6px 0 #3a2308;margin:0 0 6px}
#loading .lbar{height:8px;border-radius:9px;background:rgba(255,255,255,.12);overflow:hidden;margin:26px 0 10px}
#loading .lbar i{display:block;height:100%;width:0;border-radius:9px;background:linear-gradient(90deg,#f0c36a,#ffe19a);box-shadow:0 0 14px rgba(240,195,106,.6)}
#loading .lrow{display:flex;justify-content:space-between;font:500 13px 'DM Mono',monospace;letter-spacing:.08em;color:#aeb2bb}
#loading .ltip{margin-top:22px;font:700 14px 'Baloo 2',sans-serif;color:#8d919b;min-height:20px}
#loading.fail .lbar i{background:#e8453c;box-shadow:0 0 14px rgba(232,69,60,.6)}#loading.fail #lstep{color:#ff8a7a}
body.loading #title,body.loading #hud{visibility:hidden}`;

function ensure(){
  let root=document.getElementById('loading');
  if(!root){
    if(!document.getElementById('loading-css')){const st=document.createElement('style');st.id='loading-css';st.textContent=CSS;document.head.appendChild(st)}
    root=document.createElement('div');root.id='loading';root.className='out';
    root.innerHTML=`<div class="lc"><div class="lname" id="ltitle"></div><div class="lbar"><i id="lfill"></i></div><div class="lrow"><span id="lstep">Loading…</span><span id="lpct">0%</span></div><div class="ltip" id="ltip"></div></div>`;
    document.body.appendChild(root)}
  return root}

function createLoadingScreen(){
  let root=null,fill,pct,step,tip,title,tipsList=DEFAULT_TIPS,tipTimer=0,paintId=0,target=0,shown=0,finished=false,failed=false,onGone=null,ti=0;
  const grab=()=>{root=ensure();fill=root.querySelector('#lfill');pct=root.querySelector('#lpct');step=root.querySelector('#lstep');tip=root.querySelector('#ltip');title=root.querySelector('#ltitle')};
  const paint=()=>{
    if(failed)return;
    shown+=(target-shown)*.14;if(target-shown<.002)shown=target;
    fill.style.width=(shown*100).toFixed(1)+'%';pct.textContent=Math.round(shown*100)+'%';
    if(finished&&shown>=.999){root.classList.add('out');document.body.classList.remove('loading');clearInterval(tipTimer);paintId=0;
      const cb=onGone;onGone=null;setTimeout(()=>cb&&cb(),620);return}
    paintId=requestAnimationFrame(paint)};
  const startTips=()=>{clearInterval(tipTimer);if(tip){tip.textContent=tipsList[ti%tipsList.length]}tipTimer=setInterval(()=>{if(tip)tip.textContent=tipsList[++ti%tipsList.length]},2600)};
  const api={
    /** the boot screen (index.html) is already visible: adopt it without resetting */
    adopt(){grab();target=shown=0;finished=failed=false;startTips();if(!paintId)paint()},
    show(text='Loading…',heading=''){
      grab();cancelAnimationFrame(paintId);paintId=0;target=shown=0;finished=failed=false;
      root.classList.remove('fail');void root.offsetWidth;root.classList.remove('out');document.body.classList.add('loading');
      if(title)title.textContent=heading;step.textContent=text;fill.style.width='0%';pct.textContent='0%';startTips();paint()},
    set(p,text){if(!root)grab();target=Math.max(target,Math.min(1,p));if(text)step.textContent=text},
    done(){if(!root)grab();failed=false;root.classList.remove('fail');step.textContent='Ready!';target=1;finished=true;if(!paintId)paint();return new Promise(res=>{onGone=res})},
    fail(msg){if(!root)grab();failed=true;root.classList.add('fail');step.textContent=msg},
    tips(list){tipsList=list&&list.length?list:DEFAULT_TIPS;ti=0}};
  return api}

export const loading=createLoadingScreen();
// the boot code in main.js talks to window.__load (set/done) - keep that name working, backed by the same screen
window.__load={set:(p,t)=>loading.set(p,t),done:()=>loading.done()};

// ---- boot: index.html ships the screen already visible (body.loading). Adopt it, and turn any start-up error into a readable message instead of a frozen bar.
let booting=document.body.classList.contains('loading')&&!!document.getElementById('loading');
if(booting){
  loading.adopt();
  const bootDone=loading.done.bind(loading);loading.done=()=>{booting=false;return bootDone()};
  const fail=m=>{if(!booting)return;loading.fail(m);const t=document.getElementById('ltip');if(t)t.textContent='Open the browser console (F12) to see exactly which file failed, then reload.'};
  addEventListener('error',e=>{const t=e.target;fail(t&&t.src?'Could not load '+t.src.split('/').pop():'Error: '+(e.message||'script failed'))},true);
  addEventListener('unhandledrejection',e=>fail('Error: '+((e.reason&&e.reason.message)||e.reason)));
  setTimeout(()=>{if(booting){const t=document.getElementById('ltip');if(t)t.textContent='Still loading... if this never finishes, check the console (F12) for a missing file.'}},20000);
}
