import * as T from 'three';
import {createCatAvatar} from './js/catAvatar.js';
import {buildMap,W,H} from './js/forestMap.js';
import {buildEnemy,STATS} from './js/enemies/index.js';
import {openMaker} from './js/catMaker.js';
import {createFX} from './js/effects.js';
import {createAtmosphere} from './js/atmosphere.js';
import {createHUD} from './js/hud.js';
import {WEAPONS} from './js/weapons/index.js';
import {createSettings} from './js/settings.js';
import {createMode5v5} from './js/5v5.js';
import {patchCat} from './js/enemies/playersAi.js';

const lerp2=(a,b,t)=>a+(b-a)*t,clamp=(v,a,b)=>Math.max(a,Math.min(b,v));const $=s=>document.querySelector(s),rnd=(a,b)=>a+Math.random()*(b-a);
const renderer=new T.WebGLRenderer({antialias:true,alpha:true,canvas:$('#c')});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setClearColor(0,0);
const scene=new T.Scene();
const cam=new T.PerspectiveCamera(70,1,.1,480),fx=createFX(scene),tmp=new T.Vector3();
const atm=createAtmosphere(renderer,scene,cam);let curMode='';
const hud=createHUD();
const stage=new T.Group();stage.position.set(0,0,3);stage.visible=false;scene.add(stage);
[[1.7,.4],[1.25,.5]].forEach(([r,op],i)=>{const m=new T.Mesh(new T.CircleGeometry(r,48),new T.MeshBasicMaterial({color:'#fff',transparent:true,opacity:op,depthWrite:false}));m.rotation.x=-Math.PI/2;m.position.y=.005+i*.004;stage.add(m)});
addEventListener('resize',resize);let gfx=null;const prr=()=>gfx?gfx.pr():Math.min(devicePixelRatio,1.5);
function resize(){renderer.setPixelRatio(prr());renderer.setSize(innerWidth,innerHeight);atm.resize(innerWidth,innerHeight,prr());cam.aspect=innerWidth/innerHeight;const f=cam.userData.off||0;f?cam.setViewOffset(innerWidth,innerHeight,innerWidth*f,0,innerWidth,innerHeight):cam.clearViewOffset();cam.updateProjectionMatrix()}
function setView(f){cam.userData.off=f;resize()}resize();
const map=buildMap(7,atm.envMap);scene.add(map.group);
gfx=createSettings({atm,map,onResolution:resize});   // graphics options (presets + per-option, saved, applied live)
const KC={frog:'#6fd36b',rabbit:'#d9c3a0',spider:'#6a4c9a',bee:'#ffd23a'};
let cfg=JSON.parse(localStorage.getItem('sad.cat')||'{}'),cat,state='title',clock=0,paused=false,spin=0,spinHeld=false,run=false,ang=0,backup=null,gunUntil=0;
let gm='wave',elapsed=0,wave=1,kills=0,score=0,spawnT=1,best=+localStorage.getItem('sad.best')||0;
const P={x:0,z:0,hp:5,max:5,inv:0,cd:0,mv:false,aim:0,shake:0,hx:0,hz:0,rel:1,camDist:2.8,camYaw:0,camPitch:0,roll:0,rcd:0,rdx:0,rdz:1,kick:0,wpn:0,blink:0,scope:false,hs:0,dash:0,dx:0,dz:1,fwd:0,side:0,viewYaw:0,chain:0,chainT:0,dead:false,frozen:false},bullets=[],ebul=[],enemies=[],pickups=[],keys={},mouse={l:false};
// ---- waves: a wave is a fixed number of enemies; the next wave starts only once every one of them is defeated
const WV={phase:'intro',t:0,left:0,total:0,spawnT:0};
const quota=w=>Math.min(44,4+w*2),maxAlive=w=>Math.min(4+Math.floor(w*1.2),12);
const bGeo=new T.SphereGeometry(.14,8,8),bMat=new T.MeshBasicMaterial({color:'#ffe066'}),eMat=new T.MeshBasicMaterial({color:'#ff7a3c'});
const hs=new T.Shape();hs.moveTo(.25,.25);hs.bezierCurveTo(.25,.25,.2,0,0,0);hs.bezierCurveTo(-.3,0,-.3,.35,-.3,.35);hs.bezierCurveTo(-.3,.55,-.15,.77,.25,.95);hs.bezierCurveTo(.65,.77,.8,.55,.8,.35);hs.bezierCurveTo(.8,.35,.8,0,.5,0);hs.bezierCurveTo(.35,0,.25,.25,.25,.25);
const heartGeo=new T.ExtrudeGeometry(hs,{depth:.25,bevelEnabled:true,bevelSize:.06,bevelThickness:.06,bevelSegments:3});heartGeo.translate(-.25,-.5,-.12);heartGeo.scale(.5,.5,.5);const heartMat=new T.MeshStandardMaterial({color:'#ff4d6d',roughness:.5,emissive:'#ff2a52',emissiveIntensity:.35});
const casts=o=>o.traverse(m=>{if(m.isMesh){m.castShadow=true;m.receiveShadow=true}});
const WP=()=>WEAPONS[P.wpn],isGunW=()=>WP().kind==='gun';
function equipIdx(i){P.wpn=i;P.scope=false;cat.userData.equip(WEAPONS[i]);hud.weapon(i)}
function setCat(){if(cat)scene.remove(cat);cat=createCatAvatar(cfg);patchCat(cat);casts(cat);scene.add(cat);hud.name(cfg.name);cat.userData.onSlashHit=meleeHit;cat.userData.equip(WP());hud.weapon(P.wpn)}
function setWeapon(i){i=(i+WEAPONS.length)%WEAPONS.length;if(state!=='play'||paused||P.roll>0||P.wpn===i)return;equipIdx(i)}
function meleeHit(d){const st=WP().stats,fx_=Math.sin(P.camYaw),fz_=Math.cos(P.camYaw);let hitAny=false;
  enemies.forEach(e=>{const dx=e.x-P.x,dz=e.z-P.z,dist=Math.hypot(dx,dz)||1;if(e.dodge<=0&&dist<st.range+e.r&&(dx*fx_+dz*fz_)/dist>st.arc){e.hp-=st.dmg;e.hbT=2.5;e.fl=.2;e.stun=.3;e.alert=6;e.x+=dx/dist*1.4;e.z+=dz/dist*1.4;fx.hit(new T.Vector3(e.x,.8,e.z),'#fff3b0',9);hitAny=true}});
  for(let i=ebul.length-1;i>=0;i--){const b=ebul[i],p=b.m.position;if(Math.hypot(p.x-P.x,p.z-P.z)<Math.min(2.4,st.range)){fx.hit(p,'#ffd8a0',5);scene.remove(b.m);ebul.splice(i,1)}}
  if(gm==='v5'&&mode5.playerMelee(fx_,fz_))hitAny=true;
  P.shake=Math.max(P.shake,hitAny?.38:.12);if(hitAny){P.hs=.07;hud.hit(false)}}
