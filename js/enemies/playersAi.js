// AI-controlled cat PLAYERS for the 5v5 mode.
// Each bot is a real cat avatar (createCatAvatar, the same model + animation + physics as the human player) and is driven through exactly
// the same controls a player has: move (forward/side), aim (yaw), shoot, slash, tumble-roll, swap weapon, scope.
// Same speeds, same cooldowns (shot .22s, slash .5s, roll .55s + .95s cooldown), same roll invulnerability. Nothing a player can't do.
// They also jump and air-dash mid-air with the same avatar calls as the player (cu.jump / cu.setAir / cu.airDash / cu.land).
// Behaviours: chase, retreat, reposition (strafe / peek / spot changes), dodge (bullets + sword wind-ups), shoot, melee, plus
// objective play (go to a site, hold, investigate gunfire / last seen position).
import * as T from 'three';
import {createCatAvatar,COATS,EYECS,PATTERNS,EARS,CLOAK_COLS,GEAR_COLS,EYE_STYLES,NOSES,TAILS,COLLAR_TYPES} from '../catAvatar.js';
import {WEAPONS} from '../weapons/index.js';
import {blocked} from '../obsGrid.js';
import {info as rankInfo} from '../rank.js';

// Adapter: the 5v5 code talks to the avatar with setWeapon('gun'|'sword') and isSlashing().
// If the avatar only has equip(weapon) / slash(), add those two on top of what it already has.
export function patchCat(cat){
  const u=cat.userData;
  if(!u.setWeapon){
    const gun=WEAPONS.find(w=>w.id==='peashooter')||WEAPONS.find(w=>w.kind==='gun'),
          sword=WEAPONS.find(w=>w.id==='woodensword')||WEAPONS.find(w=>w.kind!=='gun');
    u.setWeapon=k=>u.equip(k==='gun'?gun:sword);
  }
  if(!u.isSlashing){
    let until=0;const slash=u.slash;
    u.slash=(...a)=>{const r=slash.apply(u,a);if(r)until=performance.now()+450;return r};
    u.isSlashing=()=>performance.now()<until;
  }
  return cat;
}

export const TEAM_COL={A:'#4aa8ff',B:'#ff5a5a'};
export const NAMES=['Mochi','Biscuit','Pixel','Nova','Whisk','Tofu','Zig','Pepper','Miso','Ember','Clover','Juno','Taco','Fable','Smudge','Rex','Boba','Ziggy','Olive','Pumpkin'];
// jump / air-dash tuning (match the player's values here if they differ)
const JUMP_V=7.8,GRAV=24,AIR_DASH_V=10;
const rnd=(a,b)=>a+Math.random()*(b-a),pick=a=>a[(Math.random()*a.length)|0],ang=(a,b)=>Math.atan2(Math.sin(b-a),Math.cos(b-a)),turn=(a,b,k)=>a+ang(a,b)*k;

