import * as T from 'three';
import {createCatAvatar,addOutline,setOutline} from './js/catAvatar.js';
import {WIND} from './js/batch.js';   // WIND.uFade: where the cat is, so trees / rocks in front of it turn see-through
import {buildMap} from './js/forestMap.js';
import {openMaker,createShowcase,bakeMakerIcons} from './js/catMaker.js';
import * as IconR from './js/iconRender.js';   // namespace import: an older iconRender.js without useIconRenderer no longer stops the game from loading
import {createFX} from './js/effects.js';
import {createAtmosphere} from './js/atmosphere.js';
import {createHUD} from './js/hud.js';
import {WEAPONS} from './js/weapons/index.js';
import {createSettings} from './js/settings.js';
import {near,blocked,segBlocked} from './js/obsGrid.js';
import {patchCat} from './js/enemies/playersAi.js';
import {createMobile,isMobile} from './js/mobile.js';
import {createGamepad} from './js/gamepad.js';   // controller support (Settings > Controls > Controller)
import {createAudio} from './js/audio.js';
import {createKeybinds} from './js/keybinds.js';
import {headIconURL} from './js/headIcon.js';
import {charIconFrames,charIconCached,charRunFrames} from './js/charIcon.js';
import {createTitleScene} from './js/titleScene.js';   // title screen scenery (hills, sky, clouds)
import {InvCard} from './js/invCard.js';           // the inventory is a 3D card inside the scene
import {createStory} from './js/storyMode.js';       // story mode lives in its own file: world slots, world generation, day / night, inventory

// ---- loading screen (see index.html): real steps, each one painted before the heavy work starts
const L=window.__load||{set(){},done(){}},tick=()=>new Promise(res=>requestAnimationFrame(()=>setTimeout(res,0)));
L.set(.14,'Starting renderer…');await tick();
// boot loading screen: the white running cat (the cat you last played, or the default one), handed to the loading screen in index.html
try{let bc=null;const ls=JSON.parse(localStorage.getItem('sad.slots')||'null'),li=parseInt(localStorage.getItem('sad.lastSlot'),10);
  if(Array.isArray(ls)){const e=(ls[li]&&ls[li].cfg)?ls[li]:ls.find(x=>x&&x.cfg);bc=e&&e.cfg}
  if(!bc)try{bc=JSON.parse(localStorage.getItem('sad.cat')||'null')}catch(e){}
  const rf=charRunFrames(bc||{});if(rf&&window.__loadCat)window.__loadCat(rf);await tick()}catch(e){console.warn('loading cat skipped',e)}

const lerp2=(a,b,t)=>a+(b-a)*t,clamp=(v,a,b)=>Math.max(a,Math.min(b,v));const $=s=>document.querySelector(s),rnd=(a,b)=>a+Math.random()*(b-a);
const IOS=/iPhone|iPad|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);   // iOS WebKit drops the GL context sooner than Android: lighter default framebuffer
const renderer=new T.WebGLRenderer({antialias:false,alpha:true,canvas:$('#c')});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setClearColor(0,0);if(IconR.useIconRenderer)IconR.useIconRenderer(renderer);   // cat maker tiles are rendered with this same renderer
const scene=new T.Scene();
const cam=new T.PerspectiveCamera(70,1,.1,480),fx=createFX(scene),tmp=new T.Vector3(),fp=new T.Vector3();
const atm=createAtmosphere(renderer,scene,cam);let curMode='';
// pixel size is fixed (no slider): PIXEL = 3 screen pixels per game pixel (art rows = window height / 3); use 100% browser zoom
const PIXEL=2.5,applyPixel=()=>{atm.setPixel(true);atm.setArtRows(Math.round(innerHeight/PIXEL))};applyPixel();addEventListener('resize',applyPixel);
atm.onRestore=()=>{try{renderer.compile(scene,cam)}catch(e){}resize()};   // after a lost + restored WebGL context: recompile every shader, rebuild the render targets
const hud=createHUD();
const stage=new T.Group();stage.position.set(0,0,3);stage.visible=false;scene.add(stage);
[[1.9,.1],[1.35,.17],[.85,.12]].forEach(([r,op],i)=>{const m=new T.Mesh(new T.CircleGeometry(r,48),new T.MeshBasicMaterial({color:'#fff',transparent:true,opacity:op,depthWrite:false}));m.rotation.x=-Math.PI/2;m.position.y=.005+i*.004;stage.add(m)});
addEventListener('resize',resize);
{const again=()=>{resize();setTimeout(resize,120);setTimeout(resize,400);setTimeout(resize,900)};   // iOS settles the real size only after the rotation animation
 addEventListener('orientationchange',again);window.visualViewport&&visualViewport.addEventListener('resize',resize);document.addEventListener('visibilitychange',()=>{if(!document.hidden)again()})}
let gfx=null;const prr=()=>gfx?gfx.pr():Math.min(devicePixelRatio,1.5);
function resize() {
  const cv = renderer.domElement;   // #c is position:fixed; inset:0 (CSS), so its real size is the screen
  const w = Math.max(1, cv.clientWidth || innerWidth);
  const h = Math.max(1, cv.clientHeight || innerHeight);
  renderer.setPixelRatio(prr());
  renderer.setSize(w, h, false);    // false = keep the CSS full-screen sizing
  atm.resize(w, h, prr());
  cam.aspect = w / h;
  const f = cam.userData.off || 0, g = cam.userData.offY || 0;
  (f || g) ? cam.setViewOffset(w, h, w * f, h * g, w, h) : cam.clearViewOffset();
  cam.updateProjectionMatrix();
}
let viewTo=0,viewToY=0;function setView(f){viewTo=f;viewToY=0;cam.userData.off=f;cam.userData.offY=0;resize()}   // viewTo / viewToY: sideways / vertical slide of the view (fractions of the screen)resize();
L.set(.26,'Growing the forest…');await tick();
const forest=buildMap(7,atm.envMap);scene.add(forest.group);forest.prime(0,0,60);if(scene.fog){scene.fog.near=30;scene.fog.far=150}   // chunk-streamed hilly forest: build around the start, the rest streams in
L.set(.3,'Painting the title scenery…');await tick();
const TS=createTitleScene(scene,forest,{env:atm.envMap,quality:()=>lastQ});   // title = the real forest (js/forestMap.js) seen from a fixed camera
let map=forest,story=null;const lastQ={};   // story = js/storyMode.js (created below, once everything it needs exists)
fx.setGround((x,z)=>map.heightAt(x,z));
fx.setWater((x,z)=>map.waterAt?map.waterAt(x,z):map.world&&map.world.waterAt?map.world.waterAt(x,z):null,(x,z,a)=>map.ripple&&map.ripple(x,z,a),()=>1-(atm?atm.night:0));   // water splashes (jump / dash / step / bullets): where the water is, how to ring it, how bright it is   // shells / embers / chips land on the real terrain (forest or arena)
{const fq=forest.setQuality;forest.setQuality=q=>{Object.assign(lastQ,q);fq(q);TS.setQuality(q);story&&story.setQuality(q)}}
const audio=createAudio();
const kb=createKeybinds(()=>{for(const k in keys)keys[k]=false;hints()});   // remappable PC keys (js/keybinds.js); the game keeps reading the default codes, `kb.canon` translates
function hints(){const k=a=>kb.label(a),e=document.querySelector('#title .kb');if(e)e.innerHTML=`<b>${k('fwd')}${k('left')}${k('back')}${k('right')}</b> move &nbsp;·&nbsp; <b>Mouse</b> aim<br><br><b>${k('jump')}</b> jump &nbsp;·&nbsp; <b>${k('roll')}</b> roll &nbsp;·&nbsp; hold <b>${k('roll')}</b> in the air to glide &nbsp;·&nbsp; <b>Esc</b> pause &nbsp;·&nbsp; <b>${k('settings')}</b> settings`}
gfx=createSettings({atm,map,audio,kb,onResolution:resize,getMobile:()=>{try{return mobile}catch(e){return null}},getPad:()=>{try{return pad}catch(e){return null}}});   // `mobile` is created further down (touch layout editor lives in Settings > Controls)   // graphics options (presets + per-option, saved, applied live)
const KC={frog:'#6fd36b',rabbit:'#d9c3a0',spider:'#6a4c9a',bee:'#ffd23a'};
let cfg=JSON.parse(localStorage.getItem('sad.cat')||'{}'),cat,state='title',clock=0,paused=false,spin=0,spinHeld=false,run=false,ang=0,backup=null,gunUntil=0,mkOn=false,camAz=0,camTo=0;
window.__catCfg=()=>cfg;   // the current cat look (kept for other screens)
// title / main menu camera = a fixed view over the landscape in js/titleScene.js (the cat stands on its hill).
const TITLE_FOV=44;let vista=1;   // vista: 1 = the title landscape camera (js/titleScene.js), fades to 0 while the cat maker is open / in a match
let lastMk=0;   // the main loop only runs ~15x a second while the cat maker / My Character cover the screen
let chShow=null;   // My Character screen: catMaker-style showcase (checkered bg + pixel preview), see createShowcase in js/catMaker.js
const stageOn=(c,black)=>{const el=$('#chStage');if(!el)return;el.hidden=false;if(chShow)chShow.set(c,black);else chShow=createShowcase(el,c,black)};
const stageOff=()=>{if(chShow){chShow.dispose();chShow=null}const el=$('#chStage');if(el)el.hidden=true};
const selOn=()=>!$('#slots').hidden;   // My Character screen open = catMaker camera, centred, cat standing still in front of you
const IDLE={f:0,s:0,atk:false,roll:false};   // dp = smoothed point the title scene replaces it
// ---- character save slots (5): { cfg, best } or null. Old single-cat saves migrate into slot 1.
const SLOTN=5;let curSlot=-1;
function loadSlots(){let s=null;try{s=JSON.parse(localStorage.getItem('sad.slots'))}catch(e){}
  if(!Array.isArray(s)){s=[];try{const c=JSON.parse(localStorage.getItem('sad.cat')||'null');if(c&&Object.keys(c).length)s[0]={cfg:c,best:+localStorage.getItem('sad.best')||0}}catch(e){}}
  s=s.slice(0,SLOTN).map(x=>x&&x.cfg?x:null);while(s.length<SLOTN)s.push(null);return s}