function tumble(){if((state!=='play'&&state!=='title')||paused||P.roll>0||P.rcd>0||P.dead||P.frozen)return;let f=P.fwd,s=P.side;if(!f&&!s)f=1;
  const fxv=Math.sin(P.camYaw),fzv=Math.cos(P.camYaw),rx=-Math.cos(P.camYaw),rz=Math.sin(P.camYaw);let dx=fxv*f+rx*s,dz=fzv*f+rz*s;const l=Math.hypot(dx,dz)||1;
  if(cat.userData.tumble(f,s)){P.roll=.55;P.rcd=.95;P.rdx=dx/l;P.rdz=dz/l;P.inv=Math.max(P.inv,.55);P.scope=false;fx.puff(new T.Vector3(P.x,.2,P.z),'#ffffff',5)}}
function hudAll(){hud.hp(P.hp,P.max);hud.wave(wave);hud.foes(WV.left+enemies.length,WV.total);hud.score(score,kills,best)}
function beginWave(w){wave=w;WV.total=WV.left=quota(w);WV.phase='intro';WV.t=2.6;WV.spawnT=.4;P.chain=0;hud.banner(`WAVE ${w}`,`${WV.total} enemies`);hudAll()}
function lockPtr(){try{const r=$('#c').requestPointerLock&&$('#c').requestPointerLock();r&&r.catch&&r.catch(()=>{})}catch(e){}}
function setPaused(v){paused=v;hud.pause(v);if(v){mouse.l=false;P.scope=false;document.exitPointerLock&&document.exitPointerLock()}else lockPtr()}
function clearAll(){[enemies,pickups].forEach(a=>{a.forEach(e=>scene.remove(e.g||e.m));a.length=0});[bullets,ebul].forEach(a=>{a.forEach(b=>scene.remove(b.m));a.length=0})}
function push(o,rad){for(const r of map.obs){const dx=o.x-r.x,dz=o.z-r.z,d=Math.hypot(dx,dz),m=r.r+rad;if(d<m&&d>0){o.x=r.x+dx/d*m;o.z=r.z+dz/d*m}}}
function enterTitle(){leave5();clearAll();state='title';paused=false;mouse.l=false;document.exitPointerLock&&document.exitPointerLock();
  P.x=0;P.z=0;P.hp=P.max;P.inv=0;P.roll=0;P.rcd=0;P.scope=false;P.kick=0;P.camYaw=0;P.viewYaw=0;P.camPitch=0;P.dash=0;wave=3;spawnT=.6;bot.t=0;bot.wt=0;hud.show(false);
  equipIdx(0);setView(-.17);$('#over').hidden=true;$('#title').hidden=false;$('#bestT').textContent=best}
