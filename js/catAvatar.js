// Ming the cat: eased run/stop animation, rope-physics tail + whiskers, cloth-physics cloak, pistol arm.
import * as T from 'three';
import {lumpy,LUMP2,G,mat,BM,M,mix,shadow} from './blocks.js';
import {Rope,Cloth,VM} from './physics.js';
import {makeCoat,bindCoat,PATTERNS} from './coatShader.js';
import {createBelt} from './collar.js';
import {createHood} from './hood.js';
import {EARS,EAR_NAMES,HEADS,EYEWEAR,GEAR_COLS,buildEar,buildHeadwear,buildEyewear,cloakRest,cloakShape} from './wearables.js';
export {PATTERNS,EARS,EAR_NAMES,HEADS,EYEWEAR,GEAR_COLS};
export const COATS=[['#f6dfbd','#ee9a48'],['#ee9a48','#9a5a24'],['#fff4e6','#b9bfcc'],['#3b3a45','#fff4e6'],['#d9b48a','#5a3a28'],['#9aa3b5','#fff4e6'],['#c7b4f0','#fff4e6'],['#7a4a2b','#e8c79a'],['#ffe9a8','#ffb347'],['#e6f4ff','#7fb8e8'],['#2a2a35','#ee9a48'],['#d8f0d0','#7fcf7f']];
export const COAT_NAMES=['Ming','Ginger','Snow','Tux','Mocha','Smoke','Lilac','Cocoa','Butter','Frost','Ember','Mint'];
export const EYECS=['#4bd37b','#4aa8ff','#ffc93c','#ff6fa0','#b07aff','#ff7a3c','#7ee6d2','#ff4d6d'];
export const COLLARS=['#e63946','#4aa8ff','#ff8fc0','#58c878','#ffd54a','#b07aff']; // always worn: no "none"
export const CLOAKS=[['none','None','Off'],['short','Short','Scarf'],['long','Long','Coat']];
export const CLOAK_COLS=['#6d4cff','#e63946','#2fa8ff','#2fbf71','#ffb300','#2a2433','#ff6fa0','#8a5a3a','#ffffff','#ff7a3c','#58d6ff','#c58aff'];

function painted(geo,fn){const p=geo.attributes.position,c=new Float32Array(p.count*3),col=new T.Color(),v=new T.Vector3();
  for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i);col.set(fn(v));c.set([col.r,col.g,col.b],i*3)}geo.setAttribute('color',new T.BufferAttribute(c,3));return geo}
function tagTex(name){const c=document.createElement('canvas');c.width=c.height=64;const g=c.getContext('2d'),t=name.toUpperCase();g.fillStyle='#f2c44e';g.fillRect(0,0,64,64);
  let fs=20;g.font='800 '+fs+'px Arial';while(g.measureText(t).width>52&&fs>8){fs--;g.font='800 '+fs+'px Arial'}g.fillStyle='#8a5a14';g.textAlign='center';g.textBaseline='middle';g.fillText(t,32,34);
  const x=new T.CanvasTexture(c);x.colorSpace=T.SRGBColorSpace;return x}
const ease=(dt,k)=>1-Math.exp(-dt*k);

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