const MENUS=['title','slots','modes','worlds','wnew','pvp','search','lobby'];   // lobby = the PVP LOCAL screens (created further down); declared here because enterTitle() runs during start-up   // declared up here: enterTitle() runs during start-up, before the menu code further down
let slots=loadSlots();const saveSlots=()=>localStorage.setItem('sad.slots',JSON.stringify(slots));
let gm='wave',best=+localStorage.getItem('sad.best')||0;
const P={x:0,z:0,hp:5,max:5,inv:0,cd:0,mv:false,aim:0,shake:0,hx:0,hz:0,rel:1,camDist:3.3,camYaw:0,camPitch:0,roll:0,rcd:0,rdx:0,rdz:1,kick:0,wpn:0,blink:0,scope:false,hs:0,dash:0,dx:0,dz:1,fwd:0,side:0,viewYaw:0,chain:0,chainT:0,dead:false,frozen:false,gy:0,y:0,vy:0,jy:0,ey:0,air:false,canDash:true,ad:0,fk:0},keys={},mouse={l:false};
InvCard.init({scene,cam,renderer,keys});   // the 3D inventory card lives in the scene (js/invCard.js)
// ---- V: fixed isometric top-down camera (Minecraft Dungeons style). The camera looks down at a fixed angle and follows the cat; W/A/S/D move relative to the SCREEN,
//      the cat aims at the mouse cursor on the ground (no pointer lock while it is on), the scope is off. V again goes back to the normal camera.
// ---- fixed top-down camera (no sliders any more): rotate = look direction, angle = how steeply it looks down (radians above the ground), distance, field of view
const ISO_YAW=2.199,ISO_FOV=47;   // camera: yaw 126 deg, FOV 47 (chosen with the old camera sliders)   // now live values: the Camera panel (C) changes them. The pixel resolution (540 rows) lives in atmosphere.js (ART_H)
const isoF={x:0,y:0,z:0,on:false,px:0,pz:0},isoC={x:0,y:0,z:0,yaw:0,col:8,on:false};
// third-person follow camera tuning: dist = metres behind the cat, elev = how far above it (radians: small = looks only slightly down), follow/posK = lag (higher = tighter), yawLim = max sideways swing (radians)
const TP={dist:11.3,elev:.1745,aim:-.1,lookUp:.35,follow:9,posK:7,yawK:1.6,yawLim:.38,minDist:2,margin:.5};   // smoothed point the top-down camera follows (k = follow speed: lower = more delay)
// ---- outline slider (bottom-left): thickness of the dark blue outline around your cat, in game pixels (0 = off). O hides / shows it. The value is remembered.
{let v=parseFloat(localStorage.getItem('sad.outline'));if(!(v>=0&&v<=6))v=1;   // default outline = 1 game pixel (= 3 screen pixels)
  const box=document.createElement('div');
  box.style.cssText='position:fixed;left:12px;bottom:12px;z-index:99999;background:#000b;color:#fff;font:12px sans-serif;padding:6px 10px;border-radius:8px;display:flex;gap:8px;align-items:center;pointer-events:auto;user-select:none';
  ['mousedown','pointerdown','click','wheel'].forEach(t=>box.addEventListener(t,e=>e.stopPropagation()));
  const lab=document.createElement('span'),r=document.createElement('input');r.type='range';r.min=0;r.max=6;r.step=.25;r.value=v;r.style.width='120px';
  const rows=()=>Math.max(1,Math.round(innerHeight/PIXEL));
  const apply=()=>{v=+r.value;lab.textContent='Outline '+v.toFixed(2);try{localStorage.setItem('sad.outline',v)}catch(e){}setOutline(v,rows())};
  r.oninput=apply;r.onchange=()=>r.blur();box.append(lab,r);document.body.appendChild(box);apply();
  addEventListener('resize',apply);
  addEventListener('keydown',e=>{if(e.code==='KeyO'&&!e.repeat&&!e.ctrlKey&&!e.altKey&&!e.metaKey&&!/INPUT|TEXTAREA|SELECT/.test((e.target&&e.target.tagName)||''))box.style.display=box.style.display==='none'?'flex':'none'})}
// ---- dynamic camera state: smoothed player velocity -> look-ahead, speed zoom, FOV push, yaw sway, bank. All values ease, nothing snaps.
const dyn={vx:0,vz:0,n:0,dash:0,dist:0,fov:0,yaw:0,roll:0,air:0};
const DYN={look:.42,lookMax:3.6,spd:9,zoom:.3,dashZoom:.4,fovSpd:.8,fovDash:2,sway:.05,bank:.01,elev:.03};   // tune the feel here
let invE=0;const INV={zoom:.64,lift:.55,turn:5};let invWas=false;   // inventory open (the 3D card, js/invCard.js): the camera zooms in on the cat (zoom = fraction of the distance removed), looks at its chest (lift, metres), the view slides so the cat stands LEFT of the card (InvCard.viewShift) and the cat turns to face the camera
let iso=false,isoK=0,lookK=0,lookYaw=0,lookHeld=false;   // U (hold) = temporary landscape view from behind the cat
const isoM={x:innerWidth/2,y:innerHeight/2,has:false},isoV=new T.Vector3(),isoD=new T.Vector3();
const ctlYaw=()=>{const k=lookK*lookK*(3-2*lookK);return ISO_YAW+Math.atan2(Math.sin(lookYaw-ISO_YAW),Math.cos(lookYaw-ISO_YAW))*k};   // the direction W points to: the fixed iso direction, turning to the camera's direction while U is held (so movement matches the view)
let camYawNow=ISO_YAW;const mvYaw=()=>iso?ctlYaw():P.camYaw;   // the direction W points to
function relMove(f,s){if(!iso||(!P.fwd&&!P.side))return[f,s];   // screen-relative input -> forward / sideways relative to where the cat faces (for the run animation)
  const m=ctlYaw(),dx=Math.sin(m)*P.fwd-Math.cos(m)*P.side,dz=Math.cos(m)*P.fwd+Math.sin(m)*P.side,l=Math.hypot(dx,dz)||1,c=P.camYaw;
  return[(dx*Math.sin(c)+dz*Math.cos(c))/l,(-dx*Math.cos(c)+dz*Math.sin(c))/l]}
const NONE=[];   // (no enemies / pickups exist any more: the HUD radars just get an empty list)
const casts=o=>o.traverse(m=>{if(m.isMesh&&!m.userData.ol){m.castShadow=true;m.receiveShadow=true}});   // (outline hull meshes never cast / receive shadows)
const WP=()=>WEAPONS[P.wpn],isGunW=()=>WP().kind==='gun';
const refill=()=>{},reload=()=>{},hasMag=()=>false;   // guns no longer fire: no ammo, no reload
function equipIdx(i){P.wpn=i;P.scope=false;cat.userData.equip(WEAPONS[i]);hud.weapon(i)}
function setCat(){if(cat){cat.userData.dispose&&cat.userData.dispose();scene.remove(cat)}cat=createCatAvatar(cfg);patchCat(cat);casts(cat);addOutline(cat);if(mkOn)cat.traverse(m=>{if(m.isMesh)m.receiveShadow=false});scene.add(cat);hud.name(cfg.name);cat.userData.onSlashHit=()=>{};cat.userData.fx=fx;cat.userData.equip(WP());hud.weapon(P.wpn)}
function setWeapon(i){if(story&&story.invOpen())return;i=(i+WEAPONS.length)%WEAPONS.length;const lo=gm==='story'&&P.loadout;if(lo&&!lo.includes(i))i=lo[0]===P.wpn?lo[1]:lo[0];
  if(state!=='play'||paused||P.roll>0||P.wpn===i)return;equipIdx(i)}
// ---- jump: P.y = feet height (world), P.vy = vertical speed, P.jy = height above the ground. Roll held in the air = glide.
const JUMP_V=7.8,JUMP_G=21,DASH_T=.3,DASH_V=17;
const GLIDE_FALL=2.3,GLIDE_V=10.5,GLIDE_V0=6.5,GLIDE_TURN=1.5,GLIDE_INERTIA=2,GLIDE_ZOOM=4.5;   // glide: slow fall; it is a heavy, drifting flight: speed builds up (GLIDE_V0 -> GLIDE_V), turning is slow (GLIDE_TURN rad/s max, GLIDE_INERTIA = how slowly the turn reacts), the camera pulls back by GLIDE_ZOOM
function resetAir(){P.air=false;P.vy=0;P.jy=0;P.ad=0;P.canDash=true;P.fk=0;P.glide=false;P.gs=-1;P.gw=0}
function startGlide(){if(state!=='play'||paused||!P.air||P.glide||P.roll>0||P.dead||P.frozen)return;P.glide=true;P.gs=-1;P.gw=0;P.scope=false;audio.play('slash',{vol:.2,pitch:1.3})}
function jump(){if(state!=='play'||paused||P.air||P.roll>0||P.dead||P.frozen)return;P.air=true;P.vy=JUMP_V;P.canDash=true;P.y=P.gy;P.scope=false;
  cat.userData.jump&&cat.userData.jump();fx.jump(fp.set(P.x,P.gy+.12,P.z));audio.play('slash',{vol:.22,pitch:1.6})}
function tumble(){if((state!=='play'&&state!=='title')||paused||P.roll>0||P.rcd>0||P.dead||P.frozen)return;if(P.air){startGlide();return}let f=P.fwd,s=P.side;if(!f&&!s)f=1;
  const my=mvYaw(),fxv=Math.sin(my),fzv=Math.cos(my),rx=-Math.cos(my),rz=Math.sin(my);let dx=fxv*f+rx*s,dz=fzv*f+rz*s;if(iso&&!P.fwd&&!P.side){dx=Math.sin(P.camYaw);dz=Math.cos(P.camYaw)}const l=Math.hypot(dx,dz)||1;
  if(cat.userData.tumble(...relMove(f,s))){P.roll=.55;P.rcd=.95;map.ripple(P.x,P.z,1.8);P.rdx=dx/l;P.rdz=dz/l;P.inv=Math.max(P.inv,.55);P.scope=false;fx.dash(fp.set(P.x,P.gy+.12,P.z),P.rdx,P.rdz)}}
