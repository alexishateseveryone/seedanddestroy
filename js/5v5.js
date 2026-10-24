// 5v5 SPIKE RUSH (Valorant-style): blue team (you + 4 AI cats) vs red team (5 AI cats).
// Rounds: 4s buy/freeze -> live. Attackers win by eliminating everyone or letting the spike explode; defenders win by eliminating the
// attackers before the plant, running out the clock, or defusing. Sides swap after round 3. First to 4 rounds wins.
// The AI players live in enemies/playersAi.js and use the same controls as the human player.
import * as T from 'three';
import {blocked} from './obsGrid.js';
import {createBot,stepBot,idleBot,TEAM_COL,NAMES} from './enemies/playersAi.js';
import {rollLobby,applyMatch,load as loadRank,info as rankInfo,badge,drawBadge} from './rank.js';
import {SPAWN,SITES as ST,heightAt as HA} from './arenaTerrain.js';   // layout + terrain of the hilly 5v5 arena (js/arenaMap.js)

const rnd=(a,b)=>a+Math.random()*(b-a),pick=a=>a[(Math.random()*a.length)|0],shuffle=a=>{for(let i=a.length-1;i>0;i--){const j=(Math.random()*(i+1))|0;[a[i],a[j]]=[a[j],a[i]]}return a};
const WIN=4,BUY=4,ROUND=90,SPIKE=25,PLANT=2.5,DEFUSE=4,BULLET={A:'#7ec8ff',B:'#ff7a6a'};

