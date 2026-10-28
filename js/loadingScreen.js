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

// ---- GAME MODE loading screen: plain black, just the mode name (Bungee) and a random one-line quote (Baloo 2), both fading in. No logo, bar, step text or fire.
// loading.show(text, heading) uses it whenever `heading` is one of these keys; the boot screen (index.html) keeps its own look.
const MODES={
  '5V5':{t:'SPIKE',q:['Plant it. Defend it. Don\'t blink.','Five cats. One spike. No second chances.','Silence is the loudest sound before a plant.','Every round is a brand new map. Adapt or fall.','Nine lives won\'t save you here.','Hold the site. Trust your team.','The spike won\'t plant itself.','Eyes up. Somebody is always watching the corner.']},
  'PVP':{t:'PVP',q:['Real cats. Real rivals. No mercy.','Your friends are about to become your enemies.','Out-aim them. Out-roll them. Out-last them.','Bragging rights are on the line.','No bots can predict a friend.']},
  'ADVENTURE':{t:'ADVENTURE',q:['Every world has a story. Go find yours.','Rivers always flow downhill. Follow one.','The map is only as big as your courage.','Somewhere past those mountains, something is waiting.','No two worlds are the same.','Take the long way. It\'s prettier.']},
  'SURVIVAL':{t:'SURVIVAL',q:['Wave after wave. How long can you last?','Dodge, shoot, repeat.','Nobody keeps all nine lives forever.','The next wave is already coming.','Pick your weapon. Trust your luck.','Stay moving. Stay alive.']}
};
const MODE_MIN=1500;   // ms the screen stays up at least, so the text can fade in and be read
const MODE_CSS=`
#loadmode{position:fixed;inset:0;z-index:5002;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:clamp(10px,2.4vh,22px);background:#000;text-align:center;padding:0 6vw;box-sizing:border-box;transition:opacity .45s ease,visibility .45s}
#loadmode.out{opacity:0;visibility:hidden;pointer-events:none}
#loadmode .mt{font:400 clamp(44px,11vw,120px)/1 'Bungee','Baloo 2',Impact,sans-serif;color:#f1e8d2;letter-spacing:.06em;opacity:0}
#loadmode .mq{font:700 clamp(15px,2.4vw,24px)/1.3 'Baloo 2',system-ui,sans-serif;color:#b9ada0;max-width:34em;opacity:0}
#loadmode.go .mt{animation:lmIn .8s ease-out .05s forwards}
#loadmode.go .mq{animation:lmIn .9s ease-out .5s forwards}
@keyframes lmIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
#loadmode.fail .mq{color:#ff8a7a}`;

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
  let mEl=null,mT,mQ,mOn=false,mAt=0;
  const modeEnsure=()=>{if(mEl)return;const st=document.createElement('style');st.id='loadmode-css';st.textContent=MODE_CSS;document.head.appendChild(st);
    mEl=document.createElement('div');mEl.id='loadmode';mEl.className='out';mEl.innerHTML='<div class="mt"></div><div class="mq"></div>';document.body.appendChild(mEl);mT=mEl.querySelector('.mt');mQ=mEl.querySelector('.mq')};
  const modeShow=M=>{modeEnsure();mT.textContent=M.t;mQ.textContent=M.q[Math.random()*M.q.length|0];
    mEl.classList.remove('out','go','fail');void mEl.offsetWidth;mEl.classList.add('go');mAt=performance.now();mOn=true;document.body.classList.add('loading')};
  const api={
    /** the boot screen (index.html) is already visible: adopt it without resetting */
    adopt(){grab();target=shown=0;finished=failed=false;startTips();if(!paintId)paint()},
    show(text='Loading…',heading=''){
      if(MODES[heading]){modeShow(MODES[heading]);return}
      if(mOn){mEl.classList.add('out');mOn=false}
      grab();cancelAnimationFrame(paintId);paintId=0;target=shown=0;finished=failed=false;
      root.classList.remove('fail');void root.offsetWidth;root.classList.remove('out');document.body.classList.add('loading');
      if(title)title.textContent=heading;step.textContent=text;fill.style.width='0%';pct.textContent='0%';startTips();paint()},
    set(p,text){if(mOn)return;if(!root)grab();target=Math.max(target,Math.min(1,p));if(text)step.textContent=text},
    done(){if(mOn)return new Promise(res=>setTimeout(()=>{mEl.classList.add('out');mOn=false;document.body.classList.remove('loading');setTimeout(res,460)},Math.max(0,MODE_MIN-(performance.now()-mAt))));
      if(!root)grab();failed=false;root.classList.remove('fail');step.textContent='Ready!';target=1;finished=true;if(!paintId)paint();return new Promise(res=>{onGone=res})},
    fail(msg){if(mOn){mQ.textContent=msg;mEl.classList.add('fail');return}if(!root)grab();failed=true;root.classList.add('fail');step.textContent=msg},
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