export function botConfig(team,name){
  const c=pick(COATS),col=TEAM_COL[team];
  return{fur:c[0],pat:c[1],pattern:pick(PATTERNS)[0],ears:pick(EARS),eyeColor:pick(EYECS),eyeStyle:pick(EYE_STYLES)[0],nose:pick(NOSES)[0],cheeks:pick(['none','none','fluff','ruff','sideburns','blush','freckles']),tail:pick(TAILS)[0],whiskers:pick(['classic','classic','short','long','thick','many','droopy']),collar:col,collarType:pick(COLLAR_TYPES)[0],name,
    // team identity = the collar + nameplate colour; cloak and headgear get random colours so the cats don't all look the same
    cloak:pick(['tattered','tattered','tattered','short','long','royal','leaves']),cloakC:pick(CLOAK_COLS),head:pick(['none','none','hood','helmet','beanie']),eyewear:pick(['none','none','glasses','shades']),gearC:pick(GEAR_COLS)};
}
let uid=0;
export function createBot(scene,{team,name,skill:rawSkill=.6,rp=900,cfg:cfgIn=null}){
  const cfg=cfgIn||botConfig(team,name),cat=createCatAvatar(cfg);patchCat(cat);scene.add(cat);cat.userData.setWeapon('gun');
  // difficulty curve: the rank's rating (0..1) is bent down so low ranks are genuinely weak and even the top rank is beatable
  const skill=Math.min(.9,Math.pow(Math.max(0,rawSkill),1.6)*.9);
  return{id:'bot'+(uid++),isBot:true,team,name,cfg,cat,skill,rp,rank:rankInfo(rp),
    // ---- traits derived from the rank: low ranks react late, miss a lot, almost never dodge, don't scope, don't investigate noises; high ranks do it all
    reactMul:2.8-1.9*skill,dodgeK:skill*skill*6.5,x:0,z:0,yaw:0,hp:5,max:5,alive:true,r:.45,
    wpn:1,roll:0,rcd:0,rdx:0,rdz:1,inv:0,cd:0,swap:0,scope:false,dash:0,dx:0,dz:1,mv:false,rel:1,vx:0,vz:0,y:0,vy:0,air:false,adUsed:false,ad:0,adx:0,adz:1,jcd:0,
    // brain
    tid:null,react:0,lastSeenT:-9,last:null,hear:null,aimOff:0,noiseT:0,strafe:Math.random()<.5?1:-1,strafeT:rnd(.4,1),shots:0,burstN:3,burstT:0,
    posT:0,spot:null,ph:rnd(0,6),sight:12+skill*15,prefMin:rnd(4.5,6),prefMax:rnd(10,12.5),act:false,rush:Math.random()<.3,stuck:0,unstick:0,px:0,pz:0,pt:0,plan:'A',slot:0,melee:false,slashing:false};
}

// steering: pick the first heading (closest to the goal) that does not run into trees / rocks / ponds / the arena edge
function steer(b,gx,gz,W){
  const dx=gx-b.x,dz=gz-b.z,d=Math.hypot(dx,dz)||1,base=Math.atan2(dx,dz);
  for(const o of [0,.45,-.45,.9,-.9,1.4,-1.4,2,-2]){
    const a=base+o,sx=Math.sin(a),sz=Math.cos(a);let ok=true;
    for(const L of [1,2,3.2]){if(L>d+.6)break;const px=b.x+sx*L,pz=b.z+sz*L;
      if(Math.abs(px)>W.hw-1||Math.abs(pz)>W.hh-1){ok=false;break}
      if(blocked(W.obs,px,pz,.75)){ok=false;break}}
    if(ok)return{dx:sx,dz:sz}}
  return{dx:-dx/d,dz:-dz/d};
}

// line of sight is the most expensive perception test, so each bot re-checks a given foe only every ~0.12s (a little reaction delay, invisible in play)
function seen(b,e,now,W){const c=b.losC||(b.losC={});let s=c[e.id];if(!s||now-s.t>.12)s=c[e.id]={t:now,v:W.los(b.x,b.z,e.x,e.z)};return s.v}

