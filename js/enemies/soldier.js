// Cat soldiers: same rig style as the player's cat (run / idle / sneak animations, rope tail, cloth cloak),
// dressed in a camouflage hood + cloak. Colours, camo palette, cloak length, hood tufts, face mask,
// ear shape and weapon are randomised per enemy.
import * as T from 'three';
import {LUMP2,G,mat,BM,M,lumpy,shadow,mix} from '../blocks.js';
import {Rope,Cloth} from '../physics.js';
import {createHood} from '../hood.js';
import {makeCoat,bindCoat} from '../coatShader.js';
import {buildEar} from '../wearables.js';
import {dressSoldier} from '../foliage.js';

const rnd=(a,b)=>a+Math.random()*(b-a),pick=a=>a[(Math.random()*a.length)|0],lerp=(a,b,t)=>a+(b-a)*t;
const sm=(a,b,x)=>{const t=Math.min(1,Math.max(0,(x-a)/(b-a)));return t*t*(3-2*t)};
const ease=(dt,k)=>1-Math.exp(-dt*k);
const gold=c=>new T.MeshStandardMaterial({color:c,roughness:.4,metalness:.25});

// 4 tones per palette: base, blotch, dark blotch, speckle
export const PALETTES={
  forest:['#4a6a30','#6f8f45','#2b3d22','#8aa65a'],
  jungle:['#2f5a3a','#4f8a52','#1c3326','#7ab06a'],
  desert:['#b89b62','#d4bd85','#8e7444','#6b5733'],
  snow:['#e8eef2','#b9c4cc','#8d99a3','#ffffff'],
  autumn:['#7a5530','#a8742f','#4f5a2a','#b9652a'],
  urban:['#4a4d55','#6a707c','#262930','#8a909c'],
  night:['#2f2f55','#44447a','#171730','#5a5a90']
};
const FURS=['#f6dfbd','#ee9a48','#9aa3b5','#3b3a45','#d9b48a','#7a4a2b','#c7b4f0','#2a2a35'];
const EYEC=['#ff4d3d','#ffb300','#ff7a3c','#e6ff3a','#ff2a7a'];
const jit=(c,a=.08)=>mix(c,pick(['#000000','#ffffff']),rnd(0,a));