const TOUCH=isMobile();   // phones / tablets / installed Android app: touch controls, no mouse capture
function setIso(b){b=!!b;if(b===iso)return;iso=b;document.body.classList.toggle('iso',b);$('#c').style.cursor='';
  if(b){P.scope=false;P.camPitch=0;isoM.x=innerWidth/2;isoM.y=innerHeight/2;isoM.has=false;try{document.exitPointerLock&&document.exitPointerLock()}catch(e){}}
  else if(state==='play'&&!paused)lockPtr()}
function lockPtr(){if(TOUCH||iso)return;try{const r=$('#c').requestPointerLock&&$('#c').requestPointerLock();r&&r.catch&&r.catch(()=>{})}catch(e){}}
function setPaused(v){paused=v;hud.pause(v);if(v){mouse.l=false;P.scope=false;document.exitPointerLock&&document.exitPointerLock()}else lockPtr()}
function clearAll(){fx.clearMarks()}
function push(o,rad){for(const r of near(map.obs,o.x,o.z)){const dx=o.x-r.x,dz=o.z-r.z,d=Math.hypot(dx,dz),m=r.r+rad;if(d<m&&d>0){o.x=r.x+dx/d*m;o.z=r.z+dz/d*m}}}
function enterTitle(){leaveGame();clearAll();refill();state='title';paused=false;mouse.l=false;document.exitPointerLock&&document.exitPointerLock();
  P.x=TS.cat.x;P.z=TS.cat.z;P.hp=P.max;P.inv=0;P.roll=0;P.rcd=0;P.scope=false;resetAir();P.kick=0;P.camYaw=TS.cat.rot;P.viewYaw=TS.cat.rot;P.camPitch=0;P.dash=0;   // title: the cat stands where the World Editor's Character spawn is (js/titleScene.js TS.cat)
  TS.catSeen=TS.catRev;hud.show(false);
  equipIdx(0);setView(0);$('#over').hidden=true;showMenu('title');$('#bestT').textContent=best}   // rank card on the title (refreshes after every ranked match)
const turnTo=(a,b,k)=>a+Math.atan2(Math.sin(b-a),Math.cos(b-a))*k;
function update(dt){
  const demo=state==='title';
  if(!(state==='play'||demo)||paused||(story&&story.invOpen())||hud.bigmapOn())return;   // the inventory screen and the map stop the world like a pause
  if(P.hs>0){P.hs-=dt;dt*=.03}   // hit-lag: the world nearly freezes for a moment
  
  // Camera rotation using Arrow keys
  const turnSpeed = 2.2, pitchSpeed = 1.8;
  if(!paused&&!iso){if(keys.ArrowLeft) P.camYaw += turnSpeed * dt;
  if(keys.ArrowRight) P.camYaw -= turnSpeed * dt;
  if(keys.ArrowUp) P.camPitch += pitchSpeed * dt;
  if(keys.ArrowDown) P.camPitch -= pitchSpeed * dt;}
  P.camPitch = Math.max(-0.5, Math.min(0.6, P.camPitch));
  if(state==='play'&&!iso)setIso(true);   // gameplay is always the fixed top-down camera
  if(iso){P.scope=false;P.camPitch=0;                                           // top-down: the cat faces one of 8 directions from the keys (no mouse aim), the last one is kept while standing still
    if(!paused&&!P.dead&&!P.frozen&&P.roll<=0&&(keys.KeyW||keys.KeyS||keys.KeyA||keys.KeyD)){const f8=(keys.KeyW?1:0)-(keys.KeyS?1:0),s8=(keys.KeyD?1:0)-(keys.KeyA?1:0);
      if(f8||s8){const m=ctlYaw(),dx=Math.sin(m)*f8-Math.cos(m)*s8,dz=Math.cos(m)*f8+Math.sin(m)*s8;P.face8=Math.round(Math.atan2(dx,dz)/(Math.PI/4))*(Math.PI/4)}}
    if(P.face8!==undefined)P.camYaw=turnTo(P.camYaw,P.face8,Math.min(1,dt*14))}   // eased turn toward the 8-direction target: smooth, not snapping

  // Player movement using WASD
  const inp=demo?IDLE:null;
  let fwd=demo?inp.f:(keys.KeyW?1:0)-(keys.KeyS?1:0),side=demo?inp.s:(keys.KeyD?1:0)-(keys.KeyA?1:0);if(P.dead||P.frozen||paused){fwd=0;side=0}
  P.fwd=fwd;P.side=side;{const rm=relMove(fwd,side);P.rel=rm[0]<0?-1:1;cat.userData.move.f=rm[0];cat.userData.move.s=rm[1]}
  P.mv=(fwd!==0||side!==0)&&P.roll<=0;P.rcd=Math.max(0,P.rcd-dt);
  const px0=P.x,pz0=P.z,sp=6.5*(WP().stats.move||1);
  if(P.roll>0){const u=P.roll/.55,v=11*(.25+.75*u);P.x+=P.rdx*v*dt;P.z+=P.rdz*v*dt;P.roll=Math.max(0,P.roll-dt);
    fp.set(P.x,P.gy+.1,P.z);fx.dashTrail(fp,P.rdx,P.rdz,u);if(P.roll<=0)fx.land(fp,P.rdx,P.rdz)}
  else if(P.glide){   // glide = flying with weight: you only nudge the heading, the cat keeps its momentum and swings wide
    const my=mvYaw(),rx=-Math.cos(my),rz=Math.sin(my),dx=Math.sin(my)*fwd+rx*side,dz=Math.cos(my)*fwd+rz*side,has=(fwd||side)&&Math.hypot(dx,dz)>0;
    if(P.gs<0){P.gh=has?Math.atan2(dx,dz):P.camYaw;P.gs=GLIDE_V0;P.gw=0}
    const df=has?Math.atan2(Math.sin(Math.atan2(dx,dz)-P.gh),Math.cos(Math.atan2(dx,dz)-P.gh)):0,tw=clamp(df*2,-1,1)*GLIDE_TURN;   // wanted turn rate (+ = left)
    P.gw+=(tw-P.gw)*Math.min(1,dt*GLIDE_INERTIA);P.gh+=P.gw*dt;                                                     // the turn rate itself eases in and out = laggy, heavy steering
    P.gs+=(GLIDE_V*(1-.3*Math.abs(P.gw)/GLIDE_TURN)-P.gs)*Math.min(1,dt*.9);                                       // speed builds slowly, a hard turn bleeds it
    P.x+=Math.sin(P.gh)*P.gs*dt;P.z+=Math.cos(P.gh)*P.gs*dt}
  else if(P.mv){const my=mvYaw(),fxv=Math.sin(my),fzv=Math.cos(my),rx=-Math.cos(my),rz=Math.sin(my);
    const dx=fxv*fwd+rx*side,dz=fzv*fwd+rz*side,len=Math.hypot(dx,dz);if(len>0){P.x+=dx/len*sp*dt;P.z+=dz/len*sp*dt}}
  if(P.dash>0){P.x+=P.dx*P.dash*3*dt;P.z+=P.dz*P.dash*3*dt;P.dash=Math.max(0,P.dash-dt*9)}
  if(state!=='title'){P.x=Math.max(-map.W/2+1,Math.min(map.W/2-1,P.x));P.z=Math.max(-map.H/2+1,Math.min(map.H/2-1,P.z))}push(P,.45);   // (the title cat may stand anywhere the World Editor put it)
  if(gm==='story'){   // CLIFFS: you can walk up ramps, but a ledge is climbed by jumping onto it (air dash helps); a wall just stops / slides you
    const tooHigh=(x,z)=>{const gN=map.heightAt(x,z),gO=map.heightAt(px0,pz0),mv=Math.hypot(x-px0,z-pz0);if(mv<1e-5)return false;return P.air?gN>P.y+.3:(gN-gO)/mv>1.3};
    if(tooHigh(P.x,P.z)){if(!tooHigh(P.x,pz0))P.z=pz0;else if(!tooHigh(px0,P.z))P.x=px0;else{P.x=px0;P.z=pz0}P.dash=0}}
  {const wr=map.world;if(gm==='story'&&wr&&wr.landR&&wr.landR(P.x,P.z)>.72&&wr.shoreDist(P.x,P.z)<-14){P.x=px0;P.z=pz0}}   // the sea: you can wade, but not walk out across the open water   // cliffs are too steep to climb
  
  P.gy=state==='title'?TS.heightAt(P.x,P.z):map.heightAt(P.x,P.z);   // title: the cat stands on the TITLE map's ground (js/titleScene.js), not on the forest
  if(gm==='story'&&!P.air&&P.y-P.gy>.7){P.air=true;P.vy=0;P.canDash=true}   // walked off a ledge: fall instead of snapping down
  if(P.air){ // ---- jump / fall (an air dash hovers: no gravity while it lasts)
    if(P.glide&&!keys.ShiftLeft)P.glide=false;   // let go of the roll key = stop gliding
    if(P.glide)P.vy+=(-GLIDE_FALL-P.vy)*Math.min(1,dt*6);else P.vy-=JUMP_G*dt;
    P.y+=P.vy*dt;
    if(P.y<=P.gy&&P.vy<=0){const hard=-P.vy;P.y=P.gy;P.air=false;P.vy=0;P.glide=false;if(P.rcd>.35)P.rcd=.35;
      cat.userData.land&&cat.userData.land(Math.min(1,hard/10));fx.land(fp.set(P.x,P.gy+.12,P.z),P.rdx*.3,P.rdz*.3);if(hard>9)P.shake=Math.max(P.shake,.25)}
    else if(P.y<P.gy)P.y=P.gy}
  else P.y=P.gy;
  P.jy=Math.max(0,P.y-P.gy);P.ey=P.y-Math.min(P.jy*.35,.8);   // the camera's eye follows the cat's real height: it used to lag 35% of the drop behind, so gliding off a high place pushed the cat off the top of the screen (the lag is now capped)
  P.fk+=((P.glide?1:0)-P.fk)*Math.min(1,dt*14);P.gz=(P.gz||0)+((P.glide?1:0)-(P.gz||0))*Math.min(1,dt*2.2);
  map.walk('player',P.x,P.z,(P.mv||P.roll>0)&&!P.air);if((P.mv||P.roll>0)&&!P.air&&clock-(P._st||0)>.22){P._st=clock;fx.splashStep(P.x,P.z,P.gy)}   // ripples when you walk on water
  if(P.mv&&!P.air&&P.roll<=0){const rx=P.x-px0,rz=P.z-pz0,rl=Math.hypot(rx,rz);if(rl>1e-4)fx.run(fp.set(P.x,P.gy,P.z),rx/rl,rz/rl)}   // cartoon dust puffs behind the feet while running
  if(gm==='story')story.tick(dt);
  P.aim=P.camYaw;
  P.cd-=dt;P.inv-=dt;cat.userData.setScope(false);
  
  // Attack trigger is E (KeyE)
  if((keys.KeyE||mouse.l||(demo&&inp.atk))&&!paused&&P.cd<=0&&P.roll<=0&&!P.dead&&!P.frozen){if(!isGunW()&&cat.userData.slash()){const st=WP().stats;if(!demo){const s=WP().sfx||{};audio.play(s.slash||'slash',{vol:s.vol,pitch:s.pitch})}P.cd=st.dur+.05;P.dx=Math.sin(P.camYaw);P.dz=Math.cos(P.camYaw);P.dash=st.dash;if(st.dash)fx.lunge(fp.set(P.x,P.gy+.1,P.z),P.dx,P.dz)}}

}
function leaveGame(){P.unarmed=false;P.loadout=null;hud.loadout&&hud.loadout(null);story&&story.leave();gm='wave';if(scene.fog){scene.fog.near=30;scene.fog.far=150}map=forest;forest.group.visible=true;document.body.classList.remove('v5');const l=document.querySelector('.wplate small');if(l)l.textContent='WAVE'}
// compile every shader / upload every geometry once, behind the loading screen, so nothing hitches the first time it appears
function warm(){try{const g=new T.Group();g.position.set(0,-80,0);WEAPONS.forEach(w=>{const b=w.build();g.add(b.group);if(b.off)g.add(b.off)});scene.add(g);renderer.compile(scene,cam);renderer.render(scene,cam);scene.remove(g)}catch(e){console.warn('warm-up skipped',e)}}
// ---- touch controls: only created on phones / tablets (see js/mobile.js); on PC this is a no-op
const mobile=createMobile({P,keys,mouse,canPlay:()=>state==='play'&&!paused&&!story.invOpen()&&!hud.bigmapOn(),tumble,jump,pause:()=>setPaused(true),
  weapon:d=>setWeapon(P.wpn+d),wname:()=>WP().name,reload,hasAmmo:hasMag,is5v5:()=>false,inventory:()=>story.toggle(),isStory:()=>gm==='story',map:()=>dispatchEvent(new CustomEvent('sad:inv',{detail:'map'})),
  scope:()=>{}});
