// Ming the cat: eased run/stop animation, rope-physics tail + whiskers, cloth-physics cloak, pistol arm.
import * as T from 'three';
import {lumpy,LUMP2,G,mat,BM,M,mix,shadow} from './blocks.js';
import {Rope,Cloth,VM} from './physics.js';
import {makeCoat,bindCoat,PATTERNS} from './coatShader.js';
import {createBelt,COLLAR_TYPES} from './collar.js';
import {createHood} from './hood.js';
import {BladeTrail} from './bladeTrail.js';
import {EYE_STYLES,NOSES,CHEEKS,TAILS,buildEyes,buildNose,buildCheeks,buildTail,tailColor,WHISKERS,buildWhiskers} from './catFeatures.js';
import {EARS,EAR_NAMES,HEADS,EYEWEAR,GEAR_COLS,buildEar,buildHeadwear,buildEyewear,cloakRest,cloakShape,cloakColor,cloakLining,buildLeaves,kindOf} from './wearables.js';
export {COLLAR_TYPES,PATTERNS,EARS,EAR_NAMES,HEADS,EYEWEAR,GEAR_COLS,EYE_STYLES,NOSES,CHEEKS,TAILS,WHISKERS};
export const COATS=[['#f6dfbd','#ee9a48'],['#ee9a48','#9a5a24'],['#fff4e6','#b9bfcc'],['#3b3a45','#fff4e6'],['#d9b48a','#5a3a28'],['#9aa3b5','#fff4e6'],['#c7b4f0','#fff4e6'],['#7a4a2b','#e8c79a'],['#ffe9a8','#ffb347'],['#e6f4ff','#7fb8e8'],['#2a2a35','#ee9a48'],['#d8f0d0','#7fcf7f'],
  ['#ffc4dc','#ff86b3'],['#ff7aa8','#fff4e6'],['#ffd0b0','#ff9a7a'],['#c92a3a','#fff4e6'],['#a9d8ff','#fff4e6'],['#2f4a8a','#c9d6ff'],['#7b3f8f','#e9c8f5'],['#14141c','#6b6b80'],['#fff1d0','#e8c27a'],['#5c6b7a','#dfe6ee'],['#fff27a','#ffb84a'],['#3fb6a8','#e6fff9']];
export const COAT_NAMES=['Ming','Ginger','Snow','Tux','Mocha','Smoke','Lilac','Cocoa','Butter','Frost','Ember','Mint','Blush','Rose','Peach','Crimson','Sky','Navy','Plum','Midnight','Cream','Slate','Lemon','Teal'];
export const EYECS=['#4bd37b','#4aa8ff','#ffc93c','#ff6fa0','#b07aff','#ff7a3c','#7ee6d2','#ff4d6d'];
export const COLLARS=['#e63946','#4aa8ff','#ff8fc0','#58c878','#ffd54a','#b07aff','#ffffff','#2a2433','#ff7a3c','#7ee6d2']; // always worn: no "none"
export const CLOAKS=[['none','None','Off'],['tattered','Tattered','Rags'],['short','Short','Scarf'],['long','Long','Coat'],['royal','Royal','Cape'],['leaves','Leaves','Leafy']];
export const CLOAK_COLS=['#8a5a3a','#6d4cff','#e63946','#2fa8ff','#2fbf71','#ffb300','#2a2433','#ff6fa0','#ffffff','#ff7a3c','#58d6ff','#c58aff'];

function painted(geo,fn){const p=geo.attributes.position,c=new Float32Array(p.count*3),col=new T.Color(),v=new T.Vector3();
  for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i);col.set(fn(v));c.set([col.r,col.g,col.b],i*3)}geo.setAttribute('color',new T.BufferAttribute(c,3));return geo}
function tagTex(name){const c=document.createElement('canvas');c.width=c.height=64;const g=c.getContext('2d'),t=name.toUpperCase();g.fillStyle='#f2c44e';g.fillRect(0,0,64,64);
  let fs=20;g.font='800 '+fs+'px Arial';while(g.measureText(t).width>52&&fs>8){fs--;g.font='800 '+fs+'px Arial'}g.fillStyle='#8a5a14';g.textAlign='center';g.textBaseline='middle';g.fillText(t,32,34);
  const x=new T.CanvasTexture(c);x.colorSpace=T.SRGBColorSpace;return x}
const ease=(dt,k)=>1-Math.exp(-dt*k);
// dual-blade pose tuning (radians). Arm X: negative = forward/up, positive = swept back. Arm Z magnitude = how wide the arm spreads out.
const DUAL={wX:-.7,wZ:1.15,oX:-.15,oZ:1.0,blade:-1.0,blade2:-1.15,   // stance: weapon arm raised wide, off arm lower + wide, blades angled outward-forward
  runX:1.2,runZ:.32,runBlade:-.1,                                     // ninja run: both arms swept back, blades trailing behind
  lean:.28,runLean:.24,crouch:.09,splay:.2,twist:.22};                // body lean (stance / extra when running), crouch depth, leg splay, torso turn

