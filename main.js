import * as T from 'three';
import {createCatAvatar} from './js/catAvatar.js';
import {buildMap} from './js/forestMap.js';
import {buildArena,ARENA_THEMES} from './js/arenaMap.js';
import {spinRoulette} from './js/weaponRoulette.js';
import {buildEnemy,STATS} from './js/enemies/index.js';
import {openMaker} from './js/catMaker.js';
import {createFX} from './js/effects.js';
import {createAtmosphere} from './js/atmosphere.js';
import {createHUD} from './js/hud.js';
import {WEAPONS} from './js/weapons/index.js';
import {createSettings} from './js/settings.js';
import {createRoguelike} from './js/roguelike.js';   // roguelike mode: waves, enemy spawning, per-wave weapon roulette
import {createMode5v5} from './js/5v5.js';
import {near,blocked,segBlocked} from './js/obsGrid.js';
import {patchCat} from './js/enemies/playersAi.js';
import {createMobile,isMobile} from './js/mobile.js';
import {createGamepad} from './js/gamepad.js';   // controller support (Settings > Controls > Controller)
import {createNet} from './js/net.js';             // PVP: WebRTC (PeerJS) peer-to-peer, no game server
import {createPvpLobby} from './js/pvpLobby.js';   // ... Host / Join / lobby screens
import {renderPill} from './js/rank.js';
import {createAudio} from './js/audio.js';
import {createKeybinds} from './js/keybinds.js';
import {headIconURL} from './js/headIcon.js';
import {charIconFrames,charIconCached,charRunFrames} from './js/charIcon.js';
import {loading} from './js/loadingScreen.js';          // reusable loading screen (boot + world generation)
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
const renderer=new T.WebGLRenderer({antialias:!IOS,alpha:true,canvas:$('#c')});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setClearColor(0,0);
const scene=new T.Scene();
const cam=new T.PerspectiveCamera(70,1,.1,480),fx=createFX(scene),tmp=new T.Vector3(),fp=new T.Vector3();
const atm=createAtmosphere(renderer,scene,cam);let curMode='';
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
  const f = cam.userData.off || 0;
  f ? cam.setViewOffset(w, h, w * f, 0, w, h) : cam.clearViewOffset();
  cam.updateProjectionMatrix();
}
let viewTo=0;function setView(f){viewTo=f;cam.userData.off=f;resize()}resize();
L.set(.26,'Growing the forest…');await tick();
const forest=buildMap(7,atm.envMap);scene.add(forest.group);forest.prime(0,0,60);if(scene.fog){scene.fog.near=30;scene.fog.far=150}   // chunk-streamed hilly forest: build around the start, the rest streams in
let map=forest,arena=null,mode5=null,story=null;const lastQ={};   // story = js/storyMode.js (created below, once everything it needs exists)
fx.setGround((x,z)=>map.heightAt(x,z));   // shells / embers / chips land on the real terrain (forest or arena)
{const fq=forest.setQuality;forest.setQuality=q=>{Object.assign(lastQ,q);fq(q);arena&&arena.setQuality(q);story&&story.setQuality(q)}}   // graphics options also reach the 5v5 arena
const audio=createAudio();
const kb=createKeybinds(()=>{for(const k in keys)keys[k]=false;hints()});   // remappable PC keys (js/keybinds.js); the game keeps reading the default codes, `kb.canon` translates
function hints(){const k=a=>kb.label(a),e=document.querySelector('#title .kb');if(e)e.innerHTML=`<b>${k('fwd')}${k('left')}${k('back')}${k('right')}</b> move &nbsp;·&nbsp; <b>Mouse</b> aim<br><b>Left click</b> shoot / slash &nbsp;·&nbsp; <b>Right click</b> scope<br><b>${k('jump')}</b> jump &nbsp;·&nbsp; <b>${k('roll')}</b> roll / air dash &nbsp;·&nbsp; <b>1-8 / wheel</b> weapon &nbsp;·&nbsp; <b>Esc</b> pause &nbsp;·&nbsp; <b>${k('settings')}</b> settings<br><b>5v5:</b> hold <b>${k('plant')}</b> to plant / defuse the spike`}
gfx=createSettings({atm,map,audio,kb,onResolution:resize,getMobile:()=>{try{return mobile}catch(e){return null}},getPad:()=>{try{return pad}catch(e){return null}}});   // `mobile` is created further down (touch layout editor lives in Settings > Controls)   // graphics options (presets + per-option, saved, applied live)
const KC={frog:'#6fd36b',rabbit:'#d9c3a0',spider:'#6a4c9a',bee:'#ffd23a'};
let cfg=JSON.parse(localStorage.getItem('sad.cat')||'{}'),cat,state='title',clock=0,paused=false,spin=0,spinHeld=false,run=false,ang=0,backup=null,gunUntil=0,mkOn=false,camAz=0,camTo=0;
// title / main menu camera = a fixed-angle DRONE SHOT (no rotation). drone fades 1 -> 0 while the cat maker is open (it keeps its own camera) and snaps to 0 in a match.
const DRONE={dist:15,pit:-.82,yaw:.6,fov:58,lift:3.2};let drone=1;const dp={x:0,z:0};
const selOn=()=>!$('#slots').hidden;   // My Character screen open = catMaker camera, centred, cat standing still in front of you
const IDLE={f:0,s:0,atk:false,roll:false};   // dp = smoothed point the drone hovers over (it glides after the cat instead of being glued to it)
// ---- character save slots (5): { cfg, best } or null. Old single-cat saves migrate into slot 1.
const SLOTN=5;let curSlot=-1;
function loadSlots(){let s=null;try{s=JSON.parse(localStorage.getItem('sad.slots'))}catch(e){}
  if(!Array.isArray(s)){s=[];try{const c=JSON.parse(localStorage.getItem('sad.cat')||'null');if(c&&Object.keys(c).length)s[0]={cfg:c,best:+localStorage.getItem('sad.best')||0}}catch(e){}}
  s=s.slice(0,SLOTN).map(x=>x&&x.cfg?x:null);while(s.length<SLOTN)s.push(null);return s}
const MENUS=['title','slots','modes','worlds','wnew','pvp','search','lobby'];let lobby=null;   // lobby = the PVP LOCAL screens (created further down); declared here because enterTitle() runs during start-up   // declared up here: enterTitle() runs during start-up, before the menu code further down
let slots=loadSlots();const saveSlots=()=>localStorage.setItem('sad.slots',JSON.stringify(slots));
let gm='wave',best=+localStorage.getItem('sad.best')||0;
const P={x:0,z:0,hp:5,max:5,inv:0,cd:0,mv:false,aim:0,shake:0,hx:0,hz:0,rel:1,camDist:2.8,camYaw:0,camPitch:0,roll:0,rcd:0,rdx:0,rdz:1,kick:0,wpn:0,blink:0,scope:false,hs:0,dash:0,dx:0,dz:1,fwd:0,side:0,viewYaw:0,chain:0,chainT:0,dead:false,frozen:false,gy:0,y:0,vy:0,jy:0,ey:0,air:false,canDash:true,ad:0,fk:0},bullets=[],ebul=[],enemies=[],pickups=[],keys={},mouse={l:false};
// ---- ROGUELIKE (endless waves + weapon roulette) lives in js/roguelike.js; main.js only feeds it the shared game objects
const rogue=createRoguelike({P,enemies,ebul,scene,fx,hud,audio,WEAPONS,buildEnemy,STATS,getMap:()=>map,getBest:()=>best,equipIdx:i=>equipIdx(i),casts:o=>casts(o),prepare:()=>beginRun()});
const bGeo=new T.SphereGeometry(.14,8,8),bMat=new T.MeshBasicMaterial({color:'#ffe066'}),eMat=new T.MeshBasicMaterial({color:'#ff7a3c'});
const hs=new T.Shape();hs.moveTo(.25,.25);hs.bezierCurveTo(.25,.25,.2,0,0,0);hs.bezierCurveTo(-.3,0,-.3,.35,-.3,.35);hs.bezierCurveTo(-.3,.55,-.15,.77,.25,.95);hs.bezierCurveTo(.65,.77,.8,.55,.8,.35);hs.bezierCurveTo(.8,.35,.8,0,.5,0);hs.bezierCurveTo(.35,0,.25,.25,.25,.25);
const heartGeo=new T.ExtrudeGeometry(hs,{depth:.25,bevelEnabled:true,bevelSize:.06,bevelThickness:.06,bevelSegments:3});heartGeo.translate(-.25,-.5,-.12);heartGeo.scale(.5,.5,.5);const heartMat=new T.MeshStandardMaterial({color:'#ff4d6d',roughness:.5,emissive:'#ff2a52',emissiveIntensity:.35});
const casts=o=>o.traverse(m=>{if(m.isMesh){m.castShadow=true;m.receiveShadow=true}});
const WP=()=>WEAPONS[P.wpn],isGunW=()=>WP().kind==='gun';
// ---- ammo / reload: a gun whose stats have `mag` uses a magazine (R or the mobile R button reloads, an empty magazine reloads by itself); `reload` = seconds. No `mag` = unlimited ammo.
const ammo=WEAPONS.map(w=>w.stats.mag||0),RL={t:0,dur:1};
const hasMag=()=>isGunW()&&!!WP().stats.mag,refill=()=>{WEAPONS.forEach((w,i)=>ammo[i]=w.stats.mag||0);RL.t=0};
function reload(){if(state!=='play'||paused||!hasMag()||RL.t>0||P.dead||P.frozen||ammo[P.wpn]>=WP().stats.mag)return;RL.t=RL.dur=WP().stats.reload||1.2;P.scope=false}
const hudAmmo=()=>!P.unarmed&&hasMag()?hud.ammo(ammo[P.wpn],WP().stats.mag,RL.t>0?1-RL.t/RL.dur:-1):hud.ammo(0,0,-1);
function equipIdx(i){P.wpn=i;P.scope=false;RL.t=0;cat.userData.equip(WEAPONS[i]);hud.weapon(i);hudAmmo()}
function setCat(){if(cat){cat.userData.dispose&&cat.userData.dispose();scene.remove(cat)}cat=createCatAvatar(cfg);patchCat(cat);casts(cat);scene.add(cat);hud.name(cfg.name);cat.userData.onSlashHit=meleeHit;cat.userData.fx=fx;cat.userData.equip(WP());hud.weapon(P.wpn)}
function setWeapon(i){if(P.unarmed||rogue.locked()||(story&&story.invOpen()))return;i=(i+WEAPONS.length)%WEAPONS.length;const lo=(gm==='v5'||gm==='story'||rogue.active())&&P.loadout;if(lo&&!lo.includes(i))i=lo[0]===P.wpn?lo[1]:lo[0];   // 5v5: wheel / buttons just flip between your two roulette weapons
  if(state!=='play'||paused||P.roll>0||P.wpn===i)return;equipIdx(i)}