function start(){leave5();clearAll();P.x=0;P.z=0;P.hp=P.max;P.inv=0;elapsed=0;wave=1;kills=0;score=0;spawnT=.5;paused=false;state='play';['#title','#over'].forEach(s=>$(s).hidden=true);hud.reset();hud.show(true);hud.pause(false);P.roll=0;P.rcd=0;P.scope=false;P.kick=0;P.camYaw=0;P.viewYaw=0;P.camPitch=0;P.chain=0;P.chainT=0;mouse.l=false;setView(0);lockPtr();equipIdx(0);hud.name(cfg.name);beginWave(1)}
function spawn(){const k=Math.random()<Math.min(.55,.22+wave*.08)?'ranged':'melee';let x,z,n=0;
  do{const a=rnd(0,6.283),d=rnd(13,18);x=P.x+Math.cos(a)*d;z=P.z+Math.sin(a)*d}while(n++<25&&(Math.abs(x)>W/2-2||Math.abs(z)>H/2-2||map.obs.some(o=>Math.hypot(o.x-x,o.z-z)<o.r+.9)));
  x=Math.max(-W/2+2,Math.min(W/2-2,x));z=Math.max(-H/2+2,Math.min(H/2-2,z));const g=buildEnemy(k);casts(g);scene.add(g);const hp=Math.ceil(STATS[k].hp*(1+(wave-1)*.15));
  enemies.push({g,k,x,z,y:0,hp,mhp:hp,hbT:0,r:STATS[k].r,t:rnd(0,3),s:0,st:'idle',sta:1,cd:rnd(.6,1.4),fl:0,yaw:Math.atan2(P.x-x,P.z-z),alert:rnd(0,1)<.5?4:0,
    wx:null,wz:0,wt:0,dodge:0,dcd:0,dsd:1,ddx:0,ddz:0,lastB:null,stun:0,pt:0,hit:false,burst:0,bcd:0,aimT:0,mt:0,sneak:false,strafe:1,jcd:rnd(1.5,4),jy:0,jx:0,jz:0,tx:0,tz:0,dc:k==='ranged'?.35:.2});
  fx.puff(new T.Vector3(x,.3,z),g.userData.col,4)}
function hurt(){if(P.inv>0)return;if(state==='title'){P.inv=.8;P.shake=Math.max(P.shake,.15);return}
  hud.hurt();P.hp--;P.inv=1.2;P.blink=1.2;P.shake=.4;hudAll();if(P.hp<=0){state='over';mouse.l=false;document.exitPointerLock&&document.exitPointerLock();best=Math.max(best,score);localStorage.setItem('sad.best',best);hud.show(false);$('#over').hidden=false;
  $('#sW').textContent=wave;$('#sK').textContent=kills;$('#sS').textContent=score;$('#best').textContent='Best: '+best}}
function shoot(){const w=WP(),st=w.stats;P.cd=st.cd;cat.userData.kick(st.kick||1);const o=cat.userData.muzzle(tmp);const sc=cat.userData.scope();
  // aim at the point under the crosshair (11 units ahead on the view line), so bullets follow the crosshair up and down too
  const cp=Math.cos(P.camPitch),tx=P.x+Math.sin(P.camYaw)*cp*11,ty=1+Math.sin(P.camPitch)*11,tz=P.z+Math.cos(P.camYaw)*cp*11;
  let ax=tx-o.x,ay=ty-o.y,az=tz-o.z;const al=Math.hypot(ax,ay,az)||1;ax/=al;ay/=al;az/=al;
  const baseYaw=Math.atan2(ax,az),baseEl=Math.asin(ay),sp=st.speed;
  for(let n=0;n<(st.pellets||1);n++){
    const k=st.spread*(1-sc*(st.scopeSteady??.7)),yaw=baseYaw+(Math.random()-.5)*k,el=baseEl+(Math.random()-.5)*k*.5,ce=Math.cos(el),m=fx.bullet(st.color);
    m.position.copy(o);m.rotation.order='YXZ';m.rotation.set(-el,yaw,0);if(st.size)m.scale.setScalar(st.size);scene.add(m);
    bullets.push({m,vx:Math.sin(yaw)*ce*sp,vy:Math.sin(el)*sp,vz:Math.cos(yaw)*ce*sp,life:st.life||1,dmg:st.dmg,pierce:st.pierce||0,hit:new Set(),col:st.color})}
  fx.muzzle(o,baseYaw);P.shake=Math.max(P.shake,st.shake||.1);P.kick=Math.max(.2,(st.kick||1)*.5);P.dx=-Math.sin(P.camYaw);P.dz=-Math.cos(P.camYaw);P.dash=st.push||1}
