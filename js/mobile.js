// Touch controls. Only active on phones/tablets; on PC createMobile() returns a no-op, so nothing changes there.
// Add ?mobile=1 to the URL to force touch controls on (handy for testing on PC), ?mobile=0 to force them off.
//   left side  : floating joystick (drives the same W/A/S/D keys as the keyboard)
//   right side : drag anywhere to look around (same as the mouse)
//   buttons    : FIRE (hold to shoot / slash, drag while holding to aim), ROLL, SCOPE, F (plant / defuse, 5v5 only),
//                < > switch weapon, II pause
// Settings > Controls API (used by settings.js): get() / set(key,value) / reset() / edit(onDone)
const MOBILE_RE=/Android|iPhone|iPad|iPod|Mobile|Silk|Opera Mini/i;
export function isMobile(){
  const q=new URLSearchParams(location.search).get('mobile');if(q==='1')return true;if(q==='0')return false;
  const ua=MOBILE_RE.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);   // 2nd check = iPadOS pretending to be a Mac
  const touchOnly=matchMedia('(pointer:coarse)').matches&&matchMedia('(hover:none)').matches;
  return ua||touchOnly}

export function createMobile(o){
  if(!isMobile())return{active:false,update(){}};
  const {P,keys,mouse}=o,SX=.0055,SY=.0046,R=56;   // look sensitivity (rad per px) and joystick radius (px)
  // ---- saved touch settings: button size, look speed, and per-button offsets from the layout editor
  const KEY='sad.touch',IDS=['mFire','mRoll','mScope','mPlant','mReload','mPause','mWpn'];
  const cfg={scale:1,sens:1,pos:{}};
  try{const j=JSON.parse(localStorage.getItem(KEY)||'null');if(j){if(+j.scale)cfg.scale=+j.scale;if(+j.sens)cfg.sens=+j.sens;if(j.pos&&typeof j.pos==='object')cfg.pos=j.pos}}catch(e){}
  const save=()=>{try{localStorage.setItem(KEY,JSON.stringify(cfg))}catch(e){}};
  document.body.classList.add('mobile');
  const css=document.createElement('style');css.textContent=`
  body.mobile{overscroll-behavior:none;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none;-webkit-tap-highlight-color:transparent}
  body.mobile #c{touch-action:none}
  body.mobile .kb,body.mobile .hud-bl,body.mobile .hud-bc{display:none!important}
  body.mobile .hud-br{bottom:auto!important;right:auto!important;top:96px!important;left:6px!important;transform:scale(.55);transform-origin:top left}
  body.mobile #hud .hud-tr{right:calc(64px + env(safe-area-inset-right))!important}   /* keep the score clear of the pause button */
  #mob{position:fixed;inset:0;z-index:960;pointer-events:none;display:none;touch-action:none;font-family:'Bungee',sans-serif}
  #mob .z{position:absolute;pointer-events:auto;touch-action:none}
  #mzL{left:0;top:22%;bottom:0;width:42%}#mzR{right:0;top:0;bottom:0;width:58%}
  #mBase{position:absolute;width:124px;height:124px;margin:-62px 0 0 -62px;border-radius:50%;border:3px solid rgba(255,255,255,.4);background:rgba(255,255,255,.1);pointer-events:none;opacity:.5}
  #mBase.on{opacity:1}
  #mKnob{position:absolute;left:50%;top:50%;width:54px;height:54px;margin:-27px;border-radius:50%;background:rgba(255,255,255,.55);border:3px solid rgba(255,255,255,.85)}
  #mob .b{position:absolute;pointer-events:auto;touch-action:none;display:flex;align-items:center;justify-content:center;border-radius:50%;background:rgba(43,33,80,.55);border:3px solid rgba(255,255,255,.5);color:#fff;font-size:13px;box-shadow:0 4px 0 rgba(26,18,56,.6);scale:var(--bs,1)}
  #mob .b.dn{transform:scale(.92);background:rgba(255,213,74,.6)}
  #mFire{right:calc(26px + env(safe-area-inset-right));bottom:34px;width:98px;height:98px;background:rgba(232,69,60,.6);font-size:17px}
  #mRoll{right:140px;bottom:26px;width:64px;height:64px}
  #mScope{right:34px;bottom:146px;width:60px;height:60px;font-size:22px}
  #mPlant{right:122px;bottom:104px;width:64px;height:64px;display:none;background:rgba(255,213,74,.65);color:#3a2308;font-size:22px}
  #mReload{right:214px;bottom:30px;width:54px;height:54px;display:none;font-size:18px;background:rgba(31,140,200,.6)}
  #mPause{top:10px;right:calc(10px + env(safe-area-inset-right));width:46px;height:46px;font-size:16px}
  #mWpn{position:absolute;left:50%;bottom:10px;transform:translateX(-50%);display:flex;gap:8px;align-items:center;pointer-events:none}
  #mWpn .b{position:static;width:46px;height:46px;font-size:16px}
  #mWn{min-width:120px;text-align:center;padding:8px 12px;border-radius:999px;background:rgba(43,33,80,.6);border:2px solid rgba(255,255,255,.4);color:#fff;font-size:13px;white-space:nowrap}
  #mEd{position:absolute;top:10px;left:50%;transform:translateX(-50%);display:none;flex-direction:column;align-items:center;gap:6px;pointer-events:auto;background:#d6d6db;color:#2b2150;padding:10px 16px;border-radius:18px;border:3px solid #9a9aa3;box-shadow:0 5px 0 rgba(0,0,0,.25);z-index:5;text-align:center;max-width:60vw}
  #mEd b{font-size:14px;font-weight:400}
  #mEd small{font:600 11px system-ui,sans-serif;color:#4a4a55}
  #mEd .r{display:flex;gap:10px;margin-top:2px}
  #mEd button{font:inherit;font-size:12px;padding:6px 16px;border-radius:999px;border:0;background:#ffd54a;color:#2b2150;cursor:pointer}
  #mEd button.g{background:#aeaeb7}
  #mob.edit #mEd{display:flex}
  #mob.edit .z{pointer-events:none}
  #mob.edit #mBase{display:none}
  #mob.edit .b{outline:2px dashed #ffd54a;outline-offset:3px}
  #mrot{position:fixed;inset:0;z-index:2000;background:#2b2150;color:#fff;font:400 20px 'Bungee',sans-serif;text-align:center;align-items:center;justify-content:center;padding:30px;display:none}
  @media (max-height:430px){
    #mFire{width:82px;height:82px;bottom:20px;font-size:15px}#mRoll{right:116px;bottom:16px;width:54px;height:54px;font-size:12px}
    #mScope{right:26px;bottom:114px;width:50px;height:50px;font-size:19px}#mPlant{right:100px;bottom:82px;width:54px;height:54px}
    #mReload{right:182px;bottom:16px;width:46px;height:46px;font-size:16px}#mPause{width:40px;height:40px;top:6px}#mWpn{bottom:6px}#mWpn .b{width:38px;height:38px}#mWn{min-width:96px;font-size:11px;padding:6px 10px}
    #mBase{width:104px;height:104px;margin:-52px 0 0 -52px}}
  @media (min-width:900px) and (min-height:700px){
    #mFire{width:118px;height:118px}#mRoll{width:76px;height:76px;right:164px}#mReload{right:252px;bottom:30px;width:64px;height:64px}#mScope{width:70px;height:70px;bottom:170px}#mPlant{width:76px;height:76px;right:144px;bottom:120px}}
  @media (orientation:portrait){body.mobile #mrot{display:flex}}`;
  document.head.appendChild(css);
  const root=document.createElement('div');root.id='mob';
  root.innerHTML=`<div class="z" id="mzL"></div><div class="z" id="mzR"></div><div id="mBase"><div id="mKnob"></div></div>
    <div class="b" id="mFire">FIRE</div><div class="b" id="mRoll">ROLL</div><div class="b" id="mScope">◎</div><div class="b" id="mPlant">F</div><div class="b" id="mReload">R</div><div class="b" id="mPause">II</div>
    <div id="mWpn"><div class="b" id="mPrev">◀</div><span id="mWn"></span><div class="b" id="mNext">▶</div></div>
    <div id="mEd"><b>MOVE BUTTONS</b><small>Drag each button where you want it</small><div class="r"><button class="g" id="mEdReset">Reset</button><button id="mEdDone">Done</button></div></div>`;
  document.body.appendChild(root);
  const rot=document.createElement('div');rot.id='mrot';rot.textContent='Rotate your device to landscape to play';document.body.appendChild(rot);
  const $=s=>root.querySelector(s),base=$('#mBase'),knob=$('#mKnob'),releasers=[];
  let shown=false,lastN=null,lastV=null,lastA=null,editing=false,editCb=null,drag=null;
  const wn=$('#mWn'),plant=$('#mPlant'),rld=$('#mReload');
  const look=(dx,dy)=>{if(!o.canPlay())return;P.camYaw-=dx*SX*cfg.sens;P.camPitch=Math.max(-.5,Math.min(.6,P.camPitch-dy*SY*cfg.sens))};

  // ---- floating joystick (left): appears where the thumb lands
  const stick={id:null,ox:0,oy:0};
  const home=()=>{base.style.left='96px';base.style.top=(innerHeight-96)+'px'};
  const setKeys=(a,b,c,d)=>{keys.KeyW=a;keys.KeyS=b;keys.KeyA=c;keys.KeyD=d};
  const stickEnd=()=>{stick.id=null;knob.style.transform='';base.classList.remove('on');setKeys(false,false,false,false);home()};
  const stickMove=e=>{let dx=e.clientX-stick.ox,dy=e.clientY-stick.oy;const l=Math.hypot(dx,dy);if(l>R){dx=dx/l*R;dy=dy/l*R}
    knob.style.transform=`translate(${dx}px,${dy}px)`;const nx=dx/R,ny=dy/R;setKeys(ny<-.3,ny>.3,nx<-.3,nx>.3)};
  const zL=$('#mzL');
  zL.addEventListener('pointerdown',e=>{if(stick.id!==null)return;e.preventDefault();zL.setPointerCapture(e.pointerId);stick.id=e.pointerId;stick.ox=e.clientX;stick.oy=e.clientY;
    base.style.left=e.clientX+'px';base.style.top=e.clientY+'px';base.classList.add('on');stickMove(e)});
  zL.addEventListener('pointermove',e=>{if(e.pointerId===stick.id)stickMove(e)});
  for(const t of['pointerup','pointercancel'])zL.addEventListener(t,e=>{if(e.pointerId===stick.id)stickEnd()});
  releasers.push(stickEnd);

  // ---- camera drag (right): same as moving the mouse
  const lk={id:null,x:0,y:0},zR=$('#mzR');
  zR.addEventListener('pointerdown',e=>{if(lk.id!==null)return;e.preventDefault();zR.setPointerCapture(e.pointerId);lk.id=e.pointerId;lk.x=e.clientX;lk.y=e.clientY});
  zR.addEventListener('pointermove',e=>{if(e.pointerId!==lk.id)return;look(e.clientX-lk.x,e.clientY-lk.y);lk.x=e.clientX;lk.y=e.clientY});
  for(const t of['pointerup','pointercancel'])zR.addEventListener(t,e=>{if(e.pointerId===lk.id)lk.id=null});
  releasers.push(()=>{lk.id=null});

  // ---- buttons (each tracks its own finger, so you can move + aim + fire at the same time)
  const btn=(sel,down,up,aim)=>{const el=$(sel);let id=null,lx=0,ly=0;
    el.addEventListener('pointerdown',e=>{e.preventDefault();if(id!==null)return;el.setPointerCapture(e.pointerId);id=e.pointerId;lx=e.clientX;ly=e.clientY;el.classList.add('dn');down()});
    el.addEventListener('pointermove',e=>{if(!aim||e.pointerId!==id)return;look(e.clientX-lx,e.clientY-ly);lx=e.clientX;ly=e.clientY});
    const end=e=>{if(e.pointerId!==id)return;id=null;el.classList.remove('dn');up&&up()};
    el.addEventListener('pointerup',end);el.addEventListener('pointercancel',end);
    releasers.push(()=>{id=null;el.classList.remove('dn');up&&up()})};
  btn('#mFire',()=>{mouse.l=true},()=>{mouse.l=false},true);
  btn('#mRoll',()=>o.tumble());
  btn('#mScope',()=>o.scope());
  btn('#mReload',()=>o.reload&&o.reload());
  btn('#mPlant',()=>{keys.KeyF=true},()=>{keys.KeyF=false});
  btn('#mPrev',()=>o.weapon(-1));btn('#mNext',()=>o.weapon(1));
  btn('#mPause',()=>o.pause());

  // ---- layout editor: drag every button where your thumbs like it (offsets are saved)
  const applyCfg=()=>{root.style.setProperty('--bs',cfg.scale);
    IDS.forEach(id=>{const p=cfg.pos[id]||[0,0];$('#'+id).style.translate=p[0]+'px '+p[1]+'px'})};
  applyCfg();
  // capture phase on the root: while editing, these run before the buttons' own handlers and block them
  root.addEventListener('pointerdown',e=>{if(!editing)return;
    const wp=e.target.closest('#mWpn'),b=e.target.closest('.b');if(!b&&!wp)return;
    e.stopPropagation();e.preventDefault();
    drag={el:wp||b,id:e.pointerId,x:e.clientX,y:e.clientY};try{e.target.setPointerCapture(e.pointerId)}catch(_){}},true);
  root.addEventListener('pointermove',e=>{if(!editing||!drag||e.pointerId!==drag.id)return;e.stopPropagation();
    const k=drag.el.id,p=cfg.pos[k]||(cfg.pos[k]=[0,0]);p[0]+=e.clientX-drag.x;p[1]+=e.clientY-drag.y;drag.x=e.clientX;drag.y=e.clientY;
    drag.el.style.translate=p[0]+'px '+p[1]+'px'},true);
  for(const t of['pointerup','pointercancel'])root.addEventListener(t,e=>{if(editing&&drag&&e.pointerId===drag.id){e.stopPropagation();drag=null;save()}},true);
  $('#mEdReset').addEventListener('click',()=>{cfg.pos={};save();applyCfg()});
  $('#mEdDone').addEventListener('click',()=>{editing=false;drag=null;root.classList.remove('edit');root.style.display='none';shown=false;lastV=lastA=null;
    const f=editCb;editCb=null;f&&f()});

  // first touch: try fullscreen + landscape lock (only works where the browser allows it)
  document.addEventListener('pointerdown',()=>{try{const d=document.documentElement,f=d.requestFullscreen||d.webkitRequestFullscreen;
    if(f){const r=f.call(d);r&&r.catch&&r.catch(()=>{})}
    if(screen.orientation&&screen.orientation.lock){const r=screen.orientation.lock('landscape');r&&r.catch&&r.catch(()=>{})}}catch(e){}},{once:true});
  addEventListener('resize',()=>{if(stick.id===null)home()});home();

  return{active:true,
    get:()=>cfg,
    set(k,v){cfg[k]=v;save();applyCfg()},
    reset(){cfg.pos={};save();applyCfg()},
    edit(cb){editing=true;editCb=cb||null;releasers.forEach(f=>f());root.style.display='block';root.classList.add('edit');
      plant.style.display='flex';rld.style.display='flex';wn.textContent=o.wname();applyCfg()},
    update(){
      if(editing)return;
      const show=o.canPlay();
      if(show!==shown){shown=show;root.style.display=show?'block':'none';if(!show){releasers.forEach(f=>f());keys.KeyF=false;mouse.l=false}else home()}
      if(!show)return;
      const n=o.wname();if(n!==lastN){lastN=n;wn.textContent=n}
      const am=!!(o.hasAmmo&&o.hasAmmo());if(am!==lastA){lastA=am;rld.style.display=am?'flex':'none'}   // reload button only for guns with a magazine
      const v=o.is5v5();if(v!==lastV){lastV=v;plant.style.display=v?'flex':'none'}}}}