function meleeHit(d){const st=WP().stats,fx_=Math.sin(P.camYaw),fz_=Math.cos(P.camYaw);let hitAny=false,kill=false;
  enemies.forEach(e=>{const dx=e.x-P.x,dz=e.z-P.z,dist=Math.hypot(dx,dz)||1;if(e.dodge<=0&&dist<st.range+e.r&&(dx*fx_+dz*fz_)/dist>st.arc){e.hp-=st.dmg;if(e.hp<=0)kill=true;e.hbT=2.5;e.fl=.2;e.sf=.34;e.stun=.3;e.alert=6;e.x+=dx/dist*1.4;e.z+=dz/dist*1.4;const hp_=new T.Vector3(e.x,(e.gy||0)+.9,e.z);fx.slashHit(hp_,P.camYaw,d,st.slashColor||'#ffe8a8',e.hp<=0?1.35:1);hitAny=true}});
  for(let i=ebul.length-1;i>=0;i--){const b=ebul[i],p=b.m.position;if(Math.hypot(p.x-P.x,p.z-P.z)<Math.min(2.4,st.range)){fx.hit(p,'#ffd8a0',5);scene.remove(b.m);ebul.splice(i,1)}}
  if(gm==='v5'){const r=mode5.playerMelee(fx_,fz_,d,st.slashColor||'#ffe8a8');if(r){hitAny=true;if(r===2)kill=true}}
  P.shake=Math.max(P.shake,hitAny?(kill?.75:.5):.12);if(hitAny){P.hs=Math.max(P.hs,kill?.15:.1);hud.hit(false);audio.play('hit')}}   // melee hit: spark + screenshake + a short hit-lag freeze
// ---- jump: P.y = feet height (world), P.vy = vertical speed, P.jy = height above the ground. Roll pressed in the air = air dash (once per jump).
const JUMP_V=7.8,JUMP_G=21,DASH_T=.3,DASH_V=17;
function resetAir(){P.air=false;P.vy=0;P.jy=0;P.ad=0;P.canDash=true;P.fk=0}
function jump(){if(state!=='play'||paused||P.air||P.roll>0||P.dead||P.frozen)return;P.air=true;P.vy=JUMP_V;P.canDash=true;P.y=P.gy;P.scope=false;
  cat.userData.jump&&cat.userData.jump();fx.jump(fp.set(P.x,P.gy+.12,P.z));audio.play('slash',{vol:.22,pitch:1.6})}
function airDash(){if(!P.canDash||P.ad>0)return;P.canDash=false;let f=P.fwd,s=P.side;if(!f&&!s)f=1;
  const fxv=Math.sin(P.camYaw),fzv=Math.cos(P.camYaw),rx=-Math.cos(P.camYaw),rz=Math.sin(P.camYaw);let dx=fxv*f+rx*s,dz=fzv*f+rz*s;const l=Math.hypot(dx,dz)||1;
  P.rdx=dx/l;P.rdz=dz/l;P.ad=DASH_T;P.vy=0;P.rcd=.8;P.inv=Math.max(P.inv,DASH_T);P.scope=false;P.shake=Math.max(P.shake,.15);
  cat.userData.airDash&&cat.userData.airDash(f,s);fx.airDash(fp.set(P.x,P.y+.7,P.z),P.rdx,P.rdz);audio.play('slash',{vol:.35,pitch:1.9})}
function tumble(){if((state!=='play'&&state!=='title')||paused||P.roll>0||P.rcd>0||P.dead||P.frozen)return;if(P.air){airDash();return}let f=P.fwd,s=P.side;if(!f&&!s)f=1;
  const fxv=Math.sin(P.camYaw),fzv=Math.cos(P.camYaw),rx=-Math.cos(P.camYaw),rz=Math.sin(P.camYaw);let dx=fxv*f+rx*s,dz=fzv*f+rz*s;const l=Math.hypot(dx,dz)||1;
  if(cat.userData.tumble(f,s)){P.roll=.55;P.rcd=.95;map.ripple(P.x,P.z,1.8);P.rdx=dx/l;P.rdz=dz/l;P.inv=Math.max(P.inv,.55);P.scope=false;fx.dash(fp.set(P.x,P.gy+.12,P.z),P.rdx,P.rdz)}}
function hudAll(){rogue.hudAll()}
const TOUCH=isMobile();   // phones / tablets / installed Android app: touch controls, no mouse capture
function lockPtr(){if(TOUCH)return;try{const r=$('#c').requestPointerLock&&$('#c').requestPointerLock();r&&r.catch&&r.catch(()=>{})}catch(e){}}
function setPaused(v){paused=v;hud.pause(v);if(v){mouse.l=false;P.scope=false;document.exitPointerLock&&document.exitPointerLock()}else lockPtr()}
function clearAll(){fx.clearMarks();[enemies,pickups].forEach(a=>{a.forEach(e=>scene.remove(e.g||e.m));a.length=0});[bullets,ebul].forEach(a=>{a.forEach(b=>scene.remove(b.m));a.length=0})}
function push(o,rad){for(const r of near(map.obs,o.x,o.z)){const dx=o.x-r.x,dz=o.z-r.z,d=Math.hypot(dx,dz),m=r.r+rad;if(d<m&&d>0){o.x=r.x+dx/d*m;o.z=r.z+dz/d*m}}}
function enterTitle(){lobby&&lobby.leave();leave5();clearAll();refill();state='title';paused=false;mouse.l=false;document.exitPointerLock&&document.exitPointerLock();
  P.x=0;P.z=0;dp.x=0;dp.z=0;P.hp=P.max;P.inv=0;P.roll=0;P.rcd=0;P.scope=false;resetAir();P.kick=0;P.camYaw=0;P.viewYaw=0;P.camPitch=0;P.dash=0;rogue.demoReset();bot.t=0;bot.wt=0;hud.show(false);
  equipIdx(0);setView(0);$('#over').hidden=true;showMenu('title');$('#bestT').textContent=best;renderPill($('#rkpill'))}   // rank card on the title (refreshes after every ranked match)
function beginRun(){leave5();clearAll();refill();P.x=0;P.z=0;P.hp=P.max;P.inv=0;paused=false;state='play';['#title','#over'].forEach(s=>$(s).hidden=true);hud.reset();hud.show(true);hud.pause(false);P.roll=0;P.rcd=0;P.scope=false;resetAir();P.kick=0;P.camYaw=0;P.viewYaw=0;P.camPitch=0;P.chain=0;P.chainT=0;mouse.l=false;setView(0);lockPtr();hud.name(cfg.name)}   // shared start-of-run reset; rogue.start() calls it, then rolls the first weapon
function hurt(){if(P.inv>0)return;if(state==='title'){P.inv=.8;P.shake=Math.max(P.shake,.15);return}
  hud.hurt();P.hp--;P.inv=1.2;P.blink=1.2;P.shake=.4;hudAll();if(P.hp<=0){rogue.cancel();audio.play('lose');state='over';mouse.l=false;document.exitPointerLock&&document.exitPointerLock();best=Math.max(best,rogue.R.score);localStorage.setItem('sad.best',best);if(slots[curSlot]){slots[curSlot].best=best;saveSlots()}hud.show(false);$('#over').hidden=false;
  $('#sW').textContent=rogue.R.wave;$('#sK').textContent=rogue.R.kills;$('#sS').textContent=rogue.R.score;$('#best').textContent='Best: '+best}}
function shoot(){const w=WP(),st=w.stats;
  if(st.mag&&state!=='title'){if(RL.t>0)return;if(ammo[P.wpn]<=0){reload();return}ammo[P.wpn]--;if(ammo[P.wpn]<=0)reload()}   // the title-screen demo has unlimited ammo
  P.cd=st.cd;cat.userData.kick(st.kick||1);if(state!=='title'){const s=w.sfx||{};audio.play(s.shoot||'shoot',{vol:s.vol,pitch:s.pitch})}   // title-screen demo bot stays quiet
  const o=cat.userData.muzzle(tmp);const sc=cat.userData.scope();
  // aim at the point under the crosshair (11 units ahead on the view line), so bullets follow the crosshair up and down too
  const cp=Math.cos(P.camPitch),tx=P.x+Math.sin(P.camYaw)*cp*11,ty=1+P.ey+Math.sin(P.camPitch)*11,tz=P.z+Math.cos(P.camYaw)*cp*11;
  let ax=tx-o.x,ay=ty-o.y,az=tz-o.z;const al=Math.hypot(ax,ay,az)||1;ax/=al;ay/=al;az/=al;
  const baseYaw=Math.atan2(ax,az),baseEl=Math.asin(ay),sp=st.speed,fast=sp>=30;   // fast guns fire slim needle rounds with a long streak tail + a line of light behind them
  for(let n=0;n<(st.pellets||1);n++){
    const k=st.spread*(1-sc*(st.scopeSteady??.7)),yaw=baseYaw+(Math.random()-.5)*k,el=baseEl+(Math.random()-.5)*k*.5,ce=Math.cos(el),m=fx.bullet(st.color,sp);
    m.position.copy(o);m.rotation.order='YXZ';m.rotation.set(-el,yaw,0);if(fast)m.scale.setScalar(.8);else if(st.size)m.scale.setScalar(st.size);scene.add(m);
    bullets.push({m,vx:Math.sin(yaw)*ce*sp,vy:Math.sin(el)*sp,vz:Math.cos(yaw)*ce*sp,life:st.life||1,dmg:st.dmg,pierce:st.pierce||0,hit:new Set(),col:st.color,fast,after:!!st.after})
    if(gm==='v5'&&mode5&&mode5.pvp){const q=bullets[bullets.length-1];mode5.localShot({x:o.x,y:o.y,z:o.z,vx:q.vx,vy:q.vy,vz:q.vz,life:q.life,col:q.col,af:q.after?1:0})}}   // custom battle: the other players simulate this bullet too
  fx.muzzle(o,baseYaw,st,P.gy);P.shake=Math.max(P.shake,st.shake||.1);P.kick=Math.max(.2,(st.kick||1)*.5);P.dx=-Math.sin(P.camYaw);P.dz=-Math.cos(P.camYaw);P.dash=st.push||1}