// clear line between two points (trees block sight and bullets)
function los(ax,az,bx,bz){const dx=bx-ax,dz=bz-az,l2=dx*dx+dz*dz||1;
  for(const r of map.obs){const t=Math.max(0,Math.min(1,((r.x-ax)*dx+(r.z-az)*dz)/l2));if(Math.hypot(ax+dx*t-r.x,az+dz*t-r.z)<r.r*.9)return false}return true}
const turnTo=(a,b,k)=>a+Math.atan2(Math.sin(b-a),Math.cos(b-a))*k;
function enemyShoot(e,d){const ud=e.g.userData,o=ud.muzzle(tmp),sneak=e.sneak,spread=(Math.random()-.5)*(sneak?.26:.12);
  const yaw=Math.atan2(P.x-o.x,P.z-o.z)+spread,dx=Math.sin(yaw),dz=Math.cos(yaw),m=fx.bullet('#ff7a3c');
  m.position.copy(o);m.rotation.y=yaw;scene.add(m);ebul.push({m,vx:dx*11,vz:dz*11,life:2.6});fx.muzzle(o,yaw);ud.kick()}
function ai(e,dt){
  const ud=e.g.userData,ranged=e.k==='ranged',dx=P.x-e.x,dz=P.z-e.z,d=Math.hypot(dx,dz)||1,ux=dx/d,uz=dz/d;
  e.t+=dt;e.fl=Math.max(0,e.fl-dt);e.stun=Math.max(0,e.stun-dt);e.alert=Math.max(0,e.alert-dt);e.dcd=Math.max(0,e.dcd-dt);e.jcd-=dt;
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
            fx.dust(new T.Vector3(e.x,.1,e.z));fx.hit(new T.Vector3(e.x,.2,e.z),'#e8dcb0',4)}}
        else if(e.st==='leap'){e.s-=dt;const u=1-Math.max(0,e.s)/.62;pose='air';pt=u;                                // committed: arcs through the air, bullets pass under it
          e.x=e.jx+(e.tx-e.jx)*u;e.z=e.jz+(e.tz-e.jz)*u;e.jy=4*2.1*u*(1-u);face=Math.atan2(e.tx-e.jx,e.tz-e.jz);
          if(e.s<=0){e.jy=0;e.st='land';e.s=.5;fx.shock(new T.Vector3(e.x,.1,e.z),'#ffe0a0');P.shake=Math.max(P.shake,.55);
            if(Math.hypot(P.x-e.x,P.z-e.z)<2.2){hurt();fx.hit(new T.Vector3(P.x,.8,P.z),'#ff7a3c',8)}}}
        else if(e.st==='land'){e.s-=dt;pose='land';pt=1-e.s/.5;if(e.s<=0){e.st='rest';e.s=1.35;e.jcd=rnd(4,6.5)}}   // slam, then it is stuck recovering: free hits
        else if(e.st==='tired'){pose='rest';e.sta=Math.min(1,e.sta+dt*.35);if(e.sta>=.7)e.st='chase'}   // catches its breath, then chases again
        else if(e.st==='wind'){face=toP;e.s-=dt;pose='wind';pt=1-e.s/.4;
          if(e.stun>0){e.st='rest';e.s=.9}else if(e.s<=0){e.st='strike';e.s=.2;e.hit=false}}
        else if(e.st==='strike'){e.s-=dt;pose='strike';pt=1-e.s/.2;mx=Math.sin(e.yaw);mz=Math.cos(e.yaw);sp=4.5;
          if(!e.hit&&pt>.35){e.hit=true;if(d<e.r+1.5){hurt();fx.hit(new T.Vector3(P.x,.8,P.z),'#ff7a3c',6)}}
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
  e.x+=mx*sp*dt;e.z+=mz*sp*dt;e.x=Math.max(-W/2+.8,Math.min(W/2-.8,e.x));e.z=Math.max(-H/2+.8,Math.min(H/2-.8,e.z));if(!(e.jy>.5))push(e,e.r);
  e.yaw=turnTo(e.yaw,face,Math.min(1,dt*(pose==='run'?14:9)));
  e.g.position.set(e.x,e.jy||0,e.z);e.g.rotation.y=e.yaw;e.g.scale.setScalar(1+e.fl*.8);
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
  if(!(state==='play'||demo)||paused)return;
  if(P.hs>0){P.hs-=dt;dt*=.12}
  if(demo){spawnT-=dt;if(spawnT<=0&&enemies.length<5){spawn();spawnT=2.2}}
  else if(gm!=='v5'){elapsed+=dt;
    if(WV.phase==='intro'){WV.t-=dt;if(WV.t<=0)WV.phase='fight'}
    else if(WV.phase==='fight'){
      WV.spawnT-=dt;if(WV.left>0&&enemies.length<maxAlive(wave)&&WV.spawnT<=0){spawn();WV.left--;WV.spawnT=Math.max(.45,1.8-wave*.12);hudAll()}
      if(WV.left<=0&&enemies.length===0){WV.phase='clear';WV.t=4.5;const bonus=100*wave;score+=bonus;if(P.hp<P.max)P.hp++;
        ebul.forEach(b=>scene.remove(b.m));ebul.length=0;fx.shock(new T.Vector3(P.x,.1,P.z),'#9be84f');hud.banner('WAVE CLEARED',`+${bonus} bonus   ·   +1 paw`,'clear long');hudAll();hud.foes(0,WV.total,'Area clear')}}
    else if(WV.phase==='clear'){WV.t-=dt;hud.foes(0,WV.total,`Next wave in ${Math.ceil(WV.t)}`);if(WV.t<=0)beginWave(wave+1)}
    P.chainT=Math.max(0,P.chainT-dt);if(P.chainT<=0)P.chain=0}
  
  // Camera rotation using Arrow keys
  const turnSpeed = 2.2, pitchSpeed = 1.8;
  if(keys.ArrowLeft) P.camYaw += turnSpeed * dt;
  if(keys.ArrowRight) P.camYaw -= turnSpeed * dt;
  if(keys.ArrowUp) P.camPitch += pitchSpeed * dt;
  if(keys.ArrowDown) P.camPitch -= pitchSpeed * dt;
  P.camPitch = Math.max(-0.5, Math.min(0.6, P.camPitch));

  // Player movement using WASD
  const inp=demo?botInput(dt):null;
  let fwd=demo?inp.f:(keys.KeyW?1:0)-(keys.KeyS?1:0),side=demo?inp.s:(keys.KeyD?1:0)-(keys.KeyA?1:0);if(P.dead||P.frozen){fwd=0;side=0}
  P.fwd=fwd;P.side=side;P.rel=fwd<0?-1:1;cat.userData.move.f=fwd;cat.userData.move.s=side;
  P.mv=(fwd!==0||side!==0)&&P.roll<=0;P.rcd=Math.max(0,P.rcd-dt);if(demo&&inp.roll)tumble();
  const sp=(P.scope&&isGunW()?3.2:6.5)*(WP().stats.move||1);
  if(P.roll>0){const u=P.roll/.55,v=11*(.25+.75*u);P.x+=P.rdx*v*dt;P.z+=P.rdz*v*dt;P.roll=Math.max(0,P.roll-dt)}
  else if(P.mv){const fxv=Math.sin(P.camYaw),fzv=Math.cos(P.camYaw),rx=-Math.cos(P.camYaw),rz=Math.sin(P.camYaw);
    const dx=fxv*fwd+rx*side,dz=fzv*fwd+rz*side,len=Math.hypot(dx,dz);if(len>0){P.x+=dx/len*sp*dt;P.z+=dz/len*sp*dt}}
  if(P.dash>0){P.x+=P.dx*P.dash*3*dt;P.z+=P.dz*P.dash*3*dt;P.dash=Math.max(0,P.dash-dt*9)}
  P.x=Math.max(-W/2+1,Math.min(W/2-1,P.x));P.z=Math.max(-H/2+1,Math.min(H/2-1,P.z));push(P,.45);
  
  P.aim=P.camYaw;
  P.cd-=dt;P.inv-=dt;cat.userData.setScope(P.scope&&isGunW()&&P.roll<=0);
  
  // Attack trigger is E (KeyE)
  if((keys.KeyE||mouse.l||(demo&&inp.atk))&&P.cd<=0&&P.roll<=0&&!P.dead&&!P.frozen){if(isGunW())shoot();else if(cat.userData.slash()){const st=WP().stats;P.cd=st.dur+.05;P.dx=Math.sin(P.camYaw);P.dz=Math.cos(P.camYaw);P.dash=st.dash}}

  for(let i=bullets.length-1;i>=0;i--){const b=bullets[i];b.m.position.x+=b.vx*dt;b.m.position.y+=(b.vy||0)*dt;b.m.position.z+=b.vz*dt;b.life-=dt;const p=b.m.position;let dead=b.life<=0||p.y<.03||p.y>7||Math.abs(p.x)>W/2||Math.abs(p.z)>H/2||map.obs.some(r=>Math.hypot(p.x-r.x,p.z-r.z)<r.r),flesh=false;
    for(const e of enemies)if(!dead&&Math.hypot(p.x-e.x,p.z-e.z)<e.r+.2&&e.dodge<=0&&!b.hit.has(e)&&Math.abs(p.y-.7-(e.jy||0))<1.2){e.hp-=b.dmg;e.hbT=2.5;e.fl=.12;e.stun=.12;e.alert=6;flesh=true;if(!demo)hud.hit(false);fx.hit(p,'#ffe066',8);fx.puff(p,e.g.userData.col||'#6f8f45',3);e.x+=b.vx*.012;e.z+=b.vz*.012;if(b.pierce>0){b.pierce--;b.hit.add(e)}else dead=true}
    if(!dead&&gm==='v5'&&mode5.bulletHit(p,b)){flesh=true;hud.hit(false);fx.hit(p,'#ffe066',8);dead=true}
    if(dead){if(!flesh&&b.life>0){fx.hit(p,'#fff3b0',5);fx.dust(p)}scene.remove(b.m);bullets.splice(i,1)}else fx.trail(p,b.vx,b.vz,b.col||'#ffd54a')}
  for(let i=ebul.length-1;i>=0;i--){const b=ebul[i];b.m.position.x+=b.vx*dt;b.m.position.z+=b.vz*dt;b.life-=dt;const p=b.m.position;let dead=b.life<=0||Math.abs(p.x)>W/2||Math.abs(p.z)>H/2||map.obs.some(r=>Math.hypot(p.x-r.x,p.z-r.z)<r.r);
    if(Math.hypot(p.x-P.x,p.z-P.z)<.55){hurt();dead=true;fx.hit(p,'#ff7a3c',6)}else if(dead&&b.life>0){fx.hit(p,'#ffb070',4);fx.dust(p)}if(dead){scene.remove(b.m);ebul.splice(i,1)}else fx.trail(p,b.vx,b.vz,'#ff7a3c')}
  enemies.forEach(e=>{ai(e,dt);e.hbT=Math.max(0,e.hbT-dt)});
  for(let i=0;i<enemies.length;i++)for(let j=i+1;j<enemies.length;j++){const a=enemies[i],b=enemies[j],dx=b.x-a.x,dz=b.z-a.z,d=Math.hypot(dx,dz),m=(a.r+b.r)*.9;if(d<m&&d>0){const k=(m-d)/2/d;a.x-=dx*k;a.z-=dz*k;b.x+=dx*k;b.z+=dz*k}}
  for(let i=enemies.length-1;i>=0;i--){const e=enemies[i];if(e.hp>0)continue;fx.puff(new T.Vector3(e.x,.7,e.z),e.g.userData.col||'#6f8f45');scene.remove(e.g);enemies.splice(i,1);
    if(!demo){P.chain++;P.chainT=3.2;score+=10*Math.min(5,1+Math.floor(P.chain/3));kills++;hud.hit(true)}
    if(Math.random()<(P.hp<=2?.2:.08)){const m=new T.Mesh(heartGeo,heartMat);m.position.set(e.x,.8,e.z);m.rotation.x=-.4;scene.add(m);pickups.push({m,x:e.x,z:e.z,t:0})}if(!demo)hudAll()}
  for(let i=pickups.length-1;i>=0;i--){const k=pickups[i];k.t+=dt;k.m.position.y=.8+Math.sin(k.t*3)*.15;k.m.rotation.y=k.t*2;
    if(Math.hypot(P.x-k.x,P.z-k.z)<.9){if(P.hp<P.max)P.hp++;fx.hit(k.m.position,'#ff9db8',10);scene.remove(k.m);pickups.splice(i,1);hudAll()}}
  if(gm==='v5')mode5.update(dt);
}
// ---- 5v5 SPIKE RUSH: hooks the mode in js/5v5.js needs (it drives 9 AI cats; you play on the blue team)
function leave5(){mode5.stop();gm='wave';document.body.classList.remove('v5');const l=document.querySelector('.wplate small');if(l)l.textContent='WAVE'}
function start5v5(){leave5();clearAll();gm='v5';P.x=0;P.z=0;P.hp=P.max;P.inv=0;P.dead=false;P.frozen=false;elapsed=0;paused=false;state='play';['#title','#over'].forEach(s=>$(s).hidden=true);
  hud.reset();hud.show(true);hud.pause(false);P.roll=0;P.rcd=0;P.scope=false;P.kick=0;P.camYaw=0;P.viewYaw=0;P.camPitch=0;P.chain=0;P.chainT=0;mouse.l=false;setView(0);
  document.body.classList.add('v5');const l=document.querySelector('.wplate small');if(l)l.textContent='ROUND';lockPtr();equipIdx(0);hud.name(cfg.name);
  mode5.start();mode5.bots.forEach(b=>casts(b.cat))}