// ---- controller: sticks / triggers in a match, the same keyboard menu navigation (A = accept, B = back) everywhere else
const pad=createGamepad({P,keys,mouse,inGame:()=>state==='play'&&!paused,inPlay:()=>state==='play',
  jump,tumble,reload,weapon:d=>setWeapon(P.wpn+d),pause:()=>setPaused(true),resume:()=>setPaused(false),
  inventory:()=>story.toggle(),invOpen:()=>story.invOpen(),isStory:()=>gm==='story',
  map:()=>dispatchEvent(new CustomEvent('sad:inv',{detail:'map'})),mapOn:()=>hud.bigmapOn(),
  scopeSet:()=>{},
  settings:()=>{if(state==='play'&&!paused)setPaused(true);gfx.open()},
  notify:(a,b)=>hud.banner(a,b)});
let last=performance.now();
hints();
// ---- STORY MODE (js/storyMode.js): it reaches the game through these hooks. `activate` is the one place that flips main.js into 'story'.
story=createStory({$,scene,atm,hud,P,keys,mouse,renderer,cam,tick,touch:TOUCH,
  game:{get gm(){return gm},get map(){return map},get state(){return state},get paused(){return paused}},
  activate:(m,sx,sz,yaw)=>{gm='story';forest.group.visible=false;m.group.visible=true;map=m;if(scene.fog){scene.fog.near=50;scene.fog.far=230}
    P.x=sx;P.z=sz;P.camYaw=yaw||0;P.viewYaw=P.camYaw;P.camPitch=0;P.hp=P.max;P.inv=0;P.dead=false;P.frozen=false;paused=false;state='play';
    ['#title','#over'].forEach(s=>$(s).hidden=true);hud.reset();hud.show(true);hud.pause(false);P.roll=0;P.rcd=0;P.scope=false;resetAir();P.kick=0;P.chain=0;P.chainT=0;mouse.l=false;setView(0);
    document.body.classList.add('story');hud.name(cfg.name);P.gy=map.heightAt(P.x,P.z)},
  hideMenus,showMenu,enterTitle,leave5:leaveGame,clearAll,refill,equipIdx,lockPtr,
  view:f=>{viewTo=f},quality:()=>lastQ,getCat:()=>cat});
// the full-screen map page (M): the game stands still while it is open and the cursor is freed for panning
let mapClosedT=-1e9;   // when the map page was last closed: Esc / the closing click must not also pause the game (the browser's pointer-lock change arrives a moment later)
hud.onMap=open=>{if(open){for(const k in keys)keys[k]=false;mouse.l=false;P.scope=false;P.mv=false;try{document.exitPointerLock&&document.exitPointerLock()}catch(e){}}else{mapClosedT=performance.now();if(state==='play'&&!paused&&!TOUCH)lockPtr()}};
L.set(.5,'Dressing the cat…');await tick();
setCat();enterTitle();
L.set(.62,'Warming up…');await tick();
L.set(.8,'Compiling shaders…');await tick();warm();
// bake every cat maker tile icon NOW, behind the loading screen, for the cat you last played (or the default look when there is none): the maker then opens instantly
try{const ls=parseInt(localStorage.getItem('sad.lastSlot'),10),en=slots[ls]||slots.find(Boolean),bc=en?JSON.parse(JSON.stringify(en.cfg)):{};
  L.set(.82,'Baking the cat maker…');await tick();
  await bakeMakerIcons(bc,p=>L.set(.82+p*.1,'Baking the cat maker… '+Math.round(p*100)+'%'))}catch(e){console.warn('cat maker bake skipped',e)}
L.set(.92,'Loading fonts & images…');
await Promise.all([document.fonts&&document.fonts.ready,...[...document.images].map(i=>i.decode?i.decode().catch(()=>{}):0)]);
L.set(.98,'Almost there…');await tick();
let lf=0,lastDraw=0;const PROF=/[?&]prof/.test(location.search),NOB=/[?&]nobots/.test(location.search),NOA=/[?&]noarena/.test(location.search),pf={n:0,u:0,r:0,fx:0,t0:performance.now()};   // open the game with ?prof to log where the frame time goes (console, every 120 frames)
let tsWas=false;
// inventory preview: while the inventory is open the world is hidden and a plain backdrop hangs behind the cat, so only the character shows through the card's hole