const lerp=(a,b,t)=>a+(b-a)*t,sm=(a,b,x)=>{const t=Math.min(1,Math.max(0,(x-a)/(b-a)));return t*t*(3-2*t)};

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
  const o=Object.assign({fur:COATS[0][0],pat:COATS[0][1],pattern:'classic',ears:'pointy',eyeColor:EYECS[0],collar:COLLARS[0],name:'Ming',cloak:'short',cloakC:CLOAK_COLS[0],head:'none',eyewear:'none',gearC:GEAR_COLS[0]},opt);
  if(!COLLARS.includes(o.collar))o.collar=COLLARS[0];          // the collar can no longer be removed
  if(!EARS.includes(o.ears))o.ears='pointy';
  if(!PATTERNS.some(p=>p[0]===o.pattern))o.pattern='classic';
  const catGroup=new T.Group(),cat=new T.Group(),head=new T.Group(),S=.45,LY=-1.52,FY=0.96;cat.scale.setScalar(S);cat.position.y=FY;catGroup.add(cat);cat.add(head);shadow(catGroup,.6);
  const acc=mat(o.pat),pink=mat('#ff9db8'),dark=BM('#2a1a14'),R=Math.PI/2;
  
  const coatMeshes=[];
  const CM=(geo,part,sc,pos,par)=>{const m=M(geo,makeCoat(o,part),sc,pos,par);coatMeshes.push(m);return m};
  CM(lumpy(new T.SphereGeometry(1,64,48),.03,0),0,[1.0,0.78,0.85],null,head);
  const body=CM(lumpy(createTorsoGeo(),.02,3),1,[.56,.62,.5],[0,-1.1,0],cat);

  const eyes=[-1,1].map(s=>{const g=new T.Group();g.position.set(s*.42,-.02,.72);g.rotation.y=s*.25;head.add(g);
    M(G.sph,BM('#150d0a'),[.14,.18,.09],null,g);M(G.sph,BM('#fff'),[.045,.055,.022],[.04,.06,.08],g);M(G.sph,BM(o.eyeColor),[.028,.028,.015],[-.04,-.06,.085],g);return g});
  
  M(LUMP2,mat('#3a2308'),[.12,.08,.08],[0,-.14,.84],head);
  M(G.box,dark,[.016,.07,.016],[0,-.22,.75],head);
  [-1,1].forEach(s=>{const m=new T.Mesh(new T.TorusGeometry(.1,.018,6,16,Math.PI),dark);m.rotation.z=Math.PI;m.position.set(s*.1,-.28,.72);head.add(m)});

  const ropes=[];
  [-1,1].forEach(s=>[-1,0,1].forEach(i=>{const rest=[0,1,2,3,4].map(k=>new T.Vector3(s*(.68+k*.2),-.1+i*.11+i*k*.025-k*k*.008,.5-k*.03));
    ropes.push(new Rope(head,rest,{radius:.016,taper:.6,nR:4,ref:[0,1,0],stiff:.2,soft:.5,damp:.9,grav:5,color:()=>'#2a1a14'}))}));
  
  const ears=[],earRig=[];
  [-1,1].forEach(s=>{const g=new T.Group();g.position.set(s*.56,.5,.02);g.rotation.z=-s*.5;head.add(g);
    const sw=new T.Group();g.add(sw);const em=s<0?acc:mat(o.fur);
    const info=buildEar(o.ears,sw,em,pink);ears.push(g);
    earRig.push({s,sw,k:info.k,fl:info.fl,out:info.out,bx:info.bx,x:0,vx:0,z:0,vz:0,flick:2+Math.random()*4});sw.rotation.set(info.bx,0,-s*info.out)});

  // headwear + eyewear live on the head so they follow every head movement
  const hw=o.head==='hood'?null:buildHeadwear(o.head,o.gearC);if(hw)head.add(hw);   // the hood is cloth: created below once the collision volumes exist
  const ew=buildEyewear(o.eyewear,o.gearC);if(ew)head.add(ew);

  // collision volumes (cat-local ellipsoids: centre, radii) so cloth can never sink into the player. m = margin
  const BODY=m=>[[[0,-.95,0],[.5+m,.42+m,.44+m]],[[0,-1.35,0],[.62+m,.42+m,.54+m]]];   // upper torso + pear hips
  const LEGSC=m=>[-1,1].map(s=>[[s*.32,-1.73,0],[.22+m,.26+m,.24+m]]);
  // ---- Leather belt collar (rough leather, stitches, holes, studs, buckle): static, sits wide under the head ----
  const HEADC=m=>[[[0,0,0],[1+m,.78+m,.85+m]]];
  const belt=createBelt(cat,o.collar,{outer:[...BODY(.02),...HEADC(.03)],inner:[...BODY(-.02),...HEADC(0)]});   // cloth belt, same physics as the cloak
  // cloth-physics hood in the chosen gear colour (dome pinned to the head, neck drape + curled tip free)
  const hood=o.head==='hood'?createHood(head,{outer:o.gearC,inner:mix(o.gearC,'#000000',.55),trimC:mix(o.gearC,'#ffffff',.55),seamC:mix(o.gearC,'#ffffff',.3),coll:[...BODY(.05),...HEADC(.04)]}):null;
  // name plate: hangs from the front of the collar like a pendulum and swings with movement
  const tag=new T.Group();tag.position.set(0,-1.06,.5);cat.add(tag);
  const plate=new T.Group();plate.position.y=-.13;tag.add(plate);
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
  const slashFx=new T.Mesh(new T.RingGeometry(.7,1.15,28,1,-.6,3.1),new T.MeshBasicMaterial({color:'#fff3c4',transparent:true,opacity:0,side:T.DoubleSide,depthWrite:false}));
  const slashRig=new T.Group();slashRig.position.set(0,-.7,.35);slashFx.rotation.y=-Math.PI/2;slashRig.add(slashFx);cat.add(slashRig);

  let cloth=null,lining=null;
  if(o.cloak!=='none'){
    const lg=o.cloak==='long',{cols,rows}=cloakShape(lg);
    const dmg=(base,r,c)=>{let col=mix(base,'#1a1430',.14*r/rows);
      if(r>=rows-2)col=mix(col,'#2a1a10',.38);
      if(r>=2&&r<=3&&c>=3&&c<=4)col='#b79a6b';
      if(c===7&&r>=1&&r<rows-1)col=mix(col,'#0b0612',.82);
      if(c===2&&r===rows-3)col=mix(col,'#0b0612',.7);
      if(r===rows-1)col=mix(col,'#e8dcc0',.4);
      return col};
    const P0={grav:15,stiff:.012};
    cloth=new Cloth(cat,cloakRest(lg,0,0),cols,rows,{...P0,coll:[...BODY(.04),...LEGSC(.03)],color:(r,c)=>dmg(o.cloakC,r,c)});
    lining=new Cloth(cat,cloakRest(lg,.07,.04),cols,rows,{...P0,coll:[...BODY(0),...LEGSC(0)],color:(r,c)=>r===rows-1?'#d9cdb0':mix('#120c1c',o.cloakC,.22+.1*r/rows)});
    [-4,-2,1,3].forEach((i,n)=>{const x=i*.1,rest=[0,1,2,3].map(k=>new T.Vector3(x,-.95-k*.17-(lg?.45:0),-.5-k*.03-n*.01));
      ropes.push(new Rope(cat,rest,{radius:.03,taper:.3,nR:4,ref:[1,0,0],stiff:.04,soft:.8,damp:.92,grav:14,color:()=>mix(o.cloakC,'#1a1430',.3)}))})}

  const tail=new T.Group();tail.position.set(0,LY,-.5);cat.add(tail);
  // Fixed negative Z coordinate on tail curve point [0,1,-.9]
  const cv=new T.CatmullRomCurve3([[0,0,0],[0,.05,-.45],[0,.45,-.85],[0,1,-.9],[0,1.35,-.55]].map(a=>new T.Vector3(...a)));
  const tailCol=t=>{switch(o.pattern){
    case 'solid':return o.fur;
    case 'tabby':return ((t*13+.5)|0)%3===0?o.pat:o.fur;
    case 'tuxedo':return t>.82?o.pat:o.fur;
    case 'calico':return t<.35?o.fur:t<.7?o.pat:o.fur;
    case 'spots':return ((t*20)|0)%4===0?o.pat:o.fur;
    case 'points':return t>.25?o.pat:o.fur;
    case 'patches':return t>.3&&t<.65?o.pat:o.fur;
    case 'hearts':return t>.8?o.pat:o.fur;
    default:return ((t*13+.5)|0)%5<2?'#fff7ee':o.pat}};
  const tr=new Rope(tail,cv.getPoints(13),{radius:.18,taper:.35,nR:8,ref:[1,0,0],stiff:.09,soft:.75,damp:.955,grav:20,color:tailCol});ropes.push(tr);
  const tipM=M(LUMP2,mat(tailCol(1)),[.14,.14,.14],null,tail);

  let time=0,walk=0,amp=0,stop=0,wasMv=false,bl=0,bt=2;
  let rv=0,rvel=0,fireW=0,aimW=0,scopeOn=false,wpn=1,swapT=0,aimP=0,aimPT=0,aimOn=false,rdy=0,hTrk=0,gW=0;
  let slashT=-1,combo=0,hitDone=false,tumT=-1,tumF=1,tumS=0,landSq=0;
  const TUMBLE_D=.55,bs=body.scale.clone(),pivot=new T.Vector3(0,-1.0*S,0),eul=new T.Euler(),pv=new T.Vector3();
  const U=catGroup.userData;U.move={f:0,s:0};
  U.kick=(p=1)=>{if(!isGun)return;rvel+=15*p;fireW=1};
  U.equip=def=>{
    while(wg.children.length)wg.remove(wg.children[0]);while(wg2.children.length)wg2.remove(wg2.children[0]);
    W=def;isGun=def.kind==='gun';HD=def.handling;dual=HD==='dual';spear=HD==='spear';twoH=!!def.fore;wLean=def.lean||0;
    slashD=(def.stats&&def.stats.dur)||.5;foreP=def.fore?new T.Vector3(0,-def.fore[0],def.fore[1]):null;
    const b=def.build();wg.add(b.group);tip=b.tip||new T.Object3D();if(!b.tip)wg.add(tip);if(b.off)wg2.add(b.off);
    swapT=1;slashT=-1;hitDone=false;wg.position.set(0,0,0);oArm.scale.y=1;
  };
  U.weapon=()=>W;
  U.setScope=b=>{scopeOn=!!b};
  // crosshair following: pitch = look-up angle of the crosshair (radians, + is up); on = in gameplay (gun ready, head tracks)
  U.setAim=(pitch,on)=>{aimOn=!!on;aimPT=on?Math.max(-.55,Math.min(.6,pitch)):0};
  U.slash=()=>{if(isGun||slashT>=0||tumT>=0)return false;slashT=0;hitDone=false;combo^=1;return true};
  U.tumble=(f,s)=>{if(tumT>=0)return false;tumT=0;tumF=f;tumS=s;slashT=-1;return true};
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
    amp+=((mv&&!rolling?1:0)-amp)*ease(dt,mv?9:7);
    walk+=dt*(6+9*amp)*amp*(rel<-.2?-1:1);
    if(wasMv&&!mv)stop=1;if(mv)stop=0;wasMv=mv;stop=Math.max(0,stop-dt*1.7);
    rvel+=(-170*rv-13*rvel)*dt;rv+=rvel*dt;
    fireW=Math.max(0,fireW-dt*2.2);swapT=Math.max(0,swapT-dt*3);landSq=Math.max(0,landSq-dt*5);
    aimW+=(((scopeOn&&isGun&&!rolling&&!slashing)?1:0)-aimW)*ease(dt,12);
    aimP+=(aimPT-aimP)*ease(dt,16);hTrk+=((aimOn&&!rolling?1:0)-hTrk)*ease(dt,8);
    rdy+=(((aimOn&&isGun&&!rolling&&!slashing)?1:0)-rdy)*ease(dt,10);   // gun stays raised and pointed at the crosshair
    const pW=isGun?Math.max(aimW,Math.min(1,fireW*3),rdy):0,aW=isGun?Math.max(aimW,rdy*.8):0;
    gW+=(((aimOn&&!rolling)?1:0)-gW)*ease(dt,10);   // melee guard poses only while playing (arms rest in the maker / menus)
    supW+=(((twoH&&!rolling)?(isGun?rdy:gW):0)-supW)*ease(dt,12);   // support hand on the foregrip / shaft
    const sw=Math.sin(walk),cs=Math.cos(walk),sk=stop*stop,wob=Math.sin((1-stop)*Math.PI*3)*sk,br=Math.sin(time*2.2);
    const lean=.2*amp-.1*sk+wob*.08,ph=s=>s<0?-sw:sw;

    legL.rotation.x=sw*.95*amp+sk*.4;legR.rotation.x=-sw*.95*amp-sk*.3;
    legL.position.y=LY+Math.max(0,cs)*.14*amp;legR.position.y=LY+Math.max(0,-cs)*.14*amp;

    const tilt=.24+amp*.06+br*.015;
    let wX=ph(WS)*.35*amp-br*.015-swapT*.5,wZ=WS*tilt,oX=ph(-WS)*.9*amp+br*.02,oZ=-WS*(tilt+.04);
    wX=lerp(wX,-1.45,pW)-rv*.55;wZ=lerp(wZ,-WS*.1,pW);
    oX=lerp(oX,-1.15,aW)-rv*.22-aimP*aW;oZ=lerp(oZ,WS*.55,aW);
    // handling poses for the melee types
    if(dual){wX=lerp(wX,-.85+ph(WS)*.18*amp,gW);oX=lerp(oX,-.85+ph(-WS)*.18*amp,gW);wZ=lerp(wZ,-WS*.2,gW);oZ=lerp(oZ,WS*.2,gW)}
    else if(spear){wX=lerp(wX,-1.0+ph(WS)*.1*amp,gW);wZ=lerp(wZ,-WS*.12,gW);oX=lerp(oX,-1.0,gW);oZ=lerp(oZ,WS*.2,gW)}
    let swr=dual?-.85:spear?0:-.75,swr2=-.85,twist=0,fwd=0;spearOff=0;
    if(slashing){
      slashT+=dt;const t=slashT/slashD,d=combo?1:-1,wind=sm(0,.28,t),swing=sm(.28,.48,t),rec=sm(.62,1,t);
      if(spear){ // pull back, thrust, recover
        const thr=sm(.28,.46,t),ext=thr*(1-rec),pull=wind*(1-thr);
        spearOff=pull*.3-ext*.5;fwd=ext*.3;twist=d*.12*ext;wX=lerp(wX,-1.15,wind);
        if(t>.38&&!hitDone){hitDone=true;if(U.onSlashHit)U.onSlashHit(1)}
        slashFx.material.opacity=ext*.45;slashFx.scale.setScalar(.6+ext*.35);slashRig.rotation.z=0;
      }else{ // one-hand slash, or alternating hands for dual blades
        const useO=dual&&combo===1,dd=useO?-d:d;const bx=useO?oX:wX,bz=useO?oZ:wZ;
        let ax=lerp(bx,-2.7,wind);ax=lerp(ax,-.3,swing);ax=lerp(ax,bx,rec);
        let az=bz+dd*(.7*wind-1.5*swing);az=lerp(az,bz,rec);
        let sr=lerp(-.75,0,wind);sr=lerp(sr,-.25,swing);sr=lerp(sr,-.75,rec);
        if(useO){oX=ax;oZ=az;swr2=sr;wX=lerp(wX,.4,wind*(1-rec)*.5)}else{wX=ax;wZ=az;swr=sr;if(!dual)oX=lerp(oX,.5,wind*(1-rec))}
        twist=dd*(wind*.35-swing*.8)*(1-rec);fwd=swing*(1-rec)*(dual?.15:.25);
        if(t>(dual?.34:.4)&&!hitDone){hitDone=true;if(U.onSlashHit)U.onSlashHit(dd)}
        const u=sm(.28,.62,t)*(1-sm(.62,.9,t));slashFx.material.opacity=u*.6;slashFx.scale.setScalar((dual?.65:.85)+u*.3);slashRig.rotation.z=dd*.7;
      }
      if(t>=1)slashT=-1;
    }else slashFx.material.opacity=0;
    wg.rotation.x=isGun?lerp(-.55,0,pW)+rv*.15:swr;wg2.rotation.x=swr2;wg.position.y=spearOff;
    wArm.rotation.x=wX;wArm.rotation.z=wZ;oArm.rotation.x=oX;oArm.rotation.z=oZ;

    let rx=lean+fwd-rv*.14+aimW*.05-aimP*.12*Math.max(pW,hTrk*.5)+wLean*pW,rz=-U.move.s*.1*amp,ry=twist+sw*.08*amp,tuck=0,rollA=0;
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
    cat.position.set(0,FY+Math.abs(cs)*.1*amp+br*.012*(1-amp)+(pivot.y-pv.y)+hop-landSq*.05,(pivot.z-pv.z)-rv*.1);
    const sq=1-.16*tuck-.1*landSq;
    cat.scale.set(S*(1+.07*sk+.1*tuck+.08*landSq),S*(sq-.1*sk-Math.abs(cs)*.025*amp+br*.01*(1-amp)),S*(1+.07*sk+.1*tuck+.08*landSq));
    body.scale.set(bs.x*(1+rv*.06),bs.y*(1-rv*.05),bs.z*(1+rv*.06));body.rotation.z=sw*.06*amp;
    head.rotation.x=-lean*.8+sk*.12+rv*.2+aimW*.12+tuck*.5-fwd*.4-aimP*.85*hTrk;   // head looks where the crosshair points
    head.rotation.y=Math.sin(time*.6)*.18*(1-amp)*(1-sk)*(1-pW)-twist*.5;
    head.rotation.z=Math.sin(time*.8)*.04+sw*.05*amp;
    ears.forEach((e,i)=>e.rotation.x=-amp*.35+sk*.35-rv*.5+Math.sin(time*3+i*2)*.03);
    tail.rotation.x=-.55*amp+sk*.45+rv*.6;tail.rotation.y=Math.sin(time*(2.5+6*amp))*(.3+.15*amp)+wob*.7;
    bt-=dt;if(bt<=0){bl=.15;bt=2+Math.random()*2.5}bl=Math.max(0,bl-dt);eyes.forEach(e=>e.scale.y=bl>0?.1:(1+rv*.06));
    ropes.forEach(r=>r.step(dt));if(cloth){cloth.step(dt);lining.step(dt)}tipM.position.copy(tr.lp[tr.n]);
    earPhysics(dt);belt.step(dt);if(hood)hood.step(dt);
  };
  catGroup.updateMatrixWorld(true);bindCoat(cat,coatMeshes);
  return catGroup;
}