function hurt5(n){if(P.inv>0||P.dead)return false;hud.hurt();P.hp-=n;P.inv=.12;P.shake=Math.max(P.shake,.35);hud.hp(Math.max(0,P.hp),P.max);
  if(P.hp<=0){P.hp=0;P.dead=true;mouse.l=false;P.scope=false;mode5.onPlayerDown()}return true}
function resetPlayer(x,z,yaw){P.x=x;P.z=z;P.camYaw=yaw;P.viewYaw=yaw;P.camPitch=0;P.hp=P.max;P.dead=false;P.frozen=false;P.inv=0;P.roll=0;P.rcd=0;P.scope=false;P.dash=0;P.kick=0;mouse.l=false;hud.hp(P.hp,P.max)}
function hud5(){const S=mode5.state();hud.hp(P.hp,P.max);hud.wave(S.round);const s=$('#score');if(s)s.textContent=`${S.score.A} : ${S.score.B}`}
function endMatch(){state='over';mouse.l=false;P.scope=false;document.exitPointerLock&&document.exitPointerLock();hud.show(false)}
const mode5=createMode5v5({scene,fx,map,P,keys,W,H,bullets,los,push,start5v5,home:()=>enterTitle(),
  toast:t=>{const [a,b='']=t.split(' · ');hud.banner(a,b)},hurt:hurt5,resetPlayer,hud:hud5,cat:()=>cat,endMatch,
  clearBullets:()=>{bullets.forEach(b=>scene.remove(b.m));bullets.length=0}});