// clear line between two points (trees block sight and bullets)
function los(ax,az,bx,bz){const dx=bx-ax,dz=bz-az,l2=dx*dx+dz*dz||1;
  {const ya=map.heightAt(ax,az)+1.2,yb=map.heightAt(bx,bz)+1.2,n=Math.ceil(Math.sqrt(l2)/1.5);   // hills block sight
    for(let i=1;i<n;i++){const t=i/n;if(map.heightAt(ax+dx*t,az+dz*t)>ya+(yb-ya)*t)return false}}
  return !segBlocked(map.obs,ax,az,bx,bz,.9)}
const turnTo=(a,b,k)=>a+Math.atan2(Math.sin(b-a),Math.cos(b-a))*k;
function enemyShoot(e,d){const ud=e.g.userData,o=ud.muzzle(tmp),sneak=e.sneak,spread=(Math.random()-.5)*(sneak?.26:.12);
  const yaw=Math.atan2(P.x-o.x,P.z-o.z)+spread,dx=Math.sin(yaw),dz=Math.cos(yaw),m=fx.bullet('#ff7a3c');
  m.position.copy(o);m.rotation.y=yaw;scene.add(m);ebul.push({m,vx:dx*11,vz:dz*11,life:2.6});fx.muzzle(o,yaw);ud.kick()}