// ---------------------------------------------------------------- decision making
function think(b,dt,W){
  const c={dx:0,dz:0,yaw:b.yaw,fire:false,slash:false,roll:null,wpn:b.wpn,scope:false,act:false,jump:false,airDash:null},now=W.time(),foes=W.foes(b);
  // perception: nearest foe in sight with a clear line
  let tgt=null,td=1e9;
  for(const e of foes){const d=Math.hypot(e.x-b.x,e.z-b.z);if(d<b.sight&&d<td&&seen(b,e,now,W)){tgt=e;td=d}}
  if(tgt){
    if(b.tid!==tgt.id){b.react=now-b.lastSeenT>.7?rnd(.16,.38)*b.reactMul:.05;b.tid=tgt.id}else b.react-=dt;
    b.lastSeenT=now;b.last={x:tgt.x,z:tgt.z,t:now};b.hear=null}
  else b.tid=null;
  b.noiseT-=dt;if(b.noiseT<=0){b.noiseT=rnd(.25,.6);b.aimOff=(Math.random()-.5)*.5*(1.3-b.skill)}
  b.burstT=Math.max(0,b.burstT-dt);b.strafeT-=dt;if(b.strafeT<=0){b.strafe=-b.strafe;b.strafeT=rnd(.5,1.4)}

  // ---- dodge: roll sideways out of incoming bullets, or away from a sword about to land
  if(b.rcd<=0&&b.roll<=0&&!b.air&&b.react<=.12){
    for(const t of W.threats(b)){
      const rx=b.x-t.x,rz=b.z-t.z,v2=t.vx*t.vx+t.vz*t.vz||1,tt=(rx*t.vx+rz*t.vz)/v2;
      if(tt>.02&&tt<.34){const cx=t.x+t.vx*tt-b.x,cz=t.z+t.vz*tt-b.z;
        if(Math.hypot(cx,cz)<.85&&Math.random()<dt*b.dodgeK){const vl=Math.sqrt(v2),px=-t.vz/vl,pz=t.vx/vl,sd=(cx*px+cz*pz)>0?-1:1;c.roll={dx:px*sd,dz:pz*sd};break}}}
    if(!c.roll)for(const e of foes)if(e.slash){const d=Math.hypot(e.x-b.x,e.z-b.z);
      if(d<3.3&&Math.random()<dt*b.dodgeK*.9){const ux=(b.x-e.x)/d,uz=(b.z-e.z)/d,s=Math.random()<.5?1:-1;c.roll={dx:ux*.8-uz*.6*s,dz:uz*.8+ux*.6*s};break}}
  }

  // ---- aerial dodge: with the roll on cooldown, hop out of the bullet's path; already in the air, an air dash sidesteps it
  if(!c.roll&&b.roll<=0&&b.react<=.12&&(b.rcd>0||b.air)){
    for(const t of W.threats(b)){
      const rx=b.x-t.x,rz=b.z-t.z,v2=t.vx*t.vx+t.vz*t.vz||1,tt=(rx*t.vx+rz*t.vz)/v2;
      if(tt>.02&&tt<.34){const cx=t.x+t.vx*tt-b.x,cz=t.z+t.vz*tt-b.z;
        if(Math.hypot(cx,cz)<.85&&Math.random()<dt*b.dodgeK*.8){
          if(!b.air){if(b.jcd<=0)c.jump=true}
          else if(!b.adUsed&&b.ad<=0){const vl=Math.sqrt(v2),px=-t.vz/vl,pz=t.vx/vl,sd=(cx*px+cz*pz)>0?-1:1;c.airDash={dx:px*sd,dz:pz*sd}}
          break}}}
  }

  // a cat that is already ON its spot (planting / defusing) keeps working while the foe is still far away: it just stands still, faces him and keeps the bar filling
  const og=W.objective(b),ogd=Math.hypot(og.x-b.x,og.z-b.z),commit=!!tgt&&(og.type==='plant'||og.type==='defuse')&&ogd<og.rad+1.2&&td>9&&b.hp>1;
  if(commit){
    c.yaw=Math.atan2(tgt.x-b.x,tgt.z-b.z);c.act=true;b.holding=true;b.mode=og.type;
  }else if(tgt){
    const dx=tgt.x-b.x,dz=tgt.z-b.z,d=td,ux=dx/d,uz=dz/d,px=-uz,pz=ux,lead=Math.min(.4,d/24)*b.skill;
    c.yaw=Math.atan2(tgt.x+tgt.vx*lead-b.x,tgt.z+tgt.vz*lead-b.z)+b.aimOff;
    const aerr=Math.abs(ang(b.yaw,c.yaw));
    // weapon choice (with hysteresis): sword up close, blaster otherwise
    if(b.wpn===1&&((d<3.6&&b.hp>1)||(b.rush&&d<8.5&&b.hp>=3)))c.wpn=0;else if(b.wpn===0&&(d>(b.rush&&b.hp>=3?11:6.2)||(b.hp<=1&&d>2)))c.wpn=1;   // rushers like the sword
    if(b.wpn===0){                                        // MELEE: chase, cut, circle at point blank
      c.dx=ux;c.dz=uz;if(d<2.5&&aerr<.55)c.slash=true;if(d<1.2){c.dx=px*b.strafe*.6;c.dz=pz*b.strafe*.6}
      b.mode='melee';
    }else{
      const retreat=b.hp<=(b.skill>.5?2:1)&&d<10;                        // RETREAT when hurt, CHASE when too far, back off when too close
      const rad=retreat?-1:d>b.prefMax?1:d<b.prefMin?-.8:0;
      const st=(b.burstT>0||b.react>0||retreat)?b.strafe*(b.skill>.45?1:.3):0;   // REPOSITION: strafe while peeking / waiting, plant the feet to shoot
      c.dx=ux*rad+px*st;c.dz=uz*rad+pz*st;
      if(b.react<=0&&aerr<.09+.12*(1-b.skill)&&b.burstT<=0)c.fire=true;
      if(d>13&&!retreat&&b.hp>2&&b.skill>.5)c.scope=true;
      b.mode=retreat?'retreat':rad>0?'chase':'fight';
    }
    // aerial play: strafe-jumps in a gunfight, a leaping air dash to close in on / escape from a foe
    if(b.skill>.3&&!b.air&&b.jcd<=0&&b.roll<=0){
      if(b.wpn===0&&d>3.8&&d<9&&Math.random()<dt*(.5+b.skill))c.jump=true;
      else if(b.wpn===1&&d<14&&b.burstT>0&&Math.random()<dt*.45*b.skill)c.jump=true;
    }
    if(b.air&&!b.adUsed&&b.ad<=0&&!c.airDash){
      if(b.wpn===0&&d>2.8&&d<8&&aerr<.7&&Math.random()<dt*3*b.skill)c.airDash={dx:ux,dz:uz};
      else if(b.wpn===1&&b.mode==='retreat'&&Math.random()<dt*3)c.airDash={dx:-ux,dz:-uz};
      else if(b.wpn===1&&Math.random()<dt*.8*b.skill)c.airDash={dx:px*b.strafe,dz:pz*b.strafe};
    }
    const m0=Math.min(1,Math.hypot(c.dx,c.dz));if(m0>.01){const st2=steer(b,b.x+c.dx*3,b.z+c.dz*3,W);c.dx=st2.dx*m0;c.dz=st2.dz*m0}   // keep the intent, route around trees
  }else{
    if(b.wpn===0)c.wpn=1;
    let goal=null;
    if(b.last&&now-b.last.t<4)goal={x:b.last.x,z:b.last.z,rad:2.4,type:'look'};          // chase the last known position
    else if(b.hear&&now-b.hear.t<6&&b.skill>.38)goal={x:b.hear.x,z:b.hear.z,rad:3,type:'look'};       // investigate gunfire
    else goal=og;
    // hysteresis: once a cat has ARRIVED it only leaves again when it is clearly outside the circle (no more flip-flopping between 'move' and 'hold' on the edge = no glitching)
    const gd=Math.hypot(goal.x-b.x,goal.z-b.z),lim=goal.rad+(b.holding?(goal.type==='plant'||goal.type==='defuse'?.5:1.1):0);
    if(gd>lim){b.holding=false;const s=steer(b,goal.x,goal.z,W);c.dx=s.dx;c.dz=s.dz;c.yaw=Math.atan2(s.dx,s.dz)+Math.sin(now*1.3+b.ph)*.35;b.mode='move'}
    else{                                                  // arrived: hold, scan and reposition
      b.holding=true;if(goal.type==='look'){b.last=null;b.hear=null}
      c.act=goal.type==='plant'||goal.type==='defuse';
      c.yaw=(goal.face??Math.atan2(-b.x,-b.z))+Math.sin(now*.8+b.ph)*(c.act?0:.7);   // planting / defusing: stand still and look at the entrance, no wobbling
      b.posT-=dt;
      if(c.act)b.spot=null;
      else if(b.posT<=0){                                   // nothing to fight, nothing to plant: WANDER around the post (short pauses) instead of freezing
        const wander=goal.type==='hold'||goal.type==='post',a=rnd(0,6.28),r=wander?rnd(2,7):rnd(1.2,3),sx=goal.x+Math.cos(a)*r,sz=goal.z+Math.sin(a)*r;
        b.posT=wander?rnd(1.5,4):rnd(3,6);b.spot=W.clear?W.clear(sx,sz):{x:sx,z:sz}}
      if(b.spot&&Math.hypot(b.spot.x-b.x,b.spot.z-b.z)>.7){const s=steer(b,b.spot.x,b.spot.z,W);c.dx=s.dx*.7;c.dz=s.dz*.7}
      b.mode=c.act?goal.type:'hold';
    }
  }
  if(b.unstick>0){b.unstick-=dt;const a=Math.atan2(c.dx,c.dz)+1.3;c.dx=Math.sin(a);c.dz=Math.cos(a)}
  return c;
}