(function loop(now){requestAnimationFrame(loop);
  {const iv=gfx.fpsInterval();if(iv){if(now-lastDraw<iv-1)return;lastDraw=now-((now-lastDraw)%iv)}else lastDraw=now}   // FPS limit (Settings > Graphics): skip animation frames that come sooner than the cap
  if(mkOn||selOn()){if(now-lastMk<66)return;lastMk=now}   // cat maker / My Character: the screen is covered by the 2D preview, so the hidden 3D game only needs a slow tick
  gfx.ingame(state==='play');
  if(lf<5&&++lf===5)L.done();   // the loading screen leaves once the game has really drawn a few frames
const raw=(now-last)/1000,dt=Math.min(raw,.05);last=now;if(state!=='maker'&&!paused&&raw<.5)gfx.frame(raw,n=>hud.banner('Graphics: '+n,'lowered automatically for smoother play'));clock+=dt;mobile.update();pad.update(raw);const lag=P.hs>0&&!paused;if(PROF){renderer.info.autoReset=false;renderer.info.reset();}   // ?prof&nobots / &noarena hide the bots / the arena so you can see what each costs
  const _u0=performance.now();update(dt);pf.u+=performance.now()-_u0;fx.update(lag?dt*.3:dt);   // sparks keep moving in slow motion during the freeze
  {const c=cam.userData.off||0,cy=cam.userData.offY||0;if(c!==viewTo||cy!==viewToY){const e=Math.min(1,dt*6),n=Math.abs(viewTo-c)<.001?viewTo:c+(viewTo-c)*e,ny=Math.abs(viewToY-cy)<.001?viewToY:cy+(viewToY-cy)*e;cam.userData.off=n;cam.userData.offY=ny;const W=Math.max(1,renderer.domElement.clientWidth||innerWidth),H=Math.max(1,renderer.domElement.clientHeight||innerHeight);(n||ny)?cam.setViewOffset(W,H,W*n,H*ny,W,H):cam.clearViewOffset();cam.updateProjectionMatrix()}   // maker open/close: the cat glides to the other side of the screen
  if(!mkOn)camTo=selOn()?Math.PI:0;let d=camTo-camAz;d=Math.atan2(Math.sin(d),Math.cos(d));camAz+=d*Math.min(1,dt*5);   // maker: camera swings round the cat (0 = behind it as usual, PI = in front of it)
  if(!spinHeld){spin=Math.atan2(Math.sin(spin),Math.cos(spin));spin-=spin*Math.min(1,dt*4)}}
  const mode=state==='maker'?'maker':'play';if(mode!==curMode){curMode=mode;atm.setMode(mode)}
  audio.music(state==='title'||state==='maker'||gm==='story'?'title':state==='over'?null:'wave');audio.duck(paused)
  // 5v5: when you are dead the camera follows the ally you picked (the spectate buttons live in 5v5.js); the map and the sun's shadows follow it too
  const SV=null,FOC=P;   // (no spectator view any more)
  story.cycle(state==='play');atm.hold=paused||story.invOpen()||hud.bigmapOn();   // day/night runs only in a story world and stops with the inventory open
  if(TS.catSeen!==TS.catRev){TS.catSeen=TS.catRev;if(state==='title'){P.x=TS.cat.x;P.z=TS.cat.z;P.camYaw=P.viewYaw=TS.cat.rot}}   // titleMap.js arrived: move the cat to its Character spawn
  TS.sky(state==='title'&&!$('#title').hidden);   // title screen = looking at the sky; tapping (main menu) tilts the camera down to the forest
  {const ton=state==='title'&&map===forest;TS.show(ton);if(TS.custom&&map===forest)forest.group.visible=!ton}   // title: the forest stays visible, only the floating seeds are the title's own; with a titleMap.json the custom map replaces the forest there
  if(state!=='maker')map.update(clock,FOC,{sun:atm.lightDir,sky:atm.fogColor});atm.update(dt,clock,FOC);WIND.uFade.value.set(FOC.x,FOC.ey+1.1,FOC.z,state==='play'?1:0);
  {const n=atm.night||0,k=n*n*(3-2*n);WIND.uDim.value.set(1-.62*k,1-.58*k,1-.30*k)}   // night: trees, bushes and grass go dark and blue like everything else
  if(state!=='play')hud.scope(0);
  if(state==='play'||state==='over'||state==='title'){
    const invOn=state==='play'&&!!story.invOpen();   // inventory open: zoomed-in front view of the real cat, standing on the left of the 3D card
    if(invOn||invWas){const vs=invOn?InvCard.viewShift():{x:0,y:0};viewTo=vs.x;viewToY=vs.y;invWas=invOn}   // slide the view (also follows a window resize while it is open)
    if(iso&&state!=='play')setIso(false);
    {const un=state==='title'&&selOn()&&!mkOn,u=cat.userData;                                  // My Character (cat pick): empty hands + the calm idle pose
      if(un&&!u.selBare){u.selBare=true;try{u.equip(null)}catch(e){}}
      else if(!un&&u.selBare){u.selBare=false;try{u.equip(WP())}catch(e){}}}
    lookK+=((lookHeld&&state==='play'&&!paused&&!invOn?1:0)-lookK)*(1-Math.exp(-dt*4));if(lookK<.002)lookK=0;
    isoK+=((iso&&state==='play'?1:0)-isoK)*Math.min(1,dt*5);if(isoK<.002)isoK=0;if(isoK>.998)isoK=1;const isoS=isoK*isoK*(3-2*isoK);   // 0..1, eased: blends the normal camera into the top-down one
    cat.position.set(P.x,P.air?P.y:P.gy,P.z);
    invE+=((invOn?1:0)-invE)*(1-Math.exp(-dt*INV.turn));if(invE<.002)invE=0;if(invE>.998)invE=1;
    {let ry=P.camYaw;if(P.fk>.001&&P.gh!=null)ry=P.camYaw+Math.atan2(Math.sin(P.gh-P.camYaw),Math.cos(P.gh-P.camYaw))*P.fk;if(invE>0){const fy=Math.atan2(cam.position.x-P.x,cam.position.z-P.z)+((InvCard.spinY||0));ry=P.camYaw+Math.atan2(Math.sin(fy-P.camYaw),Math.cos(fy-P.camYaw))*(invE*invE*(3-2*invE))}cat.rotation.y=ry}   // turns round to look into the (unmoved) camera
    P.blink=Math.max(0,P.blink-dt);cat.visible=!P.dead&&(state==='title'||P.blink<=0||Math.floor(clock*20)%2===0);
    {const wd=state==='title'&&!mkOn&&!selOn()?1:0;vista=state==='title'?vista+(wd-vista)*Math.min(1,dt*3.5):0;if(Math.abs(vista-wd)<.002)vista=wd}   // title + main menu = landscape view, cat maker = behind-the-cat camera, a match = neither
    cat.userData.setAim(invOn?0:P.camPitch,(state==='play'&&!paused)||state==='title');cat.userData.setAir(P.air?P.jy:0,P.vy);cat.userData.setGlide(P.glide,P.glide?P.gw/GLIDE_TURN:0);cat.userData.holster(false);cat.userData.update(paused?0:lag?dt*.06:dt,P.mv&&(state==='play'||state==='title')&&!paused,P.rel);
    P.shake=Math.max(0,P.shake-dt*1.2);const sh=P.shake*P.shake*.55*(1-vista);   // the title view never shakes
    
    const aw=cat.userData.scope(),kk=P.kick=Math.max(0,P.kick-dt*5),kc=kk*(1-vista),dist=(SV?SPEC_H:state==='title'?(mkOn?3.5:4.8):lerp2(P.camDist,1.7,aw))+kc*.12+(state==='play'?(P.gz||0)*GLIDE_ZOOM:0),rightOffset=SV?0:state==='title'?(selOn()?0:.5):lerp2(1.4,.8,aw);
    {   // ---- camera dynamics (top-down play camera): velocity from the real movement of the cat, smoothed
      const snap=!isoF.on||Math.hypot(P.x-isoF.px,P.z-isoF.pz)>6,idt=Math.max(dt,1e-3);
      let vx=snap?0:(P.x-isoF.px)/idt,vz=snap?0:(P.z-isoF.pz)/idt;isoF.px=P.x;isoF.pz=P.z;
      const vl=Math.hypot(vx,vz);if(vl>20){vx*=20/vl;vz*=20/vl}
      const kv=1-Math.exp(-dt*6);dyn.vx+=(vx-dyn.vx)*kv;dyn.vz+=(vz-dyn.vz)*kv;
      const sp=Math.hypot(dyn.vx,dyn.vz),dashing=(P.roll>0||P.glide)?1:0,play=state==='play'&&!paused&&!P.dead?1:0;
      dyn.n+=(Math.min(1,sp/DYN.spd)*play-dyn.n)*(1-Math.exp(-dt*3));
      dyn.dash+=(dashing-dyn.dash)*(1-Math.exp(-dt*(dashing?14:4)));
      dyn.air+=((P.air?1:0)-dyn.air)*(1-Math.exp(-dt*5));
      const sx=Math.cos(ISO_YAW),sz=-Math.sin(ISO_YAW),side=(dyn.vx*sx+dyn.vz*sz)/DYN.spd;   // velocity component along the screen's horizontal axis
      dyn.yaw+=(clamp(side,-1,1)*DYN.sway-dyn.yaw)*(1-Math.exp(-dt*2.2));
      dyn.roll+=(clamp(side,-1,1)*DYN.bank-dyn.roll)*(1-Math.exp(-dt*4));
      dyn.dist+=((dyn.n*DYN.zoom+dyn.dash*DYN.dashZoom+dyn.air*.5)-dyn.dist)*(1-Math.exp(-dt*2.6));
      dyn.fov+=((dyn.n*DYN.fovSpd+dyn.dash*DYN.fovDash)-dyn.fov)*(1-Math.exp(-dt*5))}
    let targetFov=lerp2(lerp2(gfx.get().fov||70,WP().stats.zoom||40,aw)+kc*2+(P.gz||0)*9,TITLE_FOV,vista);targetFov+=(ISO_FOV+dyn.fov+lookK*lookK*(3-2*lookK)*16-targetFov)*isoS;if(Math.abs(cam.fov-targetFov)>.01){cam.fov=targetFov;cam.updateProjectionMatrix()}
    const vy0=state==='title'?P.viewYaw+camAz-spin:FOC.camYaw,vy=vy0,pit=(state==='title'?-.25:SV?-1.18:P.camPitch)+kc*.02;   // drone: fixed yaw + fixed downward pitch   // spectating = TOP VIEW: high above the ally, looking steeply down
    const rx=-Math.cos(vy),rz=Math.sin(vy),cp=Math.cos(pit),sp=Math.sin(pit),dX=Math.sin(vy)*cp,dY=sp,dZ=Math.cos(vy)*cp;
    const fx0=FOC.x,fz0=FOC.z,px=fx0+rx*rightOffset,pz=fz0+rz*rightOffset;
    const camX=px-dX*dist+rx*rnd(-sh,sh)*.7,camZ=pz-dZ*dist+rz*rnd(-sh,sh)*.7;let camY=FOC.ey+1.0-dY*dist+rnd(-sh,sh)+(P.roll>0?-.15:0)+(state==='play'&&!SV?(gfx.get().cam||0)*.0375*(1-aw):0);   // Settings > Camera height: raises / lowers the camera only (the aim point stays put); fades out while scoped
    camY=Math.max(.35+map.heightAt(camX,camZ),camY);   // never let the camera sink below the ground
    cam.position.set(camX,camY,camZ);if(!SV&&state!=='title')for(const o of near(map.obs,cam.position.x,cam.position.z)){if(o.r>3)continue;const ox=cam.position.x-o.x,oz=cam.position.z-o.z,od=Math.hypot(ox,oz),om=o.r+.35;if(od<om&&od>1e-3){cam.position.x=o.x+ox/od*om;cam.position.z=o.z+oz/od*om}}   // keep the camera out of trunks and rocks
    cam.lookAt(fx0+dX*11,1+FOC.ey+dY*11,fz0+dZ*11);
    if(vista>0){const tc=TS.cam(clock),p0=cam.position.clone(),q0=cam.quaternion.clone();cam.position.copy(tc.pos);cam.lookAt(tc.look);const q1=cam.quaternion.clone();cam.position.lerpVectors(p0,tc.pos,vista);cam.quaternion.copy(q0).slerp(q1,vista)}   // title landscape view, blended in / out   // looks at the point the bullets converge on (drone: a bit higher, so the cat sits in the lower half under the logo)
    cam.rotation.z+=rnd(-sh,sh)*.02+(P.roll>0?Math.sin(P.roll*14)*.02:0);
    if(isoS>0){cam.getWorldDirection(isoD);const lx=cam.position.x+isoD.x*12,ly=cam.position.y+isoD.y*12,lz=cam.position.z+isoD.z*12;   // where the normal camera looks right now (we blend from it)
      // ---- THIRD-PERSON FOLLOW CAMERA: perspective, behind + above the cat, tilted slightly down, smooth lag, limited swing, collision avoidance, near-constant distance
      const ty=P.ey+TP.aim,spd=Math.hypot(dyn.vx,dyn.vz);
      if(!isoF.on||isoS<.02||Math.hypot(P.x-isoF.x,P.z-isoF.z)>14){isoF.x=P.x;isoF.y=ty;isoF.z=P.z;isoF.on=true;isoC.on=false}
      else{const kx=1-Math.exp(-dt*TP.follow),ky=1-Math.exp(-dt*(P.vy>0&&P.air?3.2:7));isoF.x+=(P.x-isoF.x)*kx;isoF.z+=(P.z-isoF.z)*kx;isoF.y+=(ty-isoF.y)*ky}   // the point the camera orbits: follows the cat with a little delay
      // limited horizontal swing: the camera drifts (slowly, at most +-TP.yawLim) towards the side the cat is running to, then settles back behind it
      let tyaw=0;if(spd>1.2){let off=Math.atan2(dyn.vx,dyn.vz)-ISO_YAW;tyaw=TP.yawLim*Math.sin(off)*Math.min(1,spd/DYN.spd)}tyaw*=1-lookK*lookK*(3-2*lookK);   // no auto sideways swing while U is held
      isoC.yaw+=(tyaw-isoC.yaw)*(1-Math.exp(-dt*TP.yawK));
      {const occ=isoC.on&&state==='play'&&segBlocked(map.obs,P.x,P.z,isoC.x,isoC.z,.55)?1:0;isoC.occ=(isoC.occ||0)+(occ-(isoC.occ||0))*(1-Math.exp(-dt*(occ?5:1.2)))}   // a trunk / rock / debris between the camera and the cat: the camera rises and looks down over it, then eases back
      const invES=invE*invE*(3-2*invE),lkS=lookK*lookK*(3-2*lookK),el=lerp2(TP.elev+DYN.elev*(1-dyn.n)*(1-dyn.dash)-.03*dyn.air,.1,lkS)+.35*(isoC.occ||0)*(1-lkS)*(1-invES)-.8*invES,cE=Math.cos(el),sE=Math.sin(el),yw0=ISO_YAW+isoC.yaw*(1-lkS),yw=yw0+Math.atan2(Math.sin(lookYaw-yw0),Math.cos(lookYaw-yw0))*lkS,dist=lerp2(TP.dist+dyn.dist,7,lkS)*(1-INV.zoom*invES);   // U held: low camera right behind the cat
      camYawNow=yw;const dx=-Math.sin(yw)*cE,dy=sE,dz=-Math.cos(yw)*cE;   // unit vector from the cat to the camera: behind and above
      // collision avoidance: walk from the cat towards the wanted camera spot; if the ground or a trunk/rock is in the way, stop just in front of it
      let dmax=dist;   // no pull-in: the camera never zooms in on trunks / cliffs (the ground clamp below only lifts it)
      if(!isoC.on)isoC.col=dist;isoC.col+=(dmax-isoC.col)*(1-Math.exp(-dt*(dmax<isoC.col?14:2.2)));   // pulls in fast, eases back out slowly
      const ex=isoF.x+dx*isoC.col,ey=isoF.y+dy*isoC.col,ez=isoF.z+dz*isoC.col;
      if(!isoC.on){isoC.x=ex;isoC.y=ey;isoC.z=ez;isoC.on=true}else{const kp=1-Math.exp(-dt*TP.posK);isoC.x+=(ex-isoC.x)*kp;isoC.y+=(ey-isoC.y)*kp;isoC.z+=(ez-isoC.z)*kp}   // smooth position interpolation (slight lag)
      for(const o of near(map.obs,isoC.x,isoC.z)){if(o.r>3)continue;const ox=isoC.x-o.x,oz=isoC.z-o.z,od=Math.hypot(ox,oz),om=o.r+.35;if(od<om&&od>1e-3){isoC.x=o.x+ox/od*om;isoC.z=o.z+oz/od*om}}
      isoC.y=Math.max(isoC.y,.35+map.heightAt(isoC.x,isoC.z));
      {let need=0;for(let i=1;i<=10;i++){const t=i/10,h=map.heightAt(isoF.x+(isoC.x-isoF.x)*t,isoF.z+(isoC.z-isoF.z)*t)+.9,yl=isoF.y+(isoC.y-isoF.y)*t;if(h>yl)need=Math.max(need,(h-yl)/t)}   // hill / cliff / slope between the camera and the cat: lift the camera until the cat is in view
        need=Math.min(need,30-28.5*invES);const L0=isoC.lift||0;isoC.lift=L0+(need-L0)*(1-Math.exp(-dt*(need>L0?12:1.8)))}
      cam.position.set(cam.position.x+(isoC.x-cam.position.x)*isoS,cam.position.y+(isoC.y+(isoC.lift||0)-cam.position.y)*isoS,cam.position.z+(isoC.z-cam.position.z)*isoS);
      {const tx=isoF.x+Math.sin(lookYaw)*16*lkS,ty=isoF.y+TP.lookUp+3.4*lkS+INV.lift*invES,tz=isoF.z+Math.cos(lookYaw)*16*lkS;cam.lookAt(lx+(tx-lx)*isoS,ly+(ty-ly)*isoS,lz+(tz-lz)*isoS)}   // ...looking out over the landscape ahead
      cam.rotation.z+=dyn.roll*isoS;   // tiny lean into sideways runs
      if(sh>0){cam.position.x+=rnd(-sh,sh)*isoS;cam.position.y+=rnd(-sh,sh)*.8*isoS;cam.position.z+=rnd(-sh,sh)*isoS;cam.rotation.z+=rnd(-sh,sh)*.02*isoS}}   // screenshake
    if(state==='play'){cam.updateMatrixWorld();hud.crosshair(0,false);hud.tumble(1-P.rcd/.95);
      hud.radar(FOC,NONE,NONE,map,isoS>.5?camYawNow:FOC.camYaw);if(hud.bigmapOn())hud.bigradar(FOC,NONE,NONE,map)}
  }
  else{const mk=state==='maker';let mv=false;
    if(mk&&run){ang+=dt*3;cat.position.set(Math.cos(ang)*.9,0,3+Math.sin(ang)*.9);cat.rotation.y=Math.atan2(-Math.sin(ang),Math.cos(ang));mv=true}
    else{cat.position.set(0,0,3);if(mk){if(!spinHeld){spin=Math.atan2(Math.sin(spin),Math.cos(spin));spin-=spin*Math.min(1,dt*4)}cat.rotation.y=spin}else cat.rotation.y=Math.sin(clock*.7)*.6}
    cat.visible=true;const shooting=performance.now()<=gunUntil;cat.userData.setAim(0,shooting);cat.userData.setScope(false);cat.userData.move.f=mv?1:0;cat.userData.move.s=0;cat.userData.holster(!shooting);cat.userData.update(dt,mv,1);if(mk){if(cam.fov!==38){cam.fov=38;cam.updateProjectionMatrix()}cam.position.set(0,1.0,6.0);cam.lookAt(0,.74,3)}else{cam.position.set(0,2.4,8);cam.lookAt(0,1,3)}}
  TS.update(dt,clock,cam.position,{sun:atm.lightDir,sky:atm.fogColor});
  InvCard.update(Math.min(raw,.08));   // the inventory card: placed in front of the (final) camera, HTML glued onto it
  {const _r0=performance.now();if(!(mkOn||selOn()))atm.render();const _r1=performance.now();pf.r+=_r1-_r0;
  if(PROF&&++pf.n>=120){const i=renderer.info.render,bp=globalThis.__botProf||{think:0,avatar:0},k=1/pf.n,t=performance.now();
    const gl=renderer.getContext(),g0=performance.now();gl.finish();const gpuWait=performance.now()-g0;   // time the GPU still needed after the draw calls were sent
    const grp=[];scene.children.forEach(c=>{if(!c.visible)return;let n=0;c.traverseVisible(o=>{if(o.isMesh||o.isSprite||o.isPoints||o.isLine)n++});grp.push([n,c.type+'('+c.children.length+')'+(c.userData&&c.userData.setAim?' cat':'')])});
    grp.sort((x,y)=>y[0]-x[0]);const cats=scene.children.filter(c=>c.visible&&c.userData&&c.userData.setAim).length;
    console.log(`[prof] frame ${((t-pf.t0)*k).toFixed(1)}ms | update ${(pf.u*k).toFixed(2)} (bot think ${(bp.think*k).toFixed(2)}, bot avatar ${(bp.avatar*k).toFixed(2)}) | render submit ${(pf.r*k).toFixed(2)} | gpu wait after submit ${gpuWait.toFixed(1)}ms | WHOLE-FRAME draw calls ${i.calls} tris ${i.triangles} | visible cats ${cats} | programs ${renderer.info.programs?renderer.info.programs.length:'?'} | geometries ${renderer.info.memory.geometries} textures ${renderer.info.memory.textures} | biggest scene groups (visible meshes): ${grp.slice(0,6).map(x=>x[1]+':'+x[0]).join(', ')}`);
    pf.n=pf.u=pf.r=0;pf.t0=t;if(globalThis.__botProf){bp.think=0;bp.avatar=0}}}})(last);