let last=performance.now();
setCat();enterTitle();
(function loop(now){requestAnimationFrame(loop);const raw=(now-last)/1000,dt=Math.min(raw,.05);last=now;if(state!=='maker'&&!paused&&raw<.5)gfx.frame(raw,n=>hud.banner('Graphics: '+n,'lowered automatically for smoother play'));clock+=dt;update(dt);fx.update(dt);
  const mode=state==='maker'?'maker':'play';if(mode!==curMode){curMode=mode;atm.setMode(mode)}
  if(state!=='maker')map.update(clock,P,{sun:atm.sunDir,sky:atm.fogColor});atm.update(dt,clock,P);
  if(state!=='play')hud.scope(0);
  if(state==='play'||state==='over'||state==='title'){
    cat.position.set(P.x,0,P.z);
    cat.rotation.y = P.camYaw;
    P.blink=Math.max(0,P.blink-dt);cat.visible=!P.dead&&(state==='title'||P.blink<=0||Math.floor(clock*20)%2===0);
    cat.userData.setAim(P.camPitch,(state==='play'&&!paused)||state==='title');cat.userData.holster(false);cat.userData.update(paused?0:dt,P.mv&&(state==='play'||state==='title')&&!paused,P.rel);
    P.shake=Math.max(0,P.shake-dt*1.2);const sh=P.shake*P.shake*1.2;
    
    const aw=cat.userData.scope(),kk=P.kick=Math.max(0,P.kick-dt*5),dist=(state==='title'?4.8:lerp2(P.camDist,1.7,aw))+kk*.12,rightOffset=state==='title'?.5:lerp2(1.4,.8,aw);
    const targetFov=lerp2(70,WP().stats.zoom||40,aw)+kk*2;if(Math.abs(cam.fov-targetFov)>.01){cam.fov=targetFov;cam.updateProjectionMatrix()}
    const vy=state==='title'?P.viewYaw:P.camYaw,pit=(state==='title'?-.25:P.camPitch)+kk*.02;
    const rx=-Math.cos(vy),rz=Math.sin(vy),cp=Math.cos(pit),sp=Math.sin(pit),dX=Math.sin(vy)*cp,dY=sp,dZ=Math.cos(vy)*cp;
    const px=P.x+rx*rightOffset,pz=P.z+rz*rightOffset;
    const camX=px-dX*dist,camZ=pz-dZ*dist;let camY=1.0-dY*dist+rnd(-sh,sh)+(P.roll>0?-.15:0);camY=Math.max(.35,camY);
    cam.position.set(camX,camY,camZ);for(const o of map.obs){if(o.r>3)continue;const ox=cam.position.x-o.x,oz=cam.position.z-o.z,od=Math.hypot(ox,oz),om=o.r+.35;if(od<om&&od>1e-3){cam.position.x=o.x+ox/od*om;cam.position.z=o.z+oz/od*om}}   // keep the camera out of trunks and rocks
    cam.lookAt(P.x+dX*11,1+dY*11,P.z+dZ*11);   // looks at the point the bullets converge on
    cam.rotation.z+=rnd(-sh,sh)*.02+(P.roll>0?Math.sin(P.roll*14)*.02:0);
    if(state==='play'){cam.updateMatrixWorld();hud.scope(aw);hud.crosshair(7+kk*34+(P.mv?3:0)+(P.scope?-3:0)+P.shake*10,!paused);hud.tumble(1-P.rcd/.95);
      hud.combo(Math.min(5,1+Math.floor(P.chain/3)),P.chain,P.chainT/3.2);hud.bars(enemies,cam,clock);hud.radar(P,enemies,pickups,map,P.camYaw)}
  }
  else{const mk=state==='maker';let mv=false;
    if(mk&&run){ang+=dt*3;cat.position.set(Math.cos(ang)*.9,0,3+Math.sin(ang)*.9);cat.rotation.y=Math.atan2(-Math.sin(ang),Math.cos(ang));mv=true}
    else{cat.position.set(0,0,3);if(mk){if(!spinHeld){spin=Math.atan2(Math.sin(spin),Math.cos(spin));spin-=spin*Math.min(1,dt*4)}cat.rotation.y=spin}else cat.rotation.y=Math.sin(clock*.7)*.6}
    cat.visible=true;cat.userData.holster(performance.now()>gunUntil);cat.userData.update(dt,mv,1);if(mk){if(cam.fov!==38){cam.fov=38;cam.updateProjectionMatrix()}cam.position.set(0,1.0,6.0);cam.lookAt(0,.74,3)}else{cam.position.set(0,2.4,8);cam.lookAt(0,1,3)}}
  atm.render()})(last);