// 2. Short, chubby, non-floating Leg Generator
function createLegGeo(height, topR, botR, furCol) {
  const geo = new T.SphereGeometry(1, 20, 16);
  const pos = geo.attributes.position;
  for(let i=0; i<pos.count; i++){
    let x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    let normY = (y + 1) / 2;
    let currentRadius = botR * (1 - normY) + topR * normY;
    pos.setX(i, x * currentRadius * 0.9);
    pos.setY(i, (y * 0.5) * height - height/2);
    pos.setZ(i, z * currentRadius);
  }
  geo.computeVertexNormals();
  return painted(geo, v => (v.y < -height * 0.35) ? '#fff7ee' : furCol);
}

const lerp=(a,b,t)=>a+(b-a)*t,sm=(a,b,x)=>{const t=Math.min(1,Math.max(0,(x-a)/(b-a)));return t*t*(3-2*t)},rg=(a,b,x)=>Math.min(1,Math.max(0,(x-a)/(b-a))),e3=x=>1-Math.pow(1-x,3);

function createBentArmGeo(len,s,furCol,tipCol='#fff7ee'){
  const N=30,SEG=20,curve=t=>new T.Vector3(s*.03*Math.sin(Math.PI*t),-len*t,.02*Math.sin(Math.PI*t));
  const rad=t=>{let r=.105+.035*Math.exp(-(((t-.1)/.16)**2))+.04*Math.exp(-(((t-.8)/.13)**2));
    if(t<.06)r*=Math.sqrt(Math.max(0,1-((.06-t)/.06)**2));if(t>.9)r*=Math.sqrt(Math.max(0,1-((t-.9)/.1)**2));return r};
  const pos=[],col=[],idx=[],c1=new T.Color(furCol),c2=new T.Color(tipCol),cc=new T.Color(),ref=new T.Vector3(0,0,1);
  for(let i=0;i<=N;i++){const t=i/N,P=curve(t),Tn=curve(Math.min(1,t+.01)).sub(curve(Math.max(0,t-.01))).normalize();
    const Nn=new T.Vector3().crossVectors(Tn,ref).normalize(),Bn=new T.Vector3().crossVectors(Tn,Nn).normalize(),r=rad(t);
    cc.copy(c1).lerp(c2,sm(.68,.8,t));
    for(let j=0;j<=SEG;j++){const a=j/SEG*Math.PI*2,cx=Math.cos(a)*r,sy=Math.sin(a)*r;
      pos.push(P.x+Nn.x*cx+Bn.x*sy,P.y+Nn.y*cx+Bn.y*sy,P.z+Nn.z*cx+Bn.z*sy);col.push(cc.r,cc.g,cc.b)}}
  for(let i=0;i<N;i++)for(let j=0;j<SEG;j++){const a=i*(SEG+1)+j,b=a+SEG+1;idx.push(a,a+1,b,b,a+1,b+1)}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setAttribute('color',new T.Float32BufferAttribute(col,3));
  g.setIndex(idx);g.computeVertexNormals();g.userData.end=curve(.8);return g}

// Rounded-box torso (super-ellipsoid) that tapers towards the shoulders: less round, more "plush toy"
function createTorsoGeo(){
  const g=new T.SphereGeometry(1,56,40),p=g.attributes.position;
  const sp=(v,e)=>Math.sign(v)*Math.pow(Math.abs(v),e),E1=2.7,E2=2.4;
  for(let i=0;i<p.count;i++){
    const x=p.getX(i),y=p.getY(i),z=p.getZ(i);
    const phi=Math.asin(Math.max(-1,Math.min(1,y))),th=Math.atan2(z,x);
    const cp=sp(Math.cos(phi),2/E1),sy=sp(Math.sin(phi),2/E1);
    let nx=cp*sp(Math.cos(th),2/E2),nz=cp*sp(Math.sin(th),2/E2);
    const t=(sy+1)/2,w=1-.26*sm(.1,1,t);
    const belly=nz>0?1+.06*(1-t):1;
    p.setXYZ(i,nx*w,sy,nz*w*belly);
  }
  g.computeVertexNormals();return g}