// ---------------------------------------------------------------- one frame: think, then drive the avatar exactly like a player
// per-frame cost counters (read by main.js when the page is opened with ?prof)
export const PROF=globalThis.__botProf={think:0,avatar:0};
export function stepBot(b,dt,W){
  if(!b.alive)return;
  b.cd-=dt;b.inv-=dt;b.rcd=Math.max(0,b.rcd-dt);b.swap=Math.max(0,b.swap-dt);b.jcd=Math.max(0,b.jcd-dt);b.ad=Math.max(0,b.ad-dt);
  const t0=performance.now(),c=think(b,dt,W),cu=b.cat.userData,sy=Math.sin(b.yaw),cy=Math.cos(b.yaw);PROF.think+=performance.now()-t0;
  b.yaw=turn(b.yaw,c.yaw,Math.min(1,dt*(5+7*b.skill)));
  b.act=c.act&&!b.mv;
  // tumble (same rules as the player)
  if(c.roll&&b.rcd<=0&&b.roll<=0&&!b.air){const l=Math.hypot(c.roll.dx,c.roll.dz)||1,rx=c.roll.dx/l,rz=c.roll.dz/l;
    if(cu.tumble(rx*Math.sin(b.yaw)+rz*Math.cos(b.yaw),rx*-Math.cos(b.yaw)+rz*Math.sin(b.yaw))){b.roll=.55;b.rcd=.95;b.rdx=rx;b.rdz=rz;b.inv=Math.max(b.inv,.65);b.scope=false;W.puff(b.x,b.z)}}
  // jump + air dash (same avatar calls as the player)
  if(c.jump&&!b.air&&b.roll<=0&&b.jcd<=0&&!cu.isTumbling()&&!b.scope){b.air=true;b.vy=JUMP_V;b.adUsed=false;b.jcd=.45;cu.jump()}
  if(c.airDash&&b.air&&!b.adUsed&&b.ad<=0&&b.roll<=0&&!cu.isAirDashing()){
    const l=Math.hypot(c.airDash.dx,c.airDash.dz)||1,ax=c.airDash.dx/l,az=c.airDash.dz/l;
    cu.airDash(ax*Math.sin(b.yaw)+az*Math.cos(b.yaw),ax*-Math.cos(b.yaw)+az*Math.sin(b.yaw));
    b.ad=.3;b.adUsed=true;b.adx=ax;b.adz=az;b.vy=Math.max(b.vy,0)*.4;b.scope=false}
  // weapon swap + scope
  if(c.wpn!==b.wpn&&b.swap<=0&&b.roll<=0){b.wpn=c.wpn;cu.setWeapon(b.wpn?'gun':'sword');b.swap=.4;b.scope=false}
  b.scope=c.scope&&b.wpn===1&&b.roll<=0;cu.setScope(b.scope);
  // shoot / slash
  if(c.fire&&b.cd<=0&&b.roll<=0&&b.wpn===1&&b.swap<=0&&b.burstT<=0){
    W.fire(b);b.cd=.22;b.dash=1.2;b.dx=-Math.sin(b.yaw);b.dz=-Math.cos(b.yaw);
    if(++b.shots>=b.burstN){b.shots=0;b.burstN=3+((Math.random()*3)|0);b.burstT=rnd(.35,.9)*(1.7-b.skill);b.strafeT=0}}
  if(c.slash&&b.cd<=0&&b.roll<=0&&b.wpn===0&&b.swap<=0&&cu.slash()){b.cd=.5;b.dash=1.1;b.dx=sy;b.dz=cy}
  // movement: identical to the player (6.5 walk, 3.2 scoped, roll 11 decaying, recoil dash)
  const px0=b.x,pz0=b.z,ml=Math.hypot(c.dx,c.dz),sp=b.scope?3.2:6.5;
  if(b.roll>0){const u=b.roll/.55,v=11*(.25+.75*u);b.x+=b.rdx*v*dt;b.z+=b.rdz*v*dt;b.roll=Math.max(0,b.roll-dt);b.mv=false}
  else if(ml>.01){const mx=c.dx/ml,mz=c.dz/ml;b.x+=mx*sp*dt;b.z+=mz*sp*dt;b.mv=true;
    const f=mx*Math.sin(b.yaw)+mz*Math.cos(b.yaw),s=-mx*Math.cos(b.yaw)+mz*Math.sin(b.yaw);cu.move.f=f;cu.move.s=s;b.rel=f<0?-1:1}
  else{b.mv=false;cu.move.f=0;cu.move.s=0}
  if(b.dash>0){b.x+=b.dx*b.dash*3*dt;b.z+=b.dz*b.dash*3*dt;b.dash=Math.max(0,b.dash-dt*9)}
  if(b.ad>0){const v=AIR_DASH_V*(.4+.6*b.ad/.3);b.x+=b.adx*v*dt;b.z+=b.adz*v*dt}   // air dash: a burst of speed that fades out
  b.x=Math.max(-W.hw+1,Math.min(W.hw-1,b.x));b.z=Math.max(-W.hh+1,Math.min(W.hh-1,b.z));W.push(b,b.r);
  // vertical motion: gravity (eased while air-dashing), landing squash
  if(b.air){b.vy-=GRAV*(b.ad>0?.25:1)*dt;b.y+=b.vy*dt;if(b.y<=0){const p=Math.min(1,-b.vy/9);b.y=0;b.vy=0;b.air=false;b.ad=0;cu.land(p)}}
  cu.setAir(b.y,b.vy);
  // stuck detection -> sidestep
  b.pt+=dt;if(b.pt>1){const moved=Math.hypot(b.x-b.px,b.z-b.pz);if(b.mv&&moved<.6)b.unstick=.6;b.px=b.x;b.pz=b.z;b.pt=0}
  b.vx=(b.x-px0)/Math.max(dt,1e-3);b.vz=(b.z-pz0)/Math.max(dt,1e-3);
  // sync the avatar (same calls as the player's loop)
  b.slashing=cu.isSlashing();
  b.cat.position.set(b.x,(W.h?W.h(b.x,b.z):0)+b.y,b.z);b.cat.rotation.y=b.yaw;cu.setAim(0,true);cu.holster(false);
  avatarUpdate(b,dt,W,b.mv&&b.roll<=0,b.rel);
}
// avatar update with LOD: cats that are off-screen or far from the player run their animation + cloth / rope physics every 2nd / 3rd frame with the accumulated dt
function avatarUpdate(b,dt,W,mv,rel){
  b.acc=(b.acc||0)+dt;const far=W&&W.far?W.far(b):0;
  if(far===0||(((b.lodN=(b.lodN||0)+1)+((b.ph*7)|0))%(far+1))===0){const t1=performance.now(),a=Math.min(b.acc,.06);b.acc=0;b.cat.userData.update(a,mv,rel);PROF.avatar+=performance.now()-t1}
}
// an idle / frozen avatar (buy phase, round end, dead bots are simply hidden)
export function idleBot(b,dt,W){b.y=0;b.vy=0;b.air=false;b.ad=0;b.cat.userData.setAir(0,0);b.cat.position.set(b.x,W&&W.h?W.h(b.x,b.z):0,b.z);b.cat.rotation.y=b.yaw;b.cat.userData.setAim(0,true);avatarUpdate(b,dt,W,false,1)}