function ai(e,dt){
  const ud=e.g.userData,ranged=e.k==='ranged',dx=P.x-e.x,dz=P.z-e.z,d=Math.hypot(dx,dz)||1,ux=dx/d,uz=dz/d;
  e.t+=dt;e.fl=Math.max(0,e.fl-dt);e.sf=Math.max(0,(e.sf||0)-dt);e.stun=Math.max(0,e.stun-dt);e.alert=Math.max(0,e.alert-dt);e.dcd=Math.max(0,e.dcd-dt);e.jcd-=dt;
  let mx=0,mz=0,sp=0,pose='idle',aim=false,face=e.yaw,pt=0;
  // ---- awareness: field of view + short "hearing" radius + clear line of sight
  const sightR=ranged?18:14,toP=Math.atan2(dx,dz),seen=d<sightR&&(Math.abs(Math.atan2(Math.sin(toP-e.yaw),Math.cos(toP-e.yaw)))<1.7||d<5)&&los(e.x,e.z,P.x,P.z);
  if(seen)e.alert=5;
  if(e.dodge>0){ // ---- dodge roll (invulnerable)
    e.dodge-=dt;const u=Math.max(0,e.dodge)/.38;sp=10*(.3+.7*u);mx=e.ddx;mz=e.ddz;pose='dodge';pt=1-u;
  }else{
    // chance to dodge a bullet that is about to hit
    if(e.dcd<=0&&e.alert>0&&e.st!=='leap')for(const b of bullets){const bx=e.x-b.m.position.x,bz=e.z-b.m.position.z,v2=b.vx*b.vx+b.vz*b.vz,t=(bx*b.vx+bz*b.vz)/v2;
      if(t>0&&t<.26){const cx=b.m.position.x+b.vx*t-e.x,cz=b.m.position.z+b.vz*t-e.z;
        if(Math.hypot(cx,cz)<e.r+.5&&b!==e.lastB){e.lastB=b;
          if(Math.random()<e.dc){const v=Math.sqrt(v2),px=-b.vz/v,pz=b.vx/v,sg=(cx*px+cz*pz)>=0?1:-1;e.ddx=px*sg;e.ddz=pz*sg;e.dodge=.38;e.dcd=1.8+rnd(0,1.2);e.dsd=(e.ddx*Math.cos(e.yaw)-e.ddz*Math.sin(e.yaw))>=0?1:-1;
            e.burst=0;e.aimT=0;fx.puff(new T.Vector3(e.x,.2,e.z),'#ffffff',3)}break}}}
    if(e.dodge<=0){
      if(e.st==='idle'){ // ---- idle: stand, look around, wander slowly towards the action
        e.wt-=dt;if(e.wt<=0){e.wt=rnd(2.2,5);if(Math.random()<.4)e.wx=null;else{const a=rnd(0,6.283);e.wx=e.x+Math.cos(a)*4+ux*3;e.wz=e.z+Math.sin(a)*4+uz*3}}
        if(e.wx!==null){const wx=e.wx-e.x,wz=e.wz-e.z,wd=Math.hypot(wx,wz);if(wd<.6)e.wx=null;else{mx=wx/wd;mz=wz/wd;sp=1.5;pose='walk';face=Math.atan2(mx,mz)}}
        if(e.alert>0){e.st=ranged?'engage':'chase';e.s=0;e.mt=0}
      }
      else if(!ranged){ // ================= MELEE: run at you, attack, rest =================
        if(e.st==='chase'){face=toP;mx=ux;mz=uz;
          if(e.alert<=0&&d>sightR+4)e.st='idle';
          else if(d<1.9&&e.stun<=0){e.st='wind';e.s=.4;e.sta=Math.max(0,e.sta-.2)}
          else if(e.jcd<=0&&e.sta>.3&&d>5.4&&d<11&&e.stun<=0&&los(e.x,e.z,P.x,P.z)){e.st='charge';e.s=1.1}   // too far for a swing: charge, then jump
          else if(d<10&&e.sta>0){sp=7.4;pose='run';e.sta-=dt*.22;if(e.sta<=0){e.sta=0;e.st='tired'}}   // sprint only when you are close, and only while stamina lasts
          else{sp=2.1;pose='walk';e.sta=Math.min(1,e.sta+dt*.08)}}                                       // you are far (or it is winded): it just walks
        else if(e.st==='charge'){face=toP;mx=ux;mz=uz;sp=10;pose='run';e.s-=dt;e.sta=Math.max(0,e.sta-dt*.12);   // all-out sprint
          if(e.stun>0){e.st='rest';e.s=.9}else if(d<=5.2||e.s<=0){e.st='crouch';e.s=.3}}
        else if(e.st==='crouch'){face=toP;mx=ux;mz=uz;sp=1.2;e.s-=dt;pose='crouch';pt=1-e.s/.3;                     // plant the feet and coil, tracking you
          if(e.stun>0){e.st='rest';e.s=.9}
          else if(e.s<=0){e.st='leap';e.s=.62;e.jx=e.x;e.jz=e.z;let tx=P.x-e.x,tz=P.z-e.z;const td=Math.hypot(tx,tz)||1,k=Math.min(td,7.5)/td;e.tx=e.x+tx*k;e.tz=e.z+tz*k;
            fx.dust(new T.Vector3(e.x,e.gy+.1,e.z))}}
        else if(e.st==='leap'){e.s-=dt;const u=1-Math.max(0,e.s)/.62;pose='air';pt=u;                                // committed: arcs through the air, bullets pass under it
          e.x=e.jx+(e.tx-e.jx)*u;e.z=e.jz+(e.tz-e.jz)*u;e.jy=4*2.1*u*(1-u);face=Math.atan2(e.tx-e.jx,e.tz-e.jz);
          if(e.s<=0){e.jy=0;e.st='land';e.s=.5;fx.smash(new T.Vector3(e.x,e.gy+.1,e.z));P.shake=Math.max(P.shake,.55);
            if(Math.hypot(P.x-e.x,P.z-e.z)<2.2&&P.jy<.7){hurt();fx.hit(new T.Vector3(P.x,.8,P.z),'#ff7a3c',8)}}}
        else if(e.st==='land'){e.s-=dt;pose='land';pt=1-e.s/.5;if(e.s<=0){e.st='rest';e.s=1.35;e.jcd=rnd(4,6.5)}}   // slam, then it is stuck recovering: free hits
        else if(e.st==='tired'){pose='rest';e.sta=Math.min(1,e.sta+dt*.35);if(e.sta>=.7)e.st='chase'}   // catches its breath, then chases again
        else if(e.st==='wind'){face=toP;e.s-=dt;pose='wind';pt=1-e.s/.4;
          if(e.stun>0){e.st='rest';e.s=.9}else if(e.s<=0){e.st='strike';e.s=.2;e.hit=false}}
        else if(e.st==='strike'){e.s-=dt;pose='strike';pt=1-e.s/.2;mx=Math.sin(e.yaw);mz=Math.cos(e.yaw);sp=4.5;
          if(!e.hit&&pt>.35){e.hit=true;if(d<e.r+1.5&&P.jy<.7){hurt();fx.hit(new T.Vector3(P.x,.8,P.z),'#ff7a3c',6)}}
          if(e.s<=0){e.st='rest';e.s=1.25}}
        else{e.s-=dt;pose='rest';e.sta=Math.min(1,e.sta+dt*.2);if(e.s<=0)e.st=e.sta>.25?'chase':'tired'}   // rest after the attack: easy to hit
      }
      else{ // ================= RANGED: shoots while standing or sneaking =================
        face=toP;aim=true;const clear=los(e.x,e.z,P.x,P.z),repos=d<5||d>12.5||!clear;
        if(e.alert<=0&&d>sightR+4){e.st='idle';aim=false}
        e.mt-=dt;if(e.mt<=0){e.mt=rnd(1.4,2.8);e.sneak=Math.random()<.55;e.strafe=Math.random()<.5?1:-1}
        if(repos&&e.burst<=0&&e.aimT<=0){ // reposition at normal speed with the gun lowered
          const want=d<5?-1:1;mx=ux*want;mz=uz*want;sp=3.8;pose='walk';aim=false;e.aimT=0;if(want>0&&!clear){mx+=-uz*e.strafe*.5;mz+=ux*e.strafe*.5}
        }else if(e.sneak){ // moving while shooting = sneaking: slow, low, less accurate
          mx=-uz*e.strafe*.8+ux*(d>9?.5:d<7?-.5:0);mz=ux*e.strafe*.8+uz*(d>9?.5:d<7?-.5:0);sp=1.7;pose='sneak';
        }else{sp=0;pose='idle'}
        e.cd-=dt;
        if(clear&&!repos){
          if(e.burst<=0&&e.cd<=0){e.aimT+=dt;if(e.aimT>=(e.sneak?.5:.35)){e.burst=1+((Math.random()*3)|0);e.bcd=0;e.aimT=0}}
          if(e.burst>0){e.bcd-=dt;if(e.bcd<=0){enemyShoot(e,d);e.burst--;e.bcd=.2;if(e.burst<=0)e.cd=rnd(.9,1.8)}}
        }else e.aimT=0;
        if(e.stun>0){e.aimT=0}
      }
    }
  }
  const len=Math.hypot(mx,mz)||1;if(sp>0){mx/=len;mz/=len}
  e.x+=mx*sp*dt;e.z+=mz*sp*dt;e.x=Math.max(-map.W/2+.8,Math.min(map.W/2-.8,e.x));e.z=Math.max(-map.H/2+.8,Math.min(map.H/2-.8,e.z));if(!(e.jy>.5))push(e,e.r);
  e.yaw=turnTo(e.yaw,face,Math.min(1,dt*(pose==='run'?14:9)));
  e.gy=map.heightAt(e.x,e.z);map.walk(e.wid||(e.wid='e'+(++wuid)),e.x,e.z,sp>.3&&!(e.jy>.5));e.g.position.set(e.x,e.gy+(e.jy||0),e.z);e.g.rotation.y=e.yaw;e.g.scale.setScalar(1+e.fl*.8);
  {if(!e.fs){e.fs=fx.flashGlow();e.fs.position.y=.9;e.g.add(e.fs)}const on=e.sf>0&&Math.sin(e.sf*110)>-.25;e.fs.visible=on;if(on){e.fs.material.opacity=Math.min(1,e.sf*6);e.fs.scale.setScalar(1.7+e.sf*2.2)}}   // hit flash: the creature flickers with a bright glow for a moment

  ud.update(dt,{mv:sp>.3,pose,pt,aim,dir:e.dsd,lod:d>26?2:d>15?1:0,jy:e.jy||0});
}
// ---- title-screen attract mode: a bot plays the game for you ----
const bot={t:0,sd:1,wt:0},BOT_GUNS=[0,2,5,6,7];
function botInput(dt){
  let tgt=null,bd=1e9;for(const e of enemies){const d=Math.hypot(e.x-P.x,e.z-P.z);if(d<bd){bd=d;tgt=e}}
  bot.t-=dt;if(bot.t<=0){bot.t=rnd(1.2,2.6);bot.sd=Math.random()<.5?1:-1}
  bot.wt-=dt;if(bot.wt<=0){bot.wt=8;equipIdx(BOT_GUNS[(Math.random()*BOT_GUNS.length)|0])}   // the demo shows off different guns
  let f=0,s=0,atk=false,roll=false;
  if(tgt){const want=Math.atan2(tgt.x-P.x,tgt.z-P.z);P.camYaw=turnTo(P.camYaw,want,Math.min(1,dt*9));
    const err=Math.abs(Math.atan2(Math.sin(want-P.camYaw),Math.cos(want-P.camYaw)));
    f=bd<5.5?-1:bd>9.5?1:0;s=bot.sd*(bd<13?1:0);atk=err<.12&&bd<15&&los(P.x,P.z,tgt.x,tgt.z);
    if(P.rcd<=0){
      for(const b of ebul){const rx=P.x-b.m.position.x,rz=P.z-b.m.position.z,v2=b.vx*b.vx+b.vz*b.vz,t=(rx*b.vx+rz*b.vz)/v2;
        if(t>0&&t<.3&&Math.hypot(b.m.position.x+b.vx*t-P.x,b.m.position.z+b.vz*t-P.z)<.9){roll=true;break}}
      for(const e of enemies)if(e.k==='melee'&&Math.hypot(e.x-P.x,e.z-P.z)<2.8&&(e.st==='wind'||e.st==='leap'||e.st==='crouch')){roll=true;break}
    }
  }else{P.camYaw+=dt*.5;f=.5}
  P.viewYaw=turnTo(P.viewYaw,P.camYaw,Math.min(1,dt*1.6));
  return{f,s,atk,roll};
}
function update(dt){
  const demo=state==='title';
  const pvpLive=state==='play'&&gm==='v5'&&!!mode5&&mode5.pvp;   // a custom battle never stops for one player's pause menu or hit-lag: the others are still fighting
  if(!(state==='play'||demo)||(paused&&!pvpLive)||(story&&story.invOpen())||hud.bigmapOn())return;   // the inventory screen and the map page stop the world like a pause
  if(P.hs>0){P.hs-=dt;if(!pvpLive)dt*=.03}   // hit-lag: the world nearly freezes for a moment
  if(demo){if(!selOn())rogue.demoUpdate(dt)}
  else if(gm!=='v5'&&gm!=='story')rogue.update(dt);   // roguelike waves (js/roguelike.js)
  
  // Camera rotation using Arrow keys
  const turnSpeed = 2.2, pitchSpeed = 1.8;
  if(!paused){if(keys.ArrowLeft) P.camYaw += turnSpeed * dt;
  if(keys.ArrowRight) P.camYaw -= turnSpeed * dt;
  if(keys.ArrowUp) P.camPitch += pitchSpeed * dt;
  if(keys.ArrowDown) P.camPitch -= pitchSpeed * dt;}
  P.camPitch = Math.max(-0.5, Math.min(0.6, P.camPitch));

  // Player movement using WASD
  const inp=demo?(selOn()?IDLE:botInput(dt)):null;
  let fwd=demo?inp.f:(keys.KeyW?1:0)-(keys.KeyS?1:0),side=demo?inp.s:(keys.KeyD?1:0)-(keys.KeyA?1:0);if(P.dead||P.frozen||paused){fwd=0;side=0}
  P.fwd=fwd;P.side=side;P.rel=fwd<0?-1:1;cat.userData.move.f=fwd;cat.userData.move.s=side;
  P.mv=(fwd!==0||side!==0)&&P.roll<=0;P.rcd=Math.max(0,P.rcd-dt);if(demo&&inp.roll)tumble();
  const px0=P.x,pz0=P.z,sp=(P.scope&&isGunW()?3.2:6.5)*(WP().stats.move||1);
  if(P.roll>0){const u=P.roll/.55,v=11*(.25+.75*u);P.x+=P.rdx*v*dt;P.z+=P.rdz*v*dt;P.roll=Math.max(0,P.roll-dt);
    fp.set(P.x,P.gy+.1,P.z);fx.dashTrail(fp,P.rdx,P.rdz,u);if(P.roll<=0)fx.land(fp,P.rdx,P.rdz)}
  else if(P.ad>0){const u=P.ad/DASH_T,v=DASH_V*(.45+.55*u);P.x+=P.rdx*v*dt;P.z+=P.rdz*v*dt;fx.airTrail(fp.set(P.x,P.y+.7,P.z),P.rdx,P.rdz,u)}   // air dash
  else if(P.mv){const fxv=Math.sin(P.camYaw),fzv=Math.cos(P.camYaw),rx=-Math.cos(P.camYaw),rz=Math.sin(P.camYaw);
    const dx=fxv*fwd+rx*side,dz=fzv*fwd+rz*side,len=Math.hypot(dx,dz);if(len>0){P.x+=dx/len*sp*dt;P.z+=dz/len*sp*dt}}
  if(P.dash>0){P.x+=P.dx*P.dash*3*dt;P.z+=P.dz*P.dash*3*dt;P.dash=Math.max(0,P.dash-dt*9)}
  P.x=Math.max(-map.W/2+1,Math.min(map.W/2-1,P.x));P.z=Math.max(-map.H/2+1,Math.min(map.H/2-1,P.z));push(P,.45);
  if(gm==='story')story.blockSlope(px0,pz0);   // cliffs are too steep to climb
  
  P.gy=map.heightAt(P.x,P.z);
  if(P.air){ // ---- jump / fall (an air dash hovers: no gravity while it lasts)
    if(P.ad>0){P.ad=Math.max(0,P.ad-dt);P.vy=0}else P.vy-=JUMP_G*dt;
    P.y+=P.vy*dt;
    if(P.y<=P.gy&&P.vy<=0){const hard=-P.vy;P.y=P.gy;P.air=false;P.vy=0;P.ad=0;P.canDash=true;if(P.rcd>.35)P.rcd=.35;
      cat.userData.land&&cat.userData.land(Math.min(1,hard/10));fx.land(fp.set(P.x,P.gy+.12,P.z),P.rdx*.3,P.rdz*.3);if(hard>9)P.shake=Math.max(P.shake,.25)}
    else if(P.y<P.gy)P.y=P.gy}
  else P.y=P.gy;
  P.jy=Math.max(0,P.y-P.gy);P.ey=P.gy+P.jy*.65;P.fk+=((P.ad>0?1:0)-P.fk)*Math.min(1,dt*14);
  map.walk('player',P.x,P.z,(P.mv||P.roll>0)&&!P.air);   // ripples when you walk on water
  if(gm==='story')story.tick(dt);
  P.aim=P.camYaw;
  if(RL.t>0){RL.t-=dt;if(RL.t<=0){RL.t=0;ammo[P.wpn]=WP().stats.mag||0}}
  P.cd-=dt;P.inv-=dt;cat.userData.setScope(P.scope&&isGunW()&&P.roll<=0);
  
  // Attack trigger is E (KeyE)
  if((keys.KeyE||mouse.l||(demo&&inp.atk))&&!paused&&P.cd<=0&&P.roll<=0&&!P.dead&&!P.frozen){if(isGunW())shoot();else if(cat.userData.slash()){const st=WP().stats;if(!demo){const s=WP().sfx||{};audio.play(s.slash||'slash',{vol:s.vol,pitch:s.pitch})}P.cd=st.dur+.05;P.dx=Math.sin(P.camYaw);P.dz=Math.cos(P.camYaw);P.dash=st.dash;if(st.dash)fx.lunge(fp.set(P.x,P.gy+.1,P.z),P.dx,P.dz)}}

  for(let i=bullets.length-1;i>=0;i--){const b=bullets[i];b.m.position.x+=b.vx*dt;b.m.position.y+=(b.vy||0)*dt;b.m.position.z+=b.vz*dt;b.life-=dt;const p=b.m.position;let dead=b.life<=0||p.y<map.heightAt(p.x,p.z)+.03||p.y>(gm==='v5'?24:16)||Math.abs(p.x)>map.W/2||Math.abs(p.z)>map.H/2||blocked(map.obs,p.x,p.z,0),flesh=false;
    for(const e of enemies)if(!dead&&Math.hypot(p.x-e.x,p.z-e.z)<e.r+.2&&e.dodge<=0&&!b.hit.has(e)&&Math.abs(p.y-.7-(e.gy||0)-(e.jy||0))<1.2){e.hp-=b.dmg;e.hbT=2.5;e.fl=.12;e.sf=.28;e.stun=.12;e.alert=6;flesh=true;if(!demo){hud.hit(false);audio.play('hit')}fx.splat(p,b.vx,b.vz);e.x+=b.vx*.012;e.z+=b.vz*.012;if(b.pierce>0){b.pierce--;b.hit.add(e)}else dead=true}
    if(!dead&&gm==='v5'&&mode5.bulletHit(p,b)){flesh=true;hud.hit(false);audio.play('hit');fx.splat(p,b.vx,b.vz);dead=true}
    if(dead){if(!flesh&&b.life>0){fx.wall(p,'#fff3b0',b.after);fx.mark(p,b.vx,b.vy||0,b.vz,p.y<map.heightAt(p.x,p.z)+.05)};scene.remove(b.m);bullets.splice(i,1)}else fx.trail(p,b.vx,b.vz,b.col||'#ffd54a',b.fast?{vy:b.vy||0,dt,fast:true,after:b.after}:undefined)}
  for(let i=ebul.length-1;i>=0;i--){const b=ebul[i];b.m.position.x+=b.vx*dt;b.m.position.z+=b.vz*dt;b.life-=dt;const p=b.m.position;let dead=b.life<=0||Math.abs(p.x)>map.W/2||Math.abs(p.z)>map.H/2||blocked(map.obs,p.x,p.z,0);
    if(Math.hypot(p.x-P.x,p.z-P.z)<.55&&!(P.jy>.7&&p.y<P.y+.2)){hurt();dead=true;fx.hit(p,'#ff7a3c',6)}else if(dead&&b.life>0){fx.wall(p,'#ffb070');fx.mark(p,b.vx,0,b.vz,false)}if(dead){scene.remove(b.m);ebul.splice(i,1)}else fx.trail(p,b.vx,b.vz,'#ff7a3c')}
  enemies.forEach(e=>{ai(e,dt);e.hbT=Math.max(0,e.hbT-dt)});
  for(let i=0;i<enemies.length;i++)for(let j=i+1;j<enemies.length;j++){const a=enemies[i],b=enemies[j],dx=b.x-a.x,dz=b.z-a.z,d=Math.hypot(dx,dz),m=(a.r+b.r)*.9;if(d<m&&d>0){const k=(m-d)/2/d;a.x-=dx*k;a.z-=dz*k;b.x+=dx*k;b.z+=dz*k}}
  for(let i=enemies.length-1;i>=0;i--){const e=enemies[i];if(e.hp>0)continue;fx.puff(new T.Vector3(e.x,.7,e.z),e.g.userData.col||'#6f8f45');scene.remove(e.g);enemies.splice(i,1);
    if(!demo){rogue.onKill();hud.hit(true)}
    if(Math.random()<(P.hp<=2?.2:.08)){const m=new T.Mesh(heartGeo,heartMat);const hy=map.heightAt(e.x,e.z);m.position.set(e.x,hy+.8,e.z);m.rotation.x=-.4;scene.add(m);pickups.push({m,x:e.x,z:e.z,t:0,hy})}if(!demo)hudAll()}
  for(let i=pickups.length-1;i>=0;i--){const k=pickups[i];k.t+=dt;k.m.position.y=k.hy+.8+Math.sin(k.t*3)*.15;k.m.rotation.y=k.t*2;
    if(Math.hypot(P.x-k.x,P.z-k.z)<.9){if(P.hp<P.max)P.hp++;fx.hit(k.m.position,'#ff9db8',10);scene.remove(k.m);pickups.splice(i,1);hudAll()}}
  if(gm==='v5')mode5.update(dt);
}
// ---- 5v5 SPIKE RUSH: hooks the mode in js/5v5.js needs (it drives 9 AI cats; you play on the blue team)
let wuid=0;
function leave5(){rogue.stop();P.unarmed=false;P.loadout=null;hud.loadout&&hud.loadout(null);mode5&&mode5.stop();story&&story.leave();gm='wave';if(scene.fog){scene.fog.near=30;scene.fog.far=150}map=forest;forest.group.visible=true;arena&&(arena.group.visible=false);document.body.classList.remove('v5');const l=document.querySelector('.wplate small');if(l)l.textContent='WAVE'}
function ensureArena(){if(!arena){arena=buildArena(11,atm.envMap);scene.add(arena.group);arena.setQuality(lastQ);arena.group.visible=false}}
// 5v5: every round is played on a freshly generated random map (js/5v5.js calls ctx.newMap behind the loading screen). The new arena replaces the old one everywhere (arena / map).
function swapArena(theme,seed){
  if(arena){scene.remove(arena.group);try{arena.dispose&&arena.dispose()}catch(e){}arena.group.traverse(o=>{o.geometry&&o.geometry.dispose&&o.geometry.dispose()})}   // free the old map's buffers
  arena=buildArena(seed,atm.envMap,theme);scene.add(arena.group);arena.setQuality(lastQ);arena.group.visible=true;if(gm==='v5')map=arena;
  try{renderer.compile(scene,cam)}catch(e){}
  hud.prepMap&&hud.prepMap(arena);               // paint the paper minimap now, not during the first frame
  return arena}