export function createMode5v5(ctx){
  const {scene,fx,map,P,keys,cam}=ctx,hw=ctx.W/2,hh=ctx.H/2,tmp=new T.Vector3();
  const S={active:false,round:0,score:{A:0,B:0},phase:'off',t:0,atk:'A',plan:'A',spike:{planted:false,site:null,t:0,x:0,z:0},plant:0,defuse:0,time:0,stats:{k:0,d:0}};
  let bots=[],bl=[],snap=[],prevN=0,visuals=null,hudT=0,lastHitBy=null;
  const pe={id:'player',isPlayer:true,team:'A',x:0,z:0,vx:0,vz:0,hp:5,wpn:1,roll:0,slash:false,alive:true,name:'YOU'};
  const vfr=new T.Frustum(),vpm=new T.Matrix4(),vsp=new T.Sphere(new T.Vector3(),3);   // view test for the cats (a bit generous: the camera it uses is last frame's)
  const spv={on:false,x:0,z:0,gy:0,ey:0,yaw:0},F=()=>spv.on?spv:P;   // where the 'player' is for distance LOD: the spectated ally while you are dead
  const free=(x,z)=>{for(let r=0;r<12;r+=1.5)for(let a=0;a<6.28;a+=.7){const px=x+Math.cos(a)*r,pz=z+Math.sin(a)*r;if(!blocked(map.obs,px,pz,3.2))return{x:px,z:pz}}return{x,z}};
  let SITES=null;

  // ------------------------------------------------------------------ DOM (HUD, kill feed, prompt, result card)
  const css=document.createElement('style');css.textContent=`
  #v5{position:fixed;inset:0;pointer-events:none;z-index:990;font-family:'Baloo 2',sans-serif;color:#fff}
  #v5bar{position:absolute;top:72px;left:50%;transform:translateX(-50%);display:flex;align-items:center;gap:14px;text-shadow:0 2px 0 #1a1238,0 0 8px #0009}
  #v5bar .t{font:400 22px 'Bungee',sans-serif;min-width:64px;text-align:center}#v5bar .d{display:flex;gap:5px}
  #v5bar .d i{width:13px;height:13px;border-radius:50%;background:#00000066;box-shadow:0 0 0 2px #ffffff66;display:block}#v5bar .d.a i.on{background:#4aa8ff;box-shadow:0 0 8px #4aa8ff}#v5bar .d.b i.on{background:#ff5a5a;box-shadow:0 0 8px #ff5a5a}
  #v5sp{position:absolute;top:116px;left:50%;transform:translateX(-50%);font:400 15px 'Bungee',sans-serif;letter-spacing:.08em;color:#ffd54a;text-shadow:0 2px 0 #3a2308;opacity:0}#v5sp.on{opacity:1}#v5sp.red{color:#ff5a5a;animation:v5b .5s infinite}
  @keyframes v5b{50%{opacity:.4}}
  #v5pr{position:absolute;bottom:150px;left:50%;transform:translateX(-50%);text-align:center;font:800 18px 'Baloo 2',sans-serif;text-shadow:0 2px 0 #0008;opacity:0}#v5pr.on{opacity:1}
  #v5pr .bar{width:200px;height:10px;border-radius:9px;background:#ffffff30;overflow:hidden;margin:6px auto 0}#v5pr .bar i{display:block;height:100%;width:0;background:#ffd54a}
  #v5feed{position:absolute;top:70px;right:18px;display:flex;flex-direction:column;gap:6px;align-items:flex-end}
  #v5feed div{background:rgba(43,33,80,.8);border-radius:12px;padding:3px 12px;font-weight:800;font-size:14px;animation:v5f 4s forwards}#v5feed b.a{color:#7ec8ff}#v5feed b.b{color:#ff8a7a}
  @keyframes v5f{0%{opacity:0;transform:translateX(30px)}8%{opacity:1;transform:none}85%{opacity:1}100%{opacity:0}}
  #v5rk2{position:absolute;top:140px;left:50%;transform:translateX(-50%);display:flex;align-items:center;gap:8px;background:rgba(43,33,80,.7);border:2px solid #ffffff30;border-radius:999px;padding:2px 12px 2px 6px;font:800 13px 'Baloo 2',sans-serif;white-space:nowrap;opacity:.9}
  #v5over .card h2{color:#5fcf4a}#v5over.lose .card h2{color:#e8453c}`;
  document.head.appendChild(css);
  const root=document.createElement('div');root.id='v5';root.hidden=true;root.innerHTML=`<div id="v5bar"><div class="d a"></div><div class="t" id="v5t">1:30</div><div class="d b"></div></div><div id="v5sp"></div><div id="v5pr"><span></span><div class="bar"><i></i></div></div><div id="v5feed"></div>`;document.body.appendChild(root);
  const over=document.createElement('div');over.id='v5over';over.className='panel';over.hidden=true;
  over.innerHTML=`<div class="card"><h2>VICTORY</h2><div class="stats"><div><b id="v5s">0-0</b><span>Rounds</span></div><div><b id="v5k">0</b><span>Your KOs</span></div><div><b id="v5d">0</b><span>Deaths</span></div></div><div class="rkbox" id="v5rk"></div><p id="best"></p><div class="row"><button id="v5again" class="btn green">Rematch</button><button id="v5home" class="btn gold">Title</button></div></div>`;document.body.appendChild(over);
  const $=s=>root.querySelector(s);over.querySelector('#v5again').onclick=()=>{over.hidden=true;ctx.start5v5()};over.querySelector('#v5home').onclick=()=>{over.hidden=true;ctx.home()};
  const feed=(a,b,ta,tb,sw)=>{const d=document.createElement('div');d.innerHTML=`<b class="${ta==='A'?'a':'b'}">${a}</b> ${sw?'🗡':'➤'} <b class="${tb==='A'?'a':'b'}">${b}</b>`;$('#v5feed').prepend(d);setTimeout(()=>d.remove(),4000);while($('#v5feed').children.length>5)$('#v5feed').lastChild.remove()};
  const dots=()=>{const n=t=>bots.filter(b=>b.team===t&&b.alive).length+(t==='A'&&!P.dead?1:0),mk=(t,k)=>Array.from({length:5},(_,i)=>`<i class="${i<n(t)?'on':''}"></i>`).join('');$('#v5bar .a').innerHTML=mk('A');$('#v5bar .b').innerHTML=mk('B')};
  const banner=t=>ctx.toast(t);

  // ------------------------------------------------------------------ world dressing: site rings + letters, spawn pads, spike
  const letter=(ch,c)=>{const cv=document.createElement('canvas');cv.width=cv.height=128;const g=cv.getContext('2d');g.font='900 100px Bungee, Impact, sans-serif';g.textAlign='center';g.textBaseline='middle';g.fillStyle=c;g.globalAlpha=.85;g.fillText(ch,64,70);const t=new T.CanvasTexture(cv);t.colorSpace=T.SRGBColorSpace;return t};
  function dress(){
    if(visuals)return;SITES={A:{id:'A',...ST.A,r:3.6},B:{id:'B',...ST.B,r:3.6}};
    const g=new T.Group(),flat=(geo,mat,x,z,y)=>{const m=new T.Mesh(geo,mat);m.rotation.x=-Math.PI/2;m.position.set(x,y+HA(x,z),z);g.add(m);return m};
    const rings={};
    for(const k of['A','B']){const s=SITES[k];rings[k]=flat(new T.RingGeometry(s.r-.18,s.r,56),new T.MeshBasicMaterial({color:'#ffffff',transparent:true,opacity:.75,depthWrite:false,side:T.DoubleSide}),s.x,s.z,.06);
      flat(new T.CircleGeometry(s.r,56),new T.MeshBasicMaterial({color:'#ffd54a',transparent:true,opacity:.14,depthWrite:false}),s.x,s.z,.05);
      flat(new T.PlaneGeometry(3,3),new T.MeshBasicMaterial({map:letter(k,'#ffffff'),transparent:true,depthWrite:false}),s.x,s.z,.07)}
    [['atk','#4aa8ff'],['def','#ff5a5a']].forEach(([k,c])=>{const x=SPAWN[k].x;flat(new T.CircleGeometry(7,40),new T.MeshBasicMaterial({color:c,transparent:true,opacity:.16,depthWrite:false}),x,0,.05);flat(new T.RingGeometry(6.8,7,48),new T.MeshBasicMaterial({color:c,transparent:true,opacity:.6,depthWrite:false}),x,0,.06)});
    const sp=new T.Group();const body=new T.Mesh(new T.BoxGeometry(.5,.2,.5),new T.MeshStandardMaterial({color:'#1b1b24',roughness:.5,metalness:.3}));body.position.y=.12;sp.add(body);
    const core=new T.Mesh(new T.SphereGeometry(.13,12,10),new T.MeshBasicMaterial({color:'#ff3a3a'}));core.position.y=.34;sp.add(core);const lt={intensity:0};   // plain object, NOT a PointLight: a light that becomes visible changes the scene's light count and makes three recompile every lit material (trees, ground, cats) = a big hitch each plant / round end
sp.visible=false;g.add(sp);
    scene.add(g);visuals={g,rings,spike:sp,core,lt}}
  const ringsColor=()=>{if(!visuals)return;for(const k of['A','B'])visuals.rings[k].material.color.set(S.spike.planted&&S.spike.site===k?'#ff4d4d':'#ffffff')};

  // ------------------------------------------------------------------ nameplates
  function plate(b){if(!b.plate){const cv=document.createElement('canvas');cv.width=192;cv.height=64;const tx=new T.CanvasTexture(cv);tx.colorSpace=T.SRGBColorSpace;const sp=new T.Sprite(new T.SpriteMaterial({map:tx,transparent:true,depthTest:false}));sp.scale.set(2.1,.7,1);sp.renderOrder=10;scene.add(sp);b.plate={cv,tx,sp}}
    const {cv,tx}=b.plate,g=cv.getContext('2d');g.clearRect(0,0,192,64);if(b.rank)drawBadge(g,19,24,12,b.rank);g.font='800 26px "Baloo 2",Arial,sans-serif';g.textAlign='center';g.lineWidth=6;g.strokeStyle='#1a1238';g.strokeText(b.name,96,24);g.fillStyle=TEAM_COL[b.team];g.fillText(b.name,96,24);
    for(let i=0;i<b.max;i++){g.fillStyle=i<b.hp?TEAM_COL[b.team]:'#ffffff30';g.beginPath();g.roundRect?g.roundRect(20+i*30,40,26,10,5):g.rect(20+i*30,40,26,10);g.fill()}tx.needsUpdate=true}

  // ------------------------------------------------------------------ combat
  const alive=t=>bots.filter(b=>b.team===t&&b.alive).length+(t==='A'&&!P.dead?1:0);
  function noiseAt(x,z,team){for(const b of bots)if(b.alive&&b.team!==team&&b.tid==null&&Math.hypot(b.x-x,b.z-z)<28)b.hear={x:x+rnd(-3,3),z:z+rnd(-3,3),t:S.time}}
  function damage(b,n,src){if(!b.alive||b.inv>0)return;b.hp-=n;const p=new T.Vector3(b.x,HA(b.x,b.z)+.8,b.z);fx.hit(p,'#ffe066',8);fx.puff(p,TEAM_COL[b.team],3);
    if(src&&src.x!==undefined&&b.tid==null)b.last={x:src.x,z:src.z,t:S.time};plate(b);
    if(b.hp<=0){b.alive=false;b.cat.visible=false;b.plate.sp.visible=false;fx.puff(new T.Vector3(b.x,HA(b.x,b.z)+.8,b.z),TEAM_COL[b.team],14);
      const sn=src?(src.isPlayer||src==='player'?'YOU':src.name):'?',st=src&&(src.isPlayer||src==='player')?'A':src?src.team:'A';
      if(src==='player'||(src&&src.isPlayer))S.stats.k++;feed(sn,b.name,st,b.team,src&&src.slashing);dots();check()}}
  function playerHit(n,src){if(P.dead||P.frozen||P.inv>0||P.roll>0)return false;lastHitBy=src;return ctx.hurt(n)}
  function botMelee(b){const fxv=Math.sin(b.yaw),fzv=Math.cos(b.yaw);
    for(const e of snap){if(e.team===b.team||!e.alive)continue;const dx=e.x-b.x,dz=e.z-b.z,d=Math.hypot(dx,dz)||1;if(d<3.1&&(dx*fxv+dz*fzv)/d>-.05){
      if(e.isPlayer){playerHit(3,b)}else{damage(e.ref,3,b);e.ref.x+=dx/d*1.4;e.ref.z+=dz/d*1.4}fx.hit(new T.Vector3(e.x,.8,e.z),'#fff3b0',9)}}}
  const world={hw,hh,obs:map.obs,time:()=>S.time,los:ctx.los,push:ctx.push,h:HA,puff:(x,z)=>fx.puff(new T.Vector3(x,HA(x,z)+.2,z),'#ffffff',5),
    foes:b=>snap.filter(e=>e.team!==b.team&&e.alive),
    threats:b=>{const o=[];for(const t of bl)if(t.team!==b.team)o.push({x:t.m.position.x,z:t.m.position.z,vx:t.vx,vz:t.vz});if(b.team==='B')for(const t of ctx.bullets)o.push({x:t.m.position.x,z:t.m.position.z,vx:t.vx,vz:t.vz});return o},
    fire:b=>{const o=b.cat.userData.muzzle(tmp),yaw=b.yaw+(Math.random()-.5)*.22*(1.4-b.skill)*(b.scope?.3:1),dx=Math.sin(yaw),dz=Math.cos(yaw),m=fx.bullet(BULLET[b.team]);
      m.position.copy(o);m.rotation.set(0,yaw,0);scene.add(m);
      const tg=snap.find(e=>e.id===b.tid),dd=tg?Math.hypot(tg.x-b.x,tg.z-b.z)||1:0,vy=tg?Math.max(-8,Math.min(8,(HA(tg.x,tg.z)+.8-o.y)/dd*22)):0;   // aim up / down the slope at the target
      bl.push({m,vx:dx*22,vy,vz:dz*22,life:1.1,team:b.team,owner:b});if(Math.hypot(b.x-F().x,b.z-F().z)<45)fx.muzzle(o,yaw,{lite:.3});b.cat.userData.kick();noiseAt(b.x,b.z,b.team)},
    far:b=>{if(b.inView===false)return 2;const f=F(),d=Math.hypot(b.x-f.x,b.z-f.z);return d>45?2:d>28?1:0},   // distance class for the avatar LOD in playersAi.stepBot
    objective:b=>objective(b)};

  // objectives: attackers -> site (planter plants, the rest cover), post-plant spots; defenders -> hold angles, rotate on info, defuse
  const defSide=(x,z)=>Math.atan2(SPAWN.def.x-x,0-z);
  function objective(b){
    const atk=b.team===S.atk,site=SITES[b.plan],sp=S.spike;
    if(S.phase==='buy')return{x:b.x,z:b.z,rad:99,type:'hold'};
    if(atk){
      if(sp.planted){const base=Math.atan2(SPAWN.def.z-sp.z,SPAWN.def.x-sp.x),a=base+(b.slot-2)*.55,R=5.5;return{x:sp.x+Math.cos(a)*R,z:sp.z+Math.sin(a)*R,rad:1.8,type:'post',face:defSide(sp.x,sp.z)}}
      if(S.planter===b)return{x:site.x,z:site.z,rad:1.4,type:'plant',face:defSide(site.x,site.z)};
      const base=Math.atan2(SPAWN.def.z-site.z,SPAWN.def.x-site.x),a=base+(b.slot-2)*.6,R=site.r*.9;return{x:site.x+Math.cos(a)*R,z:site.z+Math.sin(a)*R,rad:2,type:'hold',face:defSide(site.x,site.z)};
    }
    if(sp.planted){if(S.defuser===b)return{x:sp.x,z:sp.z,rad:1.1,type:'defuse',face:0};
      const base=Math.atan2(SPAWN.atk.z-sp.z,SPAWN.atk.x-sp.x),a=base+(b.slot-2)*.6,R=7;return{x:sp.x+Math.cos(a)*R,z:sp.z+Math.sin(a)*R,rad:2,type:'hold',face:Math.atan2(-b.x+sp.x,-b.z+sp.z)}}
    const base=Math.atan2(0-site.z,SPAWN.atk.x-site.x),a=base+(b.slot-2)*.5,R=4.8;
    return{x:site.x+Math.cos(a)*R,z:site.z+Math.sin(a)*R,rad:2.2,type:'hold',face:Math.atan2(SPAWN.atk.x-b.x,0-b.z)};
  }

  // ------------------------------------------------------------------ rounds
  function placeBots(){
    const atk=shuffle([-8,-4,0,4,8]),def=shuffle([-8,-4,0,4,8]);let ia=0,id=0;
    const pl=S.plan,other=pl==='A'?'B':'A';let atkBots=bots.filter(b=>b.team===S.atk),defBots=bots.filter(b=>b.team!==S.atk);
    atkBots.forEach((b,i)=>{b.plan=i===0?other:pl;b.slot=i});defBots.forEach((b,i)=>{b.plan=i<2?'A':i<4?'B':pick(['A','B']);b.slot=i});
    bots.forEach(b=>{const a=b.team===S.atk,x=a?SPAWN.atk.x:SPAWN.def.x,z=a?atk[ia++%5]:def[id++%5];
      Object.assign(b,{x,z,yaw:a?Math.PI/2:-Math.PI/2,hp:5,alive:true,wpn:1,roll:0,rcd:0,inv:0,cd:0,swap:0,scope:false,dash:0,tid:null,last:null,hear:null,react:0,burstT:0,shots:0,act:false,spot:null,mv:false,vx:0,vz:0});
      b.cat.visible=true;b.cat.userData.setWeapon('gun');b.cat.position.set(x,HA(x,z),z);plate(b);b.plate.sp.visible=true});
    const pa=S.atk==='A';ctx.resetPlayer(pa?SPAWN.atk.x:SPAWN.def.x,pa?atk[ia%5]:def[id%5],pa?Math.PI/2:-Math.PI/2);
  }
  function startRound(){
    S.round++;S.atk=S.round<=3?'A':'B';if(S.round===4)banner('SIDES SWAPPED');S.plan=pick(['A','B']);S.phase='buy';S.t=BUY;S.plant=S.defuse=0;S.spike={planted:false,site:null,t:0,x:0,z:0};
    bl.forEach(b=>scene.remove(b.m));bl.length=0;ctx.clearBullets();visuals.spike.visible=false;visuals.lt.intensity=0;ringsColor();placeBots();dots();ctx.hud();
    banner(`ROUND ${S.round} · ${S.atk==='A'?'ATTACK':'DEFEND'}${S.atk==='A'?' '+S.plan:''}`);setTimeout(()=>{},0);sp('');
  }
  function sp(t,red){const e=$('#v5sp');e.textContent=t;e.className=t?(red?'on red':'on'):''}
  function endRound(w,why){if(S.phase==='end'||S.phase==='done')return;S.score[w]++;S.phase='end';S.t=3.6;banner(`${w==='A'?'BLUE':'RED'} WINS THE ROUND · ${why}`);ctx.hud();
    if(S.score[w]>=WIN)S.phase='done',setTimeout(()=>matchEnd(w),1800)}
  function matchEnd(w){if(!S.active)return;const win=w==='A';over.classList.toggle('lose',!win);over.querySelector('h2').textContent=win?'VICTORY':'DEFEAT';over.querySelector('#v5s').textContent=`${S.score.A}-${S.score.B}`;over.querySelector('#v5k').textContent=S.stats.k;over.querySelector('#v5d').textContent=S.stats.d;
    
    // ---- ranked result: RR gained / lost, promotion or demotion, placement games count double
    const res=applyMatch({win,a:S.score.A,b:S.score.B,k:S.stats.k,d:S.stats.d}),bx=over.querySelector('#v5rk');
    const startPct=res.promoted?0:res.demoted?100:res.before.pct;bx.classList.toggle('dn',res.delta<0);
    bx.innerHTML=`<div class="rkh">${badge(res.after,38)}<div><b class="rkn">${res.after.label}</b><small>${res.placement?'PLACEMENT MATCH':res.after.rr+' RR · '+res.rec.w+'W '+res.rec.l+'L'}</small></div><b class="rkd ${res.delta>=0?'up':'dn'}">${res.delta>=0?'+':''}${res.delta} RR</b></div><div class="rkbar"><i style="width:${startPct}%"></i></div><div class="rkx" style="color:${res.promoted?'#2f8a2a':'#c0392b'}">${res.promoted?'RANK UP!':res.demoted?'DERANKED':''}</div>`;
    setTimeout(()=>{const i=bx.querySelector('.rkbar i');if(i)i.style.width=res.after.pct+'%'},350);
    ctx.endMatch();over.hidden=false}
  function check(){if(S.phase!=='live'&&S.phase!=='planted')return;const def=S.atk==='A'?'B':'A',a=alive(S.atk),d=alive(def);
    if(d===0)endRound(S.atk,'ELIMINATION');else if(a===0&&!S.spike.planted)endRound(def,'ELIMINATION')}
  function plant(x,z,site){S.spike={planted:true,site,t:SPIKE,x,z};S.phase='planted';S.plant=0;visuals.spike.position.set(x,HA(x,z),z);visuals.spike.visible=true;ringsColor();banner(`SPIKE PLANTED · ${site}`);fx.hit(new T.Vector3(x,.3,z),'#ff4d4d',10);check()}
  function nearestSite(x,z){let best=null,bd=1e9;for(const k of['A','B']){const s=SITES[k],d=Math.hypot(s.x-x,s.z-z);if(d<bd){bd=d;best=s}}return{s:best,d:bd}}

  // ------------------------------------------------------------------ frame
  function refresh(dt){
    pe.vx=(P.x-pe.x)/Math.max(dt,1e-3);pe.vz=(P.z-pe.z)/Math.max(dt,1e-3);pe.x=P.x;pe.z=P.z;pe.hp=P.hp;pe.alive=!P.dead;pe.roll=P.roll;pe.wpn=P.wpn;pe.slash=ctx.cat().userData.isSlashing();
    snap=[pe];
    for(const b of bots){const s=b.snap||(b.snap={ref:b,id:b.id,team:b.team,isPlayer:false});s.x=b.x;s.z=b.z;s.vx=b.vx;s.vz=b.vz;s.hp=b.hp;s.alive=b.alive;s.slash=b.slashing;s.wpn=b.wpn;s.roll=b.roll;snap.push(s)}
  }
  function separate(){const all=[...bots.filter(b=>b.alive)];
    for(let i=0;i<all.length;i++){const a=all[i];
      if(!P.dead){const dx=a.x-P.x,dz=a.z-P.z,d=Math.hypot(dx,dz),m=.9;if(d<m&&d>0){a.x+=dx/d*(m-d)*.6;a.z+=dz/d*(m-d)*.6}}
      for(let j=i+1;j<all.length;j++){const b=all[j],dx=b.x-a.x,dz=b.z-a.z,d=Math.hypot(dx,dz),m=.9;if(d<m&&d>0){const k=(m-d)/2/d;a.x-=dx*k;a.z-=dz*k;b.x+=dx*k;b.z+=dz*k}}}}
  function bullets(dt){
    for(let i=bl.length-1;i>=0;i--){const t=bl[i],p=t.m.position;p.x+=t.vx*dt;p.y+=t.vy*dt;p.z+=t.vz*dt;t.life-=dt;let dead=t.life<=0||p.y<HA(p.x,p.z)+.02||Math.abs(p.x)>hw||Math.abs(p.z)>hh||blocked(map.obs,p.x,p.z,0),flesh=false;
      if(!dead&&t.team==='B'&&!P.dead&&Math.hypot(p.x-P.x,p.z-P.z)<.5&&Math.abs(p.y-(P.gy+.8))<1.2&&P.inv<=0&&P.roll<=0){if(playerHit(1,t.owner)){flesh=true;dead=true;fx.hit(p,'#ff7a3c',6)}}
      if(!dead)for(const b of bots)if(b.alive&&b.team!==t.team&&Math.hypot(p.x-b.x,p.z-b.z)<.5&&Math.abs(p.y-(HA(b.x,b.z)+.8))<1.2&&b.inv<=0){damage(b,1,t.owner);dead=true;flesh=true;break}
      if(dead){if(!flesh&&t.life>0){fx.hit(p,'#fff3b0',4);fx.dust(p)}scene.remove(t.m);bl.splice(i,1)}else if((t.tf=(t.tf||0)+1)%2===0&&Math.hypot(p.x-F().x,p.z-F().z)<45)fx.trail(p,t.vx,t.vz,BULLET[t.team])}}
  function playerSpike(dt){let acting=null;const atk=S.atk==='A',hold=keys.KeyF&&!P.dead&&!P.frozen&&!P.mv&&P.roll<=0;let prompt='',prog=0;
    if(!S.spike.planted){const {s,d}=nearestSite(P.x,P.z);if(atk&&!P.dead&&d<s.r){prompt='HOLD F · PLANT SPIKE';if(hold)acting={plant:true,s}}}
    else if(!atk&&!P.dead&&Math.hypot(P.x-S.spike.x,P.z-S.spike.z)<2.2){prompt='HOLD F · DEFUSE';if(hold)acting={defuse:true}}
    return{acting,prompt}}
  function spikeTick(dt){
    const pl=playerSpike(dt);let plantActing=false,defActing=false,site=null,ax=0,az=0;
    if(!S.spike.planted){
      const pb=bots.filter(b=>b.alive&&b.team===S.atk&&b.plan===S.plan).sort((a,b)=>Math.hypot(SITES[S.plan].x-a.x,SITES[S.plan].z-a.z)-Math.hypot(SITES[S.plan].x-b.x,SITES[S.plan].z-b.z))[0]||null;S.planter=pb;
      if(pb&&pb.act){const n=nearestSite(pb.x,pb.z);if(n.d<n.s.r){plantActing=true;site=n.s;ax=pb.x;az=pb.z}}
      if(pl.acting&&pl.acting.plant){plantActing=true;site=pl.acting.s;ax=P.x;az=P.z}
      S.plant=plantActing?S.plant+dt:Math.max(0,S.plant-dt*2);
      if(S.plant>=PLANT)plant(ax,az,site.id);
    }else{
      const sp=S.spike;sp.t-=dt;const ds=bots.filter(b=>b.alive&&b.team!==S.atk).sort((a,b)=>Math.hypot(sp.x-a.x,sp.z-a.z)-Math.hypot(sp.x-b.x,sp.z-b.z))[0]||null;S.defuser=ds;
      if(ds&&ds.act&&Math.hypot(ds.x-sp.x,ds.z-sp.z)<2.2)defActing=true;if(pl.acting&&pl.acting.defuse)defActing=true;
      S.defuse=defActing?S.defuse+dt:Math.max(0,S.defuse-dt);
      visuals.core.material.color.set(Math.floor(S.time*(2+(SPIKE-sp.t)/4))%2?'#ffffff':'#ff3a3a');visuals.lt.intensity=Math.floor(S.time*(2+(SPIKE-sp.t)/4))%2?4:.5;
      if(S.defuse>=DEFUSE){visuals.spike.visible=false;endRound(S.atk==='A'?'B':'A','SPIKE DEFUSED')}
      else if(sp.t<=0){fx.shock(new T.Vector3(sp.x,.2,sp.z),'#ff8a4a');fx.puff(new T.Vector3(sp.x,.6,sp.z),'#ff6a2a',20);P.shake=Math.max(P.shake,.9);visuals.spike.visible=false;endRound(S.atk,'SPIKE DETONATED')}}
    // prompt / HUD strip
    const pr=$('#v5pr');const prog=S.spike.planted?S.defuse/DEFUSE:S.plant/PLANT;
    if(pl.prompt||prog>0){pr.className='on';pr.firstChild.textContent=pl.prompt||(S.spike.planted?'DEFUSING…':'PLANTING…');pr.querySelector('i').style.width=prog*100+'%'}else pr.className='';
    sp_(S.spike.planted?`SPIKE · ${Math.max(0,S.spike.t).toFixed(0)}s · SITE ${S.spike.site}`:S.atk==='A'?`ATTACK · PLANT AT ${S.plan}`:'DEFEND THE SITES',S.spike.planted)}
  const sp_=(t,red)=>sp(t,red);

  // ------------------------------------------------------------------ spectate: when you are dead, watch one of your living allies (buttons, or the left / right arrow keys)
  const spec={id:null,sig:'',last:null,yaw:0},specEl=document.createElement('div');specEl.id='v5spec';specEl.hidden=true;root.appendChild(specEl);
  {const st=document.createElement('style');st.textContent=`
    #v5spec{position:absolute;left:50%;bottom:26px;transform:translateX(-50%);display:flex;flex-direction:column;align-items:center;gap:8px;pointer-events:auto;user-select:none}
    #v5spec .lb{font:400 15px 'Bungee',sans-serif;letter-spacing:.1em;color:#ffd54a;text-shadow:0 2px 0 #3a2308,0 0 8px #0009}#v5spec .lb b{color:#7ec8ff;font-weight:400}
    #v5spec .row{display:flex;gap:8px;align-items:center}
    #v5spec button{font:800 15px 'Baloo 2',sans-serif;color:#fff;background:rgba(43,33,80,.85);border:2px solid #ffffff40;border-radius:14px;padding:5px 14px;cursor:pointer;display:flex;flex-direction:column;align-items:center;line-height:1.1}
    #v5spec button:hover{background:rgba(70,55,130,.95)}#v5spec button.on{border-color:#4aa8ff;box-shadow:0 0 12px #4aa8ff;background:rgba(40,80,150,.92)}
    #v5spec button i{font-style:normal;font-size:11px;color:#7ec8ff;letter-spacing:.12em}#v5spec .nav{padding:6px 13px;font-size:18px}
    #v5spec .hint{font:700 12px 'Baloo 2',sans-serif;opacity:.8;text-shadow:0 1px 0 #000a}`;document.head.appendChild(st)}
  const allies=()=>bots.filter(b=>b.team==='A'&&b.alive);
  function specGo(d){const al=allies();if(!al.length)return;const i=al.findIndex(b=>b.id===spec.id);spec.id=al[((i<0?0:i)+d+al.length)%al.length].id;spec.sig=''}
  specEl.addEventListener('click',e=>{const t=e.target.closest&&e.target.closest('button');if(!t)return;const k=t.dataset.k;if(k==='prev')specGo(-1);else if(k==='next')specGo(1);else{spec.id=k;spec.sig=''}});
  addEventListener('keydown',e=>{if(!S.active||!P.dead||specEl.hidden)return;if(e.code==='ArrowLeft'){specGo(-1);e.preventDefault()}else if(e.code==='ArrowRight'){specGo(1);e.preventDefault()}});
  function specTick(){
    const al=allies(),on=S.active&&P.dead&&al.length>0&&S.phase!=='done'&&S.phase!=='off';
    if(!on){specEl.hidden=true;spec.id=null;spv.on=false;return}
    let t=al.find(b=>b.id===spec.id);if(!t){const i=Math.max(0,Math.min(al.length-1,spec.i||0));t=al[i];spec.id=t.id;spec.sig=''}
    spec.i=al.indexOf(t);
    const sig=spec.id+'|'+al.map(b=>b.id+':'+b.hp).join();
    if(sig!==spec.sig){spec.sig=sig;
      specEl.innerHTML=`<div class="lb">SPECTATING · <b>${t.name}</b></div><div class="row"><button class="nav" data-k="prev">◀</button>`
        +al.map(b=>`<button data-k="${b.id}" class="${b.id===spec.id?'on':''}">${b.name}<i>${'♥'.repeat(Math.max(0,b.hp))}</i></button>`).join('')+`<button class="nav" data-k="next">▶</button></div><div class="hint">click a teammate · or use ← → keys</div>`}
    specEl.hidden=false}
  /** camera focus for main.js: the ally being watched (smoothed view direction), or null when you are alive */
  function specView(){
    if(!S.active||!P.dead||specEl.hidden){spv.on=false;return null}
    const t=bots.find(b=>b.id===spec.id&&b.alive);if(!t){spv.on=false;return null}
    if(spec.last!==t.id){spec.last=t.id;spec.yaw=t.yaw}
    spec.yaw+=Math.atan2(Math.sin(t.yaw-spec.yaw),Math.cos(t.yaw-spec.yaw))*.18;
    const gy=HA(t.x,t.z);spv.on=true;spv.x=t.x;spv.z=t.z;spv.gy=gy;spv.ey=gy+t.y*.65;spv.yaw=spec.yaw;return spv}

  const api={
    get active(){return S.active},
    start(){
      this.stop(true);dress();S.active=true;S.round=0;S.score={A:0,B:0};S.stats={k:0,d:0};S.time=0;prevN=ctx.bullets.length;
      const names=shuffle([...NAMES]);bots=[];
      // ranked lobby: the 9 AI cats are rated around YOUR rank, and their rating sets how well they play (reaction, aim, dodging, scoping...)
      const rk=loadRank(),me=rankInfo(rk.rp),lob=rollLobby(rk.rp);S.lobby=lob;
      lob.A.forEach(l=>{const b=createBot(scene,{team:'A',name:names.pop(),skill:l.skill,rp:l.rp});b.cat.userData.onSlashHit=()=>botMelee(b);bots.push(b)});
      lob.B.forEach(l=>{const b=createBot(scene,{team:'B',name:names.pop(),skill:l.skill,rp:l.rp});b.cat.userData.onSlashHit=()=>botMelee(b);bots.push(b)});
      root.hidden=false;over.hidden=true;visuals.g.visible=true;startRound();
    },
    stop(keep){S.active=false;S.phase='off';bots.forEach(b=>{scene.remove(b.cat);if(b.plate)scene.remove(b.plate.sp)});bots=[];bl.forEach(b=>scene.remove(b.m));bl=[];snap=[];
      if(visuals){visuals.g.visible=false;visuals.spike.visible=false}root.hidden=true;over.hidden=true;specEl.hidden=true;spv.on=false;P.dead=false;P.frozen=false},
    spectateView:specView,
    update(dt){
      if(!S.active)return;S.time+=dt;refresh(dt);
      if(ctx.bullets.length>prevN)noiseAt(P.x,P.z,'A');prevN=ctx.bullets.length;
      const live=S.phase==='live'||S.phase==='planted';
      if(S.phase==='buy'){S.t-=dt;P.frozen=true;bots.forEach(b=>b.alive&&idleBot(b,dt,world));if(S.t<=0){S.phase='live';S.t=ROUND;P.frozen=false;banner('GO!')}}
      else if(live){
        if(S.phase==='live'){S.t-=dt;if(S.t<=0)endRound(S.atk==='A'?'B':'A','TIME')}
        for(const b of bots){stepBot(b,dt,world);ctx.walk&&ctx.walk(b.id,b.x,b.z,b.mv||b.roll>0)}separate();   // walk = ripples on water
        bullets(dt);if(S.phase==='live'||S.phase==='planted')spikeTick(dt)}
      else{S.t-=dt;bots.forEach(b=>b.alive&&idleBot(b,dt,world));bullets(dt);if(S.phase==='end'&&S.t<=0)startRound()}
      // draw only the cats the camera can see: every cat is ~100 meshes (= draw calls) and half of them are behind you at any moment
      if(cam){vpm.multiplyMatrices(cam.projectionMatrix,cam.matrixWorldInverse);vfr.setFromProjectionMatrix(vpm)}
      for(const b of bots)if(b.alive){b.cat.position.y=HA(b.x,b.z);vsp.center.set(b.x,b.cat.position.y+.9,b.z);
        const inV=!cam||vfr.intersectsSphere(vsp),d=Math.hypot(b.x-F().x,b.z-F().z),ud=b.cat.userData;b.inView=inV;b.cat.visible=!globalThis.__hideBots&&inV;
        const sh=inV&&d<22;if(b.shOn!==sh){b.shOn=sh;ud.setShadow&&ud.setShadow(sh)}      // real shadows only for visible cats near you (the blob shadow stays)
        const hi=d<28;if(b.hiD!==hi){b.hiD=hi;ud.setDetail&&ud.setDetail(hi)}}               // far cats drop their tiny detail meshes   // stand on the terrain whatever the avatar code did this frame
      for(const b of bots)if(b.plate){b.plate.sp.position.set(b.x,HA(b.x,b.z)+2.35,b.z);b.plate.sp.visible=b.alive}
      specTick();
      hudT-=dt;if(hudT<=0){hudT=.2;const t=S.phase==='buy'?S.t:S.phase==='planted'?S.spike.t:S.t,m=Math.max(0,Math.ceil(t));$('#v5t').textContent=Math.floor(m/60)+':'+String(m%60).padStart(2,'0');$('#v5t').style.color=S.phase==='planted'?'#ff5a5a':'#fff';dots()}
    },
    bulletHit(p,b){for(const e of bots)if(e.alive&&e.team==='B'&&Math.hypot(p.x-e.x,p.z-e.z)<.55&&e.inv<=0&&Math.abs(p.y-(HA(e.x,e.z)+.8))<1.1){damage(e,1,'player');return true}return false},
    // returns 0 = no hit, 1 = hit, 2 = killed someone. side = swing side (+1/-1), col = blade colour -> same slash spark as on the wave enemies
    playerMelee(fx_,fz_,side=1,col='#ffe8a8'){let hit=0;const yaw=Math.atan2(fx_,fz_);for(const e of bots){if(!e.alive||e.team!=='B'||e.inv>0)continue;const dx=e.x-P.x,dz=e.z-P.z,d=Math.hypot(dx,dz)||1;if(d<3.2&&(dx*fx_+dz*fz_)/d>-.05){
      const ex=e.x,ez=e.z;damage(e,3,'player');fx.slashHit(new T.Vector3(ex,HA(ex,ez)+.9,ez),yaw,side,col,e.alive?1:1.35);
      e.x+=dx/d*1.4;e.z+=dz/d*1.4;hit=Math.max(hit,e.alive?1:2)}}return hit},
    onPlayerDown(){if(P.dead)return;P.dead=true;S.stats.d++;const k=lastHitBy;feed(k&&k.name||'?','YOU',k?k.team:'B','A',k&&k.slashing);dots();check()},
    prog(){const t=S.phase==='buy'?S.t/BUY:S.phase==='planted'?S.spike.t/SPIKE:S.t/ROUND;return Math.max(0,Math.min(1,t))*100+'%'},
    state(){return S},get bots(){return bots},
    hud(){const w=document.getElementById('wave'),s=document.getElementById('score'),b=document.getElementById('bestHud');if(w)w.textContent=`ROUND ${S.round} · ${S.atk==='A'?'ATTACK':'DEFEND'}`;if(s)s.textContent=`${S.score.A} : ${S.score.B}`;if(b)b.textContent='FIRST TO '+WIN}
  };
  return api;
}