export function createCatAvatar(opt={}){
  const o=Object.assign({fur:COATS[0][0],pat:COATS[0][1],pattern:'classic',ears:'pointy',eyeColor:EYECS[0],collar:COLLARS[0],name:'Ming',cloak:'tattered',cloakC:CLOAK_COLS[0],collarType:'normal',head:'none',eyewear:'none',gearC:GEAR_COLS[0],eyeStyle:'classic',nose:'button',cheeks:'none',tail:'classic',whiskers:'classic'},opt);
  if(!COLLARS.includes(o.collar))o.collar=COLLARS[0];          // the collar can no longer be removed
  if(!COLLAR_TYPES.some(x=>x[0]===o.collarType))o.collarType='normal';
  if(!CLOAKS.some(x=>x[0]===o.cloak))o.cloak='tattered';
  if(!EARS.includes(o.ears))o.ears='pointy';
  if(!PATTERNS.some(p=>p[0]===o.pattern))o.pattern='classic';
  if(!EYE_STYLES.some(x=>x[0]===o.eyeStyle))o.eyeStyle='classic';
  if(!NOSES.some(x=>x[0]===o.nose))o.nose='button';
  if(!CHEEKS.some(x=>x[0]===o.cheeks))o.cheeks='none';
  if(!TAILS.some(x=>x[0]===o.tail))o.tail='classic';
  if(!WHISKERS.some(x=>x[0]===o.whiskers))o.whiskers='classic';
  const catGroup=new T.Group(),cat=new T.Group(),head=new T.Group(),S=.45,LY=-1.52,FY=0.96;cat.scale.setScalar(S);cat.position.y=FY;catGroup.add(cat);cat.add(head);const nCh=catGroup.children.length;shadow(catGroup,.6);const shM=catGroup.children[nCh]||null,shY=shM?shM.position.y:0,shS=shM?shM.scale.clone():null;   // the blob shadow stays on the ground while the cat jumps
  const acc=mat(o.pat),pink=mat('#ff9db8'),dark=BM('#2a1a14'),R=Math.PI/2;
  
  const coatMeshes=[];
  const CM=(geo,part,sc,pos,par)=>{const m=M(geo,makeCoat(o,part),sc,pos,par);coatMeshes.push(m);return m};
  CM(lumpy(new T.SphereGeometry(1,64,48),.03,0),0,[1.0,0.78,0.85],null,head);
  const body=CM(lumpy(createTorsoGeo(),.02,3),1,[.56,.62,.5],[0,-1.1,0],cat);

  const eyes=buildEyes(o.eyeStyle,o.eyeColor,o.fur,head);
  
  buildNose(o.nose,head);
  const cheeks=buildCheeks(o.cheeks,o,head);   // fur locks use the head's coat shader + rope physics
  if(cheeks){cheeks.meshes.forEach(m=>coatMeshes.push(m))}
  M(G.box,dark,[.016,.07,.016],[0,-.22,.75],head);
  [-1,1].forEach(s=>{const m=new T.Mesh(new T.TorusGeometry(.1,.018,6,16,Math.PI),dark);m.rotation.z=Math.PI;m.position.set(s*.1,-.28,.72);head.add(m)});

  const ropes=[];
  if(cheeks)cheeks.ropes.forEach(r=>ropes.push(r));
  buildWhiskers(o.whiskers,head).forEach(r=>ropes.push(r));      // whisker style: see catFeatures.js ('none' = no whiskers)  
  const ears=[],earRig=[],earMods=[];
  [-1,1].forEach(s=>{const g=new T.Group();g.position.set(s*.56,.5,.02);g.rotation.z=-s*.5;head.add(g);
    const sw=new T.Group();g.add(sw);const em=s<0?acc:mat(o.fur);
    const info=buildEar(o.ears,sw,em,pink);ears.push(g);if(info.ropes)info.ropes.forEach(r=>ropes.push(r));if(info.mods)info.mods.forEach(m=>earMods.push(m));
    earRig.push({s,sw,k:info.k,fl:info.fl,out:info.out,bx:info.bx,x:0,vx:0,z:0,vz:0,flick:2+Math.random()*4});sw.rotation.set(info.bx,0,-s*info.out)});

  // headwear + eyewear live on the head so they follow every head movement
  const hw=o.head==='hood'?null:buildHeadwear(o.head,o.gearC);if(hw)head.add(hw);   // the hood is cloth: created below once the collision volumes exist
  const ew=buildEyewear(o.eyewear,o.gearC);if(ew)head.add(ew);

  // collision volumes (cat-local ellipsoids: centre, radii) so cloth can never sink into the player. m = margin
  const BODY=m=>[[[0,-.95,0],[.5+m,.42+m,.44+m]],[[0,-1.35,0],[.62+m,.42+m,.54+m]]];   // upper torso + pear hips
  const LEGSC=m=>[-1,1].map(s=>[[s*.32,-1.73,0],[.22+m,.26+m,.24+m]]);
  // ---- Leather belt collar (rough leather, stitches, holes, studs, buckle): static, sits wide under the head ----
  const HEADC=m=>[[[0,0,0],[1+m,.78+m,.85+m]]];
  const belt=createBelt(cat,o.collar,{outer:[...BODY(.02),...HEADC(.03)],inner:[...BODY(-.02),...HEADC(0)]},o.collarType);   // cloth belt, same physics as the cloak
  // cloth-physics hood in the chosen gear colour (dome pinned to the head, neck drape + curled tip free)
  const hood=o.head==='hood'?createHood(head,{outer:o.gearC,inner:mix(o.gearC,'#000000',.55),trimC:mix(o.gearC,'#ffffff',.55),seamC:mix(o.gearC,'#ffffff',.3),coll:[...BODY(.05),...HEADC(.04)]}):null;
  // name plate: hangs from a gold ring on the bottom-centre of the collar (it follows the collar cloth every frame) and swings like a pendulum
  const tag=new T.Group();cat.add(tag);belt.anchor(tag.position);
  const GOLDM=new T.MeshStandardMaterial({color:'#e8b83a',roughness:.35,metalness:.85});
  const ring1=new T.Mesh(new T.TorusGeometry(.05,.012,8,18),GOLDM);ring1.position.y=-.035;ring1.rotation.y=R;tag.add(ring1);   // ring on the collar side
  const plate=new T.Group();plate.position.y=-.17;tag.add(plate);
  const ring2=new T.Mesh(new T.TorusGeometry(.04,.011,8,18),GOLDM);ring2.position.set(0,.15,0);plate.add(ring2);                 // ring on the plate, interlocked with ring1
  M(G.cyl,mat('#f2c44e',.4),[.15,.027,.15],[0,0,0],plate).rotation.x=R;
  const f=new T.Mesh(new T.CircleGeometry(.14,24),new T.MeshBasicMaterial({map:tagTex(o.name)}));f.position.set(0,0,.03);plate.add(f);
  const tagS={x:0,vx:0,z:0,vz:0};

  const WS=-1;
  const armGeos={'-1':createBentArmGeo(.5,-1,o.pat),'1':createBentArmGeo(.5,1,o.pat)}, legGeo=createLegGeo(.42,.14,.22,o.pat);
  const arm=s=>{const p=new T.Group();p.position.set(s*.47,-.76,.05);cat.add(p);CM(armGeos[s],2,[1,1,1],[0,0,0],p);return p};
  const leg=s=>{const p=new T.Group();p.position.set(s*.32,LY,0);cat.add(p);CM(legGeo,3,[1,1,1],[0,0,0],p);return p};
  const armL=arm(-1),armR=arm(1),legL=leg(-1),legR=leg(1);
  const wArm=WS<0?armL:armR,oArm=WS<0?armR:armL;

  const hand=new T.Group();hand.position.copy(armGeos[WS].userData.end);wArm.add(hand);
  // weapons are modules (js/weapons/*.js) built procedurally and equipped through U.equip(def)
  const wg=new T.Group();hand.add(wg);
  const hand2=new T.Group();hand2.position.copy(armGeos[-WS].userData.end);oArm.add(hand2);const wg2=new T.Group();hand2.add(wg2);
  let tip=new T.Object3D();wg.add(tip);
  let W=null,isGun=true,HD='pistol',dual=false,spear=false,twoH=false,foreP=null,slashD=.5,wLean=0,supW=0,spearOff=0;
  const supM=new T.Matrix4(),supV=new T.Vector3(),supQ=new T.Quaternion(),DOWN=new T.Vector3(0,-1,0),reachO=armGeos[-WS].userData.end.length()||.42;
  const qCat=new T.Quaternion(),aimD=new T.Vector3(),aimU=new T.Vector3(),aX=new T.Vector3(),aY=new T.Vector3(),aZ=new T.Vector3(),mA=new T.Matrix4(),qAim=new T.Quaternion(),qKick=new T.Quaternion(),AXX=new T.Vector3(1,0,0);
  // blade trails (ribbon + sparks) follow the real blade of whatever melee weapon is equipped: one per hand
  const trA=new BladeTrail(catGroup),trB=new BladeTrail(catGroup),TCOL={woodensword:['#ffe9a8','#ffffff'],dualdagger:['#8fe8ff','#e8fbff'],spear:['#dcecff','#ffffff']};

  let cloth=null,lining=null,leaves=null;
  if(o.cloak!=='none'){
    const kind=kindOf(o.cloak),{cols,rows}=cloakShape(kind),P0={grav:15,stiff:.012};
    cloth=new Cloth(cat,cloakRest(kind,0,0),cols,rows,{...P0,coll:[...BODY(.04),...LEGSC(.03)],color:(r,c)=>cloakColor(kind,o.cloakC,r,c,rows)});
    lining=new Cloth(cat,cloakRest(kind,.07,.04),cols,rows,{...P0,coll:[...BODY(0),...LEGSC(0)],color:(r,c)=>cloakLining(kind,o.cloakC,r,rows)});
    if(kind==='leaves'){const lv=buildLeaves(cat,cols,rows,o.cloakC),P=(c,r)=>cloth.lp[r*cols+c];lv.place(P);leaves={lv,P}}
  }

  const tail=new T.Group();tail.position.set(0,LY,-.5);cat.add(tail);
  const tailCol=tailColor(o);
  const tf=buildTail(o.tail,tail,o);tf.ropes.forEach(r=>ropes.push(r));      // tail types: see catFeatures.js

  let time=0,walk=0,amp=0,stop=0,wasMv=false,bl=0,bt=2;
  let rv=0,rvel=0,fireW=0,aimW=0,scopeOn=false,wpn=1,swapT=0,aimP=0,aimPT=0,aimOn=false,rdy=0,hTrk=0,gW=0;
  let slashT=-1,combo=0,hitDone=false,tumT=-1,tumF=1,tumS=0,landSq=0;
  let jumpS=0,airH=0,airV=0,airW=0,dashT=-1,dashF=1,dashS=0;   // jump / air dash state (fed by the game through U.setAir / U.jump / U.land / U.airDash)
  const TUMBLE_D=.55,bs=body.scale.clone(),pivot=new T.Vector3(0,-1.0*S,0),eul=new T.Euler(),pv=new T.Vector3();
  const U=catGroup.userData;U.move={f:0,s:0};
  U.kick=(p=1)=>{if(!isGun)return;rvel+=15*p;fireW=1};
  U.equip=def=>{
    while(wg.children.length)wg.remove(wg.children[0]);while(wg2.children.length)wg2.remove(wg2.children[0]);
    W=def;isGun=def.kind==='gun';HD=def.handling;dual=HD==='dual';spear=HD==='spear';twoH=!!def.fore;wLean=def.lean||0;
    slashD=(def.stats&&def.stats.dur)||.5;foreP=def.fore?new T.Vector3(0,-def.fore[0],def.fore[1]):null;
    const b=def.build();wg.add(b.group);tip=b.tip||new T.Object3D();if(!b.tip)wg.add(tip);if(b.off)wg2.add(b.off);
    trA.clear();trB.clear();if(!isGun){const tc=TCOL[def.id]||['#fff3c4','#ffffff'];const bo=dual?{w:1.5,sp:1.3,a:1.15}:{w:1.15,sp:.9};trA.setBlade(wg,tc[0],tc[1],bo);if(dual&&b.off)trB.setBlade(wg2,'#c9a0ff','#f4ecff',bo)}
    swapT=1;slashT=-1;hitDone=false;wg.position.set(0,0,0);oArm.scale.y=1;
  };
  U.weapon=()=>W;
  // ---- crowd LOD hooks (used by the 5v5 mode): real shadow casting only for nearby cats (the sun's shadow pass draws every caster a 2nd time),
  // and the tiny detail meshes (studs, stitches, eyes, nose ...) hidden on far cats. Weapon parts are never hidden.
  let detailList=null;
  const inWeapon=o=>{for(let p=o;p&&p!==catGroup;p=p.parent)if(p===hand||p===hand2)return true;return false};
  U.setShadow=on=>catGroup.traverse(o=>{if(!o.isMesh)return;if(o.userData.cs===undefined)o.userData.cs=o.castShadow;o.castShadow=on&&o.userData.cs});
  U.setDetail=on=>{
    if(!detailList){detailList=[];catGroup.updateMatrixWorld(true);const bb=new T.Box3(),sz=new T.Vector3();
      catGroup.traverse(o=>{if(!o.isMesh||!o.visible||!o.geometry||inWeapon(o))return;bb.setFromObject(o);bb.getSize(sz);if(sz.length()<.12)detailList.push(o)})}
    for(const m of detailList)m.visible=on};
  U.setScope=b=>{scopeOn=!!b};
  // crosshair following: pitch = look-up angle of the crosshair (radians, + is up); on = in gameplay (gun ready, head tracks)
  U.setAim=(pitch,on)=>{aimOn=!!on;aimPT=on?Math.max(-.55,Math.min(.6,pitch)):0};
  // melee: one swing per press, hands alternate (dual blades: left, right, left ...). U.onSlashHit(dd) is called when the blade connects.
  U.slash=()=>{if(isGun||slashT>=0||tumT>=0)return false;slashT=0;hitDone=false;combo^=1;return true};
  U.tumble=(f,s)=>{if(tumT>=0)return false;tumT=0;tumF=f;tumS=s;slashT=-1;return true};
  U.setAir=(h,vy)=>{airH=h;airV=vy};U.jump=()=>{jumpS=1};U.land=(p=1)=>{landSq=Math.max(landSq,.3+.7*p)};U.airDash=(f,s)=>{dashT=0;dashF=f;dashS=s;slashT=-1};U.isAirDashing=()=>dashT>=0;
  U.isTumbling=()=>tumT>=0;U.isSlashing=()=>slashT>=0;U.scope=()=>aimW;U.recoil=()=>rv;
  U.muzzle=v=>tip.getWorldPosition(v||new T.Vector3());U.holster=b=>{hand.visible=!b;hand2.visible=!b};

  // ---- ear sway: damped springs driven by the head's acceleration, plus the odd flick ----
  const eP=new T.Vector3(),eP0=new T.Vector3(),eV=new T.Vector3(),eV0=new T.Vector3(),eA=new T.Vector3(),eAs=new T.Vector3(),hQ=new T.Quaternion(),hP=new T.Vector3(),hS=new T.Vector3();
  let earInit=false;
  const earPhysics=dt=>{
    if(!(dt>0))return;
    head.updateWorldMatrix(true,false);head.matrixWorld.decompose(hP,hQ,hS);
    eP.set(0,.5,0).applyMatrix4(head.matrixWorld);
    if(!earInit){eP0.copy(eP);eV0.set(0,0,0);earInit=true}
    eV.copy(eP).sub(eP0).divideScalar(dt);eP0.copy(eP);
    eA.copy(eV).sub(eV0).divideScalar(dt);eV0.copy(eV);
    hQ.invert();eA.applyQuaternion(hQ).divideScalar(hS.x||1);
    eA.x=Math.max(-150,Math.min(150,eA.x));eA.y=Math.max(-150,Math.min(150,eA.y));eA.z=Math.max(-150,Math.min(150,eA.z));
    eAs.lerp(eA,ease(dt,22));
    const n=Math.ceil(dt/.012),h=dt/n;
    earRig.forEach(r=>{
      r.flick-=dt;if(r.flick<=0){r.flick=3+Math.random()*5;r.vz+=(Math.random()-.5)*9*r.fl;r.vx+=(Math.random()-.5)*5*r.fl}
      const C=.7*Math.sqrt(r.k),g=r.k*.005*r.fl;
      for(let i=0;i<n;i++){
        r.vz+=(-r.k*r.z-C*r.vz+g*(eAs.x-r.s*eAs.y*.6))*h;r.z+=r.vz*h;
        r.vx+=(-r.k*r.x-C*r.vx-g*eAs.z)*h;r.x+=r.vx*h;
      }
      r.z=Math.max(-.8,Math.min(.8,r.z));r.x=Math.max(-.8,Math.min(.8,r.x));
      r.sw.rotation.set(r.bx+r.x,0,-r.s*r.out+r.z);
    });
    // name plate pendulum: lags behind acceleration (forward accel swings it back, sideways accel swings it sideways)
    const K=55,Ct=3.2,gt=K*.012;
    for(let i=0;i<n;i++){
      tagS.vx+=(-K*tagS.x-Ct*tagS.vx+gt*eAs.z)*h;tagS.x+=tagS.vx*h;
      tagS.vz+=(-K*tagS.z-Ct*tagS.vz-gt*eAs.x)*h;tagS.z+=tagS.vz*h;
    }
    tagS.x=Math.max(-1,Math.min(.3,tagS.x));tagS.z=Math.max(-.9,Math.min(.9,tagS.z));  // can't swing into the chest
    tag.rotation.set(tagS.x,0,tagS.z);
  };

  U.update=(dt,mv,rel=1)=>{
    time+=dt;const rolling=tumT>=0,slashing=slashT>=0;
    // ---- air state: airW eases 0 -> 1 while off the ground, vN = vertical speed (+ rising, - falling), dW = air dash pose weight
    airW+=((airH>.04?1:0)-airW)*ease(dt,airH>.04?22:16);const vN=Math.max(-1.4,Math.min(1.2,airV/7.8));jumpS=Math.max(0,jumpS-dt*4.5);
    let dW=0;if(dashT>=0){dashT+=dt;const u=Math.min(1,dashT/.3);dW=sm(0,.14,u)*(1-sm(.72,1,u));if(dashT>=.3)dashT=-1}
    if(shM){shM.position.y=shY-airH;shM.scale.copy(shS).multiplyScalar(1-.3*Math.min(1,airH/1.6))}
    amp+=((mv&&!rolling?1:0)-amp)*ease(dt,mv?9:7);
    walk+=dt*(6+9*amp)*amp*(rel<-.2?-1:1)*(dual?1+.25*gW:1);
    if(wasMv&&!mv)stop=1;if(mv)stop=0;wasMv=mv;stop=Math.max(0,stop-dt*1.7);
    rvel+=(-170*rv-13*rvel)*dt;rv+=rvel*dt;
    fireW=Math.max(0,fireW-dt*2.2);swapT=Math.max(0,swapT-dt*3);landSq=Math.max(0,landSq-dt*5);
    aimW+=(((scopeOn&&isGun&&!rolling&&!slashing)?1:0)-aimW)*ease(dt,12);
    aimP+=(aimPT-aimP)*ease(dt,16);hTrk+=((aimOn&&!rolling?1:0)-hTrk)*ease(dt,8);
    rdy+=(((aimOn&&isGun&&!rolling&&!slashing)?1:0)-rdy)*ease(dt,10);   // gun stays raised and pointed at the crosshair
    const pW=isGun?Math.max(aimW,Math.min(1,fireW*3),rdy):0,aW=isGun?Math.max(aimW,rdy*.8):0;
    gW+=(((aimOn&&!rolling)?1:0)-gW)*ease(dt,10);   // melee guard poses only while playing (arms rest in the maker / menus)
    supW+=(((twoH&&!rolling)?(isGun?rdy:gW):0)-supW)*ease(dt,12);   // support hand on the foregrip / shaft
    const nj=dual?amp*gW:0,dLean=dual?gW*(DUAL.lean+DUAL.runLean*amp):0,dStance=dual?gW*(1-amp):0;   // ninja-run blend, forward lean, standing-stance blend
    const sw=Math.sin(walk),cs=Math.cos(walk),sk=stop*stop,wob=Math.sin((1-stop)*Math.PI*3)*sk,br=Math.sin(time*2.2);
    const lean=.2*amp-.1*sk+wob*.08,ph=s=>s<0?-sw:sw;

    const st=.95+.4*nj;legL.rotation.x=sw*st*amp+sk*.4;legR.rotation.x=-sw*st*amp-sk*.3;legL.rotation.z=dual?-DUAL.splay*gW*(1-amp*.4):0;legR.rotation.z=dual?DUAL.splay*gW*(1-amp*.4):0;
    legL.position.y=LY+Math.max(0,cs)*.14*amp;legR.position.y=LY+Math.max(0,-cs)*.14*amp;
    if(airW>.001){const r=sm(-.25,.9,vN);   // rising: knees tucked up; falling: legs reach down for the ground
      legL.rotation.x=lerp(legL.rotation.x,lerp(-.15,-1.15,r),airW);legR.rotation.x=lerp(legR.rotation.x,lerp(.25,-.65,r),airW);
      legL.position.y=lerp(legL.position.y,LY+.1*r,airW);legR.position.y=lerp(legR.position.y,LY+.14*r,airW)}
    if(dW>0){legL.rotation.x=lerp(legL.rotation.x,.85,dW);legR.rotation.x=lerp(legR.rotation.x,.6,dW)}   // air dash: legs trail behind

    const tilt=.24+amp*.06+br*.015;
    let wX=ph(WS)*.35*amp-br*.015-swapT*.5,wZ=WS*tilt,oX=ph(-WS)*.9*amp+br*.02,oZ=-WS*(tilt+.04);
    wX=lerp(wX,-1.45,pW)-rv*.55;wZ=lerp(wZ,-WS*.1,pW);
    oX=lerp(oX,-1.15,aW)-rv*.22-aimP*aW;oZ=lerp(oZ,WS*.55,aW);
    // handling poses for the melee types
    if(dual){ // wide stance: arms spread so the blades stay clear of the body and visible; running: ninja style, arms swept back with the blades trailing
      const sx=lerp(DUAL.wX,DUAL.runX+ph(WS)*.12,amp),sz=lerp(DUAL.wZ,DUAL.runZ,amp),ox=lerp(DUAL.oX,DUAL.runX+ph(-WS)*.12,amp),oz=lerp(DUAL.oZ,DUAL.runZ*.9,amp);
      wX=lerp(wX,sx,gW);wZ=lerp(wZ,WS*sz,gW);oX=lerp(oX,ox,gW);oZ=lerp(oZ,-WS*oz,gW)}
    else if(spear){wX=lerp(wX,-1.0+ph(WS)*.1*amp,gW);wZ=lerp(wZ,-WS*.12,gW);oX=lerp(oX,-1.0,gW);oZ=lerp(oZ,WS*.2,gW)}
    if(airW>.001){const fa=airW*(1-pW)*(dual||spear?.35:1);   // in the air the arms fly up and out (guns keep their aim, blades keep most of their guard)
      wX=lerp(wX,-1.75+vN*.15,fa);wZ=lerp(wZ,WS*.75,fa);oX=lerp(oX,-1.75+vN*.15,fa*(1-aW));oZ=lerp(oZ,-WS*.75,fa)}
    if(dW>0){wX=lerp(wX,.9,dW*.9);oX=lerp(oX,.9,dW*.9);wZ=lerp(wZ,WS*.25,dW);oZ=lerp(oZ,-WS*.25,dW)}   // air dash: arms swept back
    let swr=dual?lerp(-.85,lerp(DUAL.blade,DUAL.runBlade,amp),gW):spear?0:-.75,swr2=dual?lerp(-.85,lerp(DUAL.blade2,DUAL.runBlade,amp),gW):-.85,twist=0,fwd=0;spearOff=0;
    let swA=false,swB=false,lunge=0,lungeSide=1,jmp=0;
    if(slashing){
      const SD=slashD;slashT+=dt;const t=slashT/SD,wind=sm(0,.28,t),swing=e3(rg(.26,.46,t)),over=sm(.46,.56,t)*(1-sm(.56,.72,t)),rec=sm(.62,1,t),d=combo?1:-1;
      // ONE swing for every melee (sword, spear, dual blades with alternating hands): wind-up, a fast eased cut with overshoot, then settle
      const useO=dual&&combo===1,dd=dual?(useO?1:-1):d,bx=useO?oX:wX,bz=useO?oZ:wZ,env=wind*(1-rec),bz2=dual?lerp(bz,dd*.3,env):bz,bx2=dual?lerp(bx,-.85,env):bx;     // dual (the wide stance is eased toward a normal guard while swinging, so the raise + cut read like the sword): outward = away from the body, so each hand winds up outward and cuts across the front
      let ax=lerp(bx2,-2.75,wind);ax=lerp(ax,-.25,swing);ax=lerp(ax,-.05,over*.5);ax=lerp(ax,bx,rec);
      let az=bz2+dd*(.75*wind-1.6*swing-.12*over);az=lerp(az,bz,rec);
      const base=useO?swr2:swr;let sr=lerp(base,0,wind);sr=lerp(sr,-.25,swing);sr=lerp(sr,base,rec);
      if(useO){oX=ax;oZ=az;swr2=sr}else{wX=ax;wZ=az;swr=sr;if(!dual)oX=lerp(oX,.5,wind*(1-rec))}
      if(dual){const k2=1-rec,oi=-dd;if(useO){wX+=.55*wind*k2;wZ-=oi*.5*swing*k2}else{oX+=.55*wind*k2;oZ-=oi*.5*swing*k2}}   // the free hand counter-swings (pulls back + in) like the sword's off-hand
      twist=dd*(wind*.4-swing*.95+over*.1)*(1-rec);fwd=swing*(1-rec)*.3-wind*(1-swing)*.12;     // lean back in the wind-up, lunge into the cut
      lunge=swing*(1-rec)-wind*(1-swing)*.35;lungeSide=dd;
      if(t>(dual?.33:.38)&&!hitDone){hitDone=true;if(U.onSlashHit)U.onSlashHit(dd)}
      swA=t>.2&&t<.74&&!useO;swB=t>.2&&t<.74&&useO;
      if(t>=1)slashT=-1;
    }
    if(lunge!==0&&!rolling){const f=Math.max(-.3,lunge);legR.rotation.x-=f*(lungeSide>0?.55:.25);legL.rotation.x-=f*(lungeSide>0?.25:.55)}   // step into the cut
    wg.rotation.x=isGun?lerp(-.55,0,pW)+rv*.15:swr;wg2.rotation.x=swr2;wg.position.y=spearOff;
    wArm.rotation.x=wX;wArm.rotation.z=wZ;oArm.rotation.x=oX;oArm.rotation.z=oZ;

    let rx=lean+fwd-rv*.14+aimW*.05-aimP*.12*Math.max(pW,hTrk*.5)+wLean*pW+dLean,rz=-U.move.s*.1*amp-dStance*.1,ry=twist+sw*.08*amp+dStance*DUAL.twist,tuck=0,rollA=0;
    rx+=airW*(-vN)*.22;   // nose up while rising, nose down while falling
    if(dW>0){if(Math.abs(dashF)>=Math.abs(dashS))rx+=(dashF>=0?1:-1)*dW*1.0;else rz+=(dashS>=0?1:-1)*dW*1.0}   // air dash: the body dives in the dash direction
    if(rolling){
      tumT+=dt;const u=Math.min(1,tumT/TUMBLE_D),e=u*u*(3-2*u);rollA=e*Math.PI*2;
      const fw=Math.abs(tumF)>=Math.abs(tumS);
      if(fw)rx=(tumF>=0?1:-1)*rollA;else rz=(tumS>=0?1:-1)*rollA;
      tuck=sm(0,.18,u)*(1-sm(.78,1,u));
      legL.rotation.x=legR.rotation.x=-1.25*tuck;oArm.rotation.x=wArm.rotation.x=-.95*tuck;
      oArm.rotation.z=-WS*.45*tuck;wArm.rotation.z=WS*.45*tuck;
      if(tumT>=TUMBLE_D){tumT=-1;landSq=1}
    }
    const hop=rolling?Math.sin(Math.min(1,tumT/TUMBLE_D)*Math.PI)*.1:0;
    eul.set(rx,ry,rz,'XYZ');
    if(isGun&&pW>.01&&!rolling){ // gun arm aims exactly along the crosshair line (barrel follows the look angle)
      qCat.setFromEuler(eul).invert();aimD.set(0,Math.sin(aimP),Math.cos(aimP)).applyQuaternion(qCat);aimU.set(0,1,0).applyQuaternion(qCat);
      aimU.addScaledVector(aimD,-aimU.dot(aimD)).normalize();aY.copy(aimD).negate();aZ.copy(aimU);aX.crossVectors(aY,aZ);
      qAim.setFromRotationMatrix(mA.makeBasis(aX,aY,aZ));wArm.quaternion.slerp(qAim,pW);
      qKick.setFromAxisAngle(AXX,-rv*.55);wArm.quaternion.multiply(qKick);
    }
    if(supW>.01&&!rolling&&foreP){ // support hand reaches the foregrip / spear shaft (arm stretches a little if needed)
      wArm.updateMatrix();hand.updateMatrix();wg.updateMatrix();
      supM.copy(wArm.matrix).multiply(hand.matrix).multiply(wg.matrix);
      supV.copy(foreP).applyMatrix4(supM).sub(oArm.position);const len=supV.length()||1;supV.divideScalar(len);
      supQ.setFromUnitVectors(DOWN,supV);oArm.quaternion.slerp(supQ,supW);
      oArm.scale.y=lerp(1,Math.max(.75,Math.min(1.8,len/reachO)),supW);
    }else oArm.scale.y=1;
    cat.rotation.copy(eul);pv.copy(pivot).applyEuler(eul);
    cat.position.set(0,FY+Math.abs(cs)*.1*amp*(1-airW)+br*.012*(1-amp)+(pivot.y-pv.y)+hop+jmp-landSq*.05-(dual?gW*(DUAL.crouch-.03*amp):0),(pivot.z-pv.z)-rv*.1);
    const sq=1-.16*tuck-.1*landSq;
    const stY=1+.16*jumpS+.05*airW*Math.abs(vN),stX=1-.07*jumpS-.025*airW*Math.abs(vN);   // stretch on takeoff and when falling fast
    cat.scale.set(S*stX*(1+.07*sk+.1*tuck+.08*landSq),S*stY*(sq-.1*sk-Math.abs(cs)*.025*amp+br*.01*(1-amp)),S*stX*(1+.07*sk+.1*tuck+.08*landSq));
    body.scale.set(bs.x*(1+rv*.06),bs.y*(1-rv*.05),bs.z*(1+rv*.06));body.rotation.z=sw*.06*amp;
    head.rotation.x=-lean*.8+sk*.12+rv*.2+aimW*.12+tuck*.5-fwd*.4-aimP*.85*hTrk-dLean*.85;   // head looks where the crosshair points
    head.rotation.y=Math.sin(time*.6)*.18*(1-amp)*(1-sk)*(1-pW)-twist*.5-dStance*.2;
    head.rotation.z=Math.sin(time*.8)*.04+sw*.05*amp;
    ears.forEach((e,i)=>e.rotation.x=-amp*.35+sk*.35-rv*.5+airW*(-vN)*.4+Math.sin(time*3+i*2)*.03);
    tail.rotation.x=-.55*amp-.35*nj+sk*.45+rv*.6+airW*(.3-.35*vN);tail.rotation.y=Math.sin(time*(2.5+6*amp))*(.3+.15*amp)+wob*.7;
    bt-=dt;if(bt<=0){bl=.15;bt=2+Math.random()*2.5}bl=Math.max(0,bl-dt);eyes.forEach(e=>e.scale.y=bl>0?.1:(1+rv*.06));
    ropes.forEach(r=>r.step(dt));if(cloth){cloth.step(dt);lining.step(dt);if(leaves)leaves.lv.place(leaves.P)}tf.update();earMods.forEach(f=>f());
    earPhysics(dt);belt.step(dt);belt.anchor(tag.position);if(hood)hood.step(dt);
    trA.update(dt,swA);trB.update(dt,swB);
  };
  catGroup.updateMatrixWorld(true);bindCoat(cat,coatMeshes);
  return catGroup;
}