// compile every shader / upload every geometry once, behind the loading screen, so nothing hitches the first time it appears
function warm(){try{
  const g=new T.Group();g.position.set(0,-80,0);
  WEAPONS.forEach(w=>{const b=w.build();g.add(b.group);if(b.off)g.add(b.off)});
  ['melee','ranged'].forEach(k=>{const e=buildEnemy(k);casts(e);g.add(e)});scene.add(g);
  const fv=forest.group.visible;renderer.compile(scene,cam);
  if(arena){const av=arena.group.visible;arena.group.visible=true;forest.group.visible=false;renderer.compile(scene,cam);renderer.render(scene,cam);arena.group.visible=av;forest.group.visible=fv}else renderer.render(scene,cam);
  scene.remove(g)}catch(e){console.warn('warm-up skipped',e)}}
// starting a 5v5 match runs behind the loading screen (fresh random map, 9 cats, shader compile), so nobody watches the game stall while it renders
let starting5=false,rouletteOn=false,pvpClosed=false;
async function start5v5(pv){   // pv = a custom battle ({slots,theme,seed,host,mySlot,name} from the PVP lobby); nothing = the normal 5v5 spike rush
  if(starting5)return;pvpClosed=false;starting5=true;let ok=false,rp=null,openGate=()=>{};const gate=new Promise(r=>openGate=r);
  try{
    try{lockPtr()}catch(e){}                                   // pointer lock needs the click that started us: ask for it before the first await
    loading.show('Getting the arena ready…',pv?'PVP':'5V5');await tick();await tick();
    leave5();clearAll();refill();                              // gm stays 'wave' until everything is built, so the frame loop never sees a half-made match
    loading.set(.2,pv?'Building the host\'s map…':'Picking a random map…');await tick();
    if(pv)swapArena(pv.theme,pv.seed);                         // every player builds the SAME map from the host's theme + seed
    else{const ids=ARENA_THEMES.map(t=>t.id).filter(id=>!arena||id!==arena.theme);
      swapArena(ids[(Math.random()*ids.length)|0],(Math.random()*1e9)|0)}
    loading.set(.55,'Spawning the cats…');await tick();
    if(!mode5)mode5=mk5();
    begin5v5();P.frozen=true;                                  // the arena is visible behind the roulette, the match has not started yet
    loading.set(.8,'Preparing the weapon roulette…');await tick();
    rouletteOn=true;rp=spinRoulette(WEAPONS,{count:2,wait:gate});rp.catch(()=>{});   // built hidden now, spins the instant the loading screen starts to leave
    loading.set(.9,'Compiling shaders…');await tick();
    try{renderer.compile(scene,cam)}catch(e){}
    await tick();ok=true;
  }catch(e){console.error('5v5 start failed',e)}
  const ld=loading.done();openGate();                          // the loading screen leaves and the roulette opens over it at the same moment: no gap
  if(!ok){rouletteOn=false;await ld;starting5=false;enterTitle();return}
  paused=false;hud.pause(false);P.frozen=true;mouse.l=false;
  await ld;
  let lo=null;
  try{lo=await rp}catch(e){console.error('weapon roulette failed, auto-picking',e)}
  if(!lo||lo.length<2){lo=WEAPONS.map((_,i)=>i).sort(()=>Math.random()-.5).slice(0,2)}   // auto-pick when the roulette could not run
  rouletteOn=false;
  if(pv&&pvpClosed){starting5=false;enterTitle();return}      // the host left while we were loading
  P.unarmed=false;P.loadout=lo;hud.loadout(lo);equipIdx(lo[0]);
  paused=false;hud.pause(false);P.frozen=false;state='play';
  lockPtr();
  go5v5(pv);starting5=false}
function begin5v5(){gm='v5';
  forest.group.visible=false;arena.group.visible=true;map=arena;if(scene.fog){scene.fog.near=35;scene.fog.far=170}
 P.x=0;P.z=0;P.hp=P.max;P.inv=0;P.dead=false;P.frozen=false;paused=false;state='play';['#title','#over'].forEach(s=>$(s).hidden=true);
  hud.reset();hud.show(true);hud.pause(false);P.roll=0;P.rcd=0;P.scope=false;resetAir();P.kick=0;P.camYaw=0;P.viewYaw=0;P.camPitch=0;P.chain=0;P.chainT=0;mouse.l=false;setView(0);
  document.body.classList.add('v5');const l=document.querySelector('.wplate small');if(l)l.textContent='ROUND';lockPtr();
  P.unarmed=true;P.wpn=0;P.scope=false;RL.t=0;try{cat.userData.equip(null)}catch(e){}hud.loadout([]);hudAmmo();   // 5v5 starts with empty hands: the roulette hands out the weapons
  hud.name(cfg.name);
  }