// ---- procedural camouflage (object-space blotches, anti-aliased, no textures) ----
const CAMO=/* glsl */`
varying vec3 vCamoP;uniform vec3 uC0;uniform vec3 uC1;uniform vec3 uC2;uniform vec3 uC3;uniform float uSeed;uniform float uSc;
float h31(vec3 p){p=fract(p*.3183099+.1);p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
float vn(vec3 x){vec3 i=floor(x),f=fract(x);f=f*f*(3.-2.*f);
  return mix(mix(mix(h31(i),h31(i+vec3(1.,0.,0.)),f.x),mix(h31(i+vec3(0.,1.,0.)),h31(i+vec3(1.,1.,0.)),f.x),f.y),
             mix(mix(h31(i+vec3(0.,0.,1.)),h31(i+vec3(1.,0.,1.)),f.x),mix(h31(i+vec3(0.,1.,1.)),h31(i+vec3(1.,1.,1.)),f.x),f.y),f.z);}
float edg(float v){float w=clamp(fwidth(v)*1.2,.002,.06);return smoothstep(-w,w,v);}
vec3 camoColor(){vec3 p=vCamoP*uSc+vec3(uSeed,uSeed*.7,uSeed*1.3);
  vec3 c=uC0;c=mix(c,uC1,edg(vn(p)-.5));c=mix(c,uC2,edg(vn(p*1.9+7.3)-.56));c=mix(c,uC3,edg(vn(p*3.3+2.1)-.72));return c;}
`;
function camoMat(pal,seed,scale,dark=0,double=false){
  const col=i=>new T.Color(dark?mix(pal[i],'#0a0a10',dark):pal[i]);
  const u={uC0:{value:col(0)},uC1:{value:col(1)},uC2:{value:col(2)},uC3:{value:col(3)},uSeed:{value:seed},uSc:{value:scale}};
  const m=new T.MeshStandardMaterial({color:'#ffffff',roughness:.95,side:double?T.DoubleSide:T.FrontSide});
  m.onBeforeCompile=sh=>{Object.assign(sh.uniforms,u);
    sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vCamoP;').replace('#include <begin_vertex>','#include <begin_vertex>\nvCamoP=position;');
    sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\n'+CAMO).replace('#include <color_fragment>','#include <color_fragment>\ndiffuseColor.rgb=camoColor();')};
  m.customProgramCacheKey=()=>'camo-v1';
  return m;
}

function torsoGeo(){
  const g=new T.SphereGeometry(1,24,18),p=g.attributes.position,sp=(v,e)=>Math.sign(v)*Math.pow(Math.abs(v),e),E1=2.7,E2=2.4;
  for(let i=0;i<p.count;i++){
    const x=p.getX(i),y=p.getY(i),z=p.getZ(i),phi=Math.asin(Math.max(-1,Math.min(1,y))),th=Math.atan2(z,x);
    const cp=sp(Math.cos(phi),2/E1),sy=sp(Math.sin(phi),2/E1),t=(sy+1)/2,w=1-.26*sm(.1,1,t);
    p.setXYZ(i,cp*sp(Math.cos(th),2/E2)*w,sy,cp*sp(Math.sin(th),2/E2)*w*(cp*sp(Math.sin(th),2/E2)>0?1+.06*(1-t):1));
  }
  g.computeVertexNormals();return g;
}

// weapon held in the hand, built along -Y like the player's blaster. returns {grp, tip}
// Procedural blade: extruded outline with a smooth curved edge and a saw-toothed spine (like the reference)
function bladeGeo(L,w,teeth,bend){
  const sh=new T.Shape(),N=Math.max(2,teeth*2),hw=t=>w*(1-Math.pow(t,2.4))+.008,bx=t=>bend*t*t;
  for(let i=0;i<=12;i++){const t=i/12,x=bx(t)-hw(t),y=-t*L;i?sh.lineTo(x,y):sh.moveTo(x,y)}
  sh.lineTo(bx(1),-L);
  for(let k=N;k>=0;k--){const t=k/N,notch=(teeth&&k%2?w*.32:0)*(1-t*.6);sh.lineTo(bx(t)+hw(t)+notch,-t*L)}
  const g=new T.ExtrudeGeometry(sh,{depth:.035,bevelEnabled:true,bevelSize:.008,bevelThickness:.008,bevelSegments:1,steps:1});
  g.translate(0,0,-.0175);g.rotateY(Math.PI/2);g.computeVertexNormals();return g;
}
const BLADES={sabre:[1.25,.1,7,.14],dagger:[.62,.075,4,.05],cleaver:[.9,.17,5,.08]};
function buildWeapon(kind,trimC='#c9a24a'){
  const grp=new T.Group(),tip=new T.Object3D(),steel=mat('#9aa3b5',.3),dk=mat('#3a3f50',.5),wood=mat('#8a5a2b',.85),gm=gold(trimC);grp.add(tip);
  switch(kind){
    case 'sabre':case 'dagger':case 'cleaver':{const [L,w,teeth,bend]=BLADES[kind],off=.26;
      M(G.cyl,mat('#22202a',.8),[.045,.26,.045],[0,-.1,0],grp);                       // grip
      M(G.sph,gm,[.06,.06,.06],[0,.05,0],grp);                                          // pommel
      const guard=new T.Mesh(new T.BoxGeometry(.05,.05,.34),gm);guard.position.y=-.25;grp.add(guard);
      [-1,1].forEach(s=>{const e=new T.Mesh(new T.SphereGeometry(.035,8,6),gm);e.position.set(0,-.25,s*.17);grp.add(e)});
      const bl=new T.Mesh(bladeGeo(L,w,teeth,bend),steel);bl.position.y=-off;grp.add(bl);
      const fu=new T.Mesh(bladeGeo(L*.8,w*.3,0,bend*.8),mat('#5b6272',.5));fu.position.set(0,-off-.02,0);fu.scale.set(1.4,1,.6);grp.add(fu);
      break}
    case 'rifle':M(G.box,dk,[.13,.5,.15],[0,-.25,0],grp);M(G.box,wood,[.12,.32,.2],[0,.05,-.04],grp);M(G.box,mat('#8e949f',.4),[.06,.7,.06],[0,-.85,0],grp);M(G.box,dk,[.07,.22,.07],[0,-.45,.1],grp);tip.position.set(0,-1.22,0);break;
    case 'smg':M(G.box,mat('#8e949f',.4),[.14,.62,.16],[0,-.3,0],grp);M(G.box,dk,[.1,.28,.1],[0,-.28,-.16],grp);M(G.box,dk,[.13,.2,.3],[0,-.05,-.15],grp);tip.position.set(0,-.72,0);break;
    default:M(G.box,mat('#8e949f',.4),[.14,.62,.16],[0,-.3,0],grp);M(G.box,dk,[.13,.2,.3],[0,-.05,-.15],grp);M(G.box,mat('#2a2f3d',.5),[.06,.05,.1],[0,-.62,0],grp);tip.position.set(0,-.72,0);
  }
  return {grp,tip};
}

const LF_LONG=1.5,LF_SHORT=.85;
export function buildSoldier(kind){
  const melee=kind==='melee';
  const palName=pick(Object.keys(PALETTES)),pal=PALETTES[palName].map(c=>jit(c));
  const fur=pick(FURS),pat=jit(pick(FURS.filter(c=>c!==fur))),eyeC=pick(EYEC),seed=rnd(0,60);
  const pattern=pick(['classic','solid','tabby','tuxedo','calico','spots','points','patches']),faceT=pick(['cat','dog','bunny']),hooded=Math.random()<.5;   // half of the soldiers wear a hood, the rest go bare-headed   // every soldier: own coat pattern + muzzle type
  const longCloak=Math.random()<.5,earT=faceT==='dog'?pick(['lop','folded','bear']):faceT==='bunny'?pick(['bunny','lop']):pick(['pointy','round','tufted','bat']),trimC=pick(['#c9a24a','#c9a24a','#c0c6d0','#c0392b']);
  const wKind=melee?pick(['sabre','sabre','dagger','cleaver']):pick(['pistol','rifle','smg']);

  const g=new T.Group(),cat=new T.Group(),head=new T.Group(),S=.45,LY=-1.52,FY=.96;
  cat.scale.setScalar(S);cat.position.y=FY;g.add(cat);cat.add(head);const shd=shadow(g,.6);
  const furM=mat(fur),patM=mat(pat),pink=mat('#ff9db8');
  const tunic=camoMat(pal,seed+3,2.4,.35),pants=camoMat(pal,seed+9,3,.5);

  // body / head
  const tg=torsoGeo(),body=M(tg,tunic,[.56,.62,.5],[0,-1.1,0],cat);const bs=body.scale.clone();
  const headM=new T.Mesh(lumpy(new T.SphereGeometry(1,48,36),.03,0),makeCoat({fur,pat,pattern},0));headM.scale.set(1.0,.78,.85);head.add(headM);   // real coat pattern, same shader as the player
  const BODY=m=>[[[0,-.95,0],[.5+m,.42+m,.44+m]],[[0,-1.35,0],[.62+m,.42+m,.54+m]]],LEGSC=m=>[-1,1].map(s=>[[s*.32,-1.73,0],[.22+m,.26+m,.24+m]]),HEADC=m=>[[[0,0,0],[1+m,.78+m,.85+m]]];
  const eyes=[-1,1].map(s=>{const e=new T.Group();e.position.set(s*.42,-.02,.72);e.rotation.y=s*.25;head.add(e);
    M(G.sph,BM('#150d0a'),[.14,.18,.09],null,e);M(G.sph,BM(eyeC),[.085,.12,.095],[0,0,.012],e);M(G.sph,BM('#150d0a'),[.02,.1,.1],[0,0,.02],e);
    M(G.box,BM('#2a1a14'),[.22,.045,.05],[0,.2,.08],e).rotation.z=s*.38;return e});
  // muzzle by species: cat = small nose + whiskers, dog = long snout + big glossy nose, bunny = puffy cheeks + split lip + buck teeth
  const ink=BM('#2a1a14'),arc=(r,x,y,z)=>{const m=new T.Mesh(new T.TorusGeometry(r,.018,6,16,Math.PI),ink);m.rotation.z=Math.PI;m.position.set(x,y,z);head.add(m)};
  if(faceT==='cat'){
    M(LUMP2,mat('#d98a8a'),[.09,.065,.06],[0,-.14,.84],head);[-1,1].forEach(s=>{arc(.1,s*.1,-.28,.79);
      [-1,0,1].forEach(i=>{const w=M(G.box,BM('#efe6d6'),[.55,.012,.012],[s*.78,-.16+i*.07,.55],head);w.rotation.z=s*i*.14;w.rotation.y=-s*.35})});
  }else if(faceT==='dog'){
    M(LUMP2,mat(mix(fur,'#ffffff',.55)),[.36,.26,.36],[0,-.2,.82],head);
    M(LUMP2,mat('#101018',.25),[.17,.12,.1],[0,-.08,1.13],head);M(G.box,ink,[.018,.12,.018],[0,-.24,1.14],head);
    [-1,1].forEach(s=>{arc(.12,s*.12,-.34,1.1);[0,1,2].forEach(i=>M(G.sph,ink,[.014,.014,.014],[s*(.16+i*.04),-.2+i*.04,1.12],head))});
  }else{
    const cm=mat(mix(fur,'#ffffff',.5));[-1,1].forEach(s=>{M(LUMP2,cm,[.17,.14,.15],[s*.1,-.25,.87],head);arc(.07,s*.07,-.3,1.0);M(G.box,BM('#ffffff'),[.07,.11,.03],[s*.042,-.36,1.0],head)});
    M(LUMP2,mat('#ff8fb0'),[.075,.055,.055],[0,-.13,1.0],head);M(G.box,ink,[.014,.1,.014],[0,-.22,1.0],head);
  }

  // ears poke out of the hood
  const ears=[];
  [-1,1].forEach(s=>{const e=new T.Group();e.position.set(s*.56,.5,.02);e.rotation.z=-s*.5;head.add(e);const sw=new T.Group();e.add(sw);
    const info=buildEar(earT,sw,furM,pink);sw.rotation.set(info.bx,0,-s*info.out);
    ears.push({e,sw,s,v:0,x:0,ph:rnd(0,6),bx:info.bx,out:info.out,fl:info.fl})});

  // procedural assassin hood in camo cloth, lined darker, with trim + stitched seam
  const inner=new T.MeshStandardMaterial({color:mix(pal[2],'#000000',.6),roughness:.95});
  const hood=hooded?createHood(head,{outerM:camoMat(pal,seed,2.2,.2,false),innerM:inner,trimC,seamC:mix(pal[2],'#000000',.7),coll:[...BODY(.05),...HEADC(.04)],grav:12}):{step(){}};   // hooded soldiers: cloth hood pinned to the head. bare-headed soldiers: no hood at all

  // limbs
  const mkArm=s=>{const p=new T.Group();p.position.set(s*.47,-.76,.05);cat.add(p);
    M(LUMP2,tunic,[.13,.24,.13],[0,-.14,0],p);M(LUMP2,furM,[.1,.2,.1],[0,-.34,0],p);M(LUMP2,mat('#fff7ee'),[.11,.09,.11],[0,-.47,0],p);return p};
  const mkLeg=s=>{const p=new T.Group();p.position.set(s*.32,LY,0);cat.add(p);
    M(LUMP2,pants,[.16,.2,.16],[0,-.12,0],p);M(LUMP2,furM,[.14,.16,.14],[0,-.3,0],p);M(LUMP2,mat('#fff7ee'),[.16,.09,.21],[0,-.41,.05],p);return p};
  const armL=mkArm(-1),armR=mkArm(1),legL=mkLeg(-1),legR=mkLeg(1);
  const wArm=armR,oArm=armL;
  const hand=new T.Group();hand.position.set(0,-.4,0);wArm.add(hand);
  const W=buildWeapon(wKind,trimC);hand.add(W.grp);

  // tail (rope physics)
  const tail=new T.Group();tail.position.set(0,LY,-.5);cat.add(tail);
  const cv=new T.CatmullRomCurve3([[0,0,0],[0,.05,-.45],[0,.45,-.85],[0,1,-.9],[0,1.35,-.55]].map(a=>new T.Vector3(...a)));
  const tr=new Rope(tail,cv.getPoints(9),{radius:.17,taper:.35,nR:5,ref:[1,0,0],stiff:.09,soft:.75,damp:.955,grav:20,color:t=>t>.8?pat:fur});

  // camouflage cloak: same Cloth physics as the player's cloak (top row pinned), camo material
  const cols=9,rows=5,Hh=longCloak?LF_LONG:LF_SHORT,LF=Array.from({length:cols},()=>rnd(.6,1));
  const rest=[];for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){const a=(c/(cols-1)-.5)*Math.PI*.95,k=r/(rows-1),rad=.76+k*.38;
    rest.push(new T.Vector3(Math.sin(a)*rad,-.76-k*Hh*(r===rows-1?LF[c]:1),-Math.cos(a)*rad*.85-k*.05))}
  const cloth=new Cloth(cat,rest,cols,rows,{grav:15,stiff:.012,coll:[...BODY(.04),...LEGSC(.03)]});
  cloth.mesh.material=camoMat(pal,seed+1,2.2,0,true);

  // ---- battle damage: branches + leaves woven into the clothes (procedural meshes), torn holes, ragged strips
  const deco=dressSoldier({hooded,pal,seed,cat,head,tg,bodyPos:body.position,bodyScale:body.scale,cloth,cols,rows,shredMat:camoMat(pal,seed+5,3,.3,true)});

  // ---------------- animation ----------------
  const eul=new T.Euler(),pv=new T.Vector3(),pivot=new T.Vector3(0,-1.0*S,0);
  let time=rnd(0,10),walk=0,amp=0,crouch=0,aimW=0,rv=0,rvel=0,bl=0,bt=rnd(1,3),lastX=0,lastZ=0,acc=0,lodAcc=0,lodN=0;
  const U=g.userData;U.hooded=hooded;U.col=pal[1];U.kind=kind;U.weapon=wKind;
  U.kick=()=>{rvel+=15};
  U.muzzle=v=>W.tip.getWorldPosition(v||new T.Vector3());
  // o: {mv, pose:'idle'|'walk'|'run'|'sneak'|'wind'|'strike'|'rest'|'dodge'|'crouch'|'air'|'land', pt:0..1, aim:bool, dir:±1, lod:0|1|2, jy:height above ground}
  U.update=(dt,o={})=>{
    time+=dt;shd.position.y=.035-(o.jy||0);shd.scale.setScalar(1/(1+(o.jy||0)*.35));const pose=o.pose||'idle',pt=o.pt||0,run=pose==='run',sneak=pose==='sneak';
    amp+=((o.mv?1:0)-amp)*ease(dt,9);
    walk+=dt*(run?15:sneak?5.5:8)*amp;
    rvel+=(-170*rv-13*rvel)*dt;rv+=rvel*dt;
    const sw=Math.sin(walk),cs=Math.cos(walk),br=Math.sin(time*(pose==='rest'?13:2.2));
    crouch+=(((sneak?.32:0)+(pose==='rest'?.18:0)+(pose==='wind'?.1:0)+(pose==='crouch'?.2+.5*sm(0,1,pt):0)+(pose==='land'?.7*(1-sm(0,1,pt)):0))-crouch)*ease(dt,8);
    aimW+=((o.aim?1:0)-aimW)*ease(dt,12);
    const A=run?1.05:sneak?.5:.7;
    legL.rotation.x=sw*A*amp+crouch*.7;legR.rotation.x=-sw*A*amp+crouch*.7;
    legL.scale.y=legR.scale.y=1-crouch*.45;
    legL.position.y=LY+Math.max(0,cs)*.13*amp;legR.position.y=LY+Math.max(0,-cs)*.13*amp;

    let lean=(run?.28:sneak?.22:.08)*amp+(pose==='rest'?.32:0),rx=lean,ry=0,rz=0,hop=0,swing=0;
    // arms: weapon arm = wArm
    let wX=-sw*.55*amp-br*.012-.25,wZ=.24,oX=sw*.8*amp+br*.02,oZ=-.28;
    if(run&&melee){wX=-sw*.9-.5;oX=sw*1.1}
    wX=lerp(wX,-1.45,aimW)-rv*.5;wZ=lerp(wZ,-.1,aimW);oX=lerp(oX,-1.15,aimW);oZ=lerp(oZ,.55,aimW);
    if(pose==='wind'){const u=sm(0,1,pt);wX=lerp(wX,-2.8,u);wZ=lerp(wZ,-.15,u);oX=lerp(oX,.4,u);rx=lean-.12*u;ry=.25*u}
    else if(pose==='strike'){const u=sm(0,.7,pt);wX=lerp(-2.8,-.25,u);wZ=-.15;oX=.5-u*.4;rx=lerp(-.1,.45,u);ry=lerp(.25,-.4,u);swing=u}
    else if(pose==='rest'){wX=.15+br*.03;oX=.1-br*.03;wZ=.3;oZ=-.3}
    else if(pose==='crouch'){const u=sm(0,1,pt);wX=lerp(wX,.9,u);wZ=.3;oX=lerp(oX,.7,u);rx=lean+.35*u;legL.rotation.x=legR.rotation.x=.8*u}      // coil: arms swing back, knees bend
    else if(pose==='air'){const u=sm(0,.25,pt);wX=lerp(.9,-2.9,u);wZ=-.15;oX=lerp(.7,-2.3,u);oZ=-.5;rx=lerp(.4,-.2,pt);legL.rotation.x=-.9;legR.rotation.x=-.5}   // weapon overhead, legs tucked
    else if(pose==='land'){const u=sm(0,.35,pt);wX=lerp(-2.9,.25,u);wZ=.2;oX=lerp(-2.3,.4,u);rx=lerp(.5,.1,pt)}                                      // slam down
    if(pose==='dodge'){const e=sm(0,1,pt),d=o.dir||1;rz=-d*e*Math.PI*2;const tk=sm(0,.18,pt)*(1-sm(.78,1,pt));
      legL.rotation.x=legR.rotation.x=-1.2*tk;wX=oX=-.9*tk;hop=Math.sin(pt*Math.PI)*.1}
    wArm.rotation.set(wX,0,wZ);oArm.rotation.set(oX,0,oZ);
    hand.rotation.x=0;

    eul.set(rx-rv*.12,ry,rz,'XYZ');cat.rotation.copy(eul);pv.copy(pivot).applyEuler(eul);
    cat.position.set(0,FY-.47*crouch*S+Math.abs(cs)*.09*amp+br*.012*(1-amp)+(pivot.y-pv.y)+hop,(pivot.z-pv.z)-rv*.1);
    const breathe=pose==='rest'?.045*br:0;
    cat.scale.set(S,S*(1-crouch*.05+breathe),S);
    body.scale.set(bs.x*(1+rv*.05),bs.y*(1-rv*.04),bs.z*(1+rv*.05));
    head.rotation.set(-lean*.8+(pose==='rest'?.45:0)+aimW*.1+rv*.2,Math.sin(time*.6)*.35*(1-amp)*(1-aimW)*(pose==='idle'?1:0),Math.sin(time*.8)*.04+sw*.05*amp);
    tail.rotation.x=-.5*amp+crouch*.4+rv*.4;tail.rotation.y=Math.sin(time*(2.5+6*amp))*(.3+.15*amp);
    // ears: springy flop that reacts to speed changes
    const k=ease(dt,10);ears.forEach(r=>{const tgt=-amp*.4+Math.sin(time*3+r.ph)*.03+(pose==='rest'?.4:0);r.x+=(tgt-r.x)*k;r.sw.rotation.set(r.bx+r.x*r.fl-rvel*.01*r.fl,0,-r.s*r.out+Math.sin(time*2+r.ph)*.03*r.s)});
    bt-=dt;if(bt<=0){bl=.15;bt=2+Math.random()*2.5}bl=Math.max(0,bl-dt);eyes.forEach(e=>e.scale.y=bl>0?.1:1);
    // physics, throttled by distance (far enemies: half rate / frozen)
    deco.sway(time,amp,rvel);
    const lod=o.lod||0;if(lod===2)return;lodAcc+=dt;if(lod===1&&(lodN^=1)){return}
    const st=lodAcc;lodAcc=0;tr.step(st);cloth.step(st);hood.step(st);deco.follow();
  };
  g.updateMatrixWorld(true);bindCoat(cat,[headM]);   // pattern coordinates in rest pose
  return g;
}