addEventListener('keydown',e=>{keys[e.code]=true;if(e.code==='Escape'&&state==='play'&&!paused)setPaused(true);else if(e.code==='KeyP'&&state==='play')setPaused(!paused);if(e.code==='KeyR'&&state==='over')(gm==='v5'?start5v5():start());if(e.code==='KeyG'&&(state==='play'||state==='title')){if(state==='play'&&!paused)setPaused(true);gfx.open()}if(/^Digit[1-8]$/.test(e.code))setWeapon(+e.code[5]-1);if(e.code==='Space'){e.preventDefault();tumble()}});addEventListener('keyup',e=>keys[e.code]=false);

// mouse: move = look (pointer lock), left click / hold = attack or shoot, right click = scope, wheel = swap weapon
addEventListener('mousedown',e=>{if(state!=='play')return;
  if(e.button===0){if(paused){if(!(e.target.closest&&e.target.closest('#quit,#pgfx,#gfx')))setPaused(false);return}if(!document.pointerLockElement)lockPtr();mouse.l=true}
  if(e.button===2&&isGunW()&&WP().stats.zoom&&!paused)P.scope=true});
addEventListener('mouseup',e=>{if(e.button===0)mouse.l=false;if(e.button===2)P.scope=false});
addEventListener('mousemove',e=>{if(state==='play'&&!paused&&document.pointerLockElement){P.camYaw-=e.movementX*.0026;P.camPitch=Math.max(-.5,Math.min(.6,P.camPitch-e.movementY*.0022))}});
addEventListener('wheel',e=>{if(state==='play'&&!paused)setWeapon(P.wpn+(e.deltaY>0?1:-1))},{passive:true});
document.addEventListener('pointerlockchange',()=>{if(!document.pointerLockElement&&state==='play'&&!paused)setPaused(true)});
addEventListener('contextmenu',e=>e.preventDefault());
addEventListener('pointermove',e=>{if(state==='maker'&&e.buttons&&e.target.id==='c'){spin+=e.movementX*.01;spinHeld=true}});addEventListener('pointerup',()=>spinHeld=false);
$('#play').onclick=start;$('#play5').onclick=start5v5;$('#again').onclick=start;$('#home').onclick=enterTitle;$('#resume').onclick=()=>setPaused(false);$('#pgfx').onclick=()=>gfx.open();$('#gfxOpen').onclick=()=>gfx.open();$('#quit').onclick=enterTitle;
$('#make').onclick=()=>{clearAll();P.x=0;P.z=0;backup=JSON.stringify(cfg);$('#title').hidden=true;state='maker';spin=0;spinHeld=false;run=false;setView(.17);map.group.visible=false;stage.visible=true;document.body.classList.add('mk');
  const close=()=>{state='title';run=false;setView(-.17);map.group.visible=true;stage.visible=false;document.body.classList.remove('mk');$('#title').hidden=false};
  openMaker(cfg,{change:c=>{cfg=c;setCat()},run:v=>run=v,shoot:()=>{gunUntil=performance.now()+900;cat.userData.kick();fx.muzzle(cat.userData.muzzle(tmp),cat.rotation.y)},
    done:()=>{localStorage.setItem('sad.cat',JSON.stringify(cfg));close()},cancel:()=>{cfg=JSON.parse(backup);setCat();close()}})};