// audio: browsers keep sound locked until a click / key press; every button also gets the click sound
addEventListener('pointerdown',e=>{audio.unlock();if(e.target.closest&&e.target.closest('button,.btn,.mode,.mm-t,.ti,.cslot,#title'))audio.play('click')},true);
addEventListener('keydown',e=>{
  audio.unlock();const c=kb.canon(e.code);if(c===null){if(e.code==='Space')e.preventDefault();return}keys[c]=true;if(c==='Escape'&&state==='play'&&!paused){if(!hud.bigmapOn()&&performance.now()-mapClosedT>500)setPaused(true)}else if(c==='KeyP'&&state==='play')setPaused(!paused);if(c==='KeyG'&&(state==='play'||state==='title')){if(state==='play'&&!paused)setPaused(true);gfx.open()}if(/^Digit[1-8]$/.test(c)){const n=+c[5]-1;setWeapon(gm==='story'&&P.loadout?(P.loadout[n]??P.wpn):n)}if(c==='Space'){e.preventDefault();if(!e.repeat)jump()}if(c==='ShiftLeft'&&!e.repeat)tumble();});addEventListener('keyup',e=>{const c=kb.canon(e.code);if(c)keys[c]=false});

// mouse: left click / hold = attack (melee), wheel = swap weapon
addEventListener('mousedown',e=>{if(state!=='play'||story.invOpen()||hud.bigmapOn())return;
  if(e.button===0){if(TOUCH&&!paused)return;   // touch controls have their own fire button (a touch also sends a fake mouse click)
    if(paused){if(!(e.target.closest&&e.target.closest('#quit,#pgfx,#gfx')))setPaused(false);return}if(!document.pointerLockElement)lockPtr();mouse.l=true}
  });
addEventListener('mouseup',e=>{if(TOUCH)return;if(e.button===0)mouse.l=false;});
addEventListener('mousemove',e=>{if(iso){isoM.x=e.clientX;isoM.y=e.clientY;isoM.has=true}
  if(state==='play'&&!paused&&!hud.bigmapOn()&&document.pointerLockElement){P.camYaw-=e.movementX*.0026;P.camPitch=Math.max(-.5,Math.min(.6,P.camPitch-e.movementY*.0022))}});