function go5v5(pv){mode5.start(pv?{pvp:true,net,host:pv.host,mySlot:pv.mySlot,slots:pv.slots,name:pv.name}:undefined);mode5.bots.forEach(b=>casts(b.cat));try{renderer.compile(scene,cam)}catch(e){}}
function hurt5(n){if(P.inv>0||P.dead)return false;hud.hurt();P.hp-=n;P.inv=.12;P.shake=Math.max(P.shake,.35);hud.hp(Math.max(0,P.hp),P.max);
  if(P.hp<=0){P.hp=0;P.dead=true;mouse.l=false;P.scope=false;mode5.onPlayerDown()}return true}
function resetPlayer(x,z,yaw){refill();arena&&arena.prime(x,z,60);P.x=x;P.z=z;P.camYaw=yaw;P.viewYaw=yaw;P.camPitch=0;P.hp=P.max;P.dead=false;P.frozen=false;P.inv=0;P.roll=0;P.rcd=0;P.scope=false;resetAir();P.dash=0;P.kick=0;mouse.l=false;hud.hp(P.hp,P.max);if(gm==='v5'&&state==='play'&&!paused&&!document.pointerLockElement)lockPtr()}
let hudLo=null;
function hud5(){if(P.loadout&&hudLo!==P.loadout){hudLo=P.loadout;hud.loadout(P.loadout)}const S=mode5.state();hud.hp(P.hp,P.max);hud.wave(S.round);const s=$('#score');if(s)s.textContent=`${S.score.A} : ${S.score.B}`}
function endMatch(){try{const S=mode5.state(),me=mode5.myTeam,o=me==='A'?'B':'A';audio.play(S.score[me]>S.score[o]?'win':'lose')}catch(e){}state='over';mouse.l=false;P.scope=false;document.exitPointerLock&&document.exitPointerLock();hud.show(false)}
const mk5=()=>createMode5v5({scene,cam,fx,get map(){return arena},newMap:(theme,seed)=>swapArena(theme,seed),P,keys,W:arena.W,H:arena.H,bullets,los,push,start5v5,home:()=>enterTitle(),
  toast:t=>{const [a,b='']=t.split(' · ');hud.banner(a,b)},hurt:hurt5,resetPlayer,heightAt:(x,z)=>arena.heightAt(x,z),walk:(id,x,z,mv)=>arena.walk(id,x,z,mv),ripple:(x,z,a)=>arena.ripple(x,z,a),hud:hud5,cat:()=>cat,endMatch,
  clearBullets:()=>{fx.clearMarks();bullets.forEach(b=>scene.remove(b.m));bullets.length=0}});
// ---- touch controls: only created on phones / tablets (see js/mobile.js); on PC this is a no-op
const mobile=createMobile({P,keys,mouse,canPlay:()=>state==='play'&&!paused&&!story.invOpen()&&!hud.bigmapOn(),tumble,jump,pause:()=>setPaused(true),
  weapon:d=>setWeapon(P.wpn+d),wname:()=>WP().name,reload,hasAmmo:hasMag,is5v5:()=>gm==='v5',inventory:()=>story.toggle(),isStory:()=>gm==='story',
  scope:()=>{if(isGunW()&&WP().stats.zoom&&P.roll<=0)P.scope=!P.scope}});
// ---- controller: sticks / triggers in a match, the same keyboard menu navigation (A = accept, B = back) everywhere else
const pad=createGamepad({P,keys,mouse,inGame:()=>state==='play'&&!paused,inPlay:()=>state==='play',
  jump,tumble,reload,weapon:d=>setWeapon(P.wpn+d),pause:()=>setPaused(true),resume:()=>setPaused(false),
  scopeSet:v=>{if(!v)P.scope=false;else if(isGunW()&&WP().stats.zoom&&P.roll<=0&&!P.dead)P.scope=true},
  settings:()=>{if(state==='play'&&!paused)setPaused(true);gfx.open()},
  notify:(a,b)=>hud.banner(a,b)});
let last=performance.now();
hints();
// ---- STORY MODE (js/storyMode.js): it reaches the game through these hooks. `activate` is the one place that flips main.js into 'story'.
story=createStory({$,scene,atm,hud,P,keys,mouse,renderer,cam,tick,touch:TOUCH,
  game:{get gm(){return gm},get map(){return map},get state(){return state},get paused(){return paused}},
  activate:(m,sx,sz,yaw)=>{gm='story';forest.group.visible=false;arena&&(arena.group.visible=false);m.group.visible=true;map=m;if(scene.fog){scene.fog.near=50;scene.fog.far=230}
    P.x=sx;P.z=sz;P.camYaw=yaw||0;P.viewYaw=P.camYaw;P.camPitch=0;P.hp=P.max;P.inv=0;P.dead=false;P.frozen=false;paused=false;state='play';
    ['#title','#over'].forEach(s=>$(s).hidden=true);hud.reset();hud.show(true);hud.pause(false);P.roll=0;P.rcd=0;P.scope=false;resetAir();P.kick=0;P.chain=0;P.chainT=0;mouse.l=false;setView(0);
    document.body.classList.add('story');hud.name(cfg.name);P.gy=map.heightAt(P.x,P.z)},
  hideMenus,showMenu,enterTitle,leave5,clearAll,refill,equipIdx,lockPtr,
  view:f=>{viewTo=f},quality:()=>lastQ,getCat:()=>cat});