addEventListener('wheel',e=>{if(state==='play'&&!paused&&!hud.bigmapOn()&&!story.invOpen())setWeapon(P.wpn+(e.deltaY>0?1:-1))},{passive:true});
document.addEventListener('pointerlockchange',()=>{if(TOUCH||iso||story.invOpen()||hud.bigmapOn()||performance.now()-mapClosedT<500)return;   // setting up a match / roulette is not a pause
  if(!document.pointerLockElement&&state==='play'&&!paused)setPaused(true)});
document.addEventListener('visibilitychange',()=>{if(TOUCH&&document.hidden&&state==='play'&&!paused)setPaused(true)});   // app switched / screen off
addEventListener('contextmenu',e=>e.preventDefault());
addEventListener('keydown',e=>{if(e.code==='KeyU'&&!e.repeat&&!e.ctrlKey&&!e.altKey&&!e.metaKey&&state==='play'&&!paused&&!/INPUT|TEXTAREA|SELECT/.test((e.target&&e.target.tagName)||'')){lookHeld=true;lookYaw=P.camYaw}});   // hold U: landscape view behind the cat
addEventListener('keyup',e=>{if(e.code==='KeyU')lookHeld=false});addEventListener('blur',()=>{lookHeld=false});
addEventListener('pointermove',e=>{if((mkOn||selOn())&&e.buttons&&e.target.id==='c'){spin+=e.movementX*.01;spinHeld=true}});addEventListener('pointerup',()=>spinHeld=false);
// ---- menu flow: Title (Play / Settings / Exit) -> Character slots -> [Character maker if new] -> Mode select -> game
function hideMenus(){stageOff();MENUS.forEach(m=>$('#'+m).hidden=true);$('#menuBack').hidden=true}
function showMenu(w){if(w!=='slots')stageOff();MENUS.forEach(m=>$('#'+m).hidden=m!==w);$('#menuBack').hidden=!(w==='slots'||w==='worlds'||w==='wnew')}   // one shared Back button: switching slots <-> modes never re-animates it
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const headHTML=c=>{const u=headIconURL(c);return u?`<img src="${u}" alt="" draggable="false">`:''};   // 3D head of the cat (falls back to a coat-coloured dot)
// My Character tile: the WHOLE cat as a black front-facing silhouette with white eyes, playing its real idle animation (js/charIcon.js makes one sprite sheet, CSS plays it back and forth).
// Built right AFTER the menu is on screen (a few hundred ms, once per cat look), so the cards' pop-in never stutters. Falls back to the old head picture.
let silTok=0;
function showSil(c){
  const hd=$('#modeHd'),tok=++silTok;if(!hd)return;   // (the text menu has no picture of the cat)
  const put=f=>{
    if(tok!==silTok)return;                                   // the player picked another cat meanwhile
    hd.className='hd';hd.style.cssText='';hd.textContent='';
    if(f){const w=document.createElement('span'),i=document.createElement('i');w.className='chi';w.style.cssText=`--n:${f.n};--m:${f.n-1};--ar:${f.ar};--dur:${f.dur}s`;i.style.backgroundImage=`url(${f.sheet})`;w.appendChild(i);hd.appendChild(w);return}
    const h=headHTML(c);hd.className='hd fb';hd.innerHTML=h;if(!h)hd.style.cssText=dotBg(c)};
  const f=charIconCached(c);
  if(f){put(f);return}
  hd.className='hd';hd.style.cssText='';hd.textContent='';
  setTimeout(()=>{let r=null;try{r=charIconFrames(c)}catch(e){console.warn(e)}put(r)},80)}
const dotBg=c=>`background:radial-gradient(circle at 35% 30%,${c.pat||'#ee9a48'} 0 28%,${c.fur||'#f6dfbd'} 30%)`;
// ---- MY CHARACTER: arrows flip through your cats, the last page is one empty slot shown as a black cat -> Create Character (opens the cat maker)
let selList=[],selPos=0;
const BLACK=new T.MeshBasicMaterial({color:'#050505'});
function blackOut(o){o.traverse(m=>{if(m.isMesh)m.material=Array.isArray(m.material)?m.material.map(()=>BLACK):BLACK})}   // silhouette
function drawSel(){
  const i=selList[selPos],c=slots[i];
  $('#chName').textContent=c?(c.cfg.name||'Ming'):'New Cat';
  $('#chSub').textContent=c?`BEST ${c.best||0}  \u00b7  SLOT #${i+1}`:`EMPTY SLOT #${i+1}`;
  $('#chDots').innerHTML=selList.map((_,k)=>`<i${k===selPos?' class="on"':''}></i>`).join('');
  $('#chSel').hidden=$('#chEdit').hidden=$('#chDel').hidden=!c;$('#chNew').hidden=!!c;
  const picked=!!c&&i===curSlot,sb=$('#chSel');sb.classList.toggle('green',!picked);sb.classList.toggle('gold',picked);sb.classList.toggle('picked',picked);
  sb.innerHTML=picked?'<i class="bi bi-check-circle-fill"></i>Picked':'<i class="bi bi-check-lg"></i>Select';   // the cat you are playing says Picked
  $('#chL').hidden=$('#chR').hidden=selList.length<2;
  cfg=c?JSON.parse(JSON.stringify(c.cfg)):{};setCat();if(!c)blackOut(cat);stageOn(cfg,!c)}
function renderSlots(idx){   // idx = slot to land on (default: the cat you are playing)
  selList=[];slots.forEach((c,i)=>{if(c)selList.push(i)});const e=slots.findIndex(x=>!x);if(e>=0)selList.push(e);
  const p=selList.indexOf(idx===undefined?curSlot:idx);selPos=p>=0?p:Math.min(selPos,selList.length-1);
  clearAll();refill();equipIdx(0);Object.assign(P,{x:0,z:0,camYaw:0,viewYaw:0,camPitch:0,hp:P.max,dead:false,inv:0,roll:0,rcd:0,scope:false,kick:0,dash:0});resetAir();mouse.l=false;   // stop the demo fight, cat stands still
  drawSel()}
const selMove=d=>{if(selList.length<2)return;selPos=(selPos+d+selList.length)%selList.length;drawSel();
  ['#chName','#chSub'].forEach((q,k)=>{const e=$(q);e.animate&&e.animate([{opacity:0,scale:.7},{opacity:1,scale:1.08,offset:.6},{opacity:1,scale:1}],{duration:320,delay:k*50,easing:'ease-out',fill:'backwards'})})};
function restoreCur(){cfg=slots[curSlot]?JSON.parse(JSON.stringify(slots[curSlot].cfg)):{};setCat()}   // leaving without choosing: the cat you were playing comes back

function selectSlot(i){curSlot=i;try{localStorage.setItem('sad.lastSlot',i)}catch(e){}cfg=JSON.parse(JSON.stringify(slots[i].cfg));best=slots[i].best||0;setCat();$('#bestT').textContent=best;$('#modeName').textContent=cfg.name||'Ming';
  showMenu('modes')}
// ---- TAP TO PLAY: tap anywhere on the title. Straight to the main menu with your last cat; with no cat yet, the "Create your own character" modal comes first.
const hasChar=()=>slots.some(Boolean);
function enterMain(){
  const ls=parseInt(localStorage.getItem('sad.lastSlot'),10),i=slots[ls]?ls:slots.findIndex(Boolean);
  selectSlot(i);const b=$('#menuBack');b.classList.remove('in');void b.offsetWidth;b.classList.add('in')}   // the Back button swipes in when you leave the title
$('#title').addEventListener('click',e=>{if(e.target.closest('#install'))return;if(!hasChar()){$('#newcat').hidden=false;return}enterMain()});
$('#ncGo').onclick=()=>{$('#newcat').hidden=true;openCreator(0,true)};   // modal -> cat maker (slot 1); saving it lands in the main menu
$('#ncBack').onclick=()=>{$('#newcat').hidden=true};
$('#menuBack').addEventListener('animationend',e=>e.currentTarget.classList.remove('in'));
$('#menuBack').onclick=()=>{if(!$('#wnew').hidden){story.renderWorlds();showMenu('worlds');return}if(!$('#worlds').hidden){showMenu('modes');return}
  if(!$('#slots').hidden){   // My Character -> back to the main menu (with the current cat, or the first one that is left after a delete)
    if(!slots[curSlot]){const j=slots.findIndex(Boolean);if(j<0){cfg={};setCat();showMenu('title');return}selectSlot(j);return}
    restoreCur();showMenu('modes');return}
  showMenu('title')};   // main menu -> TAP TO PLAY
$('#mPlay').onclick=()=>story.play();   // Play = story mode: the 3 world slots (js/storyMode.js)
$('#mExit').onclick=()=>showMenu('title');   // Exit = back to TAP TO PLAY
$('#chL').onclick=()=>selMove(-1);$('#chR').onclick=()=>selMove(1);
$('#chSel').onclick=()=>selectSlot(selList[selPos]);
$('#chNew').onclick=()=>openCreator(selList[selPos]);
$('#chEdit').onclick=()=>openCreator(selList[selPos]);
$('#chDel').onclick=()=>{const i=selList[selPos];if(confirm('Delete '+(slots[i].cfg.name||'this cat')+'? This cannot be undone.')){slots[i]=null;if(i===curSlot)curSlot=-1;saveSlots();renderSlots(i)}};
addEventListener('keydown',e=>{   // left / right (A D) flip through the cats directly, before the menu navigation sees the key
  if(!selOn()||e.ctrlKey||e.altKey||e.metaKey||/INPUT|TEXTAREA/.test(e.target.tagName||''))return;
  const L=e.code==='ArrowLeft'||e.code==='KeyA',R=e.code==='ArrowRight'||e.code==='KeyD';if(!L&&!R)return;
  e.preventDefault();e.stopImmediatePropagation();selMove(L?-1:1)},true);
$('#mChar').onclick=()=>{renderSlots();showMenu('slots')};   // My Character = the save slots (switch / edit / create / delete)
$('#home').onclick=enterTitle;$('#resume').onclick=()=>setPaused(false);$('#pgfx').onclick=()=>gfx.open();$('#gfxOpen').onclick=()=>gfx.open();$('#quit').onclick=enterTitle;
function openCreator(slotIdx,fromTitle){
  // the title battlefield keeps running live behind the maker (the demo cat keeps fighting): only the cfg, the camera angle and the side of the screen change
  const prevCfg=cfg;cfg=slots[slotIdx]?JSON.parse(JSON.stringify(slots[slotIdx].cfg)):{};mkOn=true;setCat();hideMenus();spin=0;spinHeld=false;camAz=camTo=0;viewTo=.17;   // cat glides to the left, the panel is on the right
  const close=()=>{mkOn=false;camTo=0;spin=0;viewTo=0;casts(cat)};   // back to the centred drone shot
  openMaker(cfg,{change:c=>{cfg=c},view:a=>camTo=a,
    done:()=>{cfg.name=cfg.name||'Ming';slots[slotIdx]={cfg:JSON.parse(JSON.stringify(cfg)),best:slots[slotIdx]?slots[slotIdx].best:0};saveSlots();close();
      if(fromTitle){selectSlot(slotIdx);return}   // first cat ever (tutorial modal) -> straight to the main menu
      if(slotIdx===curSlot)selectSlot(slotIdx);   // you edited the cat that is in use: refresh it everywhere (name, look, save)...
      renderSlots(slotIdx);showMenu('slots')},   // ...but stay in My Character
    cancel:()=>{cfg=prevCfg;setCat();close();if(fromTitle&&!hasChar())showMenu('title');else{renderSlots(slotIdx);showMenu('slots')}}})};
// ---- keyboard navigation for every menu screen (title, slots, worlds, modes, pause, game over, settings, cat maker):
// W A S D / arrow keys jump to the nearest item in that direction, Enter or E accepts, Esc goes back (Left/Right also adjust a slider).
// It only listens while one of those screens is up, so the in-game controls are never touched.
(function(){
  const q=s=>[...document.querySelectorAll(s)],hint=$('#kbhint');
  const vis=e=>{if(!e||e.hidden)return false;const s=getComputedStyle(e);return s.display!=='none'&&s.visibility!=='hidden'&&parseFloat(s.opacity)>.05};
  const touchy=()=>document.body.classList.contains('mobile')||matchMedia('(hover:none)').matches||matchMedia('(pointer:coarse)').matches||matchMedia('(max-width:900px) and (max-height:520px)').matches;   // phones / tablets: no key guide
  const UP=['KeyW','ArrowUp'],DN=['KeyS','ArrowDown'],LT=['KeyA','ArrowLeft'],RT=['KeyD','ArrowRight'],OK=['Enter','NumpadEnter','KeyE'],BACK=['Escape','Backspace'];
  const SEL={title:'#title button',newcat:'#newcat button',slots:'#slots button',worlds:'#worlds .cslot,#worlds .cslot button',wnew:'#wnew input[type=text],#wnew .dopt,#wnew .btn',modes:'#modes .ti',pvp:'#pvp .mode',search:'#search input[type=text],#search .btn',lobby:'#lobby .cslot,#lobby .cslot button,#lobby .btn',over:'#over button',pause:'#pause button',
    settings:'#gfx button,#gfx input[type=range]',maker:'#maker button,#maker input'};
  const BACKS=new Set(['slots','worlds','wnew','modes','pvp','search','lobby','newcat','settings','maker']);
  function screen(){
    const L=$('#loading');if(L&&!L.classList.contains('out'))return null;
    if(document.pointerLockElement)return null;                          // mouse captured = you are playing, never a menu
    if(state==='play'&&!paused&&!vis($('#gfx')))return null;   // in a match (roguelike, story, 5v5): no menu, no key guide
    if(vis($('#gfx')))return 'settings';
    if(mkOn||vis($('#maker')))return 'maker';
    if(vis($('#newcat')))return 'newcat';
    if(vis($('#pause')))return 'pause';
    if(vis($('#over')))return 'over';
    for(const s of ['wnew','pvp','search','lobby','slots','worlds','modes','title'])if(vis($('#'+s)))return s;
    return null}
  const items=sc=>sc?q(SEL[sc]).filter(e=>e.getClientRects().length>0&&!e.disabled):[];
  const isText=e=>!!e&&((e.tagName==='INPUT'&&e.type==='text')||e.tagName==='TEXTAREA'||e.tagName==='SELECT');
  // a stable identity, so the selection survives a menu re-rendering itself (the cat maker rebuilds all its tiles on every pick)
  const keyOf=e=>{const p=e.parentNode&&e.parentNode.dataset||{},d=e.dataset||{},sl=e.closest&&e.closest('.cslot');
    return [e.id,d.tab,d.bind,d.p,d.act,d.a,d.v,p.k||p.x||p.c||p.g,sl?sl.dataset.i:'',e.className&&String(e.className).replace(/\bkbf\b/,'').trim()].join('|')};
  let cur=null,curKey='',kbUsed=false,lastSc=null;
  function ensure(sc){
    if(sc!==lastSc){lastSc=sc;cur=null;curKey=''}
    const list=items(sc);if(!list.length){cur=null;return list}
    if(!cur||!cur.isConnected||!list.includes(cur)){cur=(curKey&&list.find(e=>keyOf(e)===curKey))||list.find(e=>!isText(e))||list[0];curKey=keyOf(cur)}
    return list}
  function apply(){
    const sc=screen();
    if(hint){hint.hidden=!sc||touchy();hint.dataset.s=sc||'';hint.dataset.back=BACKS.has(sc)?'1':'0'}
    ensure(sc);
    q('.kbf').forEach(e=>{if(e!==cur||!kbUsed)e.classList.remove('kbf')});
    if(cur&&kbUsed&&sc&&!cur.classList.contains('kbf')){cur.classList.add('kbf');cur.scrollIntoView({block:'nearest',inline:'nearest'})}
    if(cur&&kbUsed&&sc&&isText(cur)&&document.activeElement!==cur)cur.focus();
    else if(kbUsed&&sc&&document.activeElement&&isText(document.activeElement)&&document.activeElement!==cur)document.activeElement.blur()}
  let raf=0;const later=()=>{cancelAnimationFrame(raf);raf=requestAnimationFrame(apply)};
  document.addEventListener('pointerlockchange',later);setInterval(apply,250);   // a match starting / mouse capture is not a DOM change, so also re-check a few times a second
  new MutationObserver(later).observe(document.body,{subtree:true,attributes:true,attributeFilter:['hidden','class']});
  new MutationObserver(later).observe(document.body,{childList:true});
  ['#slotList','#worldList','#lbA','#lbB','#lbFoot','#maker','#gfx'].forEach(s=>{const e=$(s);e&&new MutationObserver(later).observe(e,{childList:true,subtree:s==='#maker'||s==='#gfx'})});
  addEventListener('mousemove',e=>{if(kbUsed&&Math.abs(e.movementX)+Math.abs(e.movementY)>3){kbUsed=false;apply()}},{passive:true});
  // nearest item in a direction (centres; items right ahead win over ones off to the side)
  const mid=e=>{const r=e.getBoundingClientRect();return [r.left+r.width/2,r.top+r.height/2]};
  function nearest(list,from,dx,dy){
    const [fx,fy]=mid(from);let b1=null,s1=1e9,b2=null,s2=1e9;
    for(const e of list){if(e===from)continue;const [x,y]=mid(e),vx=x-fx,vy=y-fy,al=vx*dx+vy*dy,pp=Math.abs(vx*dy-vy*dx);if(al<=4)continue;
      const a=al+3*pp,b=al+6*pp;if(pp<=al*2&&a<s1){s1=a;b1=e}if(b<s2){s2=b;b2=e}}
    return b1||b2}
  function bump(el,dir){const st=+el.step||1,span=(+el.max)-(+el.min),d=Math.max(st,Math.round(span/20/st)*st),v=Math.max(+el.min,Math.min(+el.max,+el.value+dir*d));
    if(v===+el.value)return;el.value=v;el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}))}
  const backBtn=sc=>sc==='newcat'?$('#ncBack'):sc==='maker'?$('#maker [data-a="cancel"]'):sc==='settings'?$('#gDone'):BACKS.has(sc)?$('#menuBack'):null;
  addEventListener('keydown',e=>{
    if(e.ctrlKey||e.altKey||e.metaKey)return;
    const sc=screen();if(!sc)return;
    const c=e.code,tg=e.target,typing=isText(tg),nav=UP.includes(c)||DN.includes(c)||LT.includes(c)||RT.includes(c);
    if(typing){                                   // typing a name: only Enter / Esc / up / down leave the box
      if(c==='Enter'||c==='NumpadEnter'||c==='Escape'){tg.blur();e.preventDefault();e.stopImmediatePropagation();return}
      if(c!=='ArrowUp'&&c!=='ArrowDown')return;
      cur=tg;curKey=keyOf(tg);tg.blur();kbUsed=true}
    let handled=true;const list=ensure(sc);
    if(OK.includes(c)){
      if(!e.repeat&&cur){kbUsed=true;if(isText(cur))cur.focus();else if(cur.type!=='range')cur.click();later()}
    }else if(BACK.includes(c)){
      const b=backBtn(sc);if(!b)handled=false;else if(!e.repeat)b.click()
    }else if(nav){
      const dx=RT.includes(c)?1:LT.includes(c)?-1:0,dy=DN.includes(c)?1:UP.includes(c)?-1:0;
      if(!kbUsed)kbUsed=true;                                                // first press just shows the highlight
      else if(cur){
        if(cur.type==='range'&&dx)bump(cur,dx);
        else{const n=nearest(list,cur,dx,dy);if(n){cur=n;curKey=keyOf(n)}}}
      apply()
    }else handled=false;
    if(handled){e.preventDefault();e.stopImmediatePropagation()}               // keep the menu keys away from the game handler
  },true);
  apply();
  const rk=$('#rkpill');                                                          // the 5v5 card shows no rank icon / emoji, only the text and bar
  if(rk){const strip=()=>{const f=[...rk.querySelectorAll('*')].find(e=>/^(IMG|SVG|CANVAS)$/i.test(e.tagName)||(!e.children.length&&e.textContent.trim()&&e.textContent.trim().length<=3&&!/[A-Za-z0-9]/.test(e.textContent)));if(f&&f.style.display!=='none')f.style.display='none'};
    new MutationObserver(strip).observe(rk,{childList:true,subtree:true});strip()}
})();