// the full-screen map page (M): the game stands still while it is open and the cursor is freed for panning
hud.onMap=open=>{if(open){for(const k in keys)keys[k]=false;mouse.l=false;P.scope=false;P.mv=false;try{document.exitPointerLock&&document.exitPointerLock()}catch(e){}}else if(state==='play'&&!paused)lockPtr()};
L.set(.5,'Dressing the cat…');await tick();
setCat();enterTitle();
L.set(.62,'Building the 5v5 arena…');await tick();if(!IOS)ensureArena();   // iOS: the arena is only built when a match starts (swapArena), never twice
L.set(.8,'Compiling shaders…');await tick();warm();
L.set(.92,'Loading fonts & images…');
await Promise.all([document.fonts&&document.fonts.ready,...[...document.images].map(i=>i.decode?i.decode().catch(()=>{}):0)]);
L.set(.98,'Almost there…');await tick();
const SPEC_H=24;   // how high the spectator camera hangs above the ally you watch
const SVO=Object.create(P);   // stand-in for P while spectating an ally in 5v5 (same fields, own x / z / ey / camYaw)
let lf=0,lastDraw=0;const PROF=/[?&]prof/.test(location.search),NOB=/[?&]nobots/.test(location.search),NOA=/[?&]noarena/.test(location.search),pf={n:0,u:0,r:0,fx:0,t0:performance.now()};   // open the game with ?prof to log where the frame time goes (console, every 120 frames)
(function loop(now){requestAnimationFrame(loop);
  {const iv=gfx.fpsInterval();if(iv){if(now-lastDraw<iv-1)return;lastDraw=now-((now-lastDraw)%iv)}else lastDraw=now}   // FPS limit (Settings > Graphics): skip animation frames that come sooner than the cap
  gfx.ingame(state==='play');
  if(lf<5&&++lf===5)L.done();   // the loading screen leaves once the game has really drawn a few frames
const raw=(now-last)/1000,dt=Math.min(raw,.05);last=now;if(state!=='maker'&&!paused&&raw<.5)gfx.frame(raw,n=>hud.banner('Graphics: '+n,'lowered automatically for smoother play'));clock+=dt;mobile.update();pad.update(raw);const lag=P.hs>0&&!paused&&!(gm==='v5'&&mode5&&mode5.pvp);if(PROF){renderer.info.autoReset=false;renderer.info.reset();globalThis.__hideBots=NOB;if(NOA&&arena&&gm==='v5')arena.group.visible=false}   // ?prof&nobots / &noarena hide the bots / the arena so you can see what each costs
  const _u0=performance.now();update(dt);pf.u+=performance.now()-_u0;fx.update(lag?dt*.3:dt);   // sparks keep moving in slow motion during the freeze
  {const c=cam.userData.off||0;if(c!==viewTo){const n=Math.abs(viewTo-c)<.001?viewTo:c+(viewTo-c)*Math.min(1,dt*6);cam.userData.off=n;const W=Math.max(1,renderer.domElement.clientWidth||innerWidth),H=Math.max(1,renderer.domElement.clientHeight||innerHeight);n?cam.setViewOffset(W,H,W*n,0,W,H):cam.clearViewOffset();cam.updateProjectionMatrix()}   // maker open/close: the cat glides to the other side of the screen
  if(!mkOn)camTo=selOn()?Math.PI:0;let d=camTo-camAz;d=Math.atan2(Math.sin(d),Math.cos(d));camAz+=d*Math.min(1,dt*5);   // maker: camera swings round the cat (0 = behind it as usual, PI = in front of it)
  if(!spinHeld){spin=Math.atan2(Math.sin(spin),Math.cos(spin));spin-=spin*Math.min(1,dt*4)}}
  const mode=state==='maker'?'maker':'play';if(mode!==curMode){curMode=mode;atm.setMode(mode)}
  audio.music(state==='title'||state==='maker'||gm==='story'?'title':state==='over'?null:gm==='v5'?'v5':'wave');audio.duck(paused)
  // 5v5: when you are dead the camera follows the ally you picked (the spectate buttons live in 5v5.js); the map and the sun's shadows follow it too
  const SV=(gm==='v5'&&state==='play'&&P.dead&&mode5&&mode5.spectateView)?mode5.spectateView():null,FOC=SV?SVO:P;
  if(SV){SVO.x=SV.x;SVO.z=SV.z;SVO.gy=SV.gy;SVO.ey=SV.ey;SVO.camYaw=SV.yaw;if(document.pointerLockElement&&!paused)document.exitPointerLock()}   // free the cursor so the buttons can be clicked
  story.cycle(state==='play');atm.hold=paused||story.invOpen()||hud.bigmapOn();   // day/night runs only in a story world and stops with the inventory open
  if(state!=='maker')map.update(clock,FOC,{sun:atm.lightDir,sky:atm.fogColor});atm.update(dt,clock,FOC);
  if(state!=='play')hud.scope(0);
  if(state==='play'||state==='over'||state==='title'){
    const invOn=story.invOpen();   // story inventory open: the camera turns into a slightly angled character preview
    cat.position.set(P.x,P.air?P.y:P.gy,P.z);
    cat.rotation.y = P.camYaw;
    P.blink=Math.max(0,P.blink-dt);cat.visible=!P.dead&&(state==='title'||P.blink<=0||Math.floor(clock*20)%2===0);
    {const wd=state==='title'&&!mkOn&&!selOn()?1:0;drone=state==='title'?drone+(wd-drone)*Math.min(1,dt*3.5):0;if(Math.abs(drone-wd)<.002)drone=wd;   // title + main menu = drone shot, cat maker = old behind-the-cat camera, a match = no drone at all
     const k=Math.min(1,dt*2.2);dp.x+=(P.x-dp.x)*k;dp.z+=(P.z-dp.z)*k}
    cat.userData.setAim(invOn?0:P.camPitch,(state==='play'&&!paused)||state==='title');cat.userData.setAir&&cat.userData.setAir(P.air?P.jy:0,P.vy);cat.userData.holster(false);cat.userData.update(paused?0:lag?dt*.06:dt,P.mv&&(state==='play'||state==='title')&&!paused,P.rel);
    P.shake=Math.max(0,P.shake-dt*1.2);const sh=P.shake*P.shake*1.2*(1-drone);   // the drone shot never shakes
    
    const aw=cat.userData.scope(),kk=P.kick=Math.max(0,P.kick-dt*5),kc=kk*(1-drone),dist=lerp2(SV?SPEC_H:state==='title'?4.8:lerp2(P.camDist,1.7,aw),DRONE.dist,drone)+kc*.12,rightOffset=lerp2(SV?0:state==='title'?(selOn()?0:.5):lerp2(1.4,.8,aw),0,drone);
    const targetFov=invOn?36:lerp2(lerp2(gfx.get().fov||70,WP().stats.zoom||40,aw)+kc*2+P.fk*7,DRONE.fov,drone);if(Math.abs(cam.fov-targetFov)>.01){cam.fov=targetFov;cam.updateProjectionMatrix()}
    const vy0=state==='title'?P.viewYaw+camAz-spin:FOC.camYaw,vy=vy0+Math.atan2(Math.sin(DRONE.yaw-vy0),Math.cos(DRONE.yaw-vy0))*drone,pit=lerp2(state==='title'?-.25:SV?-1.18:P.camPitch,DRONE.pit,drone)+kc*.02;   // drone: fixed yaw + fixed downward pitch   // spectating = TOP VIEW: high above the ally, looking steeply down
    const rx=-Math.cos(vy),rz=Math.sin(vy),cp=Math.cos(pit),sp=Math.sin(pit),dX=Math.sin(vy)*cp,dY=sp,dZ=Math.cos(vy)*cp;
    const fx0=lerp2(FOC.x,dp.x,drone),fz0=lerp2(FOC.z,dp.z,drone),px=fx0+rx*rightOffset,pz=fz0+rz*rightOffset;
    const camX=px-dX*dist+rx*rnd(-sh,sh)*.7,camZ=pz-dZ*dist+rz*rnd(-sh,sh)*.7;let camY=FOC.ey+1.0-dY*dist+rnd(-sh,sh)+(P.roll>0?-.15:0)+(state==='play'&&!SV?(gfx.get().cam||0)*.0375*(1-aw):0);   // Settings > Camera height: raises / lowers the camera only (the aim point stays put); fades out while scoped
    camY=Math.max(.35+map.heightAt(camX,camZ),camY);   // never let the camera sink below the ground
    cam.position.set(camX,camY,camZ);if(!SV)for(const o of near(map.obs,cam.position.x,cam.position.z)){if(o.r>3)continue;const ox=cam.position.x-o.x,oz=cam.position.z-o.z,od=Math.hypot(ox,oz),om=o.r+.35;if(od<om&&od>1e-3){cam.position.x=o.x+ox/od*om;cam.position.z=o.z+oz/od*om}}   // keep the camera out of trunks and rocks
    cam.lookAt(fx0+dX*11,1+FOC.ey+dY*11+drone*DRONE.lift,fz0+dZ*11);   // looks at the point the bullets converge on (drone: a bit higher, so the cat sits in the lower half under the logo)
    cam.rotation.z+=rnd(-sh,sh)*.02+(P.roll>0?Math.sin(P.roll*14)*.02:0);
    if(invOn){const a=P.camYaw-.5-story.invSpin(),r=6.6;cam.position.set(P.x+Math.sin(a)*r,P.gy+1.55,P.z+Math.cos(a)*r);cam.lookAt(P.x,P.gy+.85,P.z)}   // zoomed-out 3/4 view from the front; the cat turns a little to the screen's right (drag on the left to turn it)
    if(state==='play'){cam.updateMatrixWorld();hudAmmo();hud.scope(aw);hud.crosshair(7+kk*34+(P.mv?3:0)+(P.scope?-3:0)+P.shake*10,!paused&&!SV);hud.tumble(1-P.rcd/.95);
      hud.combo(Math.min(5,1+Math.floor(P.chain/3)),P.chain,P.chainT/3.2);hud.bars(enemies,cam,clock);hud.radar(FOC,enemies,pickups,map,FOC.camYaw);if(hud.bigmapOn())hud.bigradar(FOC,enemies,pickups,map)}
  }
  else{const mk=state==='maker';let mv=false;
    if(mk&&run){ang+=dt*3;cat.position.set(Math.cos(ang)*.9,0,3+Math.sin(ang)*.9);cat.rotation.y=Math.atan2(-Math.sin(ang),Math.cos(ang));mv=true}
    else{cat.position.set(0,0,3);if(mk){if(!spinHeld){spin=Math.atan2(Math.sin(spin),Math.cos(spin));spin-=spin*Math.min(1,dt*4)}cat.rotation.y=spin}else cat.rotation.y=Math.sin(clock*.7)*.6}
    cat.visible=true;const shooting=performance.now()<=gunUntil;cat.userData.setAim(0,shooting);cat.userData.setScope(false);cat.userData.move.f=mv?1:0;cat.userData.move.s=0;cat.userData.holster(!shooting);cat.userData.update(dt,mv,1);if(mk){if(cam.fov!==38){cam.fov=38;cam.updateProjectionMatrix()}cam.position.set(0,1.0,6.0);cam.lookAt(0,.74,3)}else{cam.position.set(0,2.4,8);cam.lookAt(0,1,3)}}
  {const _r0=performance.now();atm.render();const _r1=performance.now();pf.r+=_r1-_r0;
  if(PROF&&++pf.n>=120){const i=renderer.info.render,bp=globalThis.__botProf||{think:0,avatar:0},k=1/pf.n,t=performance.now();
    const gl=renderer.getContext(),g0=performance.now();gl.finish();const gpuWait=performance.now()-g0;   // time the GPU still needed after the draw calls were sent
    const grp=[];scene.children.forEach(c=>{if(!c.visible)return;let n=0;c.traverseVisible(o=>{if(o.isMesh||o.isSprite||o.isPoints||o.isLine)n++});grp.push([n,c.type+'('+c.children.length+')'+(c===(arena&&arena.group)?' ARENA':c.userData&&c.userData.setAim?' cat':'')])});
    grp.sort((x,y)=>y[0]-x[0]);const cats=scene.children.filter(c=>c.visible&&c.userData&&c.userData.setAim).length;
    console.log(`[prof] frame ${((t-pf.t0)*k).toFixed(1)}ms | update ${(pf.u*k).toFixed(2)} (bot think ${(bp.think*k).toFixed(2)}, bot avatar ${(bp.avatar*k).toFixed(2)}) | render submit ${(pf.r*k).toFixed(2)} | gpu wait after submit ${gpuWait.toFixed(1)}ms | WHOLE-FRAME draw calls ${i.calls} tris ${i.triangles} | visible cats ${cats} | programs ${renderer.info.programs?renderer.info.programs.length:'?'} | geometries ${renderer.info.memory.geometries} textures ${renderer.info.memory.textures} | biggest scene groups (visible meshes): ${grp.slice(0,6).map(x=>x[1]+':'+x[0]).join(', ')}`);
    pf.n=pf.u=pf.r=0;pf.t0=t;if(globalThis.__botProf){bp.think=0;bp.avatar=0}}}})(last);
// audio: browsers keep sound locked until a click / key press; every button also gets the click sound
addEventListener('pointerdown',e=>{audio.unlock();if(e.target.closest&&e.target.closest('button,.btn,.mode,.mm-t,.cslot,#title'))audio.play('click')},true);
addEventListener('keydown',e=>{if(e.code==='KeyM'&&!e.repeat&&!e.ctrlKey&&!e.altKey&&!e.metaKey&&state==='play'&&!paused&&!story.invOpen()&&!/INPUT|TEXTAREA|SELECT/.test((e.target&&e.target.tagName)||'')){hud.bigmap(!hud.bigmapOn());e.preventDefault();return}
  audio.unlock();const c=kb.canon(e.code);if(c===null){if(e.code==='Space')e.preventDefault();return}keys[c]=true;if(c==='Escape'&&state==='play'&&!paused)setPaused(true);else if(c==='KeyP'&&state==='play')setPaused(!paused);if(c==='KeyR'&&state==='play')reload();if(c==='KeyR'&&state==='over')(gm==='v5'?start5v5():rogue.start());if(c==='KeyG'&&(state==='play'||state==='title')){if(state==='play'&&!paused)setPaused(true);gfx.open()}if(/^Digit[1-8]$/.test(c)){const n=+c[5]-1;setWeapon((gm==='v5'||gm==='story'||rogue.active())&&P.loadout?(P.loadout[n]??P.wpn):n)}if(c==='Space'){e.preventDefault();if(!e.repeat)jump()}if(c==='ShiftLeft'&&!e.repeat)tumble();});addEventListener('keyup',e=>{const c=kb.canon(e.code);if(c)keys[c]=false});

// mouse: move = look (pointer lock), left click / hold = attack or shoot, right click = scope, wheel = swap weapon
addEventListener('mousedown',e=>{if(state!=='play'||story.invOpen())return;
  if(e.button===0){if(TOUCH&&!paused)return;   // touch controls have their own fire button (a touch also sends a fake mouse click)
    if(paused){if(!(e.target.closest&&e.target.closest('#quit,#pgfx,#gfx')))setPaused(false);return}if(gm==='v5'&&P.dead)return;if(!document.pointerLockElement)lockPtr();mouse.l=true}
  if(e.button===2&&isGunW()&&WP().stats.zoom&&!paused&&!P.dead)P.scope=true});
addEventListener('mouseup',e=>{if(TOUCH)return;if(e.button===0)mouse.l=false;if(e.button===2)P.scope=false});
addEventListener('mousemove',e=>{if(state==='play'&&!paused&&document.pointerLockElement){P.camYaw-=e.movementX*.0026;P.camPitch=Math.max(-.5,Math.min(.6,P.camPitch-e.movementY*.0022))}});
addEventListener('wheel',e=>{if(state==='play'&&!paused)setWeapon(P.wpn+(e.deltaY>0?1:-1))},{passive:true});
document.addEventListener('pointerlockchange',()=>{if(TOUCH||rouletteOn||starting5||story.invOpen()||hud.bigmapOn())return;   // setting up a match / roulette is not a pause
  if(!document.pointerLockElement&&state==='play'&&!paused&&!(gm==='v5'&&P.dead))setPaused(true)});
document.addEventListener('visibilitychange',()=>{if(TOUCH&&document.hidden&&state==='play'&&!paused&&!rouletteOn&&!starting5)setPaused(true)});   // app switched / screen off
addEventListener('contextmenu',e=>e.preventDefault());
addEventListener('pointermove',e=>{if((mkOn||selOn())&&e.buttons&&e.target.id==='c'){spin+=e.movementX*.01;spinHeld=true}});addEventListener('pointerup',()=>spinHeld=false);
// ---- menu flow: Title (Play / Settings / Exit) -> Character slots -> [Character maker if new] -> Mode select -> game
function hideMenus(){MENUS.forEach(m=>$('#'+m).hidden=true);$('#menuBack').hidden=true}
function showMenu(w){MENUS.forEach(m=>$('#'+m).hidden=m!==w);$('#menuBack').hidden=!(w==='slots'||w==='modes'||w==='worlds'||w==='wnew'||w==='pvp'||w==='search'||w==='lobby')}   // one shared Back button: switching slots <-> modes never re-animates it
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const headHTML=c=>{const u=headIconURL(c);return u?`<img src="${u}" alt="" draggable="false">`:''};   // 3D head of the cat (falls back to a coat-coloured dot)
// My Character tile: the WHOLE cat as a black front-facing silhouette with white eyes, playing its real idle animation (js/charIcon.js makes one sprite sheet, CSS plays it back and forth).
// Built right AFTER the menu is on screen (a few hundred ms, once per cat look), so the cards' pop-in never stutters. Falls back to the old head picture.
let silTok=0;
function showSil(c){
  const hd=$('#modeHd'),tok=++silTok;
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
  cfg=c?JSON.parse(JSON.stringify(c.cfg)):{};setCat();if(!c)blackOut(cat)}
function renderSlots(idx){   // idx = slot to land on (default: the cat you are playing)
  selList=[];slots.forEach((c,i)=>{if(c)selList.push(i)});const e=slots.findIndex(x=>!x);if(e>=0)selList.push(e);
  const p=selList.indexOf(idx===undefined?curSlot:idx);selPos=p>=0?p:Math.min(selPos,selList.length-1);
  clearAll();refill();equipIdx(0);rogue.demoReset();Object.assign(P,{x:0,z:0,camYaw:0,viewYaw:0,camPitch:0,hp:P.max,dead:false,inv:0,roll:0,rcd:0,scope:false,kick:0,dash:0});resetAir();mouse.l=false;dp.x=0;dp.z=0;   // stop the demo fight, cat stands still
  drawSel()}
const selMove=d=>{if(selList.length<2)return;selPos=(selPos+d+selList.length)%selList.length;drawSel();
  ['#chName','#chSub'].forEach((q,k)=>{const e=$(q);e.animate&&e.animate([{opacity:0,scale:.7},{opacity:1,scale:1.08,offset:.6},{opacity:1,scale:1}],{duration:320,delay:k*50,easing:'ease-out',fill:'backwards'})})};
function restoreCur(){cfg=slots[curSlot]?JSON.parse(JSON.stringify(slots[curSlot].cfg)):{};setCat();rogue.demoReset()}   // leaving without choosing: the cat you were playing comes back

function selectSlot(i){curSlot=i;try{localStorage.setItem('sad.lastSlot',i)}catch(e){}cfg=JSON.parse(JSON.stringify(slots[i].cfg));best=slots[i].best||0;setCat();$('#bestT').textContent=best;$('#modeName').textContent=cfg.name||'Ming';
  showSil(cfg);renderPill($('#rkpill'));showMenu('modes')}
// ---- TAP TO PLAY: tap anywhere on the title. Straight to the main menu with your last cat; with no cat yet, the "Create your own character" modal comes first.
const hasChar=()=>slots.some(Boolean);
function enterMain(){
  const ls=parseInt(localStorage.getItem('sad.lastSlot'),10),i=slots[ls]?ls:slots.findIndex(Boolean);
  selectSlot(i);const b=$('#menuBack');b.classList.remove('in');void b.offsetWidth;b.classList.add('in')}   // the Back button swipes in when you leave the title
$('#title').addEventListener('click',e=>{if(e.target.closest('#install'))return;if(!hasChar()){$('#newcat').hidden=false;return}enterMain()});
$('#ncGo').onclick=()=>{$('#newcat').hidden=true;openCreator(0,true)};   // modal -> cat maker (slot 1); saving it lands in the main menu
$('#ncBack').onclick=()=>{$('#newcat').hidden=true};
$('#menuBack').addEventListener('animationend',e=>e.currentTarget.classList.remove('in'));
$('#menuBack').onclick=()=>{if(lobby.active()){lobby.back();return}if(!$('#wnew').hidden){story.renderWorlds();showMenu('worlds');return}if(!$('#worlds').hidden){showMenu('modes');return}
  if(!$('#slots').hidden){   // My Character -> back to the main menu (with the current cat, or the first one that is left after a delete)
    if(!slots[curSlot]){const j=slots.findIndex(Boolean);if(j<0){cfg={};setCat();rogue.demoReset();showMenu('title');return}selectSlot(j);return}
    restoreCur();showMenu('modes');return}
  showMenu('title')};   // main menu -> TAP TO PLAY
$('#mRogue').onclick=async()=>{if(busyRogue)return;busyRogue=true;hideMenus();loading.show('','SURVIVAL');await tick();await tick();try{rogue.start()}catch(e){console.error(e)}await loading.done();busyRogue=false};   // survival also gets the simple mode loading screen
let busyRogue=false;          // roguelike endless = the forest map
$('#mV5').onclick=()=>{hideMenus();start5v5()};
// ---- PVP (custom battle): WebRTC room (host's browser = the room) + the Host / Join / lobby screens
const net=createNet();
lobby=createPvpLobby({$,net,showMenu,headHTML,profile:()=>({name:cfg.name||'Ming',cfg:JSON.parse(JSON.stringify(cfg))}),begin:info=>{hideMenus();start5v5(info)},themes:()=>ARENA_THEMES.map(t=>t.id)});
const inPvp=()=>gm==='v5'&&!!mode5&&mode5.pvp;
net.onPeer=(from,d)=>{if(lobby.onPeer(from,d))return;if(!mode5)mode5=mk5();mode5.onNet(from,d)};   // lobby messages stay in the lobby, the rest belongs to the match
net.onSrv=m=>{if(m.t==='closed'&&(starting5||inPvp())){pvpClosed=true;if(inPvp()){hud.banner('HOST LEFT','back to the title');enterTitle()}return}
  if(inPvp()){if(m.t==='peer-')mode5.peerLeft(m.id);return}lobby.onSrv(m)};
$('#mPvp').onclick=()=>lobby.open();
$('#mStory').onclick=()=>story.openWorlds();          // story = generated world, 3 save slots (js/storyMode.js)
['#mRogue','#mV5','#mStory','#mPvp','#mChar','#gfxOpen','#mCoop','#mAch','#mDaily'].forEach(s=>$(s).addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();e.stopPropagation();$(s).click()}}));
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
['#mCoop','#mAch','#mDaily'].forEach(s=>{const el=$(s);el.onclick=()=>{el.classList.remove('nope');void el.offsetWidth;el.classList.add('nope')};el.addEventListener('animationend',ev=>{if(ev.animationName==='mmNope')el.classList.remove('nope')})});   // not available yet: just a shake
$('#again').onclick=rogue.start;$('#home').onclick=enterTitle;$('#resume').onclick=()=>setPaused(false);$('#pgfx').onclick=()=>gfx.open();$('#gfxOpen').onclick=()=>gfx.open();$('#quit').onclick=enterTitle;
function openCreator(slotIdx,fromTitle){
  // the title battlefield keeps running live behind the maker (the demo cat keeps fighting): only the cfg, the camera angle and the side of the screen change
  const prevCfg=cfg;cfg=slots[slotIdx]?JSON.parse(JSON.stringify(slots[slotIdx].cfg)):{};setCat();hideMenus();mkOn=true;spin=0;spinHeld=false;camAz=camTo=0;viewTo=.17;   // cat glides to the left, the panel is on the right
  const close=()=>{mkOn=false;camTo=0;spin=0;viewTo=0};   // back to the centred drone shot
  openMaker(cfg,{change:c=>{cfg=c;setCat()},view:a=>camTo=a,
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
  const SEL={title:'#title button',newcat:'#newcat button',slots:'#slots button',worlds:'#worlds .cslot,#worlds .cslot button',wnew:'#wnew input[type=text],#wnew .dopt,#wnew .btn',modes:'#modes .mm-t',pvp:'#pvp .mode',search:'#search input[type=text],#search .btn',lobby:'#lobby .cslot,#lobby .cslot button,#lobby .btn',over:'#over button',pause:'#pause button